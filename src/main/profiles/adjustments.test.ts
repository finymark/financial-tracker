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
let now = new Date('2025-10-10T12:00:00.000Z')
const clock = () => now

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-adjustment-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Adjustment test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  applications.push(application)
  return application
}

afterEach(() => {
  now = new Date('2025-10-10T12:00:00.000Z')
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('recomputes the ADR 0003 observed balance when an earlier expense is recorded later', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Bank',
    currency: 'HUF',
    openingBalance: 5_150_000,
    openingDate: '2025-10-01',
  })

  const adjustment = application.commands.createBalanceAdjustment({
    accountId: account.id,
    date: '2025-10-10',
    observedMinor: 5_000_000,
    note: 'Bank balance',
  })

  expect(adjustment).toMatchObject({
    kind: 'adjustment',
    accountId: account.id,
    date: '2025-10-10',
    observedMinor: 5_000_000,
    differenceMinor: -150_000,
    noLongerCorrectsAnything: false,
  })
  expect(application.queries.getAccountBalance(account.id)).toBe(5_000_000)

  const forgottenExpense = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2025-10-05',
    totalMinor: 150_000,
    payeeName: null,
    categoryId: null,
    note: 'Forgotten expense',
  })

  expect(application.queries.getAccountBalance(account.id)).toBe(5_000_000)
  expect(application.queries.listTransactions()).toMatchObject({
    rows: [
      {
        ...adjustment,
        differenceMinor: 0,
        noLongerCorrectsAnything: true,
      },
      forgottenExpense,
    ],
    totalCount: 2,
    totals: [{ currency: 'HUF', expenseMinor: 150_000, incomeMinor: 0 }],
  })
})

test('undoes balance adjustment creation, editing, and deletion exactly', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'CHF',
    openingBalance: 10_000,
    openingDate: '2025-10-01',
  })
  const created = application.commands.createBalanceAdjustment({
    accountId: account.id,
    date: '2025-10-08',
    observedMinor: 8_000,
    note: 'Counted cash',
  })
  now = new Date('2025-10-10T13:00:00.000Z')
  const edited = application.commands.updateBalanceAdjustment({
    id: created.id,
    accountId: account.id,
    date: '2025-10-09',
    observedMinor: 9_000,
    note: 'Counted again',
  })
  application.commands.deleteBalanceAdjustment(edited.id)
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.queries.getAccountBalance(account.id)).toBe(10_000)

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([edited])
  expect(application.queries.getAccountBalance(account.id)).toBe(9_000)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([created])
  expect(application.queries.getAccountBalance(account.id)).toBe(8_000)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.queries.getAccountBalance(account.id)).toBe(10_000)
})

test('applies adjustments after opening balances, transactions, and transfer legs on the same day', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Current account',
    currency: 'HUF',
    openingBalance: 10_000,
    openingDate: '2025-10-10',
  })
  const other = application.commands.createAccount({
    name: 'Savings',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2025-10-01',
  })
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2025-10-10',
    totalMinor: 1_000,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  application.commands.createTransfer({
    fromAccountId: account.id,
    fromAmountMinor: 2_000,
    toAccountId: other.id,
    toAmountMinor: 2_000,
    date: '2025-10-10',
    note: '',
    fee: null,
  })
  const adjustment = application.commands.createBalanceAdjustment({
    accountId: account.id,
    date: '2025-10-10',
    observedMinor: 6_500,
    note: '',
  })
  expect(adjustment.differenceMinor).toBe(-500)
  expect(application.queries.getAccountBalance(account.id)).toBe(6_500)

  application.commands.createTransaction({
    accountId: account.id,
    kind: 'income',
    date: '2025-10-10',
    totalMinor: 500,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  const recomputed = application.queries
    .listTransactions()
    .rows.find((row) => row.kind === 'adjustment')
  expect(recomputed).toMatchObject({ differenceMinor: -1_000 })
  expect(application.queries.getAccountBalance(account.id)).toBe(6_500)
})

test('validates observations and combines adjustment rows with transaction filters but not totals', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'CHF',
    openingBalance: 100,
    openingDate: '2025-10-01',
  })
  expect(() =>
    application.commands.createBalanceAdjustment({
      accountId: account.id,
      date: '2025-10-11',
      observedMinor: 0,
      note: '',
    }),
  ).toThrow('adjustments.error.futureDate')
  const adjustment = application.commands.createBalanceAdjustment({
    accountId: account.id,
    date: '2025-10-10',
    observedMinor: -250,
    note: 'Physical count',
  })
  expect(adjustment.observedMinor).toBe(-250)
  expect(application.queries.listTransactions()).toMatchObject({
    rows: [adjustment],
    totalCount: 1,
    totals: [],
    days: [{ date: '2025-10-10', totals: [] }],
  })
  expect(
    application.queries.listTransactions({ search: 'physical' }).rows,
  ).toEqual([adjustment])
  expect(
    application.queries.listTransactions({ exclusion: 'hideExcluded' }).rows,
  ).toEqual([adjustment])
  expect(
    application.queries.listTransactions({ exclusion: 'onlyExcluded' }).rows,
  ).toEqual([])
  expect(
    application.queries.listTransactions({ payeeId: adjustment.id }).rows,
  ).toEqual([])
  expect(application.queries.hasAccountTransactions(account.id)).toBe(true)
  expect(() => application.commands.deleteAccount(account.id)).toThrow(
    'accounts.error.notEmpty',
  )
})

test('appends the balance adjustment migration to an existing tagged transfer profile', async () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-adjustment-upgrade-'),
  )
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Adjustment upgrade')
  const paths = registry.getProfilePaths(profile.id)
  const accountId = '00000000-0000-4000-8000-000000000101'
  const otherId = '00000000-0000-4000-8000-000000000102'
  const migration10 = CURRENT_MIGRATIONS[9]
  const previous = await openProfileApplication({
    profile,
    paths,
    clock,
    migrations: [
      ...CURRENT_MIGRATIONS.slice(0, 9),
      {
        ...migration10,
        apply(database) {
          migration10.apply(database)
          const insertAccount = database.prepare(
            `INSERT INTO accounts
             (id, name, currency, opening_balance, opening_date, created_at)
             VALUES (?, ?, 'HUF', ?, '2025-10-01', ?)`,
          )
          insertAccount.run(accountId, 'Bank', 1_000, clock().toISOString())
          insertAccount.run(otherId, 'Savings', 0, clock().toISOString())
          const insertTransaction = database.prepare(
            `INSERT INTO transactions
             (id, account_id, kind, date, total_minor, payee_id, note,
              excluded, created_at, updated_at)
             VALUES (?, ?, 'expense', ?, ?, NULL, ?, 1, ?, ?)`,
          )
          const transactionId = '00000000-0000-4000-8000-000000000103'
          const feeId = '00000000-0000-4000-8000-000000000104'
          insertTransaction.run(
            transactionId,
            accountId,
            '2025-10-05',
            100,
            'Before adjustments',
            clock().toISOString(),
            clock().toISOString(),
          )
          insertTransaction.run(
            feeId,
            accountId,
            '2025-10-06',
            10,
            'Before adjustments',
            clock().toISOString(),
            clock().toISOString(),
          )
          const insertLine = database.prepare(
            `INSERT INTO transaction_lines
             (id, transaction_id, amount_minor, category_id)
             VALUES (?, ?, ?, NULL)`,
          )
          const lineId = '00000000-0000-4000-8000-000000000105'
          insertLine.run(lineId, transactionId, 100)
          insertLine.run('00000000-0000-4000-8000-000000000106', feeId, 10)
          database
            .prepare(
              `INSERT INTO transfers
               (id, from_account_id, from_amount_minor, to_account_id,
                to_amount_minor, date, note, fee_transaction_id,
                created_at, updated_at)
               VALUES (?, ?, 200, ?, 200, '2025-10-06',
                'Before adjustments', ?, ?, ?)`,
            )
            .run(
              '00000000-0000-4000-8000-000000000107',
              accountId,
              otherId,
              feeId,
              clock().toISOString(),
              clock().toISOString(),
            )
          const tagId = '00000000-0000-4000-8000-000000000108'
          database
            .prepare(
              `INSERT INTO tags (id, name, normalized_name, created_at)
               VALUES (?, 'Trip', payee_key('Trip'), ?)`,
            )
            .run(tagId, clock().toISOString())
          database
            .prepare(
              `INSERT INTO transaction_line_tags (line_id, tag_id)
               VALUES (?, ?)`,
            )
            .run(lineId, tagId)
        },
      },
    ],
  })
  applications.push(previous)
  expect(previous.queries.getProfileInfo().schemaVersion).toBe(10)
  previous.close()

  const upgraded = await openProfileApplication({ profile, paths, clock })
  applications.push(upgraded)
  expect(upgraded.queries.getProfileInfo().schemaVersion).toBe(
    CURRENT_MIGRATIONS.length,
  )
  expect(upgraded.queries.getAccountBalance(accountId)).toBe(690)
  expect(upgraded.queries.getAccountBalance(otherId)).toBe(200)
  const before = upgraded.queries.listTransactions()
  const tags = upgraded.queries.listTags()
  const saved = upgraded.commands.createBalanceAdjustment({
    accountId,
    date: '2025-10-10',
    observedMinor: 900,
    note: '',
  })
  expect(saved.differenceMinor).toBe(210)
  upgraded.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(reopened.queries.getProfileInfo().schemaVersion).toBe(
    CURRENT_MIGRATIONS.length,
  )
  expect(reopened.queries.listTransactions().rows).toEqual([
    saved,
    ...before.rows,
  ])
  expect(reopened.queries.listTags()).toEqual(tags)
  expect(reopened.queries.getAccountBalance(accountId)).toBe(900)
})

test('combines adjustment and transfer rows with tagged and excluded transactions without changing totals', async () => {
  const application = await setup()
  const source = application.commands.createAccount({
    name: 'Bank',
    currency: 'HUF',
    openingBalance: 10_000,
    openingDate: '2025-10-01',
  })
  const destination = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2025-10-01',
  })
  const expense = application.commands.createTransaction({
    accountId: source.id,
    kind: 'expense',
    date: '2025-10-05',
    totalMinor: 1_000,
    payeeName: 'Shop',
    categoryId: null,
    note: 'Trip',
    tagNames: ['Trip'],
  })
  const transfer = application.commands.createTransfer({
    fromAccountId: source.id,
    fromAmountMinor: 2_000,
    toAccountId: destination.id,
    toAmountMinor: 1_000,
    date: '2025-10-08',
    note: 'Trip',
    fee: { amountMinor: 100, excluded: true },
  })
  const sourceAdjustment = application.commands.createBalanceAdjustment({
    accountId: source.id,
    date: '2025-10-10',
    observedMinor: 8_000,
    note: 'Trip',
  })
  const destinationAdjustment = application.commands.createBalanceAdjustment({
    accountId: destination.id,
    date: '2025-10-10',
    observedMinor: 900,
    note: 'Trip',
  })
  // The source includes the transfer leg and its excluded linked fee once.
  expect(sourceAdjustment.differenceMinor).toBe(1_100)
  expect(destinationAdjustment.differenceMinor).toBe(-100)
  expect(application.queries.getAccountBalance(source.id)).toBe(8_000)
  expect(application.queries.getAccountBalance(destination.id)).toBe(900)
  const page = application.queries.listTransactions()
  expect(page.totalCount).toBe(5)
  expect(page.rows).toEqual(
    expect.arrayContaining([
      expense,
      transfer,
      transfer.fee,
      sourceAdjustment,
      destinationAdjustment,
    ]),
  )
  expect(page.totals).toEqual([
    { currency: 'HUF', expenseMinor: 1_000, incomeMinor: 0 },
  ])
  expect(page.days).toEqual([
    { date: '2025-10-10', totals: [] },
    {
      date: '2025-10-08',
      totals: [{ currency: 'HUF', expenseMinor: 0, incomeMinor: 0 }],
    },
    { date: '2025-10-05', totals: page.totals },
  ])
  expect(application.queries.listTransactions({ search: 'trip' })).toEqual(page)
  const sourcePage = application.queries.listTransactions({
    accountId: source.id,
  })
  expect(sourcePage.totalCount).toBe(4)
  expect(sourcePage.rows).not.toContainEqual(destinationAdjustment)
  expect(
    application.queries.listTransactions({ accountId: destination.id }).rows,
  ).toEqual(expect.arrayContaining([transfer, destinationAdjustment]))
  const tagged = application.queries.listTransactions({
    tagId: expense.line.tags[0].id,
  })
  expect(tagged.rows).toEqual([expense])
  expect(tagged.totals).toEqual(page.totals)
  const excluded = application.queries.listTransactions({
    exclusion: 'onlyExcluded',
  })
  expect(excluded.rows).toEqual([transfer.fee])
  expect(excluded.totals).toEqual([
    { currency: 'HUF', expenseMinor: 0, incomeMinor: 0 },
  ])
  const included = application.queries.listTransactions({
    exclusion: 'hideExcluded',
  })
  expect(included.totalCount).toBe(4)
  expect(included.rows).not.toContainEqual(transfer.fee)
  expect(included.rows).toEqual(
    expect.arrayContaining([transfer, sourceAdjustment, destinationAdjustment]),
  )
  expect(included.totals).toEqual(page.totals)
  expect(
    application.queries.listTransactions({
      exclusion: 'onlyExcluded',
      tagId: expense.line.tags[0].id,
    }).rows,
  ).toEqual([])
  const paged = page.rows.flatMap((_, offset) => {
    const window = application.queries.listTransactions({ offset, limit: 1 })
    expect(window.totals).toEqual(page.totals)
    expect(window.days).toEqual(page.days)
    expect(window.totalCount).toBe(5)
    return window.rows
  })
  expect(paged).toEqual(page.rows)

  // All aggregate types share one undo stack, restoring linked fees, tags,
  // exclusions, and the recomputed target difference rather than a saved delta.
  application.commands.updateTransaction({
    id: expense.id,
    accountId: source.id,
    kind: 'expense',
    date: expense.date,
    totalMinor: 1_500,
    payeeName: expense.payeeName,
    categoryId: null,
    note: expense.note,
    excluded: true,
    tagNames: ['Other'],
  })
  application.commands.renameTag({
    id: expense.line.tags[0].id,
    name: 'Vacation',
  })
  const otherTag = application.queries
    .listTags()
    .find((tag) => tag.name === 'Other')!
  application.commands.deleteTag(otherTag.id)
  application.commands.deleteTransfer(transfer.id)
  application.commands.deleteBalanceAdjustment(sourceAdjustment.id)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.getAccountBalance(source.id)).toBe(8_000)
  expect(application.queries.listTransactions().rows).toContainEqual({
    ...sourceAdjustment,
    differenceMinor: -500,
  })
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toContainEqual(transfer)
  expect(application.queries.listTransactions().rows).toContainEqual({
    ...sourceAdjustment,
    differenceMinor: 1_600,
  })
  expect(application.commands.undoLast()).toBe(true)
  expect(
    application.queries.listTransactions({ tagId: otherTag.id }).totalCount,
  ).toBe(1)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTags()).toContainEqual(expense.line.tags[0])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions()).toEqual(page)
  expect(application.queries.listTags()).toEqual(expense.line.tags)
})
