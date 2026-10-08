import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import {
  openProfileApplication,
  CURRENT_MIGRATIONS,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'
import { openDatabase } from '../db'
import type { CreateTransactionInput } from '../../shared/transactions'

const directories: string[] = []
const applications: ProfileApplication[] = []
const clock = () => new Date('2026-01-15T10:00:00.000Z')

async function setup(migrations = CURRENT_MIGRATIONS) {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-tags-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Tags test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    migrations,
    clock,
  })
  applications.push(application)
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const input: CreateTransactionInput = {
    accountId: account.id,
    kind: 'expense' as const,
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  }
  return {
    application,
    input,
    profile,
    paths: registry.getProfilePaths(profile.id),
  }
}

afterEach(() => {
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('creates several tags inline and reuses Unicode-normalized case variants without duplicate associations', async () => {
  const { application, input } = await setup()
  const first = application.commands.createTransaction({
    ...input,
    tagNames: ['  Élelmiszer  ', 'Ärztin', 'vacation-2025', 'élelmiszer'],
  })
  const second = application.commands.createTransaction({
    ...input,
    tagNames: ['E\u0301LELMISZER', 'ärztin'],
  })
  expect(first.line.tags.map((tag) => tag.name)).toEqual([
    'vacation-2025',
    'Ärztin',
    'Élelmiszer',
  ])
  expect(second.line.tags).toEqual(
    first.line.tags.filter((tag) => tag.name !== 'vacation-2025'),
  )
  expect(application.queries.listTags()).toEqual(first.line.tags)
  expect(application.queries.listTransactions().rows).toContainEqual(first)
})

test('tag filter combines with existing filters and whole-set daily totals without multiplying tagged transactions', async () => {
  const { application, input } = await setup()
  const category = application.queries.listCategoryOptions('expense')[0]
  const create = (overrides: Partial<CreateTransactionInput>) =>
    application.commands.createTransaction({
      ...input,
      categoryId: category.id,
      payeeName: 'Café',
      note: 'Árvíztűrő',
      tagNames: ['Trip', 'Project'],
      ...overrides,
    })
  create({ totalMinor: 200 })
  const tagged = create({ totalMinor: 300 })
  create({ totalMinor: 999, tagNames: ['Project'] })
  create({ totalMinor: 999, date: '2025-12-31' })
  create({ totalMinor: 999, categoryId: null })
  create({ totalMinor: 999, payeeName: 'Other' })
  create({ totalMinor: 999, note: 'Other' })
  create({ kind: 'income', categoryId: null, totalMinor: 700 })
  const huf = application.commands.createAccount({
    name: 'HUF',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  create({ accountId: huf.id, totalMinor: 400 })
  const tagId = tagged.line.tags.find((tag) => tag.name === 'Trip')!.id
  const filters = {
    tagId,
    accountId: input.accountId,
    categoryId: category.id,
    payeeId: tagged.payeeId!,
    search: 'ARVIZTURO',
    period: 'thisMonth' as const,
    limit: 1,
  }
  const page = application.queries.listTransactions(filters)
  expect(page.rows).toHaveLength(1)
  expect(page.totalCount).toBe(2)
  expect(page.totals).toEqual([
    { currency: 'CHF', expenseMinor: 500, incomeMinor: 0 },
  ])
  expect(page.days).toEqual([
    {
      date: '2026-01-15',
      totals: [{ currency: 'CHF', expenseMinor: 500, incomeMinor: 0 }],
    },
  ])
  expect(
    application.queries.listTransactions({ ...filters, offset: 1 }).totals,
  ).toEqual(page.totals)
  expect(application.queries.listTransactions({ tagId }).totals).toEqual([
    { currency: 'CHF', expenseMinor: 4496, incomeMinor: 700 },
    { currency: 'HUF', expenseMinor: 400, incomeMinor: 0 },
  ])
  expect(() =>
    application.queries.listTransactions({ tagId: 'invalid' }),
  ).toThrow('transactions.error.filters')
})

test('undo restores exact tags and associations for transaction create, edit and delete, removing only inline-created tags', async () => {
  const { application, input } = await setup()
  const existing = application.commands.createTransaction({
    ...input,
    tagNames: ['Shared'],
  })
  const created = application.commands.createTransaction({
    ...input,
    tagNames: ['shared', 'Original'],
  })
  const edited = application.commands.updateTransaction({
    ...input,
    id: created.id,
    tagNames: ['SHARED', 'Edited'],
  })
  application.commands.deleteTransaction(edited.id)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toContainEqual(edited)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toContainEqual(created)
  expect(application.queries.listTags().map((tag) => tag.name)).toEqual([
    'Original',
    'Shared',
  ])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([existing])
  expect(application.queries.listTags()).toEqual(existing.line.tags)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTags()).toEqual([])
  expect(application.queries.listTransactions().rows).toEqual([])
})

test('renames tags everywhere and undo restores the original identity and spelling', async () => {
  const { application, input } = await setup()
  const first = application.commands.createTransaction({
    ...input,
    tagNames: ['Trip'],
  })
  const second = application.commands.createTransaction({
    ...input,
    tagNames: ['trip'],
  })
  const tag = first.line.tags[0]
  const renamed = application.commands.renameTag({
    id: tag.id,
    name: '  Vacation  ',
  })
  expect(renamed).toEqual({ ...tag, name: 'Vacation' })
  expect(
    application.queries
      .listTransactions({ tagId: tag.id })
      .rows.every(
        (transaction) =>
          transaction.kind !== 'transfer' &&
          transaction.line.tags[0].name === 'Vacation',
      ),
  ).toBe(true)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTags()).toEqual([tag])
  expect(application.queries.listTransactions().rows).toEqual(
    expect.arrayContaining([first, second]),
  )
})

test('deleting a tag removes all associations and undo restores them without changing transactions or other tags', async () => {
  const { application, input } = await setup()
  const first = application.commands.createTransaction({
    ...input,
    tagNames: ['Trip', 'Project'],
  })
  const second = application.commands.createTransaction({
    ...input,
    tagNames: ['Trip'],
  })
  const tag = second.line.tags[0]
  const before = application.queries.listTransactions()
  const balance = application.queries.getAccountBalance(input.accountId)
  application.commands.deleteTag(tag.id)
  expect(application.queries.listTags()).toEqual(
    first.line.tags.filter((tag) => tag.name === 'Project'),
  )
  expect(
    application.queries.listTransactions({ tagId: tag.id }).totalCount,
  ).toBe(0)
  const deleted = application.queries.listTransactions()
  expect(deleted.rows).toEqual(
    before.rows.map((transaction) =>
      transaction.kind === 'transfer'
        ? transaction
        : {
            ...transaction,
            lines: transaction.lines.map((line) => ({
              ...line,
              tags: line.tags.filter((candidate) => candidate.id !== tag.id),
            })),
            line: {
              ...transaction.line,
              tags: transaction.line.tags.filter(
                (candidate) => candidate.id !== tag.id,
              ),
            },
          },
    ),
  )
  expect(deleted.totals).toEqual(before.totals)
  expect(application.queries.getAccountBalance(input.accountId)).toBe(balance)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions()).toEqual(before)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([first])
})

test('rejects invalid tag writes atomically and preserves preceding undo history', async () => {
  const { application, input } = await setup()
  const first = application.commands.createTransaction({
    ...input,
    tagNames: ['Été', 'Project'],
  })
  for (const tagNames of [
    null,
    'Trip',
    [''],
    [' '.repeat(5)],
    ['x'.repeat(101)],
    ['Would be new', 123],
  ]) {
    expect(() =>
      application.commands.createTransaction({
        ...input,
        tagNames: tagNames as never,
      }),
    ).toThrow('tags.error.name')
    expect(() =>
      application.commands.updateTransaction({
        ...input,
        id: first.id,
        tagNames: tagNames as never,
      }),
    ).toThrow('tags.error.name')
  }
  const tag = first.line.tags.find((tag) => tag.name === 'Project')!
  expect(() =>
    application.commands.renameTag({ id: tag.id, name: 'ÉTÉ' }),
  ).toThrow('tags.error.duplicate')
  expect(() =>
    application.commands.renameTag({ id: tag.id, name: '' }),
  ).toThrow('tags.error.name')
  expect(() => application.commands.deleteTag('invalid')).toThrow(
    'tags.error.notFound',
  )
  expect(() =>
    application.commands.deleteTag('00000000-0000-4000-8000-000000000001'),
  ).toThrow('tags.error.notFound')
  expect(application.queries.listTransactions().rows).toEqual([first])
  expect(application.queries.listTags()).toEqual(first.line.tags)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTags()).toEqual([])
})

test('tags stay isolated by profile', async () => {
  const first = await setup()
  const second = await setup()
  const tagged = first.application.commands.createTransaction({
    ...first.input,
    tagNames: ['Trip'],
  })
  const other = second.application.commands.createTransaction({
    ...second.input,
    tagNames: ['Trip'],
  })
  expect(other.line.tags[0].id).not.toBe(tagged.line.tags[0].id)
  expect(
    second.application.queries.listTransactions({
      tagId: tagged.line.tags[0].id,
    }).totalCount,
  ).toBe(0)
  expect(() =>
    second.application.commands.renameTag({
      id: tagged.line.tags[0].id,
      name: 'Wrong profile',
    }),
  ).toThrow('tags.error.notFound')
  expect(() =>
    second.application.commands.deleteTag(tagged.line.tags[0].id),
  ).toThrow('tags.error.notFound')
  expect(first.application.queries.listTags()).toEqual(tagged.line.tags)
})

test('appending tags and split-line migrations preserves the version 9 ledger and tags persist on reopen while undo history does not', async () => {
  const {
    application: previous,
    input,
    profile,
    paths,
  } = await setup(CURRENT_MIGRATIONS.slice(0, 9))
  const legacy = previous.commands.createTransaction({
    ...input,
    excluded: true,
  })
  const destination = previous.commands.createAccount({
    name: 'Destination',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  previous.commands.createTransfer({
    fromAccountId: input.accountId,
    fromAmountMinor: 200,
    toAccountId: destination.id,
    toAmountMinor: 200,
    date: input.date,
    note: 'Before tags',
    fee: { amountMinor: 10, excluded: true },
  })
  expect(previous.queries.getProfileInfo().schemaVersion).toBe(9)
  const balance = previous.queries.getAccountBalance(input.accountId)
  const before = previous.queries.listTransactions()
  previous.close()
  const upgraded = await openProfileApplication({ profile, paths, clock })
  applications.push(upgraded)
  expect(upgraded.queries.getProfileInfo().schemaVersion).toBe(
    CURRENT_MIGRATIONS.length,
  )
  expect(upgraded.queries.getAccountBalance(input.accountId)).toBe(balance)
  expect(upgraded.queries.listTransactions()).toEqual(before)
  expect(upgraded.queries.listTags()).toEqual([])
  const tagged = upgraded.commands.updateTransaction({
    ...input,
    id: legacy.id,
    tagNames: ['Été', 'Project'],
  })
  const tag = tagged.line.tags.find((tag) => tag.name === 'Été')!
  upgraded.commands.renameTag({ id: tag.id, name: 'ÉTÉ' })
  const saved = upgraded.queries.listTransactions({ tagId: tag.id })
  upgraded.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(reopened.queries.listTransactions({ tagId: tag.id })).toEqual(saved)
  expect(reopened.queries.listTags().map((tag) => tag.name)).toEqual([
    'Project',
    'ÉTÉ',
  ])
  expect(reopened.commands.undoLast()).toBe(false)
  const reused = reopened.commands.createTransaction({
    ...input,
    tagNames: ['e\u0301te\u0301'],
  })
  expect(reused.line.tags[0]).toEqual({ ...tag, name: 'ÉTÉ' })
})

test('undo crosses tag rename and reuse of an existing unused tag without deleting it', async () => {
  const { application, input } = await setup()
  const first = application.commands.createTransaction({
    ...input,
    tagNames: ['Trip'],
  })
  const tag = first.line.tags[0]
  application.commands.deleteTransaction(first.id)
  application.commands.renameTag({ id: tag.id, name: 'Vacation' })
  application.commands.createTransaction({ ...input, tagNames: ['VACATION'] })
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.queries.listTags()).toEqual([{ ...tag, name: 'Vacation' }])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTags()).toEqual([tag])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([first])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTags()).toEqual([])
})

test('editing a transaction can remove all its tags without deleting reusable tags and undo restores them', async () => {
  const { application, input } = await setup()
  const first = application.commands.createTransaction({
    ...input,
    tagNames: ['Trip', 'Project'],
  })
  const cleared = application.commands.updateTransaction({
    ...input,
    id: first.id,
    tagNames: [],
  })
  expect(cleared.line.tags).toEqual([])
  expect(application.queries.listTags()).toEqual(first.line.tags)
  expect(
    application.queries.listTransactions({ tagId: first.line.tags[0].id })
      .totalCount,
  ).toBe(0)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([first])
})

test('editing existing transaction fields without supplying tag names preserves its tags', async () => {
  const { application, input } = await setup()
  const first = application.commands.createTransaction({
    ...input,
    tagNames: ['Trip'],
  })
  const edited = application.commands.updateTransaction({
    ...input,
    id: first.id,
    note: 'Updated note',
  })
  expect(edited.line.tags).toEqual(first.line.tags)
  expect(
    application.queries.listTransactions({ tagId: first.line.tags[0].id }).rows,
  ).toEqual([edited])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([first])
})

test('tag and exclusion filters combine while hiding transfers and preserving whole-set totals and balances', async () => {
  const { application, input } = await setup()
  const destination = application.commands.createAccount({
    name: 'Destination',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const included = application.commands.createTransaction({
    ...input,
    totalMinor: 200,
    tagNames: ['Trip', 'Project'],
  })
  const excluded = application.commands.createTransaction({
    ...input,
    totalMinor: 900,
    excluded: true,
    tagNames: ['Trip'],
  })
  application.commands.createTransaction({ ...input, totalMinor: 700 })
  const transfer = application.commands.createTransfer({
    fromAccountId: input.accountId,
    fromAmountMinor: 500,
    toAccountId: destination.id,
    toAmountMinor: 500,
    date: input.date,
    note: 'Trip transfer',
    fee: { amountMinor: 50 },
  })
  expect(transfer.fee?.line.tags).toEqual([])
  const balance = application.queries.getAccountBalance(input.accountId)
  const tagId = excluded.line.tags[0].id
  const all = application.queries.listTransactions({ tagId, limit: 1 })
  expect(all.totalCount).toBe(2)
  expect(all.rows).toHaveLength(1)
  expect(all.rows.every((row) => row.kind !== 'transfer')).toBe(true)
  const includedTotals = [
    { currency: 'CHF', expenseMinor: 200, incomeMinor: 0 },
  ]
  expect(all.totals).toEqual(includedTotals)
  expect(all.days).toEqual([{ date: input.date, totals: includedTotals }])
  expect(
    application.queries.listTransactions({ tagId, offset: 1 }).totals,
  ).toEqual(all.totals)
  const onlyExcluded = application.queries.listTransactions({
    tagId,
    exclusion: 'onlyExcluded',
  })
  expect(onlyExcluded.rows).toEqual([excluded])
  expect(onlyExcluded.totalCount).toBe(1)
  const zeroTotals = [{ currency: 'CHF', expenseMinor: 0, incomeMinor: 0 }]
  expect(onlyExcluded.totals).toEqual(zeroTotals)
  expect(onlyExcluded.days).toEqual([{ date: input.date, totals: zeroTotals }])
  const hideExcluded = application.queries.listTransactions({
    tagId,
    exclusion: 'hideExcluded',
  })
  expect(hideExcluded.rows).toEqual([included])
  expect(hideExcluded.totalCount).toBe(1)
  expect(hideExcluded.totals).toEqual(includedTotals)
  expect(
    application.queries.listTransactions({ exclusion: 'hideExcluded' }).rows,
  ).toContainEqual(transfer)
  expect(application.queries.getAccountBalance(input.accountId)).toBe(balance)
})

test('transaction undo captures tags and the excluded flag together across create, edit and delete', async () => {
  const { application, input } = await setup()
  const original = application.commands.createTransaction({
    ...input,
    excluded: true,
    tagNames: ['Original'],
  })
  const edited = application.commands.updateTransaction({
    ...input,
    id: original.id,
    excluded: false,
    tagNames: ['Edited'],
  })
  application.commands.deleteTransaction(edited.id)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([edited])
  expect(application.commands.undoLast()).toBe(true)
  expect(
    application.queries.listTransactions({ exclusion: 'onlyExcluded' }).rows,
  ).toEqual([original])
  expect(application.queries.listTags()).toEqual(original.line.tags)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
  expect(application.queries.listTags()).toEqual([])
  expect(application.queries.getAccountBalance(input.accountId)).toBe(0)
})

test('tag totals aggregate only tagged lines rather than the whole matching transaction', async () => {
  const { application, input, paths } = await setup()
  const original = application.commands.createTransaction({
    ...input,
    totalMinor: 500,
    tagNames: ['Trip'],
  })
  // Arrange a multi-line ledger fixture without enabling split editing. Only a
  // non-visible aggregate is queried, so the existing unsplit row guard remains.
  const database = openDatabase(paths.databasePath)
  try {
    database.transaction(() => {
      database
        .prepare('UPDATE transaction_lines SET amount_minor = 200 WHERE id = ?')
        .run(original.line.id)
      database
        .prepare(
          'INSERT INTO transaction_lines (id, transaction_id, amount_minor, category_id) VALUES (?, ?, ?, ?)',
        )
        .run('00000000-0000-4000-8000-000000000001', original.id, 300, null)
    })()
  } finally {
    database.close()
  }
  const page = application.queries.listTransactions({
    tagId: original.line.tags[0].id,
    offset: 1,
  })
  expect(page.rows).toEqual([])
  expect(page.totalCount).toBe(1)
  const totals = [{ currency: 'CHF', expenseMinor: 200, incomeMinor: 0 }]
  expect(page.totals).toEqual(totals)
  expect(page.days).toEqual([{ date: input.date, totals }])
  expect(application.queries.listTransactions({ offset: 1 }).totals).toEqual([
    { currency: 'CHF', expenseMinor: 500, incomeMinor: 0 },
  ])
})
