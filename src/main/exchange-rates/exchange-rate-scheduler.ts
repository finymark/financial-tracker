import type { ProfileApplication } from '../profiles/profile-application'
import type { ExchangeRateSource } from './exchange-rate-source'

const HOUR_MS = 60 * 60 * 1000

export interface ExchangeRateSchedulerTimers {
  setInterval(handler: () => void, delay: number): unknown
  clearInterval(id: unknown): void
}

interface ExchangeRateSchedulerOptions {
  timers?: ExchangeRateSchedulerTimers
  logger?: Pick<Console, 'error'>
  onStatusChanged?: () => void
}

interface ActiveProfileApplications {
  getActiveApplication(): ProfileApplication
}

const defaultTimers: ExchangeRateSchedulerTimers = {
  setInterval: (handler, delay) => setInterval(handler, delay),
  clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
}

export class ExchangeRateScheduler {
  readonly #profiles: ActiveProfileApplications
  readonly #source: ExchangeRateSource
  readonly #timers: ExchangeRateSchedulerTimers
  readonly #logger: Pick<Console, 'error'>
  readonly #onStatusChanged: () => void
  readonly #pending = new Map<ProfileApplication, Promise<void>>()
  #interval: unknown = null

  constructor(
    profiles: ActiveProfileApplications,
    source: ExchangeRateSource,
    options: ExchangeRateSchedulerOptions = {},
  ) {
    this.#profiles = profiles
    this.#source = source
    this.#timers = options.timers ?? defaultTimers
    this.#logger = options.logger ?? console
    this.#onStatusChanged = options.onStatusChanged ?? (() => {})
  }

  start(): void {
    if (this.#interval !== null) return
    this.#interval = this.#timers.setInterval(() => {
      void this.refreshActive()
    }, HOUR_MS)
  }

  stop(): void {
    if (this.#interval === null) return
    this.#timers.clearInterval(this.#interval)
    this.#interval = null
  }

  async refreshActive(): Promise<void> {
    let application: ProfileApplication
    try {
      application = this.#profiles.getActiveApplication()
    } catch {
      return
    }
    const existing = this.#pending.get(application)
    if (existing) return existing
    const refresh = (async () => {
      await application.commands.refreshExchangeRates(this.#source)
    })()
      .catch((error: unknown) => {
        this.#logger.error('Exchange-rate refresh failed', error)
      })
      .finally(() => {
        this.#pending.delete(application)
        this.#onStatusChanged()
      })
    this.#pending.set(application, refresh)
    return refresh
  }
}
