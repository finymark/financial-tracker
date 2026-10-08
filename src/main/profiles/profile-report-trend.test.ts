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
let now = new Date('2026-03-15T10:00:00.000Z')
const clock = () => now

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-trend-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Trend test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  applications.push(application)
  return application
}

afterEach(() => {
  now = new Date('2026-03-15T10:00:00.000Z')
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('monthly trend includes only in-range days, marks partial months, and shows empty months as zero', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2025-12-01',
  })
  const create = (
    date: string,
    kind: 'expense' | 'income',
    totalMinor: number,
  ) =>
    application.commands.createTransaction({
      accountId: account.id,
      kind,
      date,
      totalMinor,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  create('2025-12-14', 'expense', 999)
  create('2025-12-15', 'expense', 100)
  create('2025-12-31', 'expense', 200)
  create('2026-01-01', 'expense', 400)
  create('2026-01-31', 'income', 1_000)
  create('2026-03-10', 'expense', 100)
  create('2026-03-11', 'income', 999)

  const report = application.queries.getMonthlyTrend({
    period: 'custom',
    from: '2025-12-15',
    to: '2026-03-10',
  })

  expect(report.range).toEqual({ from: '2025-12-15', to: '2026-03-10' })
  expect(report.months).toMatchObject([
    {
      month: '2025-12',
      range: { from: '2025-12-15', to: '2025-12-31' },
      partial: true,
      expenses: {
        baseCurrency: 'HUF',
        roundedMinor: 300,
        unconverted: [],
        stale: false,
      },
      incomes: { roundedMinor: 0 },
      net: { roundedMinor: -300 },
    },
    {
      month: '2026-01',
      range: { from: '2026-01-01', to: '2026-01-31' },
      partial: false,
      expenses: { roundedMinor: 400 },
      incomes: { roundedMinor: 1_000 },
      net: { roundedMinor: 600 },
    },
    {
      month: '2026-02',
      range: { from: '2026-02-01', to: '2026-02-28' },
      partial: false,
      expenses: { roundedMinor: 0, unconverted: [], stale: false },
      incomes: { roundedMinor: 0, unconverted: [], stale: false },
      net: {
        exactTotal: { numerator: '0', denominator: '1' },
        roundedMinor: 0,
        unconverted: [],
        stale: false,
      },
    },
    {
      month: '2026-03',
      range: { from: '2026-03-01', to: '2026-03-10' },
      partial: true,
      expenses: { roundedMinor: 100 },
      incomes: { roundedMinor: 0 },
      net: { roundedMinor: -100 },
    },
  ])
  expect(report.months).toHaveLength(4)
})

test('monthly trend counts split lines and ordinary transfer fees but not exclusions, transfers, or adjustments', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 10_000,
    openingDate: '2026-01-01',
  })
  const other = application.commands.createAccount({
    name: 'Savings',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const food = application.commands.createCategory({
    name: 'Food test',
    kind: 'expense',
  })
  const groceries = application.commands.createCategory({
    name: 'Groceries test',
    kind: 'expense',
    parentId: food.id,
  })
  const salary = application.commands.createCategory({
    name: 'Salary test',
    kind: 'income',
  })
  for (const kind of ['expense', 'income'] as const) {
    application.commands.createTransaction({
      accountId: account.id,
      kind,
      date: '2026-03-10',
      totalMinor: kind === 'expense' ? 1_000 : 2_000,
      payeeName: null,
      categoryId: null,
      note: '',
      lines:
        kind === 'expense'
          ? [
              { amountMinor: 250, categoryId: food.id, note: '' },
              { amountMinor: 600, categoryId: groceries.id, note: '' },
              { amountMinor: 150, categoryId: null, note: '' },
            ]
          : [
              { amountMinor: 1_500, categoryId: salary.id, note: '' },
              { amountMinor: 500, categoryId: null, note: '' },
            ],
    })
    application.commands.createTransaction({
      accountId: account.id,
      kind,
      date: '2026-03-10',
      totalMinor: 5_000,
      payeeName: null,
      categoryId: null,
      note: '',
      excluded: true,
      lines: [
        { amountMinor: 2_000, categoryId: null, note: '' },
        { amountMinor: 3_000, categoryId: null, note: '' },
      ],
    })
  }
  application.commands.createTransfer({
    fromAccountId: account.id,
    fromAmountMinor: 8_000,
    toAccountId: other.id,
    toAmountMinor: 8_000,
    date: '2026-03-10',
    note: '',
    fee: { amountMinor: 100, categoryId: null, excluded: false },
  })
  application.commands.createTransfer({
    fromAccountId: account.id,
    fromAmountMinor: 7_000,
    toAccountId: other.id,
    toAmountMinor: 7_000,
    date: '2026-03-10',
    note: '',
    fee: { amountMinor: 200, categoryId: null, excluded: true },
  })
  application.commands.createBalanceAdjustment({
    accountId: account.id,
    date: '2026-03-11',
    observedMinor: 90_000,
    note: '',
  })

  const month = application.queries.getMonthlyTrend({ period: 'thisMonth' })
    .months[0]
  expect(month).toMatchObject({
    expenses: { roundedMinor: 1_100 },
    incomes: { roundedMinor: 2_000 },
    net: { roundedMinor: 900 },
  })
  expect(month.expenses).toEqual(
    application.queries.getCategoryBreakdown({ period: 'thisMonth' }).total,
  )
  expect(application.commands.undoLast()).toBe(true)
  expect(
    application.queries
      .listTransactions()
      .rows.some((row) => row.kind === 'adjustment'),
  ).toBe(false)
})

test('monthly totals convert by each line date with fallback and aggregate exactly before rounding', async () => {
  const application = await setup()
  application.commands.updateSettings({ baseCurrency: 'CHF' })
  const huf = application.commands.createAccount({
    name: 'HUF',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const chf = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  await application.commands.refreshExchangeRates({
    async fetchRates() {
      return [
        { date: '2026-01-01', currency: 'CHF', rate: '3', unit: 1 },
        { date: '2026-01-20', currency: 'CHF', rate: '6', unit: 1 },
        { date: '2026-02-01', currency: 'CHF', rate: '8', unit: 2 },
      ]
    },
  })
  const create = (
    accountId: string,
    date: string,
    kind: 'expense' | 'income',
    totalMinor: number,
  ) =>
    application.commands.createTransaction({
      accountId,
      date,
      kind,
      totalMinor,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  for (let index = 0; index < 3; index += 1)
    create(huf.id, '2026-01-03', 'expense', 1)
  create(huf.id, '2026-01-21', 'expense', 6)
  create(chf.id, '2026-01-25', 'income', 10)
  create(huf.id, '2026-02-01', 'expense', 2)
  create(huf.id, '2026-02-02', 'income', 1)

  const report = application.queries.getMonthlyTrend({
    period: 'custom',
    from: '2026-01-01',
    to: '2026-02-28',
  })
  expect(report.months).toHaveLength(2)
  expect(report.months[0]).toMatchObject({
    expenses: {
      baseCurrency: 'CHF',
      exactTotal: { numerator: '2', denominator: '1' },
      roundedMinor: 2,
      unconverted: [],
      stale: false,
    },
    incomes: { roundedMinor: 10 },
    net: { exactTotal: { numerator: '8', denominator: '1' }, roundedMinor: 8 },
  })
  // 2/4 = 0.5 expense, 1/4 = 0.25 income: net -0.25 rounds to 0,
  // not the -1 obtained by subtracting the separately rounded totals.
  expect(report.months[1]).toMatchObject({
    expenses: {
      exactTotal: { numerator: '1', denominator: '2' },
      roundedMinor: 1,
    },
    incomes: {
      exactTotal: { numerator: '1', denominator: '4' },
      roundedMinor: 0,
    },
    net: { exactTotal: { numerator: '-1', denominator: '4' }, roundedMinor: 0 },
  })
})

test('each month retains its own missing-currency bucket and marks cached conversions provisional', async () => {
  now = new Date('2026-02-14T10:00:00.000Z')
  const application = await setup()
  const chf = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  await application.commands.refreshExchangeRates({
    async fetchRates() {
      return [{ date: '2026-02-10', currency: 'CHF', rate: '400.25', unit: 1 }]
    },
  })
  const create = (
    date: string,
    kind: 'expense' | 'income',
    totalMinor: number,
  ) =>
    application.commands.createTransaction({
      accountId: chf.id,
      date,
      kind,
      totalMinor,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  create('2026-01-05', 'expense', 50)
  create('2026-01-06', 'income', 20)
  create('2026-02-09', 'expense', 70)
  create('2026-02-09', 'income', 100)
  create('2026-02-10', 'expense', 2)
  now = new Date('2026-03-15T10:00:00.000Z')
  create('2026-03-15', 'income', 1)

  const report = application.queries.getMonthlyTrend({ period: 'thisYear' })
  expect(report.months).toHaveLength(3)
  expect(report.months[0]).toMatchObject({
    expenses: {
      roundedMinor: 0,
      unconverted: [{ currency: 'CHF', amountMinor: 50 }],
      stale: false,
    },
    incomes: {
      roundedMinor: 0,
      unconverted: [{ currency: 'CHF', amountMinor: 20 }],
      stale: false,
    },
    net: {
      roundedMinor: 0,
      unconverted: [{ currency: 'CHF', amountMinor: -30 }],
      stale: false,
    },
  })
  expect(report.months[1]).toMatchObject({
    expenses: {
      exactTotal: { numerator: '1601', denominator: '2' },
      roundedMinor: 801,
      unconverted: [{ currency: 'CHF', amountMinor: 70 }],
      stale: true,
    },
    incomes: {
      roundedMinor: 0,
      unconverted: [{ currency: 'CHF', amountMinor: 100 }],
      stale: false,
    },
    net: {
      roundedMinor: -801,
      unconverted: [{ currency: 'CHF', amountMinor: 30 }],
      stale: true,
    },
  })
  expect(report.months[2]).toMatchObject({
    expenses: { roundedMinor: 0, unconverted: [], stale: false },
    incomes: { roundedMinor: 400, unconverted: [], stale: true },
    net: { roundedMinor: 400, unconverted: [], stale: true },
  })
})

test('monthly trend uses the injected-clock presets and handles full leap months and single-day ranges', async () => {
  now = new Date('2024-03-15T10:00:00.000Z')
  const application = await setup()
  expect(
    application.queries.getMonthlyTrend({ period: 'lastMonth' }),
  ).toMatchObject({
    range: { from: '2024-02-01', to: '2024-02-29' },
    months: [
      {
        month: '2024-02',
        range: { from: '2024-02-01', to: '2024-02-29' },
        partial: false,
        net: { roundedMinor: 0 },
      },
    ],
  })
  expect(
    application.queries.getMonthlyTrend({ period: 'thisMonth' }),
  ).toMatchObject({
    range: { from: '2024-03-01', to: '2024-03-15' },
    months: [{ month: '2024-03', partial: true }],
  })
  const rolling = application.queries.getMonthlyTrend({
    period: 'last12Months',
  })
  expect(rolling.range).toEqual({ from: '2023-03-16', to: '2024-03-15' })
  expect(rolling.months).toHaveLength(13)
  expect(rolling.months[0]).toMatchObject({
    month: '2023-03',
    range: { from: '2023-03-16', to: '2023-03-31' },
    partial: true,
  })
  expect(rolling.months[12]).toMatchObject({
    month: '2024-03',
    range: { from: '2024-03-01', to: '2024-03-15' },
    partial: true,
  })
  const single = application.queries.getMonthlyTrend({
    period: 'custom',
    from: '2024-02-29',
    to: '2024-02-29',
  })
  expect(single.months).toHaveLength(1)
  expect(single.months[0]).toMatchObject({
    month: '2024-02',
    range: { from: '2024-02-29', to: '2024-02-29' },
    partial: true,
  })
})

test('monthly trend validates report ranges and keeps profiles isolated', async () => {
  const application = await setup()
  for (const input of [
    { period: 'custom', from: '2026-03-16', to: '2026-03-15' },
    { period: 'custom', from: '2026-02-29', to: '2026-03-15' },
    { period: 'custom', from: '2026-03-01' },
    { period: 'thisMonth', from: '2026-03-01' },
    { period: 'all' },
  ]) {
    expect(() =>
      application.queries.getMonthlyTrend(
        input as Parameters<typeof application.queries.getMonthlyTrend>[0],
      ),
    ).toThrow('reports.error.range')
  }
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-03-01',
  })
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'income',
    date: '2026-03-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  const other = await setup()
  expect(
    other.queries.getMonthlyTrend({ period: 'thisMonth' }).months[0].incomes
      .roundedMinor,
  ).toBe(0)
  expect(
    application.queries.getMonthlyTrend({ period: 'thisMonth' }).months[0]
      .incomes.roundedMinor,
  ).toBe(100)
})
