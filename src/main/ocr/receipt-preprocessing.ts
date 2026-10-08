import { existsSync } from 'node:fs'
import { join, sep } from 'node:path'
import { Worker } from 'node:worker_threads'

interface WorkerResponse {
  id: number
  image?: Uint8Array
  error?: string
}

interface PendingJob {
  resolve(image: Buffer): void
  reject(error: Error): void
}

function workerEntryPath(): string {
  const javascript = join(
    import.meta.dirname,
    'receipt-preprocessing-worker.js',
  )
  const unpacked = javascript.replace(
    `${sep}app.asar${sep}`,
    `${sep}app.asar.unpacked${sep}`,
  )
  if (unpacked !== javascript && existsSync(unpacked)) return unpacked
  if (existsSync(javascript)) return javascript
  return join(import.meta.dirname, 'receipt-preprocessing-worker.ts')
}

export class ReceiptPreprocessor {
  #worker: Worker | null = null
  #nextId = 1
  #pending = new Map<number, PendingJob>()
  #tail: Promise<unknown> = Promise.resolve()
  #disposed = false
  #disposing: Promise<void> | null = null

  preprocess(image: Buffer): Promise<Buffer> {
    if (this.#disposed)
      return Promise.reject(new Error('Preprocessor disposed'))
    const result = this.#tail.then(() => this.#run(image))
    this.#tail = result.catch(() => {})
    return result
  }

  async dispose(): Promise<void> {
    if (this.#disposing) return this.#disposing
    this.#disposed = true
    this.#disposing = (async () => {
      await this.#tail.catch(() => {})
      const worker = this.#worker
      this.#worker = null
      if (worker) await worker.terminate()
    })()
    return this.#disposing
  }

  #run(image: Buffer): Promise<Buffer> {
    const worker = this.#getWorker()
    const id = this.#nextId
    this.#nextId += 1
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      worker.postMessage({ id, image })
    })
  }

  #getWorker(): Worker {
    if (this.#worker) return this.#worker
    const worker = new Worker(workerEntryPath())
    worker.on('message', (response: WorkerResponse) => {
      const pending = this.#pending.get(response.id)
      if (!pending) return
      this.#pending.delete(response.id)
      if (response.image) pending.resolve(Buffer.from(response.image))
      else
        pending.reject(
          new Error(response.error ?? 'Receipt preprocessing failed'),
        )
    })
    worker.on('error', (error) => this.#failWorker(worker, error))
    worker.on('exit', (code) => {
      if (this.#worker !== worker) return
      this.#worker = null
      if (code !== 0)
        this.#rejectPending(
          new Error(`Receipt preprocessing worker exited ${code}`),
        )
    })
    this.#worker = worker
    return worker
  }

  #failWorker(worker: Worker, error: Error): void {
    if (this.#worker === worker) this.#worker = null
    this.#rejectPending(error)
  }

  #rejectPending(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error)
    this.#pending.clear()
  }
}

export async function preprocessReceiptImage(image: Buffer): Promise<Buffer> {
  const preprocessor = new ReceiptPreprocessor()
  try {
    return await preprocessor.preprocess(image)
  } finally {
    await preprocessor.dispose()
  }
}
