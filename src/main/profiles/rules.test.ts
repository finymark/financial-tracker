import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import {
  CURRENT_MIGRATIONS,
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
    amountCurrency: 'HUF',
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
    payeeId: null,
    payeeName: null,
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
    payeeId: null,
    payeeName: null,
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
    payeeId: null,
    payeeName: null,
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

test('supports payee actions, single conditions, note-only text matching, and currency-specific amounts', async () => {
  const { application, account, otherAccount, categories } = await setup()
  const preferred = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: 'Preferred payee',
    categoryId: null,
    note: '',
  })
  const accountOnly = application.commands.createCategorisationRule({
    enabled: true,
    payeeId: null,
    textContains: null,
    accountId: otherAccount.id,
    minAmountMinor: null,
    maxAmountMinor: null,
    actionPayeeId: preferred.payeeId,
    categoryId: null,
    tagIds: [],
  })
  expect(
    application.queries.getCategorisationAutofill({
      accountId: otherAccount.id,
      kind: 'expense',
      totalMinor: 500,
      payeeName: null,
      note: '',
    }),
  ).toMatchObject({
    source: 'rule',
    ruleId: accountOnly.id,
    payeeId: preferred.payeeId,
    payeeName: 'Preferred payee',
  })

  const noteRule = application.commands.createCategorisationRule({
    enabled: true,
    payeeId: null,
    textContains: 'CAFE',
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    categoryId: categories[1].id,
    tagIds: [],
  })
  expect(
    application.queries.getCategorisationAutofill({
      accountId: account.id,
      kind: 'expense',
      totalMinor: 500,
      payeeName: 'Café Central',
      note: 'unrelated',
    }).ruleId,
  ).not.toBe(noteRule.id)
  expect(
    application.queries.getCategorisationAutofill({
      accountId: account.id,
      kind: 'expense',
      totalMinor: 500,
      payeeName: null,
      note: 'A café receipt',
    }).ruleId,
  ).toBe(noteRule.id)

  const chf = application.commands.createAccount({
    name: 'CHF account',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const amountRule = application.commands.createCategorisationRule({
    enabled: true,
    payeeId: null,
    textContains: null,
    accountId: null,
    minAmountMinor: 400,
    maxAmountMinor: 600,
    amountCurrency: 'HUF',
    categoryId: categories[2].id,
    tagIds: [],
  })
  expect(
    application.queries.getCategorisationAutofill({
      accountId: chf.id,
      kind: 'expense',
      totalMinor: 500,
      payeeName: null,
      note: '',
    }).ruleId,
  ).not.toBe(amountRule.id)
  expect(
    application.queries.getCategorisationAutofill({
      accountId: account.id,
      kind: 'expense',
      totalMinor: 500,
      payeeName: null,
      note: '',
    }).ruleId,
  ).toBe(amountRule.id)
  expect(() =>
    application.commands.createCategorisationRule({
      enabled: true,
      payeeId: null,
      textContains: null,
      accountId: account.id,
      minAmountMinor: 1,
      maxAmountMinor: null,
      amountCurrency: 'CHF',
      categoryId: categories[0].id,
      tagIds: [],
    }),
  ).toThrow('rules.error.amount')
})

test('migration 16 gives existing amount rules the account or base currency', async () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-rule-upgrade-'),
  )
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Rule upgrade')
  const paths = registry.getProfilePaths(profile.id)
  const migration15 = CURRENT_MIGRATIONS[14]
  const ruleId = '00000000-0000-4000-8000-000000000151'
  const old = await openProfileApplication({
    profile,
    paths,
    clock,
    migrations: [
      ...CURRENT_MIGRATIONS.slice(0, 14),
      {
        ...migration15,
        apply(database) {
          migration15.apply(database)
          const category = database
            .prepare(
              "SELECT id FROM categories WHERE seed_key = 'expense.food'",
            )
            .get() as { id: string }
          database
            .prepare(
              `INSERT INTO categorisation_rules
               (id, enabled, sort_order, payee_id, text_contains, account_id,
                min_amount_minor, max_amount_minor, category_id,
                created_at, updated_at)
               VALUES (?, 1, 0, NULL, 'legacy', NULL, 100, 200, ?, ?, ?)`,
            )
            .run(
              ruleId,
              category.id,
              clock().toISOString(),
              clock().toISOString(),
            )
        },
      },
    ],
  })
  old.close()

  const upgraded = await openProfileApplication({ profile, paths, clock })
  applications.push(upgraded)
  expect(upgraded.queries.listCategorisationRules()).toEqual([
    expect.objectContaining({
      id: ruleId,
      minAmountMinor: 100,
      maxAmountMinor: 200,
      amountCurrency: 'HUF',
      actionPayeeId: null,
      actionPayeeName: null,
    }),
  ])
})

test('rules with later-archived references can be disabled or edited, but changing to archived references is rejected', async () => {
  const { application, otherAccount, categories } = await setup()
  const parent = application.commands.createCategory({
    name: 'Archived parent',
    kind: 'expense',
  })
  const child = application.commands.createCategory({
    name: 'Child',
    kind: 'expense',
    parentId: parent.id,
  })
  const draft = {
    enabled: true,
    payeeId: null,
    textContains: null,
    accountId: otherAccount.id,
    minAmountMinor: 100,
    maxAmountMinor: 500,
    amountCurrency: 'HUF' as const,
    categoryId: child.id,
    tagIds: [],
  }
  const rule = application.commands.createCategorisationRule(draft)
  application.commands.archiveAccount(otherAccount.id)
  application.commands.archiveCategory(parent.id)
  const disabled = application.commands.updateCategorisationRule({
    ...draft,
    id: rule.id,
    enabled: false,
  })
  expect(disabled).toEqual({ ...rule, enabled: false })
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()).toEqual([rule])
  expect(
    application.commands.updateCategorisationRule({
      ...draft,
      id: rule.id,
      textContains: 'Updated',
    }).textContains,
  ).toBe('Updated')
  const other = application.commands.createCategorisationRule({
    ...draft,
    accountId: null,
    categoryId: categories[1].id,
    textContains: 'Other',
  })
  for (const changed of [
    { accountId: otherAccount.id },
    { categoryId: child.id },
  ]) {
    expect(() =>
      application.commands.updateCategorisationRule({
        ...draft,
        id: other.id,
        accountId: null,
        categoryId: categories[1].id,
        textContains: 'Other',
        ...changed,
      }),
    ).toThrow('rules.error.reference')
  }
  expect(() =>
    application.commands.updateCategorisationRule({
      ...draft,
      id: rule.id,
      amountCurrency: 'CHF',
    }),
  ).toThrow('rules.error.amount')
})
