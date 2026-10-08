import { expect, test, vi } from 'vitest'
import type { ProfileApplication } from './profiles/profile-application'
import { RecurringScheduler } from './recurring-scheduler'

test('recurring generation follows the shared hourly scheduler lifecycle', () => {
  const generate = vi.fn()
  let handler: (() => void) | undefined
  const clearInterval = vi.fn()
  const application = {
    commands: { generateRecurringTransactions: generate },
  } as unknown as ProfileApplication
  const scheduler = new RecurringScheduler(
    { getActiveApplication: () => application },
    {
      timers: {
        setInterval(next, delay) {
          handler = next
          expect(delay).toBe(60 * 60 * 1000)
          return 'hourly'
        },
        clearInterval,
      },
    },
  )
  scheduler.start()
  scheduler.start()
  handler?.()
  expect(generate).toHaveBeenCalledOnce()
  scheduler.stop()
  expect(clearInterval).toHaveBeenCalledWith('hourly')
})
