import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import {
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'

const directories: string[] = []
const applications: ProfileApplication[] = []
const clock = () => new Date('2026-01-15T10:00:00.000Z')

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-rules-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Rules test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  applications.push(application)
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const otherAccount = application.commands.createAccount({
    name: 'Card',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const categories = application.queries
    .listCategoryOptions('expense')
    .slice(0, 3)
  const lastUsed = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-14',
    totalMinor: 2_000,
    payeeName: 'Café Central',
    categoryId: categories[0].id,
    tagNames: ['Last used', 'Rule tag'],
    note: 'Earlier',
  })
  application.commands.addPayeeAlias({
    payeeId: lastUsed.payeeId!,
    name: 'KÁVÉZÓ 0123',
  })
  const tags = application.queries.listTags()
  return {
    application,
    account,
    otherAccount,
    categories,
    payeeId: lastUsed.payeeId!,
    tags,
  }
}

afterEach(() => {
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('autofill uses first matching rule, then canonical-payee last-used values, then none', async () => {
  const { application, account, categories, payeeId, tags } = await setup()
  const ruleTag = tags.find((tag) => tag.name === 'Rule tag')!
  const first = application.commands.createCategorisationRule({
    enabled: true,
    payeeId,
    textContains: 'ARVIZTURO',
    accountId: account.id,
    minAmountMinor: 1_000,
    maxAmountMinor: 3_000,
    categoryId: categories[1].id,
    tagIds: [ruleTag.id],
  })
  const second = application.commands.createCategorisationRule({
    enabled: true,
    payeeId,
    textContains: null,
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    categoryId: categories[2].id,
    tagIds: [],
  })
  const input = {
    accountId: account.id,
    kind: 'expense' as const,
    totalMinor: 2_000,
    payeeName: 'kávéző 0123',
    note: 'Árvíztűrő lunch',
  }

  expect(application.queries.getCategorisationAutofill(input)).toEqual({
    source: 'rule',
    ruleId: first.id,
    categoryId: categories[1].id,
    tags: [ruleTag],
  })
  application.commands.reorderCategorisationRule({
    id: second.id,
    sortOrder: 0,
  })
  expect(application.queries.getCategorisationAutofill(input)).toMatchObject({
    source: 'rule',
    ruleId: second.id,
    categoryId: categories[2].id,
  })

  application.commands.deleteCategorisationRule(second.id)
  application.commands.deleteCategorisationRule(first.id)
  expect(application.queries.getCategorisationAutofill(input)).toEqual({
    source: 'lastUsed',
    ruleId: null,
    categoryId: categories[0].id,
    tags,
  })
  expect(
    application.queries.getCategorisationAutofill({
      ...input,
      payeeName: 'Never seen',
    }),
  ).toEqual({
    source: 'none',
    ruleId: null,
    categoryId: null,
    tags: [],
  })
})

test('rule CRUD and reorder commands are individually undoable', async () => {
  const { application, categories, payeeId, tags } = await setup()
  const createInput = {
    enabled: true,
    payeeId,
    textContains: null,
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    categoryId: categories[0].id,
    tagIds: [tags[0].id],
  }
  const first = application.commands.createCategorisationRule(createInput)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()).toEqual([])

  const restored = application.commands.createCategorisationRule(createInput)
  const second = application.commands.createCategorisationRule({
    ...createInput,
    categoryId: categories[1].id,
  })
  const updated = application.commands.updateCategorisationRule({
    ...createInput,
    id: restored.id,
    enabled: false,
    textContains: 'Lunch',
  })
  expect(updated).toMatchObject({ enabled: false, textContains: 'Lunch' })
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()[0]).toMatchObject({
    id: restored.id,
    enabled: true,
    textContains: null,
  })

  application.commands.reorderCategorisationRule({
    id: second.id,
    sortOrder: 0,
  })
  expect(application.queries.listCategorisationRules()[0].id).toBe(second.id)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()[0].id).toBe(restored.id)

  application.commands.deleteCategorisationRule(restored.id)
  expect(application.queries.listCategorisationRules()).toHaveLength(1)
  expect(application.commands.undoLast()).toBe(true)
  expect(
    application.queries.listCategorisationRules().map(({ id }) => id),
  ).toEqual([restored.id, second.id])
  expect(first.id).not.toBe(restored.id)
})

test('previews and applies rules to only matching unsplit uncategorized transactions as one undoable command', async () => {
  const { application, account, otherAccount, categories, payeeId, tags } =
    await setup()
  const input = {
    accountId: account.id,
    kind: 'expense' as const,
    date: '2026-01-15',
    totalMinor: 500,
    payeeName: 'KÁVÉZÓ 0123',
    categoryId: null,
    note: 'Lunch',
  }
  const uncategorized = application.commands.createTransaction(input)
  application.commands.createTransaction({
    ...input,
    accountId: otherAccount.id,
  })
  application.commands.createTransaction({
    ...input,
    categoryId: categories[0].id,
  })
  const split = application.commands.createTransaction({
    ...input,
    totalMinor: 1_000,
    lines: [
      { amountMinor: 400, categoryId: null, note: '', tagNames: [] },
      { amountMinor: 600, categoryId: null, note: '', tagNames: [] },
    ],
  })
  const ruleTag = tags.find((tag) => tag.name === 'Rule tag')!
  application.commands.createCategorisationRule({
    enabled: true,
    payeeId,
    textContains: null,
    accountId: account.id,
    minAmountMinor: null,
    maxAmountMinor: null,
    categoryId: categories[1].id,
    tagIds: [ruleTag.id],
  })
  const before = application.queries.listTransactions()

  expect(application.queries.previewCategorisationRuleApplication()).toEqual({
    count: 1,
  })
  expect(application.commands.applyCategorisationRules()).toEqual({ count: 1 })
  const applied = application.queries
    .listTransactions()
    .rows.find((row) => row.id === uncategorized.id)
  expect(applied).toMatchObject({
    line: {
      categoryId: categories[1].id,
      tags: [ruleTag],
    },
  })
  expect(
    application.queries
      .listTransactions()
      .rows.find((row) => row.id === split.id),
  ).toEqual(split)

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions()).toEqual(before)
})
