import type { ProfileApplication } from './profiles/profile-application'

const HOUR_MS = 60 * 60 * 1000

export interface RecurringSchedulerTimers {
  setInterval(handler: () => void, delay: number): unknown
  clearInterval(id: unknown): void
}

interface ActiveProfileApplications {
  getActiveApplication(): ProfileApplication
}

const defaultTimers: RecurringSchedulerTimers = {
  setInterval: (handler, delay) => setInterval(handler, delay),
  clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
}

export class RecurringScheduler {
  readonly #profiles: ActiveProfileApplications
  readonly #timers: RecurringSchedulerTimers
  readonly #logger: Pick<Console, 'error'>
  #interval: unknown = null

  constructor(
    profiles: ActiveProfileApplications,
    options: {
      timers?: RecurringSchedulerTimers
      logger?: Pick<Console, 'error'>
    } = {},
  ) {
    this.#profiles = profiles
    this.#timers = options.timers ?? defaultTimers
    this.#logger = options.logger ?? console
  }

  start(): void {
    if (this.#interval !== null) return
    this.#interval = this.#timers.setInterval(
      () => this.generateActive(),
      HOUR_MS,
    )
  }

  stop(): void {
    if (this.#interval === null) return
    this.#timers.clearInterval(this.#interval)
    this.#interval = null
  }

  generateActive(): void {
    try {
      this.#profiles
        .getActiveApplication()
        .commands.generateRecurringTransactions()
    } catch (error) {
      // No open profile is a normal idle state; genuine write errors are logged.
      if (
        error instanceof Error &&
        ['No profile is open', 'A profile operation is in progress'].includes(
          error.message,
        )
      )
        return
      this.#logger.error('Recurring transaction generation failed', error)
    }
  }
}
