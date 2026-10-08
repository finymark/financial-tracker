import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import Tesseract from 'tesseract.js'
import type { OcrEngine, OcrLanguage, OcrResult } from './ocr-engine'

export interface TesseractResources {
  corePath: string
  langPath: string
  workerPath: string
}

export interface TesseractWorkerLike {
  recognize(image: Buffer): Promise<{
    data: { text: string; confidence: number }
  }>
  reinitialize(languages: string): Promise<unknown>
  terminate(): Promise<unknown>
}

interface LocalWorkerOptions extends TesseractResources {
  cacheMethod: 'none'
  gzip: true
}

export type TesseractWorkerFactory = (
  languages: OcrLanguage[],
  options: LocalWorkerOptions,
) => Promise<TesseractWorkerLike>

export interface TesseractOcrEngineOptions {
  createWorker?: TesseractWorkerFactory
  idleTimeoutMs?: number
  resources?: TesseractResources
}

const DEFAULT_IDLE_TIMEOUT_MS = 60_000
const require = createRequire(import.meta.url)

function unpackedPath(path: string): string {
  return path.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`)
}

function developmentModelDirectory(): string {
  return join(
    dirname(require.resolve('tesseract.js/package.json')),
    '..',
    'financial-tracker-ocr-models',
  )
}

export function resolveTesseractResources(): TesseractResources {
  const packagedModels = join(process.resourcesPath, 'ocr-models')
  const langPath = existsSync(join(packagedModels, 'eng.traineddata.gz'))
    ? packagedModels
    : developmentModelDirectory()
  return {
    corePath: unpackedPath(
      dirname(require.resolve('tesseract.js-core/package.json')),
    ),
    langPath,
    workerPath: unpackedPath(
      require.resolve('tesseract.js/src/worker-script/node/index.js'),
    ),
  }
}

const createLocalWorker: TesseractWorkerFactory = async (languages, options) =>
  (await Tesseract.createWorker(
    languages,
    Tesseract.OEM.LSTM_ONLY,
    options,
  )) as TesseractWorkerLike

export class TesseractOcrEngine implements OcrEngine {
  readonly #createWorker: TesseractWorkerFactory
  readonly #idleTimeoutMs: number
  readonly #resources: TesseractResources
  #worker: TesseractWorkerLike | null = null
  #activeLanguages = ''
  #tail: Promise<void> = Promise.resolve()
  #idleTimer: NodeJS.Timeout | undefined
  #pendingJobs = 0
  #disposed = false

  constructor(options: TesseractOcrEngineOptions = {}) {
    this.#createWorker = options.createWorker ?? createLocalWorker
    this.#idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
    this.#resources = options.resources ?? resolveTesseractResources()
  }

  recognize(image: Buffer, languages: OcrLanguage[]): Promise<OcrResult> {
    if (this.#disposed)
      return Promise.reject(new Error('OCR engine is disposed'))
    this.#clearIdleTimer()
    this.#pendingJobs += 1
    return this.#enqueue(async () => {
      const worker = await this.#workerFor(languages)
      const result = await worker.recognize(image)
      return { text: result.data.text, confidence: result.data.confidence }
    }).finally(() => {
      this.#pendingJobs -= 1
      if (!this.#disposed && this.#pendingJobs === 0) this.#scheduleIdleTimer()
    })
  }

  dispose(): Promise<void> {
    if (this.#disposed) return this.#tail
    this.#disposed = true
    this.#clearIdleTimer()
    return this.#enqueue(async () => this.#terminateWorker())
  }

  #enqueue<Result>(task: () => Promise<Result>): Promise<Result> {
    const result = this.#tail.then(task, task)
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  async #workerFor(languages: OcrLanguage[]): Promise<TesseractWorkerLike> {
    const languageKey = languages.join('+')
    if (!this.#worker) {
      this.#worker = await this.#createWorker(languages, {
        ...this.#resources,
        cacheMethod: 'none',
        gzip: true,
      })
      this.#activeLanguages = languageKey
    } else if (this.#activeLanguages !== languageKey) {
      try {
        await this.#worker.reinitialize(languageKey)
        this.#activeLanguages = languageKey
      } catch (error) {
        await this.#terminateWorker()
        throw error
      }
    }
    return this.#worker
  }

  async #terminateWorker(): Promise<void> {
    const worker = this.#worker
    this.#worker = null
    this.#activeLanguages = ''
    if (worker) await worker.terminate()
  }

  #clearIdleTimer(): void {
    if (this.#idleTimer) clearTimeout(this.#idleTimer)
    this.#idleTimer = undefined
  }

  #scheduleIdleTimer(): void {
    this.#clearIdleTimer()
    this.#idleTimer = setTimeout(() => {
      this.#idleTimer = undefined
      void this.#enqueue(async () => this.#terminateWorker()).catch((error) => {
        console.warn('Could not terminate idle OCR worker.', error)
      })
    }, this.#idleTimeoutMs)
    this.#idleTimer.unref()
  }
}
