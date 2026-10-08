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
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-overview-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Overview test')
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

test('overview agrees with the breakdown and compares month-to-date with the full last month', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
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
  const create = (
    date: string,
    amount: number,
    kind: 'expense' | 'income' = 'expense',
    excluded = false,
  ) =>
    application.commands.createTransaction({
      accountId: account.id,
      kind,
      date,
      totalMinor: amount,
      payeeName: null,
      categoryId: null,
      note: '',
      excluded,
    })
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-03-15',
    totalMinor: 1000,
    payeeName: null,
    categoryId: null,
    note: '',
    lines: [
      { amountMinor: 600, categoryId: tickets.id, note: '' },
      { amountMinor: 250, categoryId: travel.id, note: '' },
      { amountMinor: 150, categoryId: null, note: '' },
    ],
  })
  create('2026-03-01', 100)
  create('2026-03-15', 3000, 'income')
  create('2026-03-15', 10000, 'expense', true)
  create('2026-03-15', 20000, 'income', true)
  create('2026-02-01', 400)
  create('2026-02-28', 600)
  create('2026-02-28', 2000, 'income')
  create('2026-01-31', 9000)
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
    observedMinor: 90000,
    note: '',
  })

  const dashboard = application.queries.getOverviewDashboard()
  const breakdown = application.queries.getCategoryBreakdown({
    period: 'custom',
    ...dashboard.thisMonth.range,
  })
  const previous = application.queries.getCategoryBreakdown({
    period: 'custom',
    ...dashboard.lastMonth.range,
  })

  expect(dashboard.thisMonth).toMatchObject({
    range: { from: '2026-03-01', to: '2026-03-15' },
    expenses: { roundedMinor: 1100 },
    incomes: { roundedMinor: 3000 },
    net: { roundedMinor: 1900 },
  })
  expect(dashboard.lastMonth).toMatchObject({
    range: { from: '2026-02-01', to: '2026-02-28' },
    expenses: { roundedMinor: 1000 },
    incomes: { roundedMinor: 2000 },
    net: { roundedMinor: 1000 },
  })
  expect(dashboard.change).toMatchObject({
    expenses: { roundedMinor: 100 },
    incomes: { roundedMinor: 1000 },
    net: { roundedMinor: 900 },
  })
  expect(dashboard.thisMonth.expenses).toEqual(breakdown.total)
  expect(dashboard.lastMonth.expenses).toEqual(previous.total)
  expect(dashboard.topCategories).toMatchObject([
    {
      categoryId: travel.id,
      name: 'Travel',
      total: { roundedMinor: 850 },
      shareBasisPoints: 7727,
    },
    {
      categoryId: null,
      name: null,
      total: { roundedMinor: 250 },
      shareBasisPoints: 2273,
    },
  ])
  for (const category of dashboard.topCategories) {
    expect(category.total).toEqual(
      breakdown.categories.find(
        (item) => item.categoryId === category.categoryId,
      )?.total,
    )
  }
})

test('overview rounds net and changes once from exact converted lines, not rounded cards', async () => {
  const application = await setup()
  application.commands.updateSettings({ baseCurrency: 'CHF' })
  const account = application.commands.createAccount({
    name: 'HUF',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-02-01',
  })
  await application.commands.refreshExchangeRates({
    async fetchRates() {
      return [{ date: '2026-02-01', currency: 'CHF', rate: '3', unit: 1 }]
    },
  })
  const create = (date: string, kind: 'expense' | 'income') =>
    application.commands.createTransaction({
      accountId: account.id,
      kind,
      date,
      totalMinor: 1,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  create('2026-02-28', 'expense')
  create('2026-03-15', 'expense')
  create('2026-03-15', 'expense')
  create('2026-03-15', 'income')

  const dashboard = application.queries.getOverviewDashboard()
  expect(dashboard.thisMonth).toMatchObject({
    expenses: {
      exactTotal: { numerator: '2', denominator: '3' },
      roundedMinor: 1,
    },
    incomes: {
      exactTotal: { numerator: '1', denominator: '3' },
      roundedMinor: 0,
    },
    net: { exactTotal: { numerator: '-1', denominator: '3' }, roundedMinor: 0 },
  })
  expect(dashboard.change).toMatchObject({
    expenses: {
      exactTotal: { numerator: '1', denominator: '3' },
      roundedMinor: 0,
    },
    incomes: {
      exactTotal: { numerator: '1', denominator: '3' },
      roundedMinor: 0,
    },
    net: { exactTotal: { numerator: '0', denominator: '1' }, roundedMinor: 0 },
  })
  expect(dashboard.thisMonth.expenses).toEqual(
    application.queries.getCategoryBreakdown({ period: 'thisMonth' }).total,
  )
})

test('overview preserves date-based rates, missing buckets and stale flags in totals and top categories', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-02-01',
  })
  await application.commands.refreshExchangeRates({
    async fetchRates() {
      return [
        { date: '2026-03-10', currency: 'CHF', rate: '400.5', unit: 1 },
        { date: '2026-03-12', currency: 'CHF', rate: '420.5', unit: 1 },
      ]
    },
  })
  const create = (
    date: string,
    amount: number,
    kind: 'expense' | 'income' = 'expense',
  ) =>
    application.commands.createTransaction({
      accountId: account.id,
      kind,
      date,
      totalMinor: amount,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  create('2026-02-28', 20)
  create('2026-03-09', 40)
  create('2026-03-09', 10, 'income')
  create('2026-03-10', 1)
  create('2026-03-15', 1)
  now = new Date('2026-03-16T10:00:00.000Z')

  const dashboard = application.queries.getOverviewDashboard()
  expect(dashboard.thisMonth.expenses).toEqual({
    baseCurrency: 'HUF',
    exactTotal: { numerator: '821', denominator: '1' },
    roundedMinor: 821,
    unconverted: [{ currency: 'CHF', amountMinor: 40 }],
    stale: true,
  })
  expect(dashboard.thisMonth.incomes).toMatchObject({
    roundedMinor: 0,
    unconverted: [{ currency: 'CHF', amountMinor: 10 }],
  })
  expect(dashboard.thisMonth.net).toMatchObject({
    roundedMinor: -821,
    unconverted: [{ currency: 'CHF', amountMinor: -30 }],
    stale: true,
  })
  expect(dashboard.lastMonth.expenses).toMatchObject({
    roundedMinor: 0,
    unconverted: [{ currency: 'CHF', amountMinor: 20 }],
  })
  expect(dashboard.change.expenses).toMatchObject({
    roundedMinor: 821,
    unconverted: [{ currency: 'CHF', amountMinor: 20 }],
    stale: true,
  })
  expect(dashboard.topCategories[0]).toMatchObject({
    categoryId: null,
    shareBasisPoints: 10000,
  })
  expect(dashboard.topCategories[0].total).toEqual(dashboard.thisMonth.expenses)
  expect(dashboard.thisMonth.expenses).toEqual(
    application.queries.getCategoryBreakdown({
      period: 'custom',
      ...dashboard.thisMonth.range,
    }).total,
  )
})

test('overview ranks only the top five main categories including uncategorized by converted expenses', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-03-01',
  })
  const ids: string[] = []
  for (const amount of [100, 200, 300, 400, 500, 600]) {
    const category = application.commands.createCategory({
      name: `Category ${amount}`,
      kind: 'expense',
    })
    ids.push(category.id)
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date: '2026-03-15',
      totalMinor: amount,
      payeeName: null,
      categoryId: category.id,
      note: '',
    })
  }
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-03-15',
    totalMinor: 700,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  const dashboard = application.queries.getOverviewDashboard()
  const breakdown = application.queries.getCategoryBreakdown({
    period: 'custom',
    ...dashboard.thisMonth.range,
  })
  expect(
    dashboard.topCategories.map((category) => category.categoryId),
  ).toEqual([null, ids[5], ids[4], ids[3], ids[2]])
  expect(
    dashboard.topCategories.map((category) => category.total.roundedMinor),
  ).toEqual([700, 600, 500, 400, 300])
  expect(
    dashboard.topCategories.map((category) => category.shareBasisPoints),
  ).toEqual([2500, 2143, 1786, 1429, 1071])
  for (const category of dashboard.topCategories) {
    expect(category.total).toEqual(
      breakdown.categories.find(
        (item) => item.categoryId === category.categoryId,
      )?.total,
    )
  }
})

test.each([
  [
    '2026-01-01T10:00:00.000Z',
    '2026-01-01',
    '2026-01-01',
    '2025-12-01',
    '2025-12-31',
  ],
  [
    '2024-03-01T10:00:00.000Z',
    '2024-03-01',
    '2024-03-01',
    '2024-02-01',
    '2024-02-29',
  ],
])(
  'empty overview handles calendar rollover at %s without invalid shares',
  async (date, from, to, lastFrom, lastTo) => {
    now = new Date(date)
    const application = await setup()
    const dashboard = application.queries.getOverviewDashboard()
    expect(dashboard.thisMonth.range).toEqual({ from, to })
    expect(dashboard.lastMonth.range).toEqual({ from: lastFrom, to: lastTo })
    expect(dashboard.topCategories).toEqual([])
    for (const period of [
      dashboard.thisMonth,
      dashboard.lastMonth,
      dashboard.change,
    ]) {
      for (const total of [period.expenses, period.incomes, period.net]) {
        expect(total).toMatchObject({
          roundedMinor: 0,
          unconverted: [],
          stale: false,
        })
      }
    }
  },
)

test('overview retains categories with only missing rates without inventing converted shares', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-03-01',
  })
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-03-15',
    totalMinor: 500,
    payeeName: null,
    categoryId: null,
    note: '',
  })

  const dashboard = application.queries.getOverviewDashboard()
  const breakdown = application.queries.getCategoryBreakdown({
    period: 'custom',
    ...dashboard.thisMonth.range,
  })
  expect(dashboard.thisMonth.expenses).toEqual(breakdown.total)
  expect(dashboard.topCategories).toEqual([
    {
      categoryId: null,
      name: null,
      total: {
        baseCurrency: 'HUF',
        exactTotal: { numerator: '0', denominator: '1' },
        roundedMinor: 0,
        unconverted: [{ currency: 'CHF', amountMinor: 500 }],
        stale: false,
      },
      shareBasisPoints: 0,
    },
  ])
})
