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
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-csv-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('CSV test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
    createStartupBackup: false,
  })
  applications.push(application)
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2025-01-01',
  })
  return { application, account }
}

afterEach(() => {
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('exports ISO dates, signed two-decimal amounts, and a UTF-8 BOM with CRLF records', async () => {
  const { application, account } = await setup()
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'income',
    date: '2026-01-15',
    totalMinor: 12345,
    payeeName: 'Employer',
    categoryId: null,
    note: 'Salary',
  })
  const csv = application.queries.exportTransactionsCsv()
  expect(csv).toBe(
    '\uFEFFDate,Account,Kind,Payee,Main category,Subcategory,Amount,Currency,Note,Tags,Excluded\r\n2026-01-15,Cash,Income,Employer,,,123.45,CHF,Salary,,No\r\n',
  )
  expect(Buffer.from(csv, 'utf8').subarray(0, 3)).toEqual(
    Buffer.from([0xef, 0xbb, 0xbf]),
  )
})

test.each([
  [
    'hu',
    'Dátum;Számla;Típus;Kedvezményezett;Főkategória;Alkategória;Összeg;Pénznem;Megjegyzés;Címkék;Kizárt',
    'Kiadás',
    'Bevétel',
    'Igen',
    'Nem',
    'Élelmiszer',
    'Bolt',
    ',',
  ],
  [
    'de',
    'Datum;Konto;Art;Zahlungspartner;Hauptkategorie;Unterkategorie;Betrag;Währung;Notiz;Tags;Ausgeschlossen',
    'Ausgabe',
    'Einnahme',
    'Ja',
    'Nein',
    'Lebensmittel',
    'Einkäufe',
    ',',
  ],
  [
    'en',
    'Date,Account,Kind,Payee,Main category,Subcategory,Amount,Currency,Note,Tags,Excluded',
    'Expense',
    'Income',
    'Yes',
    'No',
    'Food',
    'Groceries',
    '.',
  ],
] as const)(
  'exports %s headers, category names, split parts, and locale decimals',
  async (language, header, expense, income, yes, no, main, child, decimal) => {
    const { application, account } = await setup()
    application.commands.updateSettings({ language })
    application.commands.renameAccount({ id: account.id, name: 'őűäöüß' })
    const category = application.queries
      .listCategories()
      .find((category) => category.seedKey === 'expense.food.shop')!
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date: '2026-01-14',
      totalMinor: 12345,
      payeeName: 'őűäöüß',
      categoryId: null,
      note: 'Header őűäöüß',
      excluded: true,
      lines: [
        {
          amountMinor: 2345,
          categoryId: category.id,
          note: 'Line őűäöüß',
          tagNames: ['Tag'],
        },
        { amountMinor: 10000, categoryId: null, note: '' },
      ],
    })
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'income',
      date: '2026-01-15',
      totalMinor: 1,
      payeeName: null,
      categoryId: null,
      note: '',
    })
    const delimiter = decimal === ',' ? ';' : ','
    expect(application.queries.exportTransactionsCsv()).toBe(
      '\uFEFF' +
        header +
        '\r\n' +
        [
          [
            '2026-01-15',
            'őűäöüß',
            income,
            '',
            '',
            '',
            `0${decimal}01`,
            'CHF',
            '',
            '',
            no,
          ].join(delimiter),
          [
            '2026-01-14',
            'őűäöüß',
            expense,
            'őűäöüß',
            main,
            child,
            `-23${decimal}45`,
            'CHF',
            'Line őűäöüß',
            'Tag',
            yes,
          ].join(delimiter),
          [
            '2026-01-14',
            'őűäöüß',
            expense,
            'őűäöüß',
            '',
            '',
            `-100${decimal}00`,
            'CHF',
            'Header őűäöüß',
            '',
            yes,
          ].join(delimiter),
        ].join('\r\n') +
        '\r\n',
    )
  },
)

test.each([
  ['hu', '.', ','],
  ['de', '.', ','],
  ['en', ',', ';'],
] as const)(
  'overrides %s decimal and field separators and quotes delimiters, quotes, CR and LF',
  async (language, decimalSeparator, delimiter) => {
    const { application, account } = await setup()
    application.commands.updateSettings({ language })
    application.commands.renameAccount({
      id: account.id,
      name: `Cash${delimiter}bank`,
    })
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date: '2026-01-15',
      totalMinor: 12345,
      payeeName: 'Shop "A"',
      categoryId: null,
      note: 'First\r\nsecond\rthird\nfourth',
      tagNames: ['a', 'b'],
    })
    const csv = application.queries.exportTransactionsCsv({ decimalSeparator })
    expect(csv).toContain(
      `\r\n2026-01-15${delimiter}"Cash${delimiter}bank"${delimiter}`,
    )
    expect(csv).toContain(`${delimiter}"Shop ""A"""${delimiter}`)
    expect(csv).toContain(
      `${delimiter}-123${decimalSeparator}45${delimiter}CHF${delimiter}"First\r\nsecond\rthird\nfourth"${delimiter}${delimiter === ',' ? '"a,b"' : 'a,b'}${delimiter}`,
    )
    expect(csv.endsWith('\r\n')).toBe(true)
  },
)

test.each(['=', '+', '-', '@', '\t', '\r'])(
  'neutralises leading %j in text cells but never signed numeric amounts',
  async (prefix) => {
    const { application, account } = await setup()
    const category = application.commands.createCategory({
      name: `${prefix}Main`,
      kind: 'expense',
    })
    const child = application.commands.createCategory({
      name: `${prefix}Child`,
      kind: 'expense',
      parentId: category.id,
    })
    application.commands.renameAccount({
      id: account.id,
      name: `${prefix}Account`,
    })
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date: '2026-01-15',
      totalMinor: 1,
      payeeName: `${prefix}Payee`,
      categoryId: child.id,
      note: `${prefix}Note`,
      tagNames: [`${prefix}Tag`],
    })
    const csv = application.queries.exportTransactionsCsv()
    // Name fields are trimmed by their commands, so tab/CR survive only in notes.
    if (prefix !== '\t' && prefix !== '\r') {
      expect(csv).toContain(
        `,'${prefix}Account,Expense,'${prefix}Payee,'${prefix}Main,'${prefix}Child,-0.01,CHF,'${prefix}Note,'${prefix}Tag,No\r\n`,
      )
    } else {
      expect(csv).toContain(
        prefix === '\t'
          ? ",CHF,'\tNote,Tag,No\r\n"
          : ',CHF,"\'\rNote",Tag,No\r\n',
      )
    }
  },
)

test('exports every line of matching transactions using AND filters and ignores list paging', async () => {
  const { application, account } = await setup()
  const main = application.commands.createCategory({
    name: 'Travel',
    kind: 'expense',
  })
  const child = application.commands.createCategory({
    name: 'Rail',
    kind: 'expense',
    parentId: main.id,
  })
  const other = application.commands.createAccount({
    name: 'Other',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2025-01-01',
  })
  const input = {
    accountId: account.id,
    kind: 'expense' as const,
    date: '2026-01-15',
    totalMinor: 100,
    payeeName: 'Café',
    categoryId: child.id,
    note: 'Árvíztűrő',
    tagNames: ['Trip'],
    excluded: true,
  }
  const matching = application.commands.createTransaction({
    ...input,
    totalMinor: 300,
    lines: [
      { amountMinor: 100, categoryId: child.id, note: '', tagNames: ['Trip'] },
      { amountMinor: 200, categoryId: null, note: 'Other part' },
    ],
  })
  application.commands.createTransaction({
    ...input,
    date: '2026-01-14',
    totalMinor: 400,
  })
  for (const change of [
    { date: '2025-12-31' },
    { accountId: other.id },
    { payeeName: 'Other' },
    { categoryId: null },
    { note: 'Other' },
    { tagNames: [] },
    { excluded: false },
  ])
    application.commands.createTransaction({ ...input, ...change })
  const tag = application.queries.listTags().find((tag) => tag.name === 'Trip')!
  const query = {
    period: 'custom' as const,
    from: '2026-01-14',
    to: '2026-01-15',
    accountId: account.id,
    categoryId: main.id,
    payeeId: matching.payeeId!,
    tagId: tag.id,
    search: 'ARVIZTURO',
    exclusion: 'onlyExcluded' as const,
    offset: 99,
    limit: 1,
  }
  expect(application.queries.listTransactions(query).rows).toEqual([])
  expect(application.queries.exportTransactionsCsv(query)).toBe(
    '\uFEFFDate,Account,Kind,Payee,Main category,Subcategory,Amount,Currency,Note,Tags,Excluded\r\n' +
      '2026-01-15,Cash,Expense,Café,Travel,Rail,-1.00,CHF,Árvíztűrő,Trip,Yes\r\n' +
      '2026-01-15,Cash,Expense,Café,,,-2.00,CHF,Other part,,Yes\r\n' +
      '2026-01-14,Cash,Expense,Café,Travel,Rail,-4.00,CHF,Árvíztűrő,Trip,Yes\r\n',
  )
  application.commands.archiveAccount(account.id)
  application.commands.archiveCategory(main.id)
  expect(application.queries.exportTransactionsCsv(query)).toContain(
    'Travel,Rail,-1.00',
  )
})

test('omits transfers and adjustments while retaining ordinary linked fee expenses and exclusion choices', async () => {
  const { application, account } = await setup()
  const other = application.commands.createAccount({
    name: 'Bank',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2025-01-01',
  })
  application.commands.createTransfer({
    fromAccountId: account.id,
    toAccountId: other.id,
    fromAmountMinor: 1000,
    toAmountMinor: 1000,
    date: '2026-01-15',
    note: 'TRANSFER',
    fee: { amountMinor: 100, categoryId: null, excluded: false },
  })
  application.commands.createBalanceAdjustment({
    accountId: account.id,
    date: '2026-01-15',
    observedMinor: 0,
    note: 'ADJUSTMENT',
  })
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'income',
    date: '2026-01-14',
    totalMinor: 200,
    payeeName: null,
    categoryId: null,
    note: 'Excluded income',
    excluded: true,
  })
  const all = application.queries.exportTransactionsCsv()
  expect(all.split('\r\n')).toHaveLength(4)
  expect(all).toContain(',Expense,,,,-1.00,CHF,TRANSFER,,No\r\n')
  expect(all).toContain(',Income,,,,2.00,CHF,Excluded income,,Yes\r\n')
  expect(all).not.toContain('ADJUSTMENT')
  expect(
    application.queries.exportTransactionsCsv({ exclusion: 'hideExcluded' }),
  ).not.toContain('Excluded income')
  expect(
    application.queries.exportTransactionsCsv({ exclusion: 'onlyExcluded' }),
  ).not.toContain('TRANSFER')
})

test('presets use the injected clock, and an empty filtered set still exports a header', async () => {
  const { application, account } = await setup()
  for (const date of [
    '2025-11-30',
    '2025-12-01',
    '2025-12-31',
    '2026-01-01',
    '2026-01-15',
  ]) {
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'income',
      date,
      totalMinor: 1,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  }
  expect(
    application.queries
      .exportTransactionsCsv({ period: 'lastMonth' })
      .split('\r\n')
      .slice(1, -1),
  ).toEqual([
    '2025-12-31,Cash,Income,,,,0.01,CHF,,,No',
    '2025-12-01,Cash,Income,,,,0.01,CHF,,,No',
  ])
  for (const period of ['thisMonth', 'thisYear'] as const) {
    expect(
      application.queries
        .exportTransactionsCsv({ period })
        .split('\r\n')
        .slice(1, -1),
    ).toEqual([
      '2026-01-15,Cash,Income,,,,0.01,CHF,,,No',
      '2026-01-01,Cash,Income,,,,0.01,CHF,,,No',
    ])
  }
  expect(application.queries.exportTransactionsCsv({ search: 'missing' })).toBe(
    '\uFEFFDate,Account,Kind,Payee,Main category,Subcategory,Amount,Currency,Note,Tags,Excluded\r\n',
  )
})

test('exports beyond the maximum list page and leaves transaction undo history untouched', async () => {
  const { application, account } = await setup()
  for (let index = 0; index < 501; index++) {
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'income',
      date: '2026-01-15',
      totalMinor: 1,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  }
  const csv = application.queries.exportTransactionsCsv({
    offset: 500,
    limit: 1,
  })
  expect(csv.split('\r\n').slice(1, -1)).toHaveLength(501)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().totalCount).toBe(500)
})

test('exports safe-integer hundredths exactly in both currencies without aggregate overflow or float rounding', async () => {
  const { application, account } = await setup()
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'income',
    date: '2026-01-15',
    totalMinor: Number.MAX_SAFE_INTEGER,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  const huf = application.commands.createAccount({
    name: 'Forint',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2025-01-01',
  })
  application.commands.createTransaction({
    accountId: huf.id,
    kind: 'expense',
    date: '2026-01-14',
    totalMinor: Number.MAX_SAFE_INTEGER,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'income',
    date: '2026-01-13',
    totalMinor: Number.MAX_SAFE_INTEGER,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  expect(application.queries.exportTransactionsCsv()).toBe(
    '\uFEFFDate,Account,Kind,Payee,Main category,Subcategory,Amount,Currency,Note,Tags,Excluded\r\n' +
      '2026-01-15,Cash,Income,,,,90071992547409.91,CHF,,,No\r\n' +
      '2026-01-14,Forint,Expense,,,,-90071992547409.91,HUF,,,No\r\n' +
      '2026-01-13,Cash,Income,,,,90071992547409.91,CHF,,,No\r\n',
  )
})

test('rejects malformed CSV options and filters at the application boundary', async () => {
  const { application } = await setup()
  for (const input of [
    null,
    [],
    'csv',
    { decimalSeparator: ';' },
    { decimalSeparator: null },
    { decimalSeparator: 1 },
    { accountId: '../other' },
    { period: 'custom' },
    { search: {} },
    { exclusion: 'invalid' },
    { period: 'custom', from: '2025-02-29', to: '2026-01-15' },
  ])
    expect(() =>
      application.queries.exportTransactionsCsv(input as never),
    ).toThrow()
})
