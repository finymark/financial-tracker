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
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-cash-flow-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Cash flow test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  applications.push(application)
  const account = application.commands.createAccount({
    name: 'Cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  return { application, account }
}

afterEach(() => {
  now = new Date('2026-03-15T10:00:00.000Z')
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('cash flow connects income main categories through Income to expense main categories with balanced values', async () => {
  const { application, account } = await setup()
  const salary = application.commands.createCategory({
    name: 'Work',
    kind: 'income',
  })
  const food = application.commands.createCategory({
    name: 'Meals',
    kind: 'expense',
  })
  for (const [kind, categoryId] of [
    ['income', salary.id],
    ['expense', food.id],
  ] as const) {
    application.commands.createTransaction({
      accountId: account.id,
      kind,
      date: '2026-03-10',
      totalMinor: 1_000,
      categoryId,
      payeeName: null,
      note: '',
    })
  }

  expect(application.queries.getCashFlow({ period: 'thisMonth' })).toEqual({
    range: { from: '2026-03-01', to: '2026-03-15' },
    baseCurrency: 'HUF',
    stale: false,
    unconverted: [],
    nodes: [
      { kind: 'income', categoryId: salary.id, name: 'Work', value: 1_000 },
      { kind: 'center', categoryId: null, name: null, value: 1_000 },
      { kind: 'expense', categoryId: food.id, name: 'Meals', value: 1_000 },
    ],
    links: [
      { source: 0, target: 1, value: 1_000 },
      { source: 1, target: 2, value: 1_000 },
    ],
  })
})

test.each([
  { income: 1_000, expense: 700, kind: 'surplus', balance: 300, center: 1_000 },
  { income: 700, expense: 1_000, kind: 'deficit', balance: 300, center: 1_000 },
  { income: 1_000, expense: 0, kind: 'surplus', balance: 1_000, center: 1_000 },
  { income: 0, expense: 1_000, kind: 'deficit', balance: 1_000, center: 1_000 },
] as const)(
  'cash flow balances $income income and $expense expense with a $kind node',
  async (example) => {
    const { application, account } = await setup()
    for (const kind of ['income', 'expense'] as const) {
      if (example[kind] === 0) continue
      application.commands.createTransaction({
        accountId: account.id,
        kind,
        date: '2026-03-10',
        totalMinor: example[kind],
        categoryId: null,
        payeeName: null,
        note: '',
      })
    }
    const report = application.queries.getCashFlow({ period: 'thisMonth' })
    const center = report.nodes.findIndex((node) => node.kind === 'center')
    const balance = report.nodes.findIndex((node) => node.kind === example.kind)
    expect(report.nodes[center].value).toBe(example.center)
    expect(report.nodes[balance]).toEqual({
      kind: example.kind,
      categoryId: null,
      name: null,
      value: example.balance,
    })
    expect(
      report.nodes.some(
        (node) =>
          node.kind === (example.kind === 'deficit' ? 'surplus' : 'deficit'),
      ),
    ).toBe(false)
    expect(report.links).toContainEqual(
      example.kind === 'surplus'
        ? { source: center, target: balance, value: example.balance }
        : { source: balance, target: center, value: example.balance },
    )
    expect(
      report.links
        .filter((link) => link.target === center)
        .reduce((sum, link) => sum + link.value, 0),
    ).toBe(example.center)
    expect(
      report.links
        .filter((link) => link.source === center)
        .reduce((sum, link) => sum + link.value, 0),
    ).toBe(example.center)
  },
)

test('cash flow counts split parts under their own main categories and keeps uncategorized income and expense distinct', async () => {
  const { application, account } = await setup()
  const work = application.commands.createCategory({
    name: 'Work',
    kind: 'income',
  })
  const bonus = application.commands.createCategory({
    name: 'Bonus',
    kind: 'income',
    parentId: work.id,
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
  for (const [kind, parts] of [
    [
      'income',
      [
        { amountMinor: 800, categoryId: bonus.id, note: '' },
        { amountMinor: 200, categoryId: null, note: '' },
      ],
    ],
    [
      'expense',
      [
        { amountMinor: 300, categoryId: tickets.id, note: '' },
        { amountMinor: 400, categoryId: lodging.id, note: '' },
        { amountMinor: 300, categoryId: null, note: '' },
      ],
    ],
  ] as const) {
    application.commands.createTransaction({
      accountId: account.id,
      kind,
      date: '2026-03-10',
      totalMinor: 1_000,
      payeeName: null,
      categoryId: null,
      note: '',
      lines: [...parts],
    })
  }
  application.commands.archiveCategory(travel.id)
  const report = application.queries.getCashFlow({ period: 'thisMonth' })
  expect(report.nodes).toEqual([
    { kind: 'income', categoryId: work.id, name: 'Work', value: 800 },
    { kind: 'income', categoryId: null, name: null, value: 200 },
    { kind: 'center', categoryId: null, name: null, value: 1_000 },
    { kind: 'expense', categoryId: travel.id, name: 'Travel', value: 700 },
    { kind: 'expense', categoryId: null, name: null, value: 300 },
  ])
  expect(report.links).toEqual([
    { source: 0, target: 2, value: 800 },
    { source: 1, target: 2, value: 200 },
    { source: 2, target: 3, value: 700 },
    { source: 2, target: 4, value: 300 },
  ])
})

test('cash flow excludes transfers, adjustments, excluded transactions and out-of-range lines, but counts ordinary transfer fees', async () => {
  const { application, account } = await setup()
  const other = application.commands.createAccount({
    name: 'Savings',
    currency: 'HUF',
    openingBalance: 10_000,
    openingDate: '2026-01-01',
  })
  for (const kind of ['income', 'expense'] as const) {
    for (const [date, totalMinor, excluded] of [
      ['2026-03-01', 100, false],
      ['2026-03-15', 200, false],
      ['2026-02-28', 1_000, false],
      ['2026-03-10', 2_000, true],
    ] as const) {
      application.commands.createTransaction({
        accountId: account.id,
        kind,
        date,
        totalMinor,
        excluded,
        payeeName: null,
        categoryId: null,
        note: '',
      })
    }
  }
  application.commands.createTransfer({
    fromAccountId: account.id,
    fromAmountMinor: 10_000,
    toAccountId: other.id,
    toAmountMinor: 10_000,
    date: '2026-03-10',
    note: '',
    fee: { amountMinor: 50, categoryId: null },
  })
  application.commands.createBalanceAdjustment({
    accountId: account.id,
    date: '2026-03-10',
    observedMinor: 50_000,
    note: '',
  })
  const report = application.queries.getCashFlow({
    period: 'custom',
    from: '2026-03-01',
    to: '2026-03-15',
  })
  expect(report.nodes).toEqual([
    { kind: 'income', categoryId: null, name: null, value: 300 },
    { kind: 'deficit', categoryId: null, name: null, value: 50 },
    { kind: 'center', categoryId: null, name: null, value: 350 },
    { kind: 'expense', categoryId: null, name: null, value: 350 },
  ])
  expect(report.links).toEqual([
    { source: 0, target: 2, value: 300 },
    { source: 1, target: 2, value: 50 },
    { source: 2, target: 3, value: 350 },
  ])
})

test('cash flow uses dated cached rates and weekend fallback, separates missing amounts by kind, and marks stale flows', async () => {
  now = new Date('2026-03-14T10:00:00.000Z')
  const { application, account } = await setup()
  const chf = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  await application.commands.refreshExchangeRates({
    async fetchRates() {
      return [
        { date: '2026-03-10', currency: 'CHF', rate: '400', unit: 1 },
        { date: '2026-03-13', currency: 'CHF', rate: '450', unit: 1 },
      ]
    },
  })
  for (const [kind, accountId, date, totalMinor] of [
    ['income', chf.id, '2026-03-09', 50],
    ['expense', chf.id, '2026-03-09', 25],
    ['income', chf.id, '2026-03-10', 100],
    ['expense', chf.id, '2026-03-14', 100],
    ['income', account.id, '2026-03-14', 5_000],
  ] as const) {
    application.commands.createTransaction({
      accountId,
      kind,
      date,
      totalMinor,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  }
  expect(application.queries.getCashFlow({ period: 'thisMonth' })).toEqual({
    range: { from: '2026-03-01', to: '2026-03-14' },
    baseCurrency: 'HUF',
    stale: true,
    unconverted: [{ currency: 'CHF', incomeMinor: 50, expenseMinor: 25 }],
    nodes: [
      { kind: 'income', categoryId: null, name: null, value: 45_000 },
      { kind: 'center', categoryId: null, name: null, value: 45_000 },
      { kind: 'expense', categoryId: null, name: null, value: 45_000 },
    ],
    links: [
      { source: 0, target: 1, value: 45_000 },
      { source: 1, target: 2, value: 45_000 },
    ],
  })
  now = new Date('2026-03-15T10:00:00.000Z')
  application.commands.createTransaction({
    accountId: chf.id,
    kind: 'income',
    date: '2026-03-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  const provisional = application.queries.getCashFlow({ period: 'thisMonth' })
  expect(provisional.stale).toBe(true)
  expect(provisional.nodes.map((node) => [node.kind, node.value])).toEqual([
    ['income', 90_000],
    ['center', 90_000],
    ['expense', 45_000],
    ['surplus', 45_000],
  ])
})

test('cash flow aggregates exact inverse conversions before rounding a category and reuses the result on its link', async () => {
  const { application, account } = await setup()
  application.commands.updateSettings({ baseCurrency: 'CHF' })
  const category = application.commands.createCategory({
    name: 'Tiny parts',
    kind: 'income',
  })
  await application.commands.refreshExchangeRates({
    async fetchRates() {
      return [{ date: '2026-03-10', currency: 'CHF', rate: '3', unit: 1 }]
    },
  })
  for (let index = 0; index < 3; index += 1) {
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'income',
      date: '2026-03-10',
      totalMinor: 1,
      payeeName: null,
      categoryId: category.id,
      note: '',
    })
  }
  const report = application.queries.getCashFlow({ period: 'thisMonth' })
  expect(report.baseCurrency).toBe('CHF')
  expect(report.nodes.map((node) => [node.kind, node.value])).toEqual([
    ['income', 1],
    ['center', 1],
    ['surplus', 1],
  ])
  expect(report.links).toEqual([
    { source: 0, target: 1, value: 1 },
    { source: 1, target: 2, value: 1 },
  ])
})

test('cash flow balances rounded category flows even when their sum differs from rounding the whole period', async () => {
  const { application, account } = await setup()
  application.commands.updateSettings({ baseCurrency: 'CHF' })
  const first = application.commands.createCategory({
    name: 'First',
    kind: 'income',
  })
  const second = application.commands.createCategory({
    name: 'Second',
    kind: 'income',
  })
  await application.commands.refreshExchangeRates({
    async fetchRates() {
      return [{ date: '2026-03-10', currency: 'CHF', rate: '2', unit: 1 }]
    },
  })
  for (const categoryId of [first.id, second.id]) {
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'income',
      date: '2026-03-10',
      totalMinor: 1,
      payeeName: null,
      categoryId,
      note: '',
    })
  }
  const report = application.queries.getCashFlow({ period: 'thisMonth' })
  // Two independent 0.5-hundredth category totals each round to 1 hundredth.
  expect(report.nodes.map((node) => [node.kind, node.value])).toEqual([
    ['income', 1],
    ['income', 1],
    ['center', 2],
    ['surplus', 2],
  ])
  expect(report.links).toEqual([
    { source: 0, target: 2, value: 1 },
    { source: 1, target: 2, value: 1 },
    { source: 2, target: 3, value: 2 },
  ])
})

test('cash flow returns an empty diagram for an empty range or entirely unconverted lines', async () => {
  const { application } = await setup()
  expect(application.queries.getCashFlow({ period: 'lastMonth' })).toEqual({
    range: { from: '2026-02-01', to: '2026-02-28' },
    baseCurrency: 'HUF',
    stale: false,
    unconverted: [],
    nodes: [],
    links: [],
  })
  const chf = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  application.commands.createTransaction({
    accountId: chf.id,
    kind: 'expense',
    date: '2026-03-10',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  expect(application.queries.getCashFlow({ period: 'thisMonth' })).toEqual({
    range: { from: '2026-03-01', to: '2026-03-15' },
    baseCurrency: 'HUF',
    stale: false,
    unconverted: [{ currency: 'CHF', incomeMinor: 0, expenseMinor: 100 }],
    nodes: [],
    links: [],
  })
  expect(() =>
    application.queries.getCashFlow({
      period: 'custom',
      from: '2026-03-16',
      to: '2026-03-15',
    }),
  ).toThrow('reports.error.range')
})

test('cash flow localizes seeded category names while preserving custom names', async () => {
  const { application, account } = await setup()
  const food = application.queries
    .listCategories()
    .find((category) => category.seedKey === 'expense.food')!
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-03-10',
    totalMinor: 100,
    payeeName: null,
    categoryId: food.id,
    note: '',
  })
  for (const [language, name] of [
    ['en', 'Food'],
    ['hu', 'Étkezés'],
    ['de', 'Lebensmittel'],
  ] as const) {
    application.commands.updateSettings({ language })
    expect(
      application.queries
        .getCashFlow({ period: 'thisMonth' })
        .nodes.find((node) => node.categoryId === food.id)?.name,
    ).toBe(name)
  }
  application.commands.renameCategory({ id: food.id, name: 'Custom meals' })
  application.commands.updateSettings({ language: 'hu' })
  expect(
    application.queries
      .getCashFlow({ period: 'thisMonth' })
      .nodes.find((node) => node.categoryId === food.id)?.name,
  ).toBe('Custom meals')
})
