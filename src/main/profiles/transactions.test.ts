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
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-ledger-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Ledger test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  applications.push(application)
  return application
}

afterEach(() => {
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('records an exact one-line transaction and reuses payees case-insensitively', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'CHF',
    openingBalance: 1000,
    openingDate: '2026-01-01',
  })
  const category = application.queries
    .listCategoryOptions('expense')
    .find((candidate) => candidate.parentId !== null)!
  const first = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 12345,
    payeeName: '  Corner Shop  ',
    categoryId: category.id,
    note: 'Weekly groceries',
  })
  expect(first).toMatchObject({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 12345,
    payeeName: 'Corner Shop',
    note: 'Weekly groceries',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    line: { amountMinor: 12345, categoryId: category.id },
  })
  expect(first.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
  expect(first.line.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )

  const second = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-14',
    totalMinor: 1,
    payeeName: 'corner shop',
    categoryId: null,
    note: '',
  })
  expect(second.payeeId).toBe(first.payeeId)
  expect(second.payeeName).toBe('Corner Shop')
  expect(application.queries.listPayees()).toHaveLength(1)
  expect(application.queries.listTransactions()).toEqual([first, second])
})

test('rejects future calendar dates through the injected clock without partial writes', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  expect(() =>
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'income',
      date: '2026-01-16',
      totalMinor: 100,
      payeeName: 'Employer',
      categoryId: null,
      note: '',
    }),
  ).toThrow('transactions.error.futureDate')
  expect(application.queries.listTransactions()).toEqual([])
  expect(application.queries.listPayees()).toEqual([])

  const saved = application.commands.createTransaction({
    accountId: account.id,
    kind: 'income',
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  expect(() =>
    application.commands.updateTransaction({
      ...saved,
      accountId: saved.accountId,
      date: '2026-01-16',
      payeeName: 'Must not be created',
      categoryId: saved.line.categoryId,
    }),
  ).toThrow('transactions.error.futureDate')
  expect(application.queries.listTransactions()).toEqual([saved])
  expect(application.queries.listPayees()).toEqual([])
})

test('editing and deleting transactions updates signed account balances and account guards', async () => {
  const application = await setup()
  const firstAccount = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 1000,
    openingDate: '2026-01-01',
  })
  const secondAccount = application.commands.createAccount({
    name: 'Bank',
    currency: 'HUF',
    openingBalance: 2000,
    openingDate: '2026-01-01',
  })
  const expenseCategory = application.queries
    .listCategoryOptions('expense')
    .find((category) => category.parentId !== null)!
  const incomeCategory = application.queries.listCategoryOptions('income')[0]
  const expense = application.commands.createTransaction({
    accountId: firstAccount.id,
    kind: 'expense',
    date: '2026-01-14',
    totalMinor: 250,
    payeeName: null,
    categoryId: expenseCategory.id,
    note: 'Original',
  })
  application.commands.createTransaction({
    accountId: firstAccount.id,
    kind: 'income',
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: incomeCategory.id,
    note: '',
  })
  expect(application.queries.getAccountBalance(firstAccount.id)).toBe(850)
  expect(application.queries.hasAccountTransactions(firstAccount.id)).toBe(true)
  expect(() => application.commands.deleteAccount(firstAccount.id)).toThrow(
    'accounts.error.notEmpty',
  )
  expect(() =>
    application.commands.changeAccountCurrency({
      id: firstAccount.id,
      currency: 'CHF',
    }),
  ).toThrow('accounts.error.currencyLocked')

  const edited = application.commands.updateTransaction({
    id: expense.id,
    accountId: secondAccount.id,
    kind: 'income',
    date: '2026-01-13',
    totalMinor: 400,
    payeeName: 'Salary office',
    categoryId: incomeCategory.id,
    note: 'Edited',
  })
  expect(edited).toMatchObject({
    id: expense.id,
    accountId: secondAccount.id,
    kind: 'income',
    totalMinor: 400,
    line: { id: expense.line.id, amountMinor: 400 },
  })
  expect(application.queries.getAccountBalance(firstAccount.id)).toBe(1100)
  expect(application.queries.getAccountBalance(secondAccount.id)).toBe(2400)

  application.commands.deleteTransaction(edited.id)
  expect(application.queries.getAccountBalance(secondAccount.id)).toBe(2000)
  expect(application.queries.hasAccountTransactions(secondAccount.id)).toBe(
    false,
  )
  expect(application.queries.listTransactions()).toHaveLength(1)
})

test('detects category use and delete-with-replacement reassigns transaction lines', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const source = application.commands.createCategory({
    name: 'Old purpose',
    kind: 'expense',
    parentId: null,
  })
  const replacement = application.commands.createCategory({
    name: 'New purpose',
    kind: 'expense',
    parentId: null,
  })
  expect(() =>
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'income',
      date: '2026-01-15',
      totalMinor: 500,
      payeeName: null,
      categoryId: source.id,
      note: '',
    }),
  ).toThrow('transactions.error.category')
  const transaction = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 500,
    payeeName: null,
    categoryId: source.id,
    note: '',
  })
  expect(application.queries.hasCategoryTransactions(source.id)).toBe(true)
  expect(() => application.commands.deleteCategory({ id: source.id })).toThrow(
    'categories.error.replacementRequired',
  )
  application.commands.deleteCategory({
    id: source.id,
    replacementId: replacement.id,
  })
  expect(application.queries.listTransactions()[0]).toEqual({
    ...transaction,
    line: { ...transaction.line, categoryId: replacement.id },
  })
  expect(application.queries.hasCategoryTransactions(replacement.id)).toBe(true)
})
