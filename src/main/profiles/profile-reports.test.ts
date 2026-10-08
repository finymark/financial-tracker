import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import {
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'
import type { ExchangeRateSource } from '../exchange-rates/exchange-rate-source'

const directories: string[] = []
const applications: ProfileApplication[] = []
let now = new Date('2026-03-15T10:00:00.000Z')
const clock = () => now

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-reports-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Report test')
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

function rateSource(
  rates: Awaited<ReturnType<ExchangeRateSource['fetchRates']>>,
): ExchangeRateSource {
  return {
    async fetchRates(input) {
      return rates.filter(
        (rate) => rate.date >= input.startDate && rate.date <= input.endDate,
      )
    },
  }
}

test('category breakdown aggregates expense lines and excludes non-report movements', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 100_000,
    openingDate: '2026-01-01',
  })
  const other = application.commands.createAccount({
    name: 'Savings',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  const travel = application.commands.createCategory({
    name: 'Travel',
    kind: 'expense',
  })
  const tickets = application.commands.createCategory({
    name: 'Tickets',
    kind: 'expense',
    parentId: travel.id,
  })
  const lodging = application.commands.createCategory({
    name: 'Lodging',
    kind: 'expense',
    parentId: travel.id,
  })
  const create = (input: {
    kind?: 'expense' | 'income'
    date?: string
    amount: number
    categoryId?: string | null
    excluded?: boolean
  }) =>
    application.commands.createTransaction({
      accountId: account.id,
      kind: input.kind ?? 'expense',
      date: input.date ?? '2026-03-10',
      totalMinor: input.amount,
      payeeName: null,
      categoryId: input.categoryId ?? null,
      note: '',
      excluded: input.excluded,
    })
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-03-10',
    totalMinor: 1_000,
    payeeName: null,
    categoryId: null,
    note: '',
    lines: [
      { amountMinor: 250, categoryId: tickets.id, note: '' },
      { amountMinor: 600, categoryId: lodging.id, note: '' },
      { amountMinor: 150, categoryId: null, note: '' },
    ],
  })
  create({ amount: 100, categoryId: travel.id })
  create({ amount: 2_000, categoryId: tickets.id, excluded: true })
  create({ amount: 3_000, categoryId: null, kind: 'income' })
  create({ amount: 4_000, categoryId: tickets.id, date: '2026-02-28' })
  application.commands.createTransfer({
    fromAccountId: account.id,
    fromAmountMinor: 500,
    toAccountId: other.id,
    toAmountMinor: 500,
    date: '2026-03-10',
    note: '',
    fee: null,
  })
  application.commands.createBalanceAdjustment({
    accountId: account.id,
    date: '2026-03-11',
    observedMinor: 90_000,
    note: '',
  })

  const report = application.queries.getCategoryBreakdown({
    period: 'custom',
    from: '2026-03-01',
    to: '2026-03-15',
  })

  expect(report.range).toEqual({ from: '2026-03-01', to: '2026-03-15' })
  expect(report.total).toMatchObject({
    baseCurrency: 'HUF',
    roundedMinor: 1_100,
    unconverted: [],
    stale: false,
  })
  expect(report.categories).toHaveLength(2)
  expect(report.categories[0]).toMatchObject({
    categoryId: travel.id,
    name: 'Travel',
    total: { roundedMinor: 950 },
    subcategories: [
      { categoryId: travel.id, name: 'Travel', total: { roundedMinor: 100 } },
      { categoryId: tickets.id, name: 'Tickets', total: { roundedMinor: 250 } },
      { categoryId: lodging.id, name: 'Lodging', total: { roundedMinor: 600 } },
    ],
  })
  expect(report.categories[1]).toMatchObject({
    categoryId: null,
    name: null,
    total: { roundedMinor: 150 },
    subcategories: [],
  })
  expect(
    report.categories[0].subcategories.reduce(
      (sum, category) => sum + category.total.roundedMinor,
      0,
    ),
  ).toBe(report.categories[0].total.roundedMinor)
  expect(
    application.queries.listTransactions({
      period: 'custom',
      from: report.range.from,
      to: report.range.to,
      uncategorized: true,
      kind: 'expense',
    }).totals,
  ).toEqual([{ currency: 'HUF', expenseMinor: 150, incomeMinor: 0 }])
  expect(
    application.queries.listTransactions({
      period: 'custom',
      from: report.range.from,
      to: report.range.to,
      categoryId: travel.id,
      exactCategory: true,
      kind: 'expense',
    }).totals,
  ).toEqual([{ currency: 'HUF', expenseMinor: 100, incomeMinor: 0 }])
})

test('category totals convert exactly, expose missing currencies, and flag provisional rates', async () => {
  now = new Date('2026-03-14T10:00:00.000Z')
  const application = await setup()
  const huf = application.commands.createAccount({
    name: 'HUF',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-03-01',
  })
  const chf = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-03-01',
  })
  const category = application.commands.createCategory({
    name: 'Converted',
    kind: 'expense',
  })
  await application.commands.refreshExchangeRates(
    rateSource([{ date: '2026-03-10', currency: 'CHF', rate: '400', unit: 1 }]),
  )
  const create = (accountId: string, date: string, amountMinor: number) =>
    application.commands.createTransaction({
      accountId,
      kind: 'expense',
      date,
      totalMinor: amountMinor,
      payeeName: null,
      categoryId: category.id,
      note: '',
    })
  create(huf.id, '2026-03-10', 100)
  create(chf.id, '2026-03-09', 50)
  create(chf.id, '2026-03-10', 100)
  now = new Date('2026-03-15T10:00:00.000Z')
  create(chf.id, '2026-03-15', 100)

  const report = application.queries.getCategoryBreakdown({
    period: 'thisMonth',
  })

  expect(report.total).toEqual({
    baseCurrency: 'HUF',
    exactTotal: { numerator: '80100', denominator: '1' },
    roundedMinor: 80_100,
    unconverted: [{ currency: 'CHF', amountMinor: 50 }],
    stale: true,
  })
  expect(report.categories[0].total).toEqual(report.total)
})

test('CHF-base category totals use exact inverse conversion and round once after aggregation', async () => {
  const application = await setup()
  application.commands.updateSettings({ baseCurrency: 'CHF' })
  const huf = application.commands.createAccount({
    name: 'HUF',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-03-15',
  })
  const category = application.commands.createCategory({
    name: 'Tiny exact parts',
    kind: 'expense',
  })
  await application.commands.refreshExchangeRates(
    rateSource([{ date: '2026-03-15', currency: 'CHF', rate: '3', unit: 1 }]),
  )
  for (let index = 0; index < 3; index += 1) {
    application.commands.createTransaction({
      accountId: huf.id,
      kind: 'expense',
      date: '2026-03-15',
      totalMinor: 1,
      payeeName: null,
      categoryId: category.id,
      note: '',
    })
  }

  expect(
    application.queries.getCategoryBreakdown({ period: 'thisMonth' }).total,
  ).toEqual({
    baseCurrency: 'CHF',
    exactTotal: { numerator: '1', denominator: '1' },
    roundedMinor: 1,
    unconverted: [],
    stale: false,
  })
})

test('report presets and custom endpoints resolve to validated inclusive ranges', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2025-01-01',
  })
  const create = (date: string, amountMinor: number) =>
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date,
      totalMinor: amountMinor,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  create('2025-03-15', 1)
  create('2025-03-16', 2)
  create('2026-03-01', 4)
  create('2026-03-15', 8)

  expect(
    application.queries.getCategoryBreakdown({ period: 'last12Months' }),
  ).toMatchObject({
    range: { from: '2025-03-16', to: '2026-03-15' },
    total: { roundedMinor: 14 },
  })
  expect(
    application.queries.getCategoryBreakdown({ period: 'thisMonth' }).range,
  ).toEqual({ from: '2026-03-01', to: '2026-03-15' })
  expect(
    application.queries.getCategoryBreakdown({ period: 'lastMonth' }).range,
  ).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  expect(
    application.queries.getCategoryBreakdown({ period: 'thisYear' }).range,
  ).toEqual({ from: '2026-01-01', to: '2026-03-15' })
  expect(
    application.queries.getCategoryBreakdown({
      period: 'custom',
      from: '2026-03-01',
      to: '2026-03-15',
    }),
  ).toMatchObject({ total: { roundedMinor: 12 } })
  expect(() =>
    application.queries.getCategoryBreakdown({
      period: 'custom',
      from: '2026-03-16',
      to: '2026-03-15',
    }),
  ).toThrow('reports.error.range')
})
