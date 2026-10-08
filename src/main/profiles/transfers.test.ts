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
let now = new Date('2026-01-15T10:00:00.000Z')
const clock = () => now

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-transfer-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Transfer test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  applications.push(application)
  return application
}

afterEach(() => {
  now = new Date('2026-01-15T10:00:00.000Z')
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('records one same-currency transfer with both legs and excludes it from totals', async () => {
  const application = await setup()
  const from = application.commands.createAccount({
    name: 'From',
    currency: 'HUF',
    openingBalance: 10_000,
    openingDate: '2026-01-01',
  })
  const to = application.commands.createAccount({
    name: 'To',
    currency: 'HUF',
    openingBalance: 2_000,
    openingDate: '2026-01-01',
  })

  const transfer = application.commands.createTransfer({
    fromAccountId: from.id,
    fromAmountMinor: 1_500,
    toAccountId: to.id,
    toAmountMinor: 1_500,
    date: '2026-01-15',
    note: 'Savings',
    fee: null,
  })

  expect(transfer).toMatchObject({
    kind: 'transfer',
    fromAccountId: from.id,
    fromAmountMinor: 1_500,
    toAccountId: to.id,
    toAmountMinor: 1_500,
    date: '2026-01-15',
    note: 'Savings',
    actualRate: null,
    fee: null,
  })
  expect(application.queries.getAccountBalance(from.id)).toBe(8_500)
  expect(application.queries.getAccountBalance(to.id)).toBe(3_500)
  expect(application.queries.hasAccountTransactions(from.id)).toBe(true)
  expect(application.queries.hasAccountTransactions(to.id)).toBe(true)
  expect(application.queries.listTransactions()).toMatchObject({
    rows: [transfer],
    totalCount: 1,
    totals: [],
    days: [{ date: '2026-01-15', totals: [] }],
  })
  expect(
    application.queries.listTransactions({ accountId: from.id }).rows,
  ).toEqual([transfer])
  expect(
    application.queries.listTransactions({ accountId: to.id }).rows,
  ).toEqual([transfer])

  for (const input of [
    { ...transfer, toAccountId: from.id },
    { ...transfer, toAmountMinor: 1_499 },
    { ...transfer, fromAmountMinor: 0 },
    { ...transfer, date: '2026-01-16' },
  ]) {
    expect(() =>
      application.commands.updateTransfer({
        id: transfer.id,
        fromAccountId: input.fromAccountId,
        fromAmountMinor: input.fromAmountMinor,
        toAccountId: input.toAccountId,
        toAmountMinor: input.toAmountMinor,
        date: input.date,
        note: input.note,
        fee: null,
      }),
    ).toThrow()
  }
  expect(application.queries.listTransactions().rows).toEqual([transfer])
})

test('keeps both cross-currency amounts authoritative and derives an exact rate', async () => {
  const application = await setup()
  const from = application.commands.createAccount({
    name: 'Forints',
    currency: 'HUF',
    openingBalance: 5_000_000,
    openingDate: '2026-01-01',
  })
  const to = application.commands.createAccount({
    name: 'Francs',
    currency: 'CHF',
    openingBalance: 10_000,
    openingDate: '2026-01-01',
  })
  const transfer = application.commands.createTransfer({
    fromAccountId: from.id,
    fromAmountMinor: 4_000_000,
    toAccountId: to.id,
    toAmountMinor: 10_250,
    date: '2026-01-14',
    note: 'Exchange',
    fee: null,
  })

  expect(transfer.actualRate).toEqual({
    fromCurrency: 'HUF',
    toCurrency: 'CHF',
    numerator: 10_250,
    denominator: 4_000_000,
  })
  expect(application.queries.getAccountBalance(from.id)).toBe(1_000_000)
  expect(application.queries.getAccountBalance(to.id)).toBe(20_250)
})

test('creates, edits, and removes the linked fee atomically with a sensible default category', async () => {
  const application = await setup()
  const from = application.commands.createAccount({
    name: 'Bank',
    currency: 'CHF',
    openingBalance: 20_000,
    openingDate: '2026-01-01',
  })
  const to = application.commands.createAccount({
    name: 'Cash',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const feeCategory = application.queries
    .listCategories()
    .find((category) => category.seedKey === 'expense.fees')!
  expect(() =>
    application.commands.createTransfer({
      fromAccountId: from.id,
      fromAmountMinor: 5_000,
      toAccountId: to.id,
      toAmountMinor: 5_000,
      date: '2026-01-15',
      note: 'Invalid fee',
      fee: { amountMinor: 250, categoryId: to.id },
    }),
  ).toThrow('transactions.error.category')
  expect(application.queries.listTransactions().rows).toEqual([])

  const transfer = application.commands.createTransfer({
    fromAccountId: from.id,
    fromAmountMinor: 5_000,
    toAccountId: to.id,
    toAmountMinor: 5_000,
    date: '2026-01-15',
    note: 'ATM',
    fee: { amountMinor: 250 },
  })

  expect(transfer.fee).toMatchObject({
    kind: 'expense',
    accountId: from.id,
    totalMinor: 250,
    date: transfer.date,
    note: transfer.note,
    line: { categoryId: feeCategory.id },
    linkedTransferId: transfer.id,
  })
  expect(application.queries.getAccountBalance(from.id)).toBe(14_750)
  expect(application.queries.getAccountBalance(to.id)).toBe(5_000)
  expect(application.queries.listTransactions().totals).toEqual([
    { currency: 'CHF', expenseMinor: 250, incomeMinor: 0 },
  ])
  expect(() =>
    application.commands.updateTransaction({
      ...transfer.fee!,
      payeeName: null,
      categoryId: transfer.fee!.line.categoryId,
      note: 'Detached edit',
    }),
  ).toThrow('transfers.error.linkedFee')
  expect(() =>
    application.commands.deleteTransaction(transfer.fee!.id),
  ).toThrow('transfers.error.linkedFee')

  expect(() =>
    application.commands.updateTransfer({
      ...transfer,
      fee: { amountMinor: 300, categoryId: to.id },
    }),
  ).toThrow('transactions.error.category')
  expect(application.queries.getAccountBalance(from.id)).toBe(14_750)

  now = new Date('2026-01-15T11:00:00.000Z')
  const edited = application.commands.updateTransfer({
    id: transfer.id,
    fromAccountId: from.id,
    fromAmountMinor: 4_000,
    toAccountId: to.id,
    toAmountMinor: 4_000,
    date: '2026-01-14',
    note: 'Edited ATM',
    fee: null,
  })
  expect(edited.fee).toBeNull()
  expect(application.queries.listTransactions().rows).toEqual([edited])
  expect(application.queries.listTransactions().totals).toEqual([])
  expect(application.queries.getAccountBalance(from.id)).toBe(16_000)
})

test('undoes transfer creation, editing, and deletion with its linked fee as one unit', async () => {
  const application = await setup()
  const from = application.commands.createAccount({
    name: 'From',
    currency: 'HUF',
    openingBalance: 10_000,
    openingDate: '2026-01-01',
  })
  const to = application.commands.createAccount({
    name: 'To',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const created = application.commands.createTransfer({
    fromAccountId: from.id,
    fromAmountMinor: 1_000,
    toAccountId: to.id,
    toAmountMinor: 1_000,
    date: '2026-01-15',
    note: 'Created',
    fee: { amountMinor: 100 },
  })
  now = new Date('2026-01-15T11:00:00.000Z')
  const edited = application.commands.updateTransfer({
    id: created.id,
    fromAccountId: from.id,
    fromAmountMinor: 2_000,
    toAccountId: to.id,
    toAmountMinor: 2_000,
    date: '2026-01-14',
    note: 'Edited',
    fee: { amountMinor: 200, categoryId: null },
  })
  application.commands.deleteTransfer(edited.id)
  expect(application.queries.listTransactions().rows).toEqual([])

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toHaveLength(2)
  expect(application.queries.listTransactions().rows).toEqual(
    expect.arrayContaining([edited, edited.fee]),
  )
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toHaveLength(2)
  expect(application.queries.listTransactions().rows).toEqual(
    expect.arrayContaining([created, created.fee]),
  )
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.queries.getAccountBalance(from.id)).toBe(10_000)
  expect(application.queries.getAccountBalance(to.id)).toBe(0)
})
