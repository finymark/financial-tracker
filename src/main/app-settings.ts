import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_QUICK_ADD_ACCELERATOR,
  normaliseAccelerator,
} from '../shared/accelerator'
import { parseWindowState, type WindowState } from './window-state'

interface AppSettings {
  version: 1
  trayNoticeShown: boolean
  quickAddAccelerator: string
  windowState?: WindowState
}

function parseSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid app settings')
  }
  const input = value as Record<string, unknown>
  if (
    input.version !== 1 ||
    typeof input.trayNoticeShown !== 'boolean' ||
    (input.quickAddAccelerator !== undefined &&
      typeof input.quickAddAccelerator !== 'string') ||
    Object.keys(input).some(
      (key) =>
        key !== 'version' &&
        key !== 'trayNoticeShown' &&
        key !== 'quickAddAccelerator' &&
        key !== 'windowState',
    )
  ) {
    throw new Error('Unsupported or invalid app settings')
  }
  return {
    version: 1,
    trayNoticeShown: input.trayNoticeShown,
    // A malformed window rectangle must not prevent the application from starting.
    windowState: parseWindowState(input.windowState),
    quickAddAccelerator:
      input.quickAddAccelerator === undefined
        ? DEFAULT_QUICK_ADD_ACCELERATOR
        : normaliseAccelerator(input.quickAddAccelerator),
  }
}

// Autostart is read from Windows, avoiding a second, potentially stale preference.
export class AppSettingsFile {
  readonly #path: string
  readonly #rename: typeof renameSync
  readonly #wait: (milliseconds: number) => void

  constructor(
    userDataDirectory: string,
    options: {
      rename?: typeof renameSync
      wait?: (milliseconds: number) => void
    } = {},
  ) {
    mkdirSync(userDataDirectory, { recursive: true })
    this.#path = join(userDataDirectory, 'app-settings.json')
    this.#rename = options.rename ?? renameSync
    this.#wait =
      options.wait ??
      ((milliseconds) => {
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          milliseconds,
        )
      })
    if (!existsSync(this.#path))
      this.#write({
        version: 1,
        trayNoticeShown: false,
        quickAddAccelerator: DEFAULT_QUICK_ADD_ACCELERATOR,
      })
    this.#read()
  }

  isTrayNoticeShown(): boolean {
    return this.#read().trayNoticeShown
  }

  markTrayNoticeShown(): void {
    this.#write({ ...this.#read(), trayNoticeShown: true })
  }

  getQuickAddAccelerator(): string {
    return this.#read().quickAddAccelerator
  }

  setQuickAddAccelerator(accelerator: string): void {
    this.#write({
      ...this.#read(),
      quickAddAccelerator: normaliseAccelerator(accelerator),
    })
  }

  getWindowState(): WindowState | undefined {
    return this.#read().windowState
  }

  setWindowState(state: WindowState): void {
    const parsed = parseWindowState(state)
    if (!parsed) throw new Error('Invalid window state')
    this.#write({ ...this.#read(), windowState: parsed })
  }

  #read(): AppSettings {
    return parseSettings(JSON.parse(readFileSync(this.#path, 'utf8')))
  }

  #write(settings: AppSettings): void {
    const temporaryPath = `${this.#path}.tmp`
    try {
      writeFileSync(
        temporaryPath,
        `${JSON.stringify(parseSettings(settings), null, 2)}\n`,
        'utf8',
      )
      const delays = [10, 20, 40, 80, 160]
      for (let attempt = 0; ; attempt += 1) {
        try {
          this.#rename(temporaryPath, this.#path)
          return
        } catch (error) {
          const code = (error as NodeJS.ErrnoException | null)?.code
          const delay = delays[attempt]
          if (
            delay === undefined ||
            !['EPERM', 'EACCES', 'EBUSY'].includes(code ?? '')
          )
            throw error
          this.#wait(delay)
        }
      }
    } finally {
      try {
        rmSync(temporaryPath, { force: true })
      } catch {
        // Preserve the write error; startup never consumes temporary files.
      }
    }
  }
}
