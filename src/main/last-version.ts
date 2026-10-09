import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

export class LastVersionFile {
  readonly #directory: string
  readonly #path: string
  readonly #readFile: (path: string) => string
  readonly #writeFile: (path: string, contents: string) => void
  readonly #rename: typeof renameSync
  readonly #wait: (milliseconds: number) => void

  constructor(
    userDataDirectory: string,
    options: {
      readFile?: (path: string) => string
      writeFile?: (path: string, contents: string) => void
      rename?: typeof renameSync
      wait?: (milliseconds: number) => void
    } = {},
  ) {
    this.#directory = userDataDirectory
    this.#path = join(userDataDirectory, 'last-version.json')
    this.#readFile = options.readFile ?? ((path) => readFileSync(path, 'utf8'))
    this.#writeFile =
      options.writeFile ??
      ((path, contents) => writeFileSync(path, contents, 'utf8'))
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

  recordCurrentVersion(currentVersion: string): string | null {
    let previousVersion: string | null = null
    try {
      const data: unknown = JSON.parse(this.#readFile(this.#path))
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const version = (data as Record<string, unknown>).version
        if (typeof version === 'string') previousVersion = version
      }
    } catch {
      // Missing, unreadable and corrupt files all behave like a fresh install.
    }

    const temporaryPath = `${this.#path}.tmp`
    try {
      mkdirSync(this.#directory, { recursive: true })
      this.#writeFile(
        temporaryPath,
        `${JSON.stringify({ version: currentVersion }, null, 2)}\n`,
      )
      const delays = [10, 20, 40, 80, 160]
      for (let attempt = 0; ; attempt += 1) {
        try {
          this.#rename(temporaryPath, this.#path)
          break
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
    } catch {
      // Optional update confirmation state must never block application startup.
      return null
    } finally {
      try {
        rmSync(temporaryPath, { force: true })
      } catch {
        // Temporary files are never read; startup still degrades safely.
      }
    }

    return previousVersion !== null && previousVersion !== currentVersion
      ? currentVersion
      : null
  }
}
