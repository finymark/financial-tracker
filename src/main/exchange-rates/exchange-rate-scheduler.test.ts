import { expect, test, vi } from 'vitest'
import type { ProfileApplication } from '../profiles/profile-application'
import type { ExchangeRateSource } from './exchange-rate-source'
import { ExchangeRateScheduler } from './exchange-rate-scheduler'

const source: ExchangeRateSource = { fetchRates: async () => [] }

test('refreshes on request and every 24 hours with injectable timers', async () => {
  const refreshExchangeRates = vi.fn(async () => {})
  const application = {
    commands: { refreshExchangeRates },
  } as unknown as ProfileApplication
  let interval: (() => void) | undefined
  const onStatusChanged = vi.fn()
  const scheduler = new ExchangeRateScheduler(
    { getActiveApplication: () => application },
    source,
    {
      timers: {
        setInterval(handler, delay) {
          expect(delay).toBe(24 * 60 * 60 * 1000)
          interval = handler
          return 1
        },
        clearInterval: vi.fn(),
      },
      onStatusChanged,
    },
  )

  scheduler.start()
  await scheduler.refreshActive()
  expect(refreshExchangeRates).toHaveBeenCalledWith(source)
  expect(onStatusChanged).toHaveBeenCalledTimes(1)
  interval!()
  await vi.waitFor(() => expect(refreshExchangeRates).toHaveBeenCalledTimes(2))
  scheduler.stop()
})

test('logs refresh failures without rejecting or blocking later refreshes', async () => {
  const error = new Error('offline')
  const refreshExchangeRates = vi
    .fn<ProfileApplication['commands']['refreshExchangeRates']>()
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce()
  const logger = { error: vi.fn() }
  const scheduler = new ExchangeRateScheduler(
    {
      getActiveApplication: () =>
        ({
          commands: { refreshExchangeRates },
        }) as unknown as ProfileApplication,
    },
    source,
    { logger },
  )

  await expect(scheduler.refreshActive()).resolves.toBeUndefined()
  expect(logger.error).toHaveBeenCalledWith(
    'Exchange-rate refresh failed',
    error,
  )
  await expect(scheduler.refreshActive()).resolves.toBeUndefined()
  expect(refreshExchangeRates).toHaveBeenCalledTimes(2)
})
