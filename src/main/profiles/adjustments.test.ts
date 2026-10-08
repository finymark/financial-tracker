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

test('appends the balance adjustment migration to an existing transfer profile', async () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-adjustment-upgrade-'),
  )
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Adjustment upgrade')
  const paths = registry.getProfilePaths(profile.id)
  const previous = await openProfileApplication({
    profile,
    paths,
    clock,
    migrations: CURRENT_MIGRATIONS.slice(0, 9),
  })
  applications.push(previous)
  const account = previous.commands.createAccount({
    name: 'Bank',
    currency: 'HUF',
    openingBalance: 1_000,
    openingDate: '2025-10-01',
  })
  previous.close()

  const upgraded = await openProfileApplication({ profile, paths, clock })
  applications.push(upgraded)
  expect(upgraded.queries.getProfileInfo().schemaVersion).toBe(10)
  expect(upgraded.queries.getAccountBalance(account.id)).toBe(1_000)
  const saved = upgraded.commands.createBalanceAdjustment({
    accountId: account.id,
    date: '2025-10-10',
    observedMinor: 900,
    note: '',
  })
  expect(saved.differenceMinor).toBe(-100)
  upgraded.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(reopened.queries.listTransactions().rows).toEqual([saved])
  expect(reopened.queries.getAccountBalance(account.id)).toBe(900)
})
