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
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-splits-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Split test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  applications.push(application)
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'CHF',
    openingBalance: 10_000,
    openingDate: '2026-01-01',
  })
  return { application, account }
}

afterEach(() => {
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('records one transaction as positive parts whose exact sum equals its total', async () => {
  const { application, account } = await setup()
  const categories = application.queries.listCategoryOptions('expense')
  const transaction = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 1_000,
    payeeName: 'Mixed shop',
    categoryId: null,
    note: '',
    lines: [
      {
        amountMinor: 400,
        categoryId: categories[0].id,
        note: 'Food part',
        tagNames: ['Trip'],
      },
      {
        amountMinor: 600,
        categoryId: categories[1].id,
        note: 'House part',
        tagNames: ['Home'],
      },
    ],
  })

  expect(transaction.lines).toHaveLength(2)
  expect(transaction.lines).toMatchObject([
    {
      amountMinor: 400,
      categoryId: categories[0].id,
      note: 'Food part',
      tags: [{ name: 'Trip' }],
    },
    {
      amountMinor: 600,
      categoryId: categories[1].id,
      note: 'House part',
      tags: [{ name: 'Home' }],
    },
  ])
  expect(application.queries.listTransactions().rows).toEqual([transaction])
  expect(application.queries.getAccountBalance(account.id)).toBe(9_000)
})

test('rejects missing, non-positive, and unequal parts atomically inside the command transaction', async () => {
  const { application, account } = await setup()
  const input = {
    accountId: account.id,
    kind: 'expense' as const,
    date: '2026-01-15',
    totalMinor: 1_000,
    payeeName: 'Must roll back',
    categoryId: null,
    note: '',
  }
  for (const lines of [
    [],
    [{ amountMinor: 0, categoryId: null, note: '', tagNames: ['New tag'] }],
    [{ amountMinor: 999, categoryId: null, note: '', tagNames: ['New tag'] }],
  ]) {
    expect(() =>
      application.commands.createTransaction({ ...input, lines }),
    ).toThrow('transactions.error.lines')
  }
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.queries.listPayees()).toEqual([])
  expect(application.queries.listTags()).toEqual([])
})

test('category and tag filters return the transaction but total only matching parts', async () => {
  const { application, account } = await setup()
  const categories = [
    application.commands.createCategory({
      name: 'Split category A',
      kind: 'expense',
    }),
    application.commands.createCategory({
      name: 'Split category B',
      kind: 'expense',
    }),
  ]
  const split = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 1_000,
    payeeName: null,
    categoryId: null,
    note: '',
    lines: [
      {
        amountMinor: 250,
        categoryId: categories[0].id,
        note: '',
        tagNames: ['Trip'],
      },
      {
        amountMinor: 750,
        categoryId: categories[1].id,
        note: '',
        tagNames: ['Home'],
      },
    ],
  })
  const trip = split.lines[0].tags[0]

  const byCategory = application.queries.listTransactions({
    categoryId: categories[0].id,
  })
  expect(byCategory.rows).toEqual([split])
  expect(byCategory.totals).toEqual([
    { currency: 'CHF', expenseMinor: 250, incomeMinor: 0 },
  ])
  expect(byCategory.days[0].totals).toEqual(byCategory.totals)

  const byTag = application.queries.listTransactions({ tagId: trip.id })
  expect(byTag.rows).toEqual([split])
  expect(byTag.totals).toEqual(byCategory.totals)
  expect(
    application.queries.listTransactions({
      categoryId: categories[1].id,
      tagId: trip.id,
    }).rows,
  ).toEqual([])
})

test('the excluded flag stays on the transaction header and omits every part from totals', async () => {
  const { application, account } = await setup()
  const split = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 1_000,
    payeeName: null,
    categoryId: null,
    note: '',
    excluded: true,
    lines: [
      { amountMinor: 250, categoryId: null, note: '', tagNames: [] },
      { amountMinor: 750, categoryId: null, note: '', tagNames: [] },
    ],
  })

  expect(split.excluded).toBe(true)
  expect(split.lines.every((line) => !('excluded' in line))).toBe(true)
  expect(application.queries.listTransactions().totals).toEqual([
    { currency: 'CHF', expenseMinor: 0, incomeMinor: 0 },
  ])
  expect(application.queries.getAccountBalance(account.id)).toBe(9_000)
})

test('editing, un-splitting, and undo restore exact line identities, notes, and tags', async () => {
  const { application, account } = await setup()
  const categories = application.queries.listCategoryOptions('expense')
  const split = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 1_000,
    payeeName: null,
    categoryId: null,
    note: '',
    lines: [
      {
        amountMinor: 400,
        categoryId: categories[0].id,
        note: 'First',
        tagNames: ['Shared', 'First tag'],
      },
      {
        amountMinor: 600,
        categoryId: categories[1].id,
        note: 'Second',
        tagNames: ['Second tag'],
      },
    ],
  })
  const unsplit = application.commands.updateTransaction({
    id: split.id,
    accountId: split.accountId,
    kind: split.kind,
    date: split.date,
    totalMinor: split.totalMinor,
    payeeName: split.payeeName,
    categoryId: null,
    note: '',
    lines: [
      {
        amountMinor: 1_000,
        categoryId: categories[0].id,
        note: 'One line again',
        tagNames: ['Shared'],
      },
    ],
  })
  expect(unsplit.lines).toHaveLength(1)

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([split])
  expect(application.queries.listTags()).toEqual(
    expect.arrayContaining(split.lines.flatMap((line) => line.tags)),
  )
})
