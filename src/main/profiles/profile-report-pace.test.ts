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
let now = new Date('2026-03-31T10:00:00.000Z')
const clock = () => now

async function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-pace-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Pace test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
    createStartupBackup: false,
  })
  applications.push(application)
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2023-01-01',
  })
  const expense = (
    date: string,
    amount: number,
    categoryId: string | null = null,
  ) =>
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date,
      totalMinor: amount,
      categoryId,
      payeeName: null,
      note: '',
    })
  return { application, account, expense }
}

afterEach(() => {
  now = new Date('2026-03-31T10:00:00.000Z')
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('spending pace compares this month so far with three clamped calendar months', async () => {
  const { application, expense } = await setup()
  expense('2025-11-30', 9_000)
  expense('2025-12-01', 300)
  expense('2025-12-31', 300)
  expense('2026-01-31', 900)
  expense('2026-02-28', 300)
  expense('2026-03-01', 200)
  expense('2026-03-31', 700)

  const report = application.queries.getSpendingPace()

  expect(report.range).toEqual({ from: '2026-03-01', to: '2026-03-31' })
  expect(report.total.previousMonths.map((month) => month.range)).toEqual([
    { from: '2026-02-01', to: '2026-02-28' },
    { from: '2026-01-01', to: '2026-01-31' },
    { from: '2025-12-01', to: '2025-12-31' },
  ])
  expect(report.total).toMatchObject({
    current: { roundedMinor: 900 },
    average: {
      exactTotal: { numerator: '600', denominator: '1' },
      roundedMinor: 600,
    },
    differenceMinor: 300,
    percentageBasisPoints: 5_000,
    incomplete: false,
  })
})

test.each([
  ['2024-03-31', ['2024-02-29', '2024-01-31', '2023-12-31']],
  ['2025-03-31', ['2025-02-28', '2025-01-31', '2024-12-31']],
  ['2026-05-31', ['2026-04-30', '2026-03-31', '2026-02-28']],
  ['2024-02-29', ['2024-01-29', '2023-12-29', '2023-11-29']],
  ['2025-02-28', ['2025-01-28', '2024-12-28', '2024-11-28']],
  ['2026-04-30', ['2026-03-30', '2026-02-28', '2026-01-30']],
  ['2026-01-15', ['2025-12-15', '2025-11-15', '2025-10-15']],
] as const)(
  'spending pace clamps inclusive comparison endpoints for %s',
  async (date, ends) => {
    now = new Date(`${date}T10:00:00.000Z`)
    const { application, expense } = await setup()
    for (const end of ends) {
      expense(`${end.slice(0, 7)}-01`, 100)
      expense(end, 200)
      const next = new Date(`${end}T10:00:00.000Z`)
      next.setUTCDate(next.getUTCDate() + 1)
      if (next.toISOString().slice(0, 7) === end.slice(0, 7))
        expense(next.toISOString().slice(0, 10), 9_000)
    }
    expense(`${date.slice(0, 7)}-01`, 100)
    expense(date, 200)

    const report = application.queries.getSpendingPace()

    expect(report.range.to).toBe(date)
    expect(report.total.previousMonths.map((month) => month.range.to)).toEqual(
      ends,
    )
    expect(
      report.total.previousMonths.map((month) => month.total.roundedMinor),
    ).toEqual([300, 300, 300])
    expect(report.total.average.roundedMinor).toBe(300)
    expect(report.total.differenceMinor).toBe(0)
    expect(report.total.percentageBasisPoints).toBe(0)
  },
)

test('pace groups split parts by main category, retains historical and uncategorized groups, and excludes other movements', async () => {
  now = new Date('2026-03-31T10:00:00.000Z')
  const { application, account, expense } = await setup()
  const food = application.commands.createCategory({
    name: 'Food test',
    kind: 'expense',
  })
  const groceries = application.commands.createCategory({
    name: 'Groceries test',
    kind: 'expense',
    parentId: food.id,
  })
  const travel = application.commands.createCategory({
    name: 'Travel test',
    kind: 'expense',
  })
  const newCategory = application.commands.createCategory({
    name: 'New test',
    kind: 'expense',
  })
  expense('2025-12-15', 300, food.id)
  expense('2026-01-15', 600, groceries.id)
  expense('2026-02-15', 900, groceries.id)
  expense('2026-02-15', 900, travel.id)
  expense('2026-02-15', 150)
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-03-15',
    totalMinor: 450,
    categoryId: null,
    payeeName: null,
    note: '',
    lines: [
      { amountMinor: 200, categoryId: groceries.id, note: '' },
      { amountMinor: 100, categoryId: food.id, note: '' },
      { amountMinor: 50, categoryId: null, note: '' },
      { amountMinor: 100, categoryId: newCategory.id, note: '' },
    ],
  })
  for (const date of ['2026-02-15', '2026-03-15']) {
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date,
      totalMinor: 9_000,
      categoryId: food.id,
      payeeName: null,
      note: '',
      excluded: true,
    })
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'income',
      date,
      totalMinor: 9_000,
      categoryId: null,
      payeeName: null,
      note: '',
    })
  }
  const savings = application.commands.createAccount({
    name: 'Savings',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2023-01-01',
  })
  application.commands.createTransfer({
    fromAccountId: account.id,
    fromAmountMinor: 9_000,
    toAccountId: savings.id,
    toAmountMinor: 9_000,
    date: '2026-03-15',
    note: '',
    fee: null,
  })
  application.commands.createBalanceAdjustment({
    accountId: account.id,
    observedMinor: 9_000,
    date: '2026-03-15',
    note: '',
  })
  // An injected clock, not the newest transaction or wall clock, defines today.
  expense('2026-03-16', 9_000, food.id)
  now = new Date('2026-03-15T10:00:00.000Z')
  application.commands.archiveCategory(food.id)

  const report = application.queries.getSpendingPace()

  expect(report.total).toMatchObject({
    current: { roundedMinor: 450 },
    average: { roundedMinor: 950 },
    differenceMinor: -500,
  })
  expect(report.categories).toHaveLength(4)
  expect(
    report.categories.find((category) => category.categoryId === food.id),
  ).toMatchObject({
    name: 'Food test',
    current: { roundedMinor: 300 },
    average: { roundedMinor: 600 },
    differenceMinor: -300,
    percentageBasisPoints: -5_000,
  })
  expect(
    report.categories.find((category) => category.categoryId === travel.id),
  ).toMatchObject({
    current: { roundedMinor: 0 },
    average: { roundedMinor: 300 },
    differenceMinor: -300,
    percentageBasisPoints: -10_000,
  })
  expect(
    report.categories.find(
      (category) => category.categoryId === newCategory.id,
    ),
  ).toMatchObject({
    current: { roundedMinor: 100 },
    average: { roundedMinor: 0 },
    differenceMinor: 100,
    percentageBasisPoints: null,
  })
  expect(
    report.categories.find((category) => category.categoryId === null),
  ).toMatchObject({
    name: null,
    current: { roundedMinor: 50 },
    average: { roundedMinor: 50 },
    differenceMinor: 0,
    percentageBasisPoints: 0,
  })
  expect(report.total.current).toEqual(
    application.queries.getCategoryBreakdown({ period: 'thisMonth' }).total,
  )
})

test('pace averages exact date-converted totals before rounding and derives percent from the exact average', async () => {
  const { application, expense } = await setup()
  application.commands.updateSettings({ baseCurrency: 'CHF' })
  await application.commands.refreshExchangeRates({
    async fetchRates() {
      return [
        { date: '2025-12-01', currency: 'CHF', rate: '3', unit: 1 },
        { date: '2026-02-01', currency: 'CHF', rate: '1', unit: 1 },
        { date: '2026-03-01', currency: 'CHF', rate: '3', unit: 1 },
      ]
    },
  })
  expense('2025-12-01', 1)
  expense('2026-01-04', 1) // Previous published rate, including weekend fallback.
  expense('2026-02-01', 1)
  expense('2026-03-01', 1)

  const report = application.queries.getSpendingPace()

  expect(report.total).toMatchObject({
    current: {
      baseCurrency: 'CHF',
      exactTotal: { numerator: '1', denominator: '3' },
      roundedMinor: 0,
    },
    average: {
      baseCurrency: 'CHF',
      exactTotal: { numerator: '5', denominator: '9' },
      roundedMinor: 1,
      stale: false,
    },
    differenceMinor: 0,
    percentageBasisPoints: -4_000,
    direction: 'behind',
    incomplete: false,
  })
  expect(report.categories[0].average).toEqual(report.total.average)
})

test('pace exposes unconverted buckets per affected month and category, and marks comparisons partial and provisional', async () => {
  now = new Date('2026-03-30T10:00:00.000Z')
  const { application, expense } = await setup()
  const chf = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2025-12-01',
  })
  const category = application.commands.createCategory({
    name: 'Missing rates test',
    kind: 'expense',
  })
  const chfExpense = (date: string, amount: number) =>
    application.commands.createTransaction({
      accountId: chf.id,
      kind: 'expense',
      date,
      totalMinor: amount,
      categoryId: category.id,
      payeeName: null,
      note: '',
    })
  chfExpense('2025-12-10', 50)
  chfExpense('2026-01-10', 100)
  chfExpense('2026-02-10', 100)
  expense('2026-02-10', 60)
  await application.commands.refreshExchangeRates({
    async fetchRates() {
      return [
        { date: '2026-01-01', currency: 'CHF', rate: '2.5', unit: 1 },
        { date: '2026-02-01', currency: 'CHF', rate: '3.5', unit: 1 },
      ]
    },
  })
  now = new Date('2026-03-31T10:00:00.000Z')
  chfExpense('2026-03-31', 100)

  const report = application.queries.getSpendingPace()

  expect(report.total.current).toMatchObject({
    roundedMinor: 350,
    stale: true,
    unconverted: [],
  })
  expect(report.total.previousMonths).toMatchObject([
    {
      range: { from: '2026-02-01', to: '2026-02-28' },
      total: { roundedMinor: 410, stale: true, unconverted: [] },
    },
    {
      range: { from: '2026-01-01', to: '2026-01-31' },
      total: { roundedMinor: 250, stale: true, unconverted: [] },
    },
    {
      range: { from: '2025-12-01', to: '2025-12-31' },
      total: {
        roundedMinor: 0,
        unconverted: [{ currency: 'CHF', amountMinor: 50 }],
      },
    },
  ])
  expect(report.total).toMatchObject({
    average: { roundedMinor: 220, stale: true },
    differenceMinor: 130,
    percentageBasisPoints: 5_909,
    incomplete: true,
  })
  expect(
    report.categories.find((item) => item.categoryId === category.id),
  ).toMatchObject({ incomplete: true, average: { roundedMinor: 200 } })
  // With no earlier published rate at all, current and history are explicit too.
  const other = await setup()
  const missing = other.application.commands.createAccount({
    name: 'Unconverted CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2025-12-01',
  })
  for (const date of ['2025-12-01', '2026-03-01'])
    other.application.commands.createTransaction({
      accountId: missing.id,
      kind: 'expense',
      date,
      totalMinor: 75,
      categoryId: null,
      payeeName: null,
      note: '',
    })
  expect(other.application.queries.getSpendingPace().total).toMatchObject({
    current: {
      roundedMinor: 0,
      unconverted: [{ currency: 'CHF', amountMinor: 75 }],
    },
    average: { roundedMinor: 0 },
    percentageBasisPoints: null,
    incomplete: true,
  })
})

test('pace uses all three months including empty ones, rounds ties away from zero, and leaves undo unchanged', async () => {
  const { application, expense } = await setup()
  expect(application.queries.getSpendingPace()).toMatchObject({
    total: {
      current: { roundedMinor: 0 },
      average: { roundedMinor: 0 },
      percentageBasisPoints: null,
      direction: 'onPace',
      incomplete: false,
    },
    categories: [],
  })
  application.commands.updateSettings({ baseCurrency: 'CHF' })
  await application.commands.refreshExchangeRates({
    async fetchRates() {
      return [{ date: '2025-12-01', currency: 'CHF', rate: '2', unit: 1 }]
    },
  })
  expense('2026-02-01', 3) // Exact average is 1.5 / 3 = 0.5 hundredths.
  const report = application.queries.getSpendingPace()
  expect(report.total).toMatchObject({
    average: {
      exactTotal: { numerator: '1', denominator: '2' },
      roundedMinor: 1,
    },
    differenceMinor: -1,
    percentageBasisPoints: -10_000,
    direction: 'behind',
  })
  application.commands.undoLast()
  expect(application.queries.getSpendingPace().total.average.roundedMinor).toBe(
    0,
  )
  application.close()
  expect(() => application.queries.getSpendingPace()).toThrow(
    'Profile is closed',
  )
})
