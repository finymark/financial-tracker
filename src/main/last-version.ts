import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export class LastVersionFile {
  readonly #directory: string
  readonly #path: string
  readonly #readFile: (path: string) => string
  readonly #writeFile: (path: string, contents: string) => void

  constructor(
    userDataDirectory: string,
    options: {
      readFile?: (path: string) => string
      writeFile?: (path: string, contents: string) => void
    } = {},
  ) {
    this.#directory = userDataDirectory
    this.#path = join(userDataDirectory, 'last-version.json')
    this.#readFile = options.readFile ?? ((path) => readFileSync(path, 'utf8'))
    this.#writeFile =
      options.writeFile ??
      ((path, contents) => writeFileSync(path, contents, 'utf8'))
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

    try {
      mkdirSync(this.#directory, { recursive: true })
      this.#writeFile(
        this.#path,
        `${JSON.stringify({ version: currentVersion }, null, 2)}\n`,
      )
    } catch {
      // Optional update confirmation state must never block application startup.
      return null
    }

    return previousVersion !== null && previousVersion !== currentVersion
      ? currentVersion
      : null
  }
}
