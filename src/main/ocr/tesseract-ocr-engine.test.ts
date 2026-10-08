import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, test, vi } from 'vitest'
import {
  TesseractOcrEngine,
  type TesseractWorkerFactory,
  type TesseractWorkerLike,
} from './tesseract-ocr-engine'

function worker(
  recognize: TesseractWorkerLike['recognize'] = async () => ({
    data: { text: 'recognized', confidence: 88 },
  }),
): TesseractWorkerLike {
  return {
    recognize,
    reinitialize: vi.fn(async () => undefined),
    terminate: vi.fn(async () => undefined),
  }
}

describe('Tesseract OCR engine lifecycle', () => {
  test('creates lazily, serializes jobs, and reinitializes for another language set', async () => {
    let active = 0
    let maximumActive = 0
    const fakeWorker = worker(async () => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await delay(10)
      active -= 1
      return { data: { text: 'recognized', confidence: 88 } }
    })
    const factory = vi.fn<TesseractWorkerFactory>(async () => fakeWorker)
    const engine = new TesseractOcrEngine({
      createWorker: factory,
      resources: {
        corePath: 'local-core',
        langPath: 'local-models',
        workerPath: 'local-worker',
      },
    })
    expect(factory).not.toHaveBeenCalled()

    const first = engine.recognize(Buffer.from('first'), ['hun', 'eng'])
    const second = engine.recognize(Buffer.from('second'), ['hun', 'eng'])
    await expect(Promise.all([first, second])).resolves.toEqual([
      { text: 'recognized', confidence: 88 },
      { text: 'recognized', confidence: 88 },
    ])
    expect(maximumActive).toBe(1)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledWith(['hun', 'eng'], {
      cacheMethod: 'none',
      corePath: 'local-core',
      gzip: true,
      langPath: 'local-models',
      workerPath: 'local-worker',
    })

    await engine.recognize(Buffer.from('third'), ['deu', 'eng'])
    expect(fakeWorker.reinitialize).toHaveBeenCalledWith('deu+eng')
    await engine.dispose()
    expect(fakeWorker.terminate).toHaveBeenCalledOnce()
    await expect(
      engine.recognize(Buffer.from('after dispose'), ['eng']),
    ).rejects.toThrow('OCR engine is disposed')
  })

  test('terminates an idle worker and creates a fresh one for the next job', async () => {
    const workers = [worker(), worker()]
    const factory = vi.fn<TesseractWorkerFactory>(async () => workers.shift()!)
    const engine = new TesseractOcrEngine({
      createWorker: factory,
      idleTimeoutMs: 15,
      resources: {
        corePath: 'local-core',
        langPath: 'local-models',
        workerPath: 'local-worker',
      },
    })
    await engine.recognize(Buffer.from('first'), ['eng'])
    await delay(30)
    expect(factory).toHaveBeenCalledTimes(1)
    await engine.recognize(Buffer.from('second'), ['eng'])
    expect(factory).toHaveBeenCalledTimes(2)
    await engine.dispose()
  })
})
