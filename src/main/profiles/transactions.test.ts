import { mkdtempSync, rmSync } from 'node:fs'
import type Database from 'better-sqlite3'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import {
  openProfileApplication,
  CURRENT_MIGRATIONS,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'

const directories: string[] = []
const applications: ProfileApplication[] = []
const clock = () => new Date('2026-01-15T10:00:00.000Z')

async function setup({
  profileClock = clock,
  migrations = CURRENT_MIGRATIONS,
  arrange,
}: {
  profileClock?: () => Date
  migrations?: typeof CURRENT_MIGRATIONS
  arrange?: (
    application: ProfileApplication,
    database: Database.Database,
  ) => void
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-ledger-'))
  directories.push(directory)
  const registry = new ProfileRegistry({
    userDataDirectory: directory,
    clock: profileClock,
  })
  const profile = registry.createProfile('Ledger test')
  let fixtureDatabase: Database.Database | undefined
  const paths = registry.getProfilePaths(profile.id)
  const application = await openProfileApplication({
    migrations: arrange
      ? migrations.map((migration) => ({
          ...migration,
          apply(database) {
            migration.apply(database)
            fixtureDatabase = database
          },
        }))
      : migrations,
    profile,
    paths,
    clock: profileClock,
  })
  applications.push(application)
  // Batch the performance fixture in one outer transaction to avoid 20 000
  // durable commits. Financial writes and assertions still use the application
  // API; the connection is available only through the public migration seam.
  if (arrange)
    fixtureDatabase!.transaction(() => arrange(application, fixtureDatabase!))()
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
  expect(application.queries.listTransactions().rows).toEqual([first, second])
})

test.each([
  ['Élelmiszer', 'élelmiszer'],
  ['Ärztin', 'ärztin'],
])(
  'reuses the oldest payee for Unicode case variants %s and %s',
  async (firstName, secondName) => {
    const application = await setup()
    const account = application.commands.createAccount({
      name: 'Cash',
      currency: 'HUF',
      openingBalance: 0,
      openingDate: '2026-01-01',
    })
    const input = {
      accountId: account.id,
      kind: 'expense' as const,
      date: '2026-01-15',
      totalMinor: 100,
      categoryId: null,
      note: '',
    }
    const first = application.commands.createTransaction({
      ...input,
      payeeName: firstName,
    })
    const second = application.commands.createTransaction({
      ...input,
      payeeName: secondName,
    })
    expect(second.payeeId).toBe(first.payeeId)
    expect(second.payeeName).toBe(firstName)
  },
)

test('excluded expenses and income stay in balances but not filtered-set or daily totals', async () => {
  const application = await setup()
  const huf = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 10000,
    openingDate: '2026-01-01',
  })
  const chf = application.commands.createAccount({
    name: 'Bank',
    currency: 'CHF',
    openingBalance: 20000,
    openingDate: '2026-01-01',
  })
  const create = (
    accountId: string,
    kind: 'expense' | 'income',
    totalMinor: number,
    excluded = false,
    date = '2026-01-15',
  ) =>
    application.commands.createTransaction({
      accountId,
      kind,
      totalMinor,
      excluded,
      date,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  create(huf.id, 'expense', 300)
  create(huf.id, 'income', 500)
  const excludedExpense = create(huf.id, 'expense', 1200, true)
  create(chf.id, 'income', 700)
  const excludedIncome = create(chf.id, 'income', 2300, true, '2026-01-14')

  expect(excludedExpense.excluded).toBe(true)
  expect(excludedIncome.excluded).toBe(true)
  expect(application.queries.getAccountBalance(huf.id)).toBe(9000)
  expect(application.queries.getAccountBalance(chf.id)).toBe(23000)
  const page = application.queries.listTransactions({ limit: 1 })
  expect(page.rows).toHaveLength(1)
  expect(page.totalCount).toBe(5)
  expect(page.totals).toEqual([
    { currency: 'CHF', expenseMinor: 0, incomeMinor: 700 },
    { currency: 'HUF', expenseMinor: 300, incomeMinor: 500 },
  ])
  expect(page.days).toEqual([
    {
      date: '2026-01-15',
      totals: [
        { currency: 'CHF', expenseMinor: 0, incomeMinor: 700 },
        { currency: 'HUF', expenseMinor: 300, incomeMinor: 500 },
      ],
    },
    {
      date: '2026-01-14',
      totals: [{ currency: 'CHF', expenseMinor: 0, incomeMinor: 0 }],
    },
  ])
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
  expect(application.queries.listTransactions().rows).toEqual([])
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
  expect(application.queries.listTransactions().rows).toEqual([saved])
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
  expect(application.queries.listTransactions().rows).toHaveLength(1)
})

test('undoes transaction delete, edit, and create in reverse order with exact aggregate images', async () => {
  let now = new Date('2026-01-15T10:00:00.000Z')
  const application = await setup({ profileClock: () => now })
  const firstAccount = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 1000,
    openingDate: '2026-01-01',
  })
  const secondAccount = application.commands.createAccount({
    name: 'Bank',
    currency: 'CHF',
    openingBalance: 2000,
    openingDate: '2026-01-01',
  })
  const expenseCategory = application.queries.listCategoryOptions('expense')[0]
  const incomeCategory = application.queries.listCategoryOptions('income')[0]
  const created = application.commands.createTransaction({
    accountId: firstAccount.id,
    kind: 'expense',
    date: '2026-01-14',
    totalMinor: 250,
    payeeName: 'Original payee',
    categoryId: expenseCategory.id,
    note: 'Original note',
  })
  now = new Date('2026-01-15T11:00:00.000Z')
  const edited = application.commands.updateTransaction({
    id: created.id,
    accountId: secondAccount.id,
    kind: 'income',
    date: '2026-01-13',
    totalMinor: 475,
    payeeName: 'Edited payee',
    categoryId: incomeCategory.id,
    note: 'Edited note',
  })
  application.commands.deleteTransaction(edited.id)

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([edited])
  expect(application.queries.getAccountBalance(secondAccount.id)).toBe(2475)

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([created])
  expect(application.queries.listPayees()).toEqual([
    {
      id: created.payeeId,
      name: 'Original payee',
      createdAt: created.createdAt,
    },
  ])
  expect(application.queries.getAccountBalance(firstAccount.id)).toBe(750)
  expect(application.queries.getAccountBalance(secondAccount.id)).toBe(2000)

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.queries.listPayees()).toEqual([])
  expect(application.queries.getAccountBalance(firstAccount.id)).toBe(1000)
  expect(application.commands.undoLast()).toBe(false)
})

test('undo restores the excluded flag and exact transaction after toggling, deleting, and creating', async () => {
  let now = new Date('2026-01-15T10:00:00.000Z')
  const application = await setup({ profileClock: () => now })
  const account = application.commands.createAccount({
    name: 'Reimbursement',
    currency: 'CHF',
    openingBalance: 10000,
    openingDate: '2026-01-01',
  })
  const input = {
    accountId: account.id,
    kind: 'expense' as const,
    date: '2026-01-15',
    totalMinor: 1200,
    payeeName: 'Travel shop',
    categoryId: null,
    note: 'To be reimbursed',
    excluded: true,
  }
  const created = application.commands.createTransaction(input)
  now = new Date('2026-01-15T11:00:00.000Z')
  const included = application.commands.updateTransaction({
    ...input,
    id: created.id,
    excluded: false,
  })
  expect(included.excluded).toBe(false)
  expect(included.updatedAt).toBe('2026-01-15T11:00:00.000Z')
  expect(application.queries.listTransactions().totals).toEqual([
    { currency: 'CHF', expenseMinor: 1200, incomeMinor: 0 },
  ])
  expect(application.queries.getAccountBalance(account.id)).toBe(8800)

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([created])
  expect(application.queries.listTransactions().totals).toEqual([
    { currency: 'CHF', expenseMinor: 0, incomeMinor: 0 },
  ])
  application.commands.deleteTransaction(created.id)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([created])
  expect(application.queries.getAccountBalance(account.id)).toBe(8800)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.queries.listPayees()).toEqual([])
  expect(application.queries.getAccountBalance(account.id)).toBe(10000)
  expect(application.commands.undoLast()).toBe(false)
})

test('rejects non-boolean excluded flags without partial writes or losing undo history', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const input = {
    accountId: account.id,
    kind: 'expense' as const,
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: 'Valid payee',
    categoryId: null,
    note: '',
  }
  const original = application.commands.createTransaction(input)
  for (const excluded of [null, 0, 1, 'true', {}, []]) {
    expect(() =>
      application.commands.createTransaction({
        ...input,
        payeeName: 'Must not be created',
        excluded,
      } as never),
    ).toThrow('transactions.error.excluded')
    expect(() =>
      application.commands.updateTransaction({
        ...input,
        id: original.id,
        payeeName: 'Must not be created',
        excluded,
      } as never),
    ).toThrow('transactions.error.excluded')
  }
  expect(application.queries.listTransactions().rows).toEqual([original])
  expect(application.queries.listPayees().map(({ name }) => name)).toEqual([
    'Valid payee',
  ])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
})

test('a successful non-undoable write clears transaction undo history', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Before rename',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const transaction = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })

  application.commands.renameAccount({ id: account.id, name: 'After rename' })

  expect(application.commands.undoLast()).toBe(false)
  expect(application.queries.listTransactions().rows).toEqual([transaction])
})

test('a failed transaction command preserves the preceding undo entry', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const transaction = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  expect(() =>
    application.commands.updateTransaction({
      ...transaction,
      date: '2026-01-16',
      payeeName: null,
      categoryId: null,
    }),
  ).toThrow('transactions.error.futureDate')

  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
})

test('edits other fields while keeping archived account and category references unchanged', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Old account',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const category = application.commands.createCategory({
    name: 'Old category',
    kind: 'expense',
  })
  const transaction = application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: category.id,
    note: '',
  })
  application.commands.archiveAccount(account.id)
  application.commands.archiveCategory(category.id)
  const edited = application.commands.updateTransaction({
    id: transaction.id,
    accountId: account.id,
    kind: 'expense',
    date: transaction.date,
    totalMinor: transaction.totalMinor,
    payeeName: null,
    categoryId: category.id,
    note: 'Kept history',
  })
  expect(edited.note).toBe('Kept history')

  const otherAccount = application.commands.createAccount({
    name: 'Other archived account',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  application.commands.archiveAccount(otherAccount.id)
  expect(() =>
    application.commands.updateTransaction({
      ...edited,
      accountId: otherAccount.id,
      payeeName: null,
      categoryId: category.id,
    }),
  ).toThrow('transactions.error.account')
})

test('filtered and daily totals aggregate transaction lines rather than header totals', async () => {
  let transactionId = ''
  const application = await setup({
    arrange(application, database) {
      const account = application.commands.createAccount({
        name: 'Split fixture',
        currency: 'HUF',
        openingBalance: 0,
        openingDate: '2026-01-01',
      })
      const transaction = application.commands.createTransaction({
        accountId: account.id,
        kind: 'expense',
        date: '2026-01-15',
        totalMinor: 500,
        payeeName: null,
        categoryId: null,
        note: '',
      })
      transactionId = transaction.id
      database
        .prepare('UPDATE transaction_lines SET amount_minor = 200 WHERE id = ?')
        .run(transaction.line.id)
      database
        .prepare(
          'INSERT INTO transaction_lines (id, transaction_id, amount_minor, category_id) VALUES (?, ?, ?, NULL)',
        )
        .run('00000000-0000-4000-8000-000000000001', transaction.id, 200)
    },
  })
  const page = application.queries.listTransactions({ offset: 1 })
  expect(page.rows).toEqual([])
  expect(page.totalCount).toBe(1)
  expect(page.totals).toEqual([
    { currency: 'HUF', expenseMinor: 400, incomeMinor: 0 },
  ])
  expect(page.days).toEqual([
    {
      date: '2026-01-15',
      totals: [{ currency: 'HUF', expenseMinor: 400, incomeMinor: 0 }],
    },
  ])
  expect(transactionId).not.toBe('')
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
  expect(application.queries.listTransactions().rows[0]).toEqual({
    ...transaction,
    line: { ...transaction.line, categoryId: replacement.id },
  })
  expect(application.queries.hasCategoryTransactions(replacement.id)).toBe(true)
})

test('combines list filters and returns whole-set and daily totals independently of the page', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Filter account',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2025-01-01',
  })
  const main = application.commands.createCategory({
    name: 'Main',
    kind: 'expense',
    parentId: null,
  })
  const child = application.commands.createCategory({
    name: 'Child',
    kind: 'expense',
    parentId: main.id,
  })
  const create = (
    date: string,
    totalMinor: number,
    categoryId: string | null,
    note = 'Árvíztűrő',
    accountId = account.id,
    payeeName = 'Café',
  ) =>
    application.commands.createTransaction({
      accountId,
      kind: 'expense',
      date,
      totalMinor,
      categoryId,
      payeeName,
      note,
    })
  const older = create('2026-01-14', 200, child.id)
  const newest = create('2026-01-15', 300, main.id)
  create('2025-12-31', 999, child.id)
  create('2026-01-15', 999, null)
  create('2026-01-15', 999, child.id, 'Other')
  const otherAccount = application.commands.createAccount({
    name: 'Other filter account',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2025-01-01',
  })
  create('2026-01-15', 999, child.id, 'Árvíztűrő', otherAccount.id)
  create('2026-01-15', 999, child.id, 'Árvíztűrő', account.id, 'Other payee')
  const input = {
    period: 'thisMonth' as const,
    accountId: account.id,
    categoryId: main.id,
    payeeId: newest.payeeId!,
    search: 'ARVIZTURO',
    limit: 1,
  }
  const page = application.queries.listTransactions(input)
  expect(page.rows).toEqual([newest])
  expect(page.totalCount).toBe(2)
  expect(page.totals).toEqual([
    { currency: 'CHF', expenseMinor: 500, incomeMinor: 0 },
  ])
  expect(page.days).toEqual([
    {
      date: '2026-01-15',
      totals: [{ currency: 'CHF', expenseMinor: 300, incomeMinor: 0 }],
    },
    {
      date: '2026-01-14',
      totals: [{ currency: 'CHF', expenseMinor: 200, incomeMinor: 0 }],
    },
  ])
  expect(
    application.queries.listTransactions({ ...input, offset: 1 }).rows,
  ).toEqual([older])
  expect(
    application.queries.listTransactions({ search: 'CAFE' }).totalCount,
  ).toBe(6)
})

test('all, only excluded, and hide excluded filters combine with other filters and preserve paging totals', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Claims',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2025-01-01',
  })
  const category = application.queries.listCategoryOptions('expense')[0]
  const input = {
    accountId: account.id,
    kind: 'expense' as const,
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: 'Railway',
    categoryId: category.id,
    note: 'Work travel',
  }
  const included = application.commands.createTransaction(input)
  const excluded = application.commands.createTransaction({
    ...input,
    excluded: true,
    totalMinor: 200,
  })
  const olderExcluded = application.commands.createTransaction({
    ...input,
    excluded: true,
    totalMinor: 300,
    date: '2026-01-14',
  })
  application.commands.createTransaction({
    ...input,
    excluded: true,
    note: 'Holiday',
  })
  application.commands.createTransaction({
    ...input,
    excluded: true,
    date: '2025-12-31',
  })
  const query = {
    period: 'thisMonth' as const,
    accountId: account.id,
    categoryId: category.id,
    payeeId: included.payeeId!,
    search: 'work',
    limit: 1,
  }
  expect(included.excluded).toBe(false)
  const all = application.queries.listTransactions({
    ...query,
    exclusion: 'all',
  })
  expect(all.totalCount).toBe(3)
  expect(all.totals).toEqual([
    { currency: 'CHF', expenseMinor: 100, incomeMinor: 0 },
  ])
  const only = application.queries.listTransactions({
    ...query,
    exclusion: 'onlyExcluded',
  })
  expect(only.rows).toEqual([excluded])
  expect(only.totalCount).toBe(2)
  expect(only.totals).toEqual([
    { currency: 'CHF', expenseMinor: 0, incomeMinor: 0 },
  ])
  expect(only.days).toEqual([
    {
      date: '2026-01-15',
      totals: [{ currency: 'CHF', expenseMinor: 0, incomeMinor: 0 }],
    },
    {
      date: '2026-01-14',
      totals: [{ currency: 'CHF', expenseMinor: 0, incomeMinor: 0 }],
    },
  ])
  expect(
    application.queries.listTransactions({
      ...query,
      exclusion: 'onlyExcluded',
      offset: 1,
    }).rows,
  ).toEqual([olderExcluded])
  const hidden = application.queries.listTransactions({
    ...query,
    exclusion: 'hideExcluded',
  })
  expect(hidden.rows).toEqual([included])
  expect(hidden.totalCount).toBe(1)
  expect(hidden.totals).toEqual([
    { currency: 'CHF', expenseMinor: 100, incomeMinor: 0 },
  ])
})

test('resolves preset boundaries from the clock and custom endpoints inclusively with separate currencies', async () => {
  const application = await setup()
  const createAccount = (currency: 'HUF' | 'CHF') =>
    application.commands.createAccount({
      name: currency,
      currency,
      openingBalance: 0,
      openingDate: '2024-01-01',
    })
  const huf = createAccount('HUF')
  const chf = createAccount('CHF')
  for (const [date, accountId, kind, totalMinor] of [
    ['2025-11-30', huf.id, 'expense', 10],
    ['2025-12-01', huf.id, 'expense', 100],
    ['2025-12-31', chf.id, 'income', 200],
    ['2026-01-01', chf.id, 'expense', 300],
    ['2026-01-15', huf.id, 'income', 400],
    ['2026-01-15', chf.id, 'expense', 500],
  ] as const)
    application.commands.createTransaction({
      accountId,
      kind,
      date,
      totalMinor,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  const last = application.queries.listTransactions({
    period: 'lastMonth',
    limit: 1,
  })
  expect(last.totalCount).toBe(2)
  expect(last.totals).toEqual([
    { currency: 'CHF', expenseMinor: 0, incomeMinor: 200 },
    { currency: 'HUF', expenseMinor: 100, incomeMinor: 0 },
  ])
  const month = application.queries.listTransactions({ period: 'thisMonth' })
  expect(month.totalCount).toBe(3)
  expect(month.totals).toEqual([
    { currency: 'CHF', expenseMinor: 800, incomeMinor: 0 },
    { currency: 'HUF', expenseMinor: 0, incomeMinor: 400 },
  ])
  expect(month.days[0]).toEqual({
    date: '2026-01-15',
    totals: [
      { currency: 'CHF', expenseMinor: 500, incomeMinor: 0 },
      { currency: 'HUF', expenseMinor: 0, incomeMinor: 400 },
    ],
  })
  expect(
    application.queries.listTransactions({ period: 'thisYear' }).totalCount,
  ).toBe(3)
  expect(
    application.queries
      .listTransactions({
        period: 'custom',
        from: '2025-12-31',
        to: '2026-01-01',
      })
      .rows.map((row) => row.date),
  ).toEqual(['2026-01-01', '2025-12-31'])
  const empty = application.queries.listTransactions({ search: 'missing' })
  expect(empty).toEqual({ rows: [], totalCount: 0, totals: [], days: [] })
  expect(application.queries.listTransactions({ offset: 100 }).totals).toEqual(
    application.queries.listTransactions().totals,
  )
})

test('rejects malformed query inputs at the application boundary', async () => {
  const application = await setup()
  for (const input of [
    null,
    [],
    'query',
    { limit: 0 },
    { limit: 501 },
    { limit: 1.5 },
    { offset: -1 },
    { offset: '0' },
    { period: 'unknown' },
    { exclusion: 'unknown' },
    { exclusion: null },
    { exclusion: true },
    { exclusion: ['all'] },
    { period: ['all'] },
    { period: null },
    { offset: null },
    { limit: null },
    { accountId: 'invalid' },
    { categoryId: 123 },
    { payeeId: '../other' },
    { search: {} },
    { search: 'x'.repeat(1001) },
    { period: 'custom' },
    { period: 'custom', from: '2025-02-29', to: '2026-01-01' },
    { period: 'custom', from: '2026-01-02', to: '2026-01-01' },
    { from: '2026-01-01' },
  ]) {
    expect(() => application.queries.listTransactions(input as never)).toThrow(
      'transactions.error.filters',
    )
  }
})

test('pages equal-date transactions deterministically and keeps archived history filterable', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Archived history',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const main = application.commands.createCategory({
    name: 'History',
    kind: 'expense',
    parentId: null,
  })
  const child = application.commands.createCategory({
    name: 'Child history',
    kind: 'expense',
    parentId: main.id,
  })
  const create = (categoryId: string) =>
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date: '2026-01-15',
      totalMinor: 100,
      categoryId,
      payeeName: null,
      note: '',
    })
  create(main.id)
  create(child.id)
  create(child.id)
  application.commands.archiveAccount(account.id)
  application.commands.archiveCategory(main.id)
  const query = { accountId: account.id, categoryId: main.id }
  const complete = application.queries.listTransactions(query)
  const ids = [0, 1, 2].map(
    (offset) =>
      application.queries.listTransactions({ ...query, offset, limit: 1 })
        .rows[0].id,
  )
  expect(ids).toEqual(complete.rows.map((row) => row.id))
  expect(new Set(ids).size).toBe(3)
  expect(
    application.queries.listTransactions({ categoryId: child.id }).totalCount,
  ).toBe(2)
  expect(complete.totals).toEqual([
    { currency: 'HUF', expenseMinor: 300, incomeMinor: 0 },
  ])
  expect(
    application.queries.listTransactions({ ...query, payeeId: main.id })
      .totalCount,
  ).toBe(0)
})

test('refuses filtered totals outside exact integer precision', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Large totals',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  for (const date of ['2026-01-14', '2026-01-15'])
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'income',
      date,
      totalMinor: Number.MAX_SAFE_INTEGER,
      categoryId: null,
      payeeName: null,
      note: '',
    })
  expect(() => application.queries.listTransactions()).toThrow(
    'transactions.error.totals',
  )
})

test('returns a filtered first page and whole-set totals quickly in a 20 000-transaction profile', async () => {
  const application = await setup({
    arrange(application) {
      const first = application.commands.createAccount({
        name: 'Performance CHF',
        currency: 'CHF',
        openingBalance: 0,
        openingDate: '2025-01-01',
      })
      const second = application.commands.createAccount({
        name: 'Performance HUF',
        currency: 'HUF',
        openingBalance: 0,
        openingDate: '2025-01-01',
      })
      const main = application.commands.createCategory({
        name: 'Performance main',
        kind: 'expense',
        parentId: null,
      })
      const child = application.commands.createCategory({
        name: 'Performance child',
        kind: 'expense',
        parentId: main.id,
      })
      for (let index = 0; index < 20_000; index++) {
        application.commands.createTransaction({
          accountId: index % 2 ? first.id : second.id,
          kind: 'expense',
          date: `2025-12-${String((index % 28) + 1).padStart(2, '0')}`,
          totalMinor: 100,
          categoryId: child.id,
          payeeName: 'Café performance',
          note: 'Árvíztűrő test',
        })
      }
    },
  })
  const first = application.queries
    .listAccounts()
    .find((account) => account.currency === 'CHF')!
  const main = application.queries
    .listCategories()
    .find((category) => category.name === 'Performance main')!
  const payee = application.queries.listPayees()[0]
  const query = {
    period: 'lastMonth' as const,
    accountId: first.id,
    categoryId: main.id,
    payeeId: payee.id,
    search: 'ARVIZTURO',
    limit: 100,
  }
  // Best of three runs: the bound measures the query, not a cold cache or a
  // momentarily busy machine.
  let page = application.queries.listTransactions(query)
  let elapsed = Number.POSITIVE_INFINITY
  for (let run = 0; run < 3; run += 1) {
    const started = performance.now()
    page = application.queries.listTransactions(query)
    elapsed = Math.min(elapsed, performance.now() - started)
  }
  console.info(
    `20 000 transactions: filtered page + totals ${elapsed.toFixed(1)} ms`,
  )
  expect(page.rows).toHaveLength(100)
  expect(page.totalCount).toBe(10_000)
  expect(page.totals).toEqual([
    { currency: 'CHF', expenseMinor: 1_000_000, incomeMinor: 0 },
  ])
  expect(
    page.days.reduce((sum, day) => sum + day.totals[0].expenseMinor, 0),
  ).toBe(1_000_000)
  // Generous headroom for shared CI runners; this measures the query, not fixture writes.
  expect(elapsed).toBeLessThan(process.env.CI ? 1500 : 500)
}, 180_000)

test('period presets distinguish months from years and include leap-day history', async () => {
  const application = await setup({
    profileClock: () => new Date('2024-03-15T10:00:00.000Z'),
  })
  const account = application.commands.createAccount({
    name: 'Calendar',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2023-01-01',
  })
  for (const date of [
    '2023-12-31',
    '2024-01-01',
    '2024-02-01',
    '2024-02-29',
    '2024-03-01',
    '2024-03-15',
  ]) {
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date,
      totalMinor: 100,
      categoryId: null,
      payeeName: null,
      note: '',
    })
  }
  expect(
    application.queries
      .listTransactions({ period: 'thisMonth' })
      .rows.map((row) => row.date),
  ).toEqual(['2024-03-15', '2024-03-01'])
  expect(
    application.queries
      .listTransactions({ period: 'lastMonth' })
      .rows.map((row) => row.date),
  ).toEqual(['2024-02-29', '2024-02-01'])
  expect(
    application.queries.listTransactions({ period: 'thisYear' }).totalCount,
  ).toBe(5)
})

test('newer creation timestamps win on the same calendar day', async () => {
  let now = new Date('2026-01-15T10:00:00.000Z')
  const application = await setup({ profileClock: () => now })
  const account = application.commands.createAccount({
    name: 'Order',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const input = {
    accountId: account.id,
    kind: 'income' as const,
    date: '2026-01-15',
    totalMinor: 100,
    categoryId: null,
    payeeName: null,
    note: '',
  }
  const older = application.commands.createTransaction(input)
  now = new Date('2026-01-15T10:00:01.000Z')
  const newer = application.commands.createTransaction(input)
  expect(application.queries.listTransactions().rows).toEqual([newer, older])
})

test('upgrades the previous ledger schema and keeps transaction filters and totals intact', async () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-list-upgrade-'),
  )
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('List upgrade')
  const paths = registry.getProfilePaths(profile.id)
  const previous = await openProfileApplication({
    profile,
    paths,
    clock,
    migrations: CURRENT_MIGRATIONS.slice(0, 5),
  })
  applications.push(previous)
  const account = previous.commands.createAccount({
    name: 'History',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2025-01-01',
  })
  const category = previous.queries.listCategoryOptions('income')[0]
  const transaction = previous.commands.createTransaction({
    accountId: account.id,
    kind: 'income',
    date: '2026-01-15',
    totalMinor: 12345,
    categoryId: category.id,
    payeeName: 'Café',
    note: 'Upgrade',
  })
  previous.close()
  applications.pop()
  const upgraded = await openProfileApplication({ profile, paths, clock })
  applications.push(upgraded)
  expect(
    upgraded.queries.listTransactions({
      accountId: account.id,
      categoryId: category.id,
      search: 'CAFE',
    }),
  ).toEqual({
    rows: [transaction],
    totalCount: 1,
    totals: [{ currency: 'CHF', expenseMinor: 0, incomeMinor: 12345 }],
    days: [
      {
        date: '2026-01-15',
        totals: [{ currency: 'CHF', expenseMinor: 0, incomeMinor: 12345 }],
      },
    ],
  })
})

test('payee-key migration merges Unicode case duplicates and repoints their transactions', async () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-payee-upgrade-'),
  )
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Payee upgrade')
  const paths = registry.getProfilePaths(profile.id)
  const previous = await openProfileApplication({
    profile,
    paths,
    clock,
    migrations: CURRENT_MIGRATIONS.slice(0, 6),
  })
  const account = previous.commands.createAccount({
    name: 'History',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const create = (payeeName: string) =>
    previous.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date: '2026-01-15',
      totalMinor: 100,
      categoryId: null,
      payeeName,
      note: '',
    })
  const oldest = create('Élelmiszer')
  const duplicate = create('élelmiszer')
  expect(duplicate.payeeId).not.toBe(oldest.payeeId)
  previous.close()

  const upgraded = await openProfileApplication({ profile, paths, clock })
  applications.push(upgraded)
  expect(upgraded.queries.listPayees()).toEqual([
    { id: oldest.payeeId, name: 'Élelmiszer', createdAt: oldest.createdAt },
  ])
  expect(
    upgraded.queries
      .listTransactions()
      .rows.map((row) =>
        row.kind === 'expense' || row.kind === 'income' ? row.payeeId : null,
      ),
  ).toEqual([oldest.payeeId, oldest.payeeId])
})

test('upgrades existing transactions as included and persists exclusion across reopening', async () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'financial-tracker-excluded-upgrade-'),
  )
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Excluded upgrade')
  const paths = registry.getProfilePaths(profile.id)
  const previous = await openProfileApplication({
    profile,
    paths,
    clock,
    migrations: CURRENT_MIGRATIONS.slice(0, 7),
  })
  applications.push(previous)
  const account = previous.commands.createAccount({
    name: 'History',
    currency: 'CHF',
    openingBalance: 10000,
    openingDate: '2026-01-01',
  })
  const input = {
    accountId: account.id,
    kind: 'expense' as const,
    date: '2026-01-15',
    totalMinor: 1200,
    payeeName: 'History payee',
    categoryId: null,
    note: 'Before upgrade',
  }
  const original = previous.commands.createTransaction(input)
  previous.close()
  const upgraded = await openProfileApplication({ profile, paths, clock })
  applications.push(upgraded)
  expect(upgraded.queries.listTransactions().rows).toEqual([
    { ...original, excluded: false },
  ])
  expect(upgraded.queries.listTransactions().totals).toEqual([
    { currency: 'CHF', expenseMinor: 1200, incomeMinor: 0 },
  ])
  const excluded = upgraded.commands.updateTransaction({
    ...input,
    id: original.id,
    excluded: true,
  })
  expect(excluded.excluded).toBe(true)
  expect(upgraded.commands.undoLast()).toBe(true)
  expect(upgraded.queries.listTransactions().rows).toEqual([
    { ...original, excluded: false },
  ])
  upgraded.commands.updateTransaction({
    ...input,
    id: original.id,
    excluded: true,
  })
  const edited = upgraded.commands.updateTransaction({
    ...input,
    id: original.id,
    note: 'Still excluded',
  })
  expect(edited.excluded).toBe(true)
  upgraded.close()

  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  const page = reopened.queries.listTransactions({ exclusion: 'onlyExcluded' })
  expect(page.rows).toEqual([edited])
  expect(page.totals).toEqual([
    { currency: 'CHF', expenseMinor: 0, incomeMinor: 0 },
  ])
  expect(reopened.queries.getAccountBalance(account.id)).toBe(8800)
  expect(reopened.commands.undoLast()).toBe(false)
})
