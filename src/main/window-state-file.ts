import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { parseWindowState, type WindowState } from './window-state'

export class WindowStateFile {
  readonly #directory: string
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
    this.#directory = userDataDirectory
    this.#path = join(userDataDirectory, 'window-state.json')
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
  }

  getWindowState(): WindowState | undefined {
    try {
      return parseWindowState(JSON.parse(readFileSync(this.#path, 'utf8')))
    } catch {
      // Optional presentation state must never block application startup.
      return undefined
    }
  }

  setWindowState(state: WindowState): void {
    const parsed = parseWindowState(state)
    if (!parsed) throw new Error('Invalid window state')
    const temporaryPath = `${this.#path}.tmp`
    try {
      mkdirSync(this.#directory, { recursive: true })
      writeFileSync(
        temporaryPath,
        `${JSON.stringify(parsed, null, 2)}\n`,
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
        // Preserve the write error; temporary files are never read on startup.
      }
    }
  }
}
