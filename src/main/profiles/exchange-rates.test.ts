import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import type { ExchangeRateSource } from '../exchange-rates/exchange-rate-source'
import {
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'

const directories: string[] = []
const applications: ProfileApplication[] = []
let now = new Date('2026-08-25T10:00:00.000Z')
const clock = () => now

async function setup(baseCurrency: 'HUF' | 'CHF' = 'HUF') {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-rates-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Rate test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
  })
  applications.push(application)
  application.commands.updateSettings({ baseCurrency })
  return application
}

function source(rates: Awaited<ReturnType<ExchangeRateSource['fetchRates']>>) {
  const calls: Parameters<ExchangeRateSource['fetchRates']>[0][] = []
  const value: ExchangeRateSource = {
    async fetchRates(input) {
      calls.push(input)
      return rates.filter(
        (rate) => rate.date >= input.startDate && rate.date <= input.endDate,
      )
    },
  }
  return { value, calls }
}

afterEach(() => {
  now = new Date('2026-08-25T10:00:00.000Z')
  for (const application of applications.splice(0)) application.close()
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

test('refreshes only the needed range and converts with previous-published-day fallback', async () => {
  const application = await setup()
  application.commands.createAccount({
    name: 'CHF cash',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-08-14',
  })
  const fake = source([
    { date: '2026-08-14', currency: 'CHF', rate: '386,38', unit: 1 },
    { date: '2026-08-19', currency: 'CHF', rate: '388,14', unit: 1 },
    { date: '2026-08-24', currency: 'CHF', rate: '387,06', unit: 1 },
    { date: '2026-08-25', currency: 'CHF', rate: '387,17', unit: 1 },
  ])

  await application.commands.refreshExchangeRates(fake.value)

  expect(fake.calls).toEqual([
    {
      startDate: '2026-08-14',
      endDate: '2026-08-25',
      currencies: ['CHF'],
    },
  ])
  expect(application.queries.getRateStatus()).toEqual({
    coverage: { startDate: '2026-08-14', endDate: '2026-08-25' },
    lastRefresh: '2026-08-25T10:00:00.000Z',
    stale: false,
    missing: false,
  })
  expect(
    application.queries.convertToBaseCurrency([
      { date: '2026-08-20', currency: 'CHF', amountMinor: 10_000 },
      { date: '2026-08-23', currency: 'CHF', amountMinor: 10_000 },
    ]),
  ).toEqual({
    baseCurrency: 'HUF',
    exactTotal: { numerator: '7762800', denominator: '1' },
    roundedMinor: 7_762_800,
    unconverted: [],
    stale: false,
  })

  now = new Date('2026-08-26T10:00:00.000Z')
  await application.commands.refreshExchangeRates(fake.value)
  expect(fake.calls.at(-1)).toEqual({
    startDate: '2026-08-26',
    endDate: '2026-08-26',
    currencies: ['CHF'],
  })
})

test('keeps missing amounts explicit and flags cached rates after coverage as stale', async () => {
  const application = await setup()
  application.commands.createAccount({
    name: 'CHF cash',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-08-17',
  })
  const fake = source([
    { date: '2026-08-19', currency: 'CHF', rate: '400', unit: 1 },
  ])
  await application.commands.refreshExchangeRates(fake.value)

  expect(
    application.queries.convertToBaseCurrency([
      { date: '2026-08-18', currency: 'CHF', amountMinor: 250 },
      { date: '2026-08-20', currency: 'CHF', amountMinor: 100 },
      { date: '2026-08-20', currency: 'HUF', amountMinor: 50 },
    ]),
  ).toEqual({
    baseCurrency: 'HUF',
    exactTotal: { numerator: '40050', denominator: '1' },
    roundedMinor: 40_050,
    unconverted: [{ currency: 'CHF', amountMinor: 250 }],
    stale: false,
  })

  now = new Date('2026-08-26T10:00:00.000Z')
  expect(application.queries.getRateStatus()).toMatchObject({
    stale: true,
    missing: true,
  })
  expect(
    application.queries.convertToBaseCurrency([
      { date: '2026-08-26', currency: 'CHF', amountMinor: 100 },
    ]),
  ).toMatchObject({ roundedMinor: 40_000, stale: true, unconverted: [] })
})

test('uses exact inverse rational conversion and rounds once after aggregation', async () => {
  const application = await setup('CHF')
  application.commands.createAccount({
    name: 'HUF cash',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-08-25',
  })
  const fake = source([
    { date: '2026-08-25', currency: 'CHF', rate: '3', unit: 1 },
  ])
  await application.commands.refreshExchangeRates(fake.value)

  expect(
    application.queries.convertToBaseCurrency([
      { date: '2026-08-25', currency: 'HUF', amountMinor: 1 },
      { date: '2026-08-25', currency: 'HUF', amountMinor: 1 },
      { date: '2026-08-25', currency: 'HUF', amountMinor: 1 },
    ]),
  ).toEqual({
    baseCurrency: 'CHF',
    exactTotal: { numerator: '1', denominator: '1' },
    roundedMinor: 1,
    unconverted: [],
    stale: false,
  })
})

test('rate cache writes preserve user undo history and a closed profile rejects late writes', async () => {
  const application = await setup()
  const account = application.commands.createAccount({
    name: 'CHF cash',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-08-25',
  })
  const fake = source([
    { date: '2026-08-25', currency: 'CHF', rate: '400', unit: 1 },
  ])
  await application.commands.refreshExchangeRates(fake.value)
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listAccounts()).toEqual([])

  const lateApplication = await setup()
  lateApplication.commands.createAccount({
    name: 'Late CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-08-25',
  })
  let resolveFetch!: (
    rates: Awaited<ReturnType<ExchangeRateSource['fetchRates']>>,
  ) => void
  const pendingSource: ExchangeRateSource = {
    fetchRates: () =>
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
  }
  const refresh = lateApplication.commands.refreshExchangeRates(pendingSource)
  lateApplication.close()
  applications.splice(applications.indexOf(lateApplication), 1)
  resolveFetch([{ date: '2026-08-25', currency: 'CHF', rate: '400', unit: 1 }])
  await expect(refresh).rejects.toThrow('Profile is closed')
  expect(account.currency).toBe('CHF')
})

test('transaction totals include one rounded base-currency total and explicit unconverted amounts', async () => {
  const application = await setup()
  const huf = application.commands.createAccount({
    name: 'HUF',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-08-18',
  })
  const chf = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-08-18',
  })
  await application.commands.refreshExchangeRates(
    source([{ date: '2026-08-19', currency: 'CHF', rate: '400', unit: 1 }])
      .value,
  )
  const create = (
    accountId: string,
    kind: 'expense' | 'income',
    date: string,
    totalMinor: number,
  ) =>
    application.commands.createTransaction({
      accountId,
      kind,
      date,
      totalMinor,
      payeeName: null,
      categoryId: null,
      note: '',
    })
  create(huf.id, 'expense', '2026-08-20', 50)
  create(chf.id, 'expense', '2026-08-20', 100)
  create(chf.id, 'income', '2026-08-18', 250)

  expect(application.queries.listTransactions().baseTotals).toEqual({
    currency: 'HUF',
    expenseMinor: 40_050,
    incomeMinor: 0,
    unconverted: [{ currency: 'CHF', expenseMinor: 0, incomeMinor: 250 }],
    stale: false,
  })
})
