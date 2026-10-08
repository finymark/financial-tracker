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
import { openDatabase } from '../db'

const directories: string[] = []
const applications: ProfileApplication[] = []
const clock = () => new Date('2026-01-15T10:00:00.000Z')

async function setup(migrations = CURRENT_MIGRATIONS) {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-templates-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Templates test')
  const paths = registry.getProfilePaths(profile.id)
  const application = await openProfileApplication({
    profile,
    paths,
    clock,
    migrations,
  })
  applications.push(application)
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const input = {
    accountId: account.id,
    kind: 'expense' as const,
    date: '2026-01-02',
    totalMinor: 12345,
    payeeName: 'Café',
    categoryId: application.queries.listCategoryOptions('expense')[0].id,
    note: 'Repeat purchase',
    tagNames: ['Trip', 'Project'],
    excluded: true,
  }
  return { application, input, profile, paths }
}

afterEach(() => {
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('duplicates a transaction with today from the injected clock, fresh identifiers, all fields and reusable tags; undo removes only the copy', async () => {
  const { application, input } = await setup()
  const original = application.commands.createTransaction(input)
  const copyId = application.commands.duplicateTransaction(original.id)
  const copy = application.queries
    .listTransactions()
    .rows.find((row) => row.id === copyId)
  expect(copy).toEqual({
    ...original,
    id: copyId,
    date: '2026-01-15',
    line: { ...original.line, id: expect.any(String) },
  })
  expect(copyId).not.toBe(original.id)
  expect(copy && copy.kind !== 'transfer' && copy.line.id).not.toBe(
    original.line.id,
  )
  expect(application.queries.getAccountBalance(input.accountId)).toBe(-24690)
  expect(application.queries.listTransactions().totals).toEqual([
    { currency: 'CHF', expenseMinor: 0, incomeMinor: 0 },
  ])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([original])
  expect(application.queries.listTags()).toEqual(original.line.tags)
  expect(application.queries.listPayees()).toHaveLength(1)
  expect(application.queries.getAccountBalance(input.accountId)).toBe(-12345)
})

test('creates a named transaction template with every transaction field optional and undo removes it without changing the ledger', async () => {
  const { application } = await setup()
  const template = application.commands.createTemplate({
    name: '  Variable bill  ',
  })
  expect(template).toEqual({
    id: expect.any(String),
    name: 'Variable bill',
    kind: null,
    accountId: null,
    totalMinor: null,
    payeeName: null,
    categoryId: null,
    tagNames: [],
    note: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  })
  expect(application.queries.listTemplates()).toEqual([template])
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.queries.listPayees()).toEqual([])
  expect(application.queries.listTags()).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([])
})

test('saves an unsplit transaction as a template, edits optional fields, and undoes delete, edit and create without changing its source', async () => {
  const { application, input } = await setup()
  const source = application.commands.createTransaction(input)
  const saved = application.commands.saveTransactionAsTemplate({
    transactionId: source.id,
    name: 'Purchase',
  })
  expect(saved).toMatchObject({
    name: 'Purchase',
    kind: 'expense',
    accountId: input.accountId,
    totalMinor: 12345,
    payeeName: 'Café',
    categoryId: input.categoryId,
    tagNames: ['Project', 'Trip'],
    note: 'Repeat purchase',
  })
  const edited = application.commands.updateTemplate({
    id: saved.id,
    name: 'Variable bill',
    payeeName: 'New payee',
    tagNames: ['New tag'],
    note: 'New note',
  })
  expect(edited).toEqual({
    ...saved,
    name: 'Variable bill',
    kind: null,
    accountId: null,
    totalMinor: null,
    categoryId: null,
    payeeName: 'New payee',
    tagNames: ['New tag'],
    note: 'New note',
  })
  application.commands.deleteTemplate(saved.id)
  expect(application.queries.listTemplates()).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([edited])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([saved])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([])
  expect(application.queries.listTransactions().rows).toEqual([source])
  expect(application.queries.listPayees().map((payee) => payee.name)).toEqual([
    'Café',
  ])
  expect(application.queries.listTags()).toEqual(source.line.tags)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
})

test('validates optional template fields and references atomically while preserving undo history', async () => {
  const { application, input } = await setup()
  const template = application.commands.createTemplate({
    name: 'Keep me',
    kind: 'expense',
    categoryId: input.categoryId,
  })
  const incomeCategory = application.queries.listCategoryOptions('income')[0].id
  const missing = '00000000-0000-4000-8000-000000000001'
  for (const [fields, error] of [
    [{ name: '' }, 'templates.error.name'],
    [{ name: 'x'.repeat(101) }, 'templates.error.name'],
    [{ kind: 'transfer' }, 'transactions.error.kind'],
    [{ accountId: missing }, 'transactions.error.account'],
    [{ categoryId: missing }, 'transactions.error.category'],
    [
      { kind: 'expense', categoryId: incomeCategory },
      'transactions.error.category',
    ],
    [{ totalMinor: 0 }, 'transactions.error.amount'],
    [{ totalMinor: 1.2 }, 'transactions.error.amount'],
    [{ totalMinor: Number.MAX_SAFE_INTEGER + 1 }, 'transactions.error.amount'],
    [{ payeeName: 'x'.repeat(101) }, 'transactions.error.payee'],
    [{ tagNames: ['Valid', ''] }, 'tags.error.name'],
    [{ note: 'x'.repeat(1001) }, 'transactions.error.note'],
  ] as const) {
    expect(() =>
      application.commands.createTemplate({
        name: 'Invalid',
        ...fields,
      } as never),
    ).toThrow(error)
    expect(() =>
      application.commands.updateTemplate({
        id: template.id,
        name: 'Invalid',
        ...fields,
      } as never),
    ).toThrow(error)
  }
  expect(() => application.commands.deleteTemplate(missing)).toThrow(
    'templates.error.notFound',
  )
  expect(() =>
    application.commands.saveTransactionAsTemplate({
      transactionId: missing,
      name: 'Missing',
    }),
  ).toThrow('transactions.error.notFound')
  expect(() => application.commands.duplicateTransaction(missing)).toThrow(
    'transactions.error.notFound',
  )
  expect(() => application.commands.duplicateTransaction('invalid')).toThrow(
    'transactions.error.notFound',
  )
  expect(application.queries.listTemplates()).toEqual([template])
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([])
})

test('templates accept independent optional fields and using a variable-amount prefill still requires a positive amount', async () => {
  const { application, input } = await setup()
  const categoryOnly = application.commands.createTemplate({
    name: 'Category',
    categoryId: input.categoryId,
  })
  expect(categoryOnly.kind).toBeNull()
  expect(categoryOnly.categoryId).toBe(input.categoryId)
  const template = application.commands.createTemplate({
    name: 'Variable',
    accountId: input.accountId,
    payeeName: '  Cafe  ',
    tagNames: [' Trip ', 'trip'],
    note: 'Variable amount',
  })
  expect(template.totalMinor).toBeNull()
  expect(template.payeeName).toBe('Cafe')
  expect(template.tagNames).toEqual(['Trip'])
  expect(application.queries.listPayees()).toEqual([])
  expect(application.queries.listTags()).toEqual([])
  expect(() =>
    application.commands.createTransaction({
      ...input,
      totalMinor: template.totalMinor!,
    }),
  ).toThrow('transactions.error.amount')
  expect(application.queries.listTransactions().totalCount).toBe(0)
  const recorded = application.commands.createTransaction({
    ...input,
    date: '2026-01-15',
    totalMinor: 375,
    payeeName: template.payeeName,
    tagNames: template.tagNames,
    note: template.note!,
  })
  expect(recorded.totalMinor).toBe(375)
  expect(recorded.payeeName).toBe('Cafe')
  expect(recorded.line.tags.map((tag) => tag.name)).toEqual(['Trip'])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual(
    expect.arrayContaining([categoryOnly, template]),
  )
  expect(application.queries.listTransactions().totalCount).toBe(0)
})

test('template and duplicate commands cannot reach another profile and undo remains in the open profile session', async () => {
  const first = await setup()
  const second = await setup()
  const source = first.application.commands.createTransaction(first.input)
  const template = first.application.commands.saveTransactionAsTemplate({
    transactionId: source.id,
    name: 'Private template',
  })
  const other = second.application.commands.createTemplate({
    name: 'Other template',
  })
  expect(second.application.queries.listTemplates()).toEqual([other])
  expect(() =>
    second.application.commands.updateTemplate({
      id: template.id,
      name: 'Wrong',
    }),
  ).toThrow('templates.error.notFound')
  expect(() => second.application.commands.deleteTemplate(template.id)).toThrow(
    'templates.error.notFound',
  )
  expect(() =>
    second.application.commands.duplicateTransaction(source.id),
  ).toThrow('transactions.error.notFound')
  expect(() =>
    second.application.commands.saveTransactionAsTemplate({
      transactionId: source.id,
      name: 'Wrong',
    }),
  ).toThrow('transactions.error.notFound')
  expect(() =>
    second.application.commands.createTemplate({
      name: 'Wrong account',
      accountId: first.input.accountId,
    }),
  ).toThrow('transactions.error.account')
  expect(second.application.commands.undoLast()).toBe(true)
  expect(first.application.queries.listTemplates()).toEqual([template])
  first.application.close()
  const reopened = await openProfileApplication({
    profile: first.profile,
    paths: first.paths,
    clock,
  })
  applications.push(reopened)
  expect(reopened.commands.undoLast()).toBe(false)
  expect(reopened.queries.listTemplates()).toEqual([template])
})

test('the appended template migration preserves the previous ledger and persists templates and copies across reopening', async () => {
  const { application, input, profile, paths } = await setup(
    CURRENT_MIGRATIONS.slice(0, 10),
  )
  const original = application.commands.createTransaction(input)
  const ledger = application.queries.listTransactions()
  application.close()
  const laterClock = () => new Date('2026-01-16T11:00:00.000Z')
  const upgraded = await openProfileApplication({
    profile,
    paths,
    clock: laterClock,
  })
  applications.push(upgraded)
  expect(upgraded.queries.getProfileInfo().schemaVersion).toBe(
    CURRENT_MIGRATIONS.length,
  )
  expect(upgraded.queries.listTransactions()).toEqual(ledger)
  expect(upgraded.queries.listTemplates()).toEqual([])
  const template = upgraded.commands.saveTransactionAsTemplate({
    transactionId: original.id,
    name: 'Saved purchase',
  })
  const copyId = upgraded.commands.duplicateTransaction(original.id)
  const copy = upgraded.queries
    .listTransactions()
    .rows.find((row) => row.id === copyId)
  expect(copy).toMatchObject({
    date: '2026-01-16',
    createdAt: '2026-01-16T11:00:00.000Z',
    updatedAt: '2026-01-16T11:00:00.000Z',
  })
  const saved = upgraded.queries.listTransactions()
  upgraded.close()
  const reopened = await openProfileApplication({
    profile,
    paths,
    clock: laterClock,
  })
  applications.push(reopened)
  expect(reopened.queries.listTemplates()).toEqual([template])
  expect(reopened.queries.listTransactions()).toEqual(saved)
  expect(reopened.commands.undoLast()).toBe(false)
})

test('template tags retain the first spelling when optional names repeat with normalized case', async () => {
  const { application } = await setup()
  const template = application.commands.createTemplate({
    name: 'Trip',
    tagNames: [' Trip ', 'trip', 'TRIP'],
  })
  expect(template.tagNames).toEqual(['Trip'])
})

test('duplicates every stored line and its tags, with line-level totals and undo observed through the application queries', async () => {
  const { application, input, paths } = await setup()
  const source = application.commands.createTransaction({
    ...input,
    totalMinor: 500,
    excluded: false,
    tagNames: ['Trip'],
  })
  const tagged = application.commands.createTransaction({
    ...input,
    tagNames: ['Project'],
  })
  const project = tagged.line.tags[0]
  application.commands.deleteTransaction(tagged.id)
  const secondCategory =
    application.queries.listCategoryOptions('expense')[1].id
  // Arrange a multi-line ledger fixture, as in the existing tag aggregate test.
  // The current drawer is unsplit-only; observations below use the application
  // API's bounded aggregate queries without invoking its single-line row view.
  const database = openDatabase(paths.databasePath)
  try {
    database.transaction(() => {
      database
        .prepare('UPDATE transaction_lines SET amount_minor = 200 WHERE id = ?')
        .run(source.line.id)
      const lineId = '00000000-0000-4000-8000-000000000001'
      database
        .prepare(
          'INSERT INTO transaction_lines (id, transaction_id, amount_minor, category_id) VALUES (?, ?, ?, ?)',
        )
        .run(lineId, source.id, 300, secondCategory)
      database
        .prepare(
          'INSERT INTO transaction_line_tags (line_id, tag_id) VALUES (?, ?)',
        )
        .run(lineId, project.id)
    })()
  } finally {
    database.close()
  }
  const copyId = application.commands.duplicateTransaction(source.id)
  expect(copyId).not.toBe(source.id)
  const tripPage = application.queries.listTransactions({
    tagId: source.line.tags[0].id,
    offset: 500,
  })
  const projectPage = application.queries.listTransactions({
    tagId: project.id,
    offset: 500,
  })
  expect(tripPage.totalCount).toBe(2)
  expect(tripPage.totals).toEqual([
    { currency: 'CHF', expenseMinor: 400, incomeMinor: 0 },
  ])
  expect(projectPage.totalCount).toBe(2)
  expect(projectPage.totals).toEqual([
    { currency: 'CHF', expenseMinor: 600, incomeMinor: 0 },
  ])
  expect(
    application.queries.listTransactions({
      categoryId: secondCategory,
      offset: 500,
    }).totalCount,
  ).toBe(2)
  expect(application.queries.getAccountBalance(input.accountId)).toBe(-1000)
  expect(application.commands.undoLast()).toBe(true)
  expect(
    application.queries.listTransactions({
      tagId: source.line.tags[0].id,
      offset: 500,
    }).totals,
  ).toEqual([{ currency: 'CHF', expenseMinor: 200, incomeMinor: 0 }])
  expect(
    application.queries.listTransactions({ tagId: project.id, offset: 500 })
      .totals,
  ).toEqual([{ currency: 'CHF', expenseMinor: 300, incomeMinor: 0 }])
  expect(application.queries.listTransactions({ offset: 500 }).totalCount).toBe(
    1,
  )
  expect(application.queries.getAccountBalance(input.accountId)).toBe(-500)
  expect(application.queries.listTags()).toEqual(
    expect.arrayContaining([project, ...source.line.tags]),
  )
})

test('duplicates income without exclusions and preserves the source when undoing the copy', async () => {
  const { application, input } = await setup()
  const original = application.commands.createTransaction({
    ...input,
    kind: 'income',
    categoryId: application.queries.listCategoryOptions('income')[0].id,
    excluded: false,
  })
  const copyId = application.commands.duplicateTransaction(original.id)
  const copy = application.queries
    .listTransactions()
    .rows.find((row) => row.id === copyId)
  expect(copy).toMatchObject({
    kind: 'income',
    excluded: false,
    totalMinor: 12345,
    date: '2026-01-15',
    payeeId: original.payeeId,
    line: {
      amountMinor: 12345,
      categoryId: original.line.categoryId,
      tags: original.line.tags,
    },
  })
  expect(application.queries.listTransactions().totals).toEqual([
    { currency: 'CHF', expenseMinor: 0, incomeMinor: 24690 },
  ])
  expect(application.queries.getAccountBalance(input.accountId)).toBe(24690)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([original])
  expect(application.queries.getAccountBalance(input.accountId)).toBe(12345)
})

test('deleting unused account and category references clears only those template fields and creates an undo barrier', async () => {
  const { application, input } = await setup()
  const category = application.commands.createCategory({
    name: 'Template category',
    kind: 'expense',
    parentId: null,
  })
  const template = application.commands.createTemplate({
    name: 'Variable bill',
    accountId: input.accountId,
    categoryId: category.id,
    tagNames: ['Trip'],
  })
  application.commands.deleteAccount(input.accountId)
  expect(application.queries.listTemplates()).toEqual([
    { ...template, accountId: null },
  ])
  expect(application.commands.undoLast()).toBe(false)
  application.commands.deleteCategory({ id: category.id })
  expect(application.queries.listTemplates()).toEqual([
    { ...template, accountId: null, categoryId: null },
  ])
  expect(application.commands.undoLast()).toBe(false)
})
