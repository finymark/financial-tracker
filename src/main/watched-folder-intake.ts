import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  watch,
} from 'node:fs'
import { join, parse } from 'node:path'
import type {
  WatchedFolderFailure,
  WatchedFolderStatus,
} from '../shared/settings'
import type { ReceiptIntake, ReceiptSource } from '../shared/receipts'

const RESCAN_INTERVAL_MS = 30_000
const STABLE_FOR_MS = 2_000
const PROCESSED_DIRECTORY = 'feldolgozott'
const IN_USE_CODES = new Set(['EBUSY', 'EPERM', 'EACCES'])
const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp)$/i
const TEMPORARY_NAME = /(?:^\.|^~\$|\.(?:tmp|partial|crdownload)(?:\.|$))/i

export type ReceiptIntakeHandler = (
  input: Extract<ReceiptIntake, { path: string }>,
  source: Extract<ReceiptSource, 'folder'>,
) => Promise<unknown>

interface WatchedFolderEntry {
  name: string
  isFile(): boolean
}

interface WatchedFolderStat {
  size: number
  mtimeMs: number
}

interface WatchedFolderWatch {
  close(): void
  onError?(listener: (error: unknown) => void): void
}

export interface WatchedFolderFileSystem {
  readDirectory(path: string): WatchedFolderEntry[]
  stat(path: string): WatchedFolderStat
  makeDirectory(path: string): void
  exists(path: string): boolean
  rename(from: string, to: string): void
  watch(path: string, listener: () => void): WatchedFolderWatch
}

export interface WatchedFolderTimers {
  setInterval(handler: () => void, delay: number): unknown
  clearInterval(id: unknown): void
  setTimeout(handler: () => void, delay: number): unknown
  clearTimeout(id: unknown): void
}

export interface WatchedFolderIntakeOptions {
  fileSystem?: Partial<WatchedFolderFileSystem>
  timers?: WatchedFolderTimers
  clock?: () => number
  onStatusChanged?: (status: WatchedFolderStatus) => void
  onFailure?: (failure: WatchedFolderFailure) => void
  logger?: Pick<Console, 'error'>
}

interface Observation {
  size: number
  mtimeMs: number
  unchangedSince: number
}

const defaultFileSystem: WatchedFolderFileSystem = {
  readDirectory: (path) => readdirSync(path, { withFileTypes: true }),
  stat: (path) => statSync(path),
  makeDirectory: (path) => mkdirSync(path, { recursive: true }),
  exists: (path) => existsSync(path),
  rename: (from, to) => renameSync(from, to),
  watch: (path, listener) => {
    const watcher = watch(path, { persistent: false }, listener)
    return {
      close: () => watcher.close(),
      onError: (onError) => watcher.on('error', onError),
    }
  },
}

const defaultTimers: WatchedFolderTimers = {
  setInterval: (handler, delay) => setInterval(handler, delay),
  clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
  setTimeout: (handler, delay) => setTimeout(handler, delay),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : undefined
}

function failureReason(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message
  if (typeof error === 'string' && error.length > 0) return error
  return 'receipts.error'
}

function isCandidate(name: string): boolean {
  return IMAGE_EXTENSION.test(name) && !TEMPORARY_NAME.test(name)
}

export class WatchedFolderIntake {
  readonly #intake: ReceiptIntakeHandler
  readonly #fileSystem: WatchedFolderFileSystem
  readonly #timers: WatchedFolderTimers
  readonly #clock: () => number
  readonly #onStatusChanged: (status: WatchedFolderStatus) => void
  readonly #onFailure: (failure: WatchedFolderFailure) => void
  readonly #logger: Pick<Console, 'error'>
  readonly #observations = new Map<string, Observation>()
  #folder: string | null = null
  #watch: WatchedFolderWatch | null = null
  #rescanInterval: unknown = null
  #stabilityTimeout: unknown = null
  #status: WatchedFolderStatus | null = null
  #generation = 0
  #scanRunning = false
  #scanAgain = false
  #scanPromise: Promise<void> | null = null

  constructor(
    intake: ReceiptIntakeHandler,
    options: WatchedFolderIntakeOptions = {},
  ) {
    this.#intake = intake
    this.#fileSystem = { ...defaultFileSystem, ...options.fileSystem }
    this.#timers = options.timers ?? defaultTimers
    this.#clock = options.clock ?? Date.now
    this.#onStatusChanged = options.onStatusChanged ?? (() => {})
    this.#onFailure = options.onFailure ?? (() => {})
    this.#logger = options.logger ?? console
  }

  async start(folder: string): Promise<void> {
    await this.stop()
    this.#folder = folder
    const generation = this.#generation
    this.#rescanInterval = this.#timers.setInterval(() => {
      void this.#runScan(generation)
    }, RESCAN_INTERVAL_MS)
    await this.#runScan(generation)
  }

  async stop(): Promise<void> {
    const pending = this.#scanPromise
    this.#generation += 1
    this.#folder = null
    this.#scanAgain = false
    this.#observations.clear()
    this.#closeWatch()
    if (this.#rescanInterval !== null) {
      this.#timers.clearInterval(this.#rescanInterval)
      this.#rescanInterval = null
    }
    this.#clearStabilityTimeout()
    this.#status = null
    await pending
  }

  #runScan(generation: number): Promise<void> {
    if (generation !== this.#generation || this.#folder === null)
      return Promise.resolve()
    if (this.#scanRunning) {
      this.#scanAgain = true
      return this.#scanPromise ?? Promise.resolve()
    }
    this.#scanRunning = true
    const pending = (async () => {
      do {
        this.#scanAgain = false
        await this.#scan(generation)
      } while (
        this.#scanAgain &&
        generation === this.#generation &&
        this.#folder !== null
      )
    })().finally(() => {
      this.#scanRunning = false
      this.#scanPromise = null
    })
    this.#scanPromise = pending
    return pending
  }

  async #scan(generation: number): Promise<void> {
    const folder = this.#folder
    if (folder === null || generation !== this.#generation) return
    let entries: WatchedFolderEntry[]
    try {
      entries = this.#fileSystem.readDirectory(folder)
      if (!this.#ensureWatch(folder, generation)) return
      this.#setStatus('watching')
    } catch {
      this.#markUnavailable()
      return
    }

    const now = this.#clock()
    const seen = new Set<string>()
    const ready: string[] = []
    for (const entry of entries) {
      if (!entry.isFile() || !isCandidate(entry.name)) continue
      const path = join(folder, entry.name)
      seen.add(path)
      let stat: WatchedFolderStat
      try {
        stat = this.#fileSystem.stat(path)
      } catch {
        continue
      }
      const previous = this.#observations.get(path)
      if (
        !previous ||
        previous.size !== stat.size ||
        previous.mtimeMs !== stat.mtimeMs
      ) {
        this.#observations.set(path, {
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          unchangedSince: now,
        })
      } else if (now - previous.unchangedSince >= STABLE_FOR_MS) {
        ready.push(path)
      }
    }
    for (const path of this.#observations.keys()) {
      if (!seen.has(path)) this.#observations.delete(path)
    }
    this.#scheduleStabilityScan(now, generation)

    ready.sort((left, right) => left.localeCompare(right))
    for (const source of ready) {
      if (generation !== this.#generation || this.#folder !== folder) return
      const moved = this.#moveToProcessed(folder, source)
      if (!moved) continue
      this.#observations.delete(source)
      try {
        await this.#intake({ path: moved }, 'folder')
      } catch (error) {
        this.#onFailure({
          fileName: parse(moved).base,
          reasonKey: failureReason(error),
        })
      }
    }
  }

  #ensureWatch(folder: string, generation: number): boolean {
    if (this.#watch) return true
    try {
      const folderWatch = this.#fileSystem.watch(folder, () => {
        void this.#runScan(generation)
      })
      folderWatch.onError?.(() => {
        if (generation !== this.#generation) return
        this.#markUnavailable()
      })
      this.#watch = folderWatch
      return true
    } catch {
      this.#markUnavailable()
      return false
    }
  }

  #moveToProcessed(folder: string, source: string): string | null {
    try {
      const processed = join(folder, PROCESSED_DIRECTORY)
      this.#fileSystem.makeDirectory(processed)
      const sourceName = parse(source)
      let suffix = 1
      while (true) {
        const name =
          suffix === 1
            ? sourceName.base
            : `${sourceName.name} (${suffix})${sourceName.ext}`
        const destination = join(processed, name)
        if (this.#fileSystem.exists(destination)) {
          suffix += 1
          continue
        }
        try {
          this.#fileSystem.rename(source, destination)
          return destination
        } catch (error) {
          if (errorCode(error) === 'EEXIST') {
            suffix += 1
            continue
          }
          throw error
        }
      }
    } catch (error) {
      if (!IN_USE_CODES.has(errorCode(error) ?? '')) {
        this.#logger.error('Watched-folder move failed', error)
      }
      return null
    }
  }

  #scheduleStabilityScan(now: number, generation: number): void {
    this.#clearStabilityTimeout()
    let delay: number | null = null
    for (const observation of this.#observations.values()) {
      const remaining = Math.max(
        0,
        STABLE_FOR_MS - (now - observation.unchangedSince),
      )
      if (remaining > 0 && (delay === null || remaining < delay)) {
        delay = remaining
      }
    }
    if (delay === null) return
    this.#stabilityTimeout = this.#timers.setTimeout(() => {
      this.#stabilityTimeout = null
      void this.#runScan(generation)
    }, delay)
  }

  #clearStabilityTimeout(): void {
    if (this.#stabilityTimeout === null) return
    this.#timers.clearTimeout(this.#stabilityTimeout)
    this.#stabilityTimeout = null
  }

  #markUnavailable(): void {
    this.#closeWatch()
    this.#observations.clear()
    this.#clearStabilityTimeout()
    this.#setStatus('unavailable')
  }

  #closeWatch(): void {
    if (!this.#watch) return
    this.#watch.close()
    this.#watch = null
  }

  #setStatus(status: WatchedFolderStatus): void {
    if (this.#status === status) return
    this.#status = status
    this.#onStatusChanged(status)
  }
}
