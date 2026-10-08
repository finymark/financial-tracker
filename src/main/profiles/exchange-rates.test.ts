import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import type {
  ExchangeRate,
  ExchangeRateSource,
} from '../exchange-rates/exchange-rate-source'
import { ExchangeRateScheduler } from '../exchange-rates/exchange-rate-scheduler'
import {
  openProfileApplication,
  type ProfileApplication,
} from './profile-application'
import { ProfileRegistry } from './profile-registry'

const directories: string[] = []
const applications: ProfileApplication[] = []
let now = new Date('2026-08-25T10:00:00.000Z')
const clock = () => now

async function setup(
  baseCurrency: 'HUF' | 'CHF' = 'HUF',
  exchangeRateSource?: ExchangeRateSource,
  logger?: Pick<Console, 'error'>,
) {
  const directory = mkdtempSync(join(tmpdir(), 'financial-tracker-rates-'))
  directories.push(directory)
  const registry = new ProfileRegistry({ userDataDirectory: directory, clock })
  const profile = registry.createProfile('Rate test')
  const application = await openProfileApplication({
    profile,
    paths: registry.getProfilePaths(profile.id),
    clock,
    exchangeRateSource,
    logger,
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
      startDate: '2026-07-31',
      endDate: '2026-08-25',
      currencies: ['CHF'],
    },
  ])
  expect(application.queries.getRateStatus()).toEqual({
    coverage: { startDate: '2026-07-31', endDate: '2026-08-25' },
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

test('keeps today open until its rate is published and advances it on the next day', async () => {
  const application = await setup()
  application.commands.createAccount({
    name: 'CHF cash',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-08-24',
  })
  let publishedToday = false
  const calls: Parameters<ExchangeRateSource['fetchRates']>[0][] = []
  const fake: ExchangeRateSource = {
    async fetchRates(input) {
      calls.push(input)
      return [
        {
          date: '2026-08-24',
          currency: 'CHF' as const,
          rate: '400',
          unit: 1,
        },
        ...(publishedToday
          ? [
              {
                date: '2026-08-25',
                currency: 'CHF' as const,
                rate: '401',
                unit: 1,
              },
            ]
          : []),
      ].filter(
        (rate) => rate.date >= input.startDate && rate.date <= input.endDate,
      )
    },
  }

  await application.commands.refreshExchangeRates(fake)
  expect(application.queries.getRateStatus()).toMatchObject({
    coverage: { startDate: '2026-08-10', endDate: '2026-08-24' },
    stale: false,
  })

  publishedToday = true
  await application.commands.refreshExchangeRates(fake)
  expect(calls.at(-1)).toMatchObject({
    startDate: '2026-08-25',
    endDate: '2026-08-25',
  })
  expect(application.queries.getRateStatus().coverage?.endDate).toBe(
    '2026-08-25',
  )
  const requestCount = calls.length
  await application.commands.refreshExchangeRates(fake)
  expect(calls).toHaveLength(requestCount)

  now = new Date('2026-08-26T10:00:00.000Z')
  await application.commands.refreshExchangeRates(fake)
  expect(calls.at(-1)).toMatchObject({
    startDate: '2026-08-26',
    endDate: '2026-08-26',
  })
  expect(application.queries.getRateStatus().coverage?.endDate).toBe(
    '2026-08-25',
  )
})

test('extends a backwards fetch so a Saturday opening date can use Friday rate', async () => {
  const application = await setup()
  application.commands.createAccount({
    name: 'Weekend CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-08-22',
  })
  const fake = source([
    { date: '2026-08-21', currency: 'CHF', rate: '400', unit: 1 },
  ])

  await application.commands.refreshExchangeRates(fake.value)

  expect(fake.calls[0]).toEqual({
    startDate: '2026-08-08',
    endDate: '2026-08-25',
    currencies: ['CHF'],
  })
  expect(
    application.queries.convertToBaseCurrency([
      { date: '2026-08-22', currency: 'CHF', amountMinor: 100 },
    ]),
  ).toMatchObject({ roundedMinor: 40_000, unconverted: [], stale: false })
})

test('coalesces non-blocking refreshes after account, transaction, and transfer writes extend rate needs', async () => {
  const calls: Parameters<ExchangeRateSource['fetchRates']>[0][] = []
  let resolveFirst!: (
    value: Awaited<ReturnType<ExchangeRateSource['fetchRates']>>,
  ) => void
  let first = true
  const fake: ExchangeRateSource = {
    fetchRates(input) {
      calls.push(input)
      if (first) {
        first = false
        return new Promise((resolve) => {
          resolveFirst = resolve
        })
      }
      return Promise.resolve([
        { date: input.startDate, currency: 'CHF', rate: '400', unit: 1 },
      ])
    },
  }
  const application = await setup('HUF', fake)
  const foreign = application.commands.createAccount({
    name: 'Initially HUF',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-08-01',
  })
  expect(calls).toHaveLength(0)

  application.commands.changeAccountCurrency({
    id: foreign.id,
    currency: 'CHF',
  })
  expect(calls).toHaveLength(1)
  application.commands.createTransaction({
    accountId: foreign.id,
    kind: 'expense',
    date: '2026-07-01',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  expect(calls).toHaveLength(1)
  resolveFirst([{ date: '2026-08-01', currency: 'CHF', rate: '400', unit: 1 }])
  await vi.waitFor(() => expect(calls).toHaveLength(3))
  await vi.waitFor(() =>
    expect(application.queries.getRateStatus().coverage?.startDate).toBe(
      '2026-06-17',
    ),
  )

  application.commands.createTransaction({
    accountId: foreign.id,
    kind: 'expense',
    date: '2026-06-01',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  await vi.waitFor(() => expect(calls).toHaveLength(4))
  await vi.waitFor(() =>
    expect(application.queries.getRateStatus().coverage?.startDate).toBe(
      '2026-05-18',
    ),
  )

  const huf = application.commands.createAccount({
    name: 'HUF',
    currency: 'HUF',
    openingBalance: 0,
    openingDate: '2026-01-01',
  })
  application.commands.createTransfer({
    fromAccountId: foreign.id,
    fromAmountMinor: 100,
    toAccountId: huf.id,
    toAmountMinor: 40_000,
    date: '2026-05-01',
    note: '',
    fee: { amountMinor: 10, categoryId: null, excluded: false },
  })
  await vi.waitFor(() => expect(calls).toHaveLength(5))
  expect(calls[4].startDate).toBe('2026-04-17')
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
      { date: '2026-08-20', currency: 'CHF', amountMinor: 100 },
    ]),
  ).toMatchObject({ roundedMinor: 40_000, stale: false, unconverted: [] })
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

function controlledSource() {
  const calls: Parameters<ExchangeRateSource['fetchRates']>[0][] = []
  const pending: {
    resolve(rates: ExchangeRate[]): void
    reject(error: Error): void
  }[] = []
  const value: ExchangeRateSource = {
    fetchRates(input) {
      calls.push(input)
      return new Promise((resolve, reject) => pending.push({ resolve, reject }))
    },
  }
  return { value, calls, pending }
}

test('drains a backdated write queued during a scheduler-started refresh', async () => {
  const fake = controlledSource()
  const application = await setup('HUF', fake.value)
  const account = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-08-24',
  })
  fake.pending.shift()!.resolve([
    { date: '2026-08-24', currency: 'CHF', rate: '400', unit: 1 },
    { date: '2026-08-25', currency: 'CHF', rate: '400', unit: 1 },
  ])
  await vi.waitFor(() =>
    expect(application.queries.getRateStatus().coverage?.endDate).toBe(
      '2026-08-25',
    ),
  )
  now = new Date('2026-08-26T10:00:00.000Z')
  const scheduler = new ExchangeRateScheduler(
    { getActiveApplication: () => application },
    fake.value,
  )
  const refresh = scheduler.refreshActive()
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-07-01',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  expect(fake.calls).toHaveLength(2)
  fake.pending
    .shift()!
    .resolve([{ date: '2026-08-26', currency: 'CHF', rate: '400', unit: 1 }])
  await refresh
  await vi.waitFor(() => expect(fake.calls).toHaveLength(3))
  expect(fake.calls[2]).toEqual({
    startDate: '2026-06-17',
    endDate: '2026-08-09',
    currencies: ['CHF'],
  })
  fake.pending
    .shift()!
    .resolve([{ date: '2026-06-30', currency: 'CHF', rate: '400', unit: 1 }])
  await vi.waitFor(() =>
    expect(application.queries.getRateStatus().missing).toBe(false),
  )
  expect(application.queries.listTransactions().baseTotals).toMatchObject({
    expenseMinor: 40_000,
    unconverted: [],
  })
  expect(application.commands.undoLast()).toBe(true)
  expect(application.queries.listTransactions().rows).toEqual([])
})

test.each(['close', 'restore'] as const)(
  'does not reject in the background when a queued refresh settles during %s',
  async (lifecycle) => {
    const fake = controlledSource()
    const logger = { error: vi.fn() }
    const application = await setup('HUF', fake.value, logger)
    const account = application.commands.createAccount({
      name: 'CHF',
      currency: 'CHF',
      openingBalance: 0,
      openingDate: '2026-08-24',
    })
    application.commands.createTransaction({
      accountId: account.id,
      kind: 'expense',
      date: '2026-07-01',
      totalMinor: 100,
      payeeName: null,
      categoryId: null,
      note: '',
    })
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      let restoring: Promise<void> | undefined
      if (lifecycle === 'close') application.close()
      else
        restoring = application.commands.restoreBackup({
          backupId: application.queries.listBackups()[0].id,
          confirmed: true,
        })
      fake.pending
        .shift()!
        .resolve([
          { date: '2026-08-25', currency: 'CHF', rate: '400', unit: 1 },
        ])
      await vi.waitFor(() =>
        expect(logger.error).toHaveBeenCalledWith(
          'Exchange-rate refresh failed',
          expect.objectContaining({
            message:
              lifecycle === 'close'
                ? 'Profile is closed'
                : 'Profile restore is in progress',
          }),
        ),
      )
      await restoring
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(unhandled).not.toHaveBeenCalled()
      expect(fake.calls).toHaveLength(1)
      if (lifecycle === 'restore')
        expect(application.queries.listAccounts()).toEqual([])
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  },
)

test('scheduler logs a closed profile refresh without rejecting', async () => {
  const application = await setup()
  application.close()
  const logger = { error: vi.fn() }
  const scheduler = new ExchangeRateScheduler(
    { getActiveApplication: () => application },
    source([]).value,
    { logger },
  )
  await expect(scheduler.refreshActive()).resolves.toBeUndefined()
  expect(logger.error).toHaveBeenCalledWith(
    'Exchange-rate refresh failed',
    expect.objectContaining({ message: 'Profile is closed' }),
  )
})

test('a write refreshes coverage that ends before yesterday', async () => {
  const fake = controlledSource()
  const application = await setup('HUF', fake.value)
  const account = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-08-24',
  })
  fake.pending.shift()!.resolve([
    { date: '2026-08-24', currency: 'CHF', rate: '400', unit: 1 },
    { date: '2026-08-25', currency: 'CHF', rate: '400', unit: 1 },
  ])
  await vi.waitFor(() =>
    expect(application.queries.getRateStatus().coverage?.endDate).toBe(
      '2026-08-25',
    ),
  )
  now = new Date('2026-08-27T10:00:00.000Z')
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-08-27',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  expect(fake.calls.at(-1)).toMatchObject({
    startDate: '2026-08-26',
    endDate: '2026-08-27',
  })
  fake.pending
    .shift()!
    .resolve([{ date: '2026-08-27', currency: 'CHF', rate: '401', unit: 1 }])
  await vi.waitFor(() =>
    expect(application.queries.getRateStatus().stale).toBe(false),
  )
  expect(application.queries.listTransactions().baseTotals).toMatchObject({
    expenseMinor: 40_100,
    stale: false,
  })
})

test('a write inside coverage repairs a left-edge gap with a previous published rate', async () => {
  const fake = controlledSource()
  const application = await setup('HUF', fake.value)
  const account = application.commands.createAccount({
    name: 'CHF',
    currency: 'CHF',
    openingBalance: 0,
    openingDate: '2026-08-24',
  })
  fake.pending.shift()!.resolve([
    { date: '2026-08-24', currency: 'CHF', rate: '400', unit: 1 },
    { date: '2026-08-25', currency: 'CHF', rate: '400', unit: 1 },
  ])
  await vi.waitFor(() =>
    expect(application.queries.getRateStatus().coverage?.endDate).toBe(
      '2026-08-25',
    ),
  )
  application.commands.createTransaction({
    accountId: account.id,
    kind: 'expense',
    date: '2026-08-15',
    totalMinor: 100,
    payeeName: null,
    categoryId: null,
    note: '',
  })
  expect(fake.calls.at(-1)).toMatchObject({
    startDate: '2026-08-01',
    endDate: '2026-08-15',
  })
  expect(application.queries.getRateStatus().missing).toBe(true)
  fake.pending
    .shift()!
    .resolve([{ date: '2026-08-14', currency: 'CHF', rate: '400', unit: 1 }])
  await vi.waitFor(() =>
    expect(application.queries.getRateStatus().missing).toBe(false),
  )
  expect(application.queries.listTransactions().baseTotals).toMatchObject({
    expenseMinor: 40_000,
    unconverted: [],
  })
})

test.each(['transaction', 'account'] as const)(
  'undo refreshes an older CHF %s restored into a left-edge gap',
  async (aggregate) => {
    const fake = controlledSource()
    const logger = { error: vi.fn() }
    const application = await setup('HUF', fake.value, logger)
    const account = application.commands.createAccount({
      name: 'CHF',
      currency: 'CHF',
      openingBalance: 0,
      openingDate: '2026-08-24',
    })
    fake.pending.shift()!.resolve([
      { date: '2026-08-24', currency: 'CHF', rate: '400', unit: 1 },
      { date: '2026-08-25', currency: 'CHF', rate: '400', unit: 1 },
    ])
    await vi.waitFor(() =>
      expect(application.queries.getRateStatus().coverage?.endDate).toBe(
        '2026-08-25',
      ),
    )
    const older =
      aggregate === 'transaction'
        ? application.commands.createTransaction({
            accountId: account.id,
            kind: 'expense',
            date: '2026-08-15',
            totalMinor: 100,
            payeeName: null,
            categoryId: null,
            note: '',
          })
        : application.commands.createAccount({
            name: 'Older CHF',
            currency: 'CHF',
            openingBalance: 100,
            openingDate: '2026-08-15',
          })
    fake.pending.shift()!.reject(new Error('offline'))
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledTimes(1))
    if (aggregate === 'transaction')
      application.commands.deleteTransaction(older.id)
    else application.commands.deleteAccount(older.id)
    expect(application.queries.getRateStatus().missing).toBe(false)
    expect(application.commands.undoLast()).toBe(true)
    expect(fake.calls).toHaveLength(3)
    fake.pending
      .shift()!
      .resolve([{ date: '2026-08-14', currency: 'CHF', rate: '400', unit: 1 }])
    await vi.waitFor(() =>
      expect(application.queries.getRateStatus().missing).toBe(false),
    )
    expect(
      application.queries.convertToBaseCurrency([
        { date: '2026-08-15', currency: 'CHF', amountMinor: 100 },
      ]),
    ).toMatchObject({ roundedMinor: 40_000, unconverted: [] })
    expect(application.commands.undoLast()).toBe(true)
    if (aggregate === 'transaction')
      expect(application.queries.listTransactions().rows).toEqual([])
    else expect(application.queries.listAccounts()).toHaveLength(1)
  },
)
