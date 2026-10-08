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

async function setup(migrations = CURRENT_MIGRATIONS) {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-templates-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Templates test')
  const paths = registry.getProfilePaths(profile.id)
  const legacyAccountId = '00000000-0000-4000-8000-000000000014'
  const appliedMigrations =
    migrations.length < CURRENT_MIGRATIONS.length
      ? migrations.map((migration, index) =>
          index === migrations.length - 1
            ? {
                ...migration,
                apply(database: Parameters<typeof migration.apply>[0]) {
                  migration.apply(database)
                  database
                    .prepare(
                      `INSERT INTO accounts
                        (id, name, currency, opening_balance, opening_date,
                         created_at, archived)
                       VALUES (?, ?, ?, ?, ?, ?, 0)`,
                    )
                    .run(
                      legacyAccountId,
                      'Cash',
                      'CHF',
                      0,
                      '2026-01-01',
                      clock().toISOString(),
                    )
                },
              }
            : migration,
        )
      : migrations
  const application = await openProfileApplication({
    profile,
    paths,
    clock,
    migrations: appliedMigrations,
  })
  applications.push(application)
  const account =
    migrations.length < CURRENT_MIGRATIONS.length
      ? application.queries.listAccounts()[0]
      : application.commands.createAccount({
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
    lines: [{ ...original.line, id: expect.any(String) }],
    line: { ...original.line, id: expect.any(String) },
  })
  expect(copyId).not.toBe(original.id)
  expect(
    copy && (copy.kind === 'expense' || copy.kind === 'income') && copy.line.id,
  ).not.toBe(original.line.id)
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
    excluded: false,
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
    excluded: true,
  })
  const edited = application.commands.updateTemplate({
    id: saved.id,
    name: 'Variable bill',
    payeeName: 'New payee',
    tagNames: ['New tag'],
    note: 'New note',
    excluded: false,
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
    excluded: false,
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
  expect(application.queries.listTags()).toMatchObject([{ name: 'Trip' }])
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
  expect(recorded.line.tags).toMatchObject([{ name: 'Trip' }])
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
    CURRENT_MIGRATIONS.slice(0, 13),
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

test('template tags retain the stored tag identity when optional names repeat with normalized case', async () => {
  const { application, input } = await setup()
  application.commands.createTransaction(input)
  const template = application.commands.createTemplate({
    name: 'Trip',
    tagNames: [' Trip ', 'trip', 'TRIP'],
  })
  expect(template.tagNames).toEqual(['Trip'])
})

test.each([true, false])(
  'duplicates all split categories, notes and tags (excluded=%s); undo keeps the source and payee aliases',
  async (excluded) => {
    const { application, input } = await setup()
    const categories = application.queries.listCategoryOptions('expense')
    const source = application.commands.createTransaction({
      ...input,
      totalMinor: 500,
      note: 'Transaction note',
      excluded,
      lines: [
        {
          amountMinor: 200,
          categoryId: categories[0].id,
          note: 'First part',
          tagNames: ['Trip'],
        },
        {
          amountMinor: 300,
          categoryId: categories[1].id,
          note: 'Second part',
          tagNames: ['Project'],
        },
      ],
    })
    const alias = application.commands.addPayeeAlias({
      payeeId: source.payeeId!,
      name: 'CAFE SHOP',
    })
    const copyId = application.commands.duplicateTransaction(source.id)
    const copy = application.queries
      .listTransactions()
      .rows.find((row) => row.id === copyId)
    expect(copy).toEqual({
      ...source,
      id: copyId,
      date: '2026-01-15',
      lines: source.lines.map((line) => ({ ...line, id: expect.any(String) })),
      line: { ...source.line, id: expect.any(String) },
    })
    if (!copy || (copy.kind !== 'expense' && copy.kind !== 'income'))
      throw new Error('Expected transaction copy')
    expect(
      copy.lines.every(
        (line) => !source.lines.some((original) => original.id === line.id),
      ),
    ).toBe(true)
    expect(copy.line).toEqual(copy.lines[0])
    expect(application.queries.getAccountBalance(input.accountId)).toBe(-1000)
    expect(application.queries.listTransactions().totals).toEqual([
      { currency: 'CHF', expenseMinor: excluded ? 0 : 1000, incomeMinor: 0 },
    ])
    for (const line of source.lines) {
      const filtered = application.queries.listTransactions({
        tagId: line.tags[0].id,
        categoryId: line.categoryId!,
      })
      expect(filtered.totalCount).toBe(2)
      expect(filtered.totals).toEqual([
        {
          currency: 'CHF',
          expenseMinor: excluded ? 0 : line.amountMinor * 2,
          incomeMinor: 0,
        },
      ])
    }
    expect(application.commands.undoLast()).toBe(true)
    expect(application.queries.listTransactions().rows).toEqual([source])
    expect(application.queries.listPayeeAliases(source.payeeId!)).toEqual([
      alias,
    ])
    expect(application.queries.getAccountBalance(input.accountId)).toBe(-500)
    expect(() =>
      application.commands.saveTransactionAsTemplate({
        transactionId: source.id,
        name: 'Cannot flatten',
      }),
    ).toThrow('templates.error.split')
    expect(application.queries.listTemplates()).toEqual([])
    // A rejected split save must not replace the previous undo entry.
    expect(application.commands.undoLast()).toBe(true)
    expect(application.queries.listPayeeAliases(source.payeeId!)).toEqual([])
  },
)

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

test('deleting unused account and category references is undoable with template links', async () => {
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
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([template])
  application.commands.deleteAccount(input.accountId)
  application.commands.deleteCategory({ id: category.id })
  expect(application.queries.listTemplates()).toEqual([
    { ...template, accountId: null, categoryId: null },
  ])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([
    { ...template, accountId: null },
  ])
})

test('template prefill resolves aliases and template undo coexists with transaction and alias undo', async () => {
  const { application, input } = await setup()
  const source = application.commands.createTransaction(input)
  const alias = application.commands.addPayeeAlias({
    payeeId: source.payeeId!,
    name: 'CAFÉ SHOP',
  })
  const template = application.commands.createTemplate({
    name: 'Alias purchase',
    payeeName: 'cafe shop',
    totalMinor: 375,
  })
  const recorded = application.commands.createTransaction({
    ...input,
    payeeName: template.payeeName,
    totalMinor: template.totalMinor!,
    excluded: false,
  })
  expect(recorded.payeeId).toBe(source.payeeId)
  expect(recorded.payeeName).toBe(source.payeeName)
  expect(application.queries.listPayees()).toHaveLength(1)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([source])
  expect(application.queries.listTemplates()).toEqual([template])
  expect(application.queries.listPayeeAliases(source.payeeId!)).toEqual([alias])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listPayeeAliases(source.payeeId!)).toEqual([])
  expect(application.queries.listTransactions().rows).toEqual([source])
})

test('duplicate preserves source category and tags despite a matching rule, and rule/template/ledger undo interleave', async () => {
  const { application, input } = await setup()
  const other = application.commands.createAccount({
    name: 'Other',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const source = application.commands.createTransaction(input)
  const template = application.commands.saveTransactionAsTemplate({
    transactionId: source.id,
    name: 'Source choices',
  })
  const suggestedCategory =
    application.queries.listCategoryOptions('expense')[1].id
  const rule = application.commands.createCategorisationRule({
    enabled: true,
    payeeId: source.payeeId,
    textContains: null,
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    categoryId: suggestedCategory,
    tagIds: [source.line.tags[0].id],
  })
  expect(
    application.queries.getCategorisationAutofill({
      accountId: input.accountId,
      kind: input.kind,
      totalMinor: input.totalMinor,
      payeeName: input.payeeName,
      note: input.note,
    }),
  ).toMatchObject({
    source: 'rule',
    ruleId: rule.id,
    categoryId: suggestedCategory,
  })
  const copyId = application.commands.duplicateTransaction(source.id)
  expect(
    application.queries
      .listTransactions()
      .rows.find((row) => row.id === copyId),
  ).toMatchObject({
    line: { categoryId: source.line.categoryId, tags: source.line.tags },
  })
  const ledgerWithCopy = application.queries.listTransactions()
  application.commands.createTransfer({
    fromAccountId: input.accountId,
    fromAmountMinor: 100,
    toAccountId: other.id,
    toAmountMinor: 100,
    date: '2026-01-15',
    note: '',
    fee: null,
  })
  const ledgerWithTransfer = application.queries.listTransactions()
  application.commands.createBalanceAdjustment({
    accountId: other.id,
    date: '2026-01-15',
    observedMinor: 250,
    note: '',
  })
  const ledgerWithAdjustment = application.queries.listTransactions()
  application.commands.deleteTemplate(template.id)
  expect(application.queries.listTemplates()).toEqual([])
  expect(application.queries.listCategorisationRules()).toEqual([rule])
  expect(application.queries.listTransactions()).toEqual(ledgerWithAdjustment)
  application.commands.updateCategorisationRule({
    ...rule,
    enabled: false,
    tagIds: rule.tags.map((tag) => tag.id),
  })
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()).toEqual([rule])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([template])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions()).toEqual(ledgerWithTransfer)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions()).toEqual(ledgerWithCopy)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([source])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
})

test('tag deletion and rename update template associations and undo restores them', async () => {
  const { application, input } = await setup()
  const source = application.commands.createTransaction(input)
  const tag = source.line.tags[0]
  const template = application.commands.saveTransactionAsTemplate({
    transactionId: source.id,
    name: 'Saved text',
  })
  const draft = {
    enabled: true,
    payeeId: source.payeeId,
    textContains: null,
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    categoryId: input.categoryId,
    tagIds: [tag.id],
  }
  const categoryRule = application.commands.createCategorisationRule(draft)
  const tagOnlyRule = application.commands.createCategorisationRule({
    ...draft,
    categoryId: null,
  })
  const before = application.queries.listTransactions()
  application.commands.renameTag({ id: tag.id, name: 'Renamed' })
  expect(
    application.queries
      .listCategorisationRules()
      .every((rule) => rule.tags[0].name === 'Renamed'),
  ).toBe(true)
  expect(application.queries.listTemplates()).toEqual([
    {
      ...template,
      tagNames: template.tagNames.map((name) =>
        name === tag.name ? 'Renamed' : name,
      ),
    },
  ])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()).toEqual([
    categoryRule,
    tagOnlyRule,
  ])
  application.commands.deleteTag(tag.id)
  expect(application.queries.listCategorisationRules()).toEqual([
    { ...categoryRule, tags: [] },
  ])
  expect(application.queries.listTemplates()).toEqual([
    {
      ...template,
      tagNames: template.tagNames.filter((name) => name !== tag.name),
    },
  ])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()).toEqual([
    categoryRule,
    tagOnlyRule,
  ])
  expect(application.queries.listTemplates()).toEqual([template])
  expect(application.queries.listTransactions()).toEqual(before)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()).toEqual([categoryRule])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
})

test('deleting shared account/category references preserves both template and rule deletion semantics', async () => {
  const { application, input } = await setup()
  const other = application.commands.createAccount({
    name: 'Other',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const tagged = application.commands.createTransaction({
    ...input,
    accountId: other.id,
  })
  const category = application.commands.createCategory({
    name: 'Shared category',
    kind: 'expense',
    parentId: null,
  })
  const template = application.commands.createTemplate({
    name: 'Shared references',
    accountId: input.accountId,
    categoryId: category.id,
    tagNames: ['Project'],
  })
  const draft = {
    enabled: true,
    payeeId: null,
    textContains: 'Purchase',
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    categoryId: category.id,
    tagIds: [],
  }
  application.commands.createCategorisationRule({
    ...draft,
    accountId: input.accountId,
  })
  application.commands.createCategorisationRule(draft)
  const taggedRule = application.commands.createCategorisationRule({
    ...draft,
    tagIds: [tagged.line.tags[0].id],
  })
  application.commands.deleteAccount(input.accountId)
  expect(application.queries.listCategorisationRules()).toHaveLength(2)
  expect(
    application.queries
      .listCategorisationRules()
      .every((rule) => rule.accountId === null),
  ).toBe(true)
  expect(application.queries.listTemplates()).toEqual([
    { ...template, accountId: null },
  ])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([template])
  expect(application.queries.listCategorisationRules()).toHaveLength(3)
  application.commands.deleteAccount(input.accountId)
  application.commands.deleteCategory({ id: category.id })
  expect(application.queries.listCategorisationRules()).toEqual([
    { ...taggedRule, categoryId: null, categoryKind: null },
  ])
  expect(application.queries.listTemplates()).toEqual([
    { ...template, accountId: null, categoryId: null },
  ])
  expect(application.queries.listTransactions().rows).toEqual([tagged])
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([
    { ...template, accountId: null },
  ])
  expect(application.queries.listCategorisationRules()).toHaveLength(2)
})

test('category replacement retargets rules, transactions and templates and undo restores all references', async () => {
  const { application, input } = await setup()
  const category = application.commands.createCategory({
    name: 'Replaceable',
    kind: 'expense',
    parentId: null,
  })
  input.categoryId = category.id
  const source = application.commands.createTransaction(input)
  const template = application.commands.saveTransactionAsTemplate({
    transactionId: source.id,
    name: 'Category reference',
  })
  const rule = application.commands.createCategorisationRule({
    enabled: true,
    payeeId: source.payeeId,
    textContains: null,
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    categoryId: input.categoryId,
    tagIds: [],
  })
  const replacement = application.queries
    .listCategoryOptions('expense')
    .find((category) => category.id !== input.categoryId)!
  application.commands.deleteCategory({
    id: input.categoryId,
    replacementId: replacement.id,
  })
  expect(application.queries.listCategorisationRules()).toEqual([
    { ...rule, categoryId: replacement.id },
  ])
  expect(application.queries.listTemplates()).toEqual([
    { ...template, categoryId: replacement.id },
  ])
  expect(application.queries.listTransactions().rows[0]).toMatchObject({
    line: { categoryId: replacement.id },
  })
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listCategorisationRules()).toEqual([rule])
  expect(application.queries.listTemplates()).toEqual([template])
  expect(application.queries.listTransactions().rows).toEqual([source])
})

test('migration 16 upgrades version-14 template data without changing the ledger', async () => {
  const legacyTemplateId = '00000000-0000-4000-8000-000000000016'
  const migration14 = CURRENT_MIGRATIONS[13]
  const { application, input, profile, paths } = await setup([
    ...CURRENT_MIGRATIONS.slice(0, 13),
    {
      ...migration14,
      apply(database) {
        migration14.apply(database)
        database
          .prepare(
            `INSERT INTO tags (id, name, normalized_name, created_at)
               VALUES ('00000000-0000-4000-8000-000000000017',
                 'Trip', payee_key('Trip'), ?)`,
          )
          .run(clock().toISOString())
        database
          .prepare(
            `INSERT INTO transaction_templates
                (id, name, kind, account_id, total_minor, payee_name,
                 category_id, tag_names, note, created_at, updated_at)
               VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, ?, NULL, ?, ?)`,
          )
          .run(
            legacyTemplateId,
            'Before rules',
            JSON.stringify(['trip', 'Missing tag']),
            clock().toISOString(),
            clock().toISOString(),
          )
      },
    },
  ])
  const source = application.commands.createTransaction(input)
  application.commands.duplicateTransaction(source.id)
  const before = application.queries.listTransactions()
  expect(application.queries.getProfileInfo().schemaVersion).toBe(14)
  application.close()
  const upgraded = await openProfileApplication({ profile, paths, clock })
  applications.push(upgraded)
  expect(upgraded.queries.getProfileInfo().schemaVersion).toBe(
    CURRENT_MIGRATIONS.length,
  )
  const template = {
    id: legacyTemplateId,
    name: 'Before rules',
    kind: null,
    accountId: null,
    totalMinor: null,
    payeeName: null,
    categoryId: null,
    tagNames: ['Trip'],
    note: null,
    excluded: false,
    createdAt: clock().toISOString(),
    updatedAt: clock().toISOString(),
  }
  expect(upgraded.queries.listTemplates()).toEqual([template])
  expect(upgraded.queries.listTransactions()).toEqual(before)
  expect(upgraded.queries.listCategorisationRules()).toEqual([])
  const rule = upgraded.commands.createCategorisationRule({
    enabled: true,
    payeeId: source.payeeId,
    textContains: null,
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    categoryId: input.categoryId,
    tagIds: [source.line.tags[0].id],
  })
  upgraded.close()
  const reopened = await openProfileApplication({ profile, paths, clock })
  applications.push(reopened)
  expect(reopened.queries.listTemplates()).toEqual([template])
  expect(reopened.queries.listTransactions()).toEqual(before)
  expect(reopened.queries.listCategorisationRules()).toEqual([rule])
  expect(reopened.commands.undoLast()).toBe(false)
})

test('template saves create missing tags, reuse Unicode-equivalent names, and undo removes only newly created tags', async () => {
  const { application, input } = await setup()
  const source = application.commands.createTransaction({
    ...input,
    tagNames: ['Élelmiszer', 'Ärztin'],
  })
  application.commands.deleteTransaction(source.id)
  const reused = application.queries.listTags()
  const template = application.commands.createTemplate({
    name: 'Tagged template',
    tagNames: ['élelmiszer', 'ärztin', 'New trip', 'NEW TRIP'],
  })
  expect(template.tagNames).toEqual(['New trip', 'Ärztin', 'Élelmiszer'])
  expect(application.queries.listTags()).toEqual(expect.arrayContaining(reused))
  expect(application.queries.listTags()).toHaveLength(3)
  expect(
    application.queries.listTags().find((tag) => tag.name === 'New trip')
      ?.createdAt,
  ).toBe(clock().toISOString())
  application.commands.updateTemplate({
    ...template,
    tagNames: ['New trip', 'New project'],
  })
  expect(application.queries.listTags()).toHaveLength(4)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([template])
  expect(application.queries.listTags().map((tag) => tag.name)).not.toContain(
    'New project',
  )
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTemplates()).toEqual([])
  expect(application.queries.listTags()).toEqual(reused)
})
