import sharp from 'sharp'
import { describe, expect, test } from 'vitest'
import type { OcrEngine, OcrLanguage } from './ocr-engine'
import { readReceipt } from './read-receipt'

class FakeOcrEngine implements OcrEngine {
  calls: { image: Buffer; languages: OcrLanguage[] }[] = []

  constructor(
    private readonly outcome: { text: string; confidence: number } | Error,
  ) {}

  async recognize(image: Buffer, languages: OcrLanguage[]) {
    this.calls.push({ image, languages })
    if (this.outcome instanceof Error) throw this.outcome
    return this.outcome
  }

  async dispose() {}
}

async function image(): Promise<Buffer> {
  return sharp({
    create: {
      width: 200,
      height: 100,
      channels: 3,
      background: '#ffffff',
    },
  })
    .png()
    .toBuffer()
}

describe('receipt reading orchestration', () => {
  test('preprocesses, recognizes in profile-language order, and parses raw text', async () => {
    const engine = new FakeOcrEngine({
      text: 'MUSTER TEST AG\nTOTAL CHF 12.50\n31.01.2025',
      confidence: 91,
    })
    const source = await image()
    const result = await readReceipt(source, 'hu', engine, '2025-01-31')

    expect(result).toEqual({
      payeeName: 'MUSTER TEST AG',
      date: '2025-01-31',
      total: 1_250,
      currency: 'CHF',
      confidence: 'high',
      rawText: 'MUSTER TEST AG\nTOTAL CHF 12.50\n31.01.2025',
    })
    expect(engine.calls).toHaveLength(1)
    expect(engine.calls[0].languages).toEqual(['hun', 'eng'])
    await expect(
      sharp(engine.calls[0].image).metadata(),
    ).resolves.toMatchObject({
      format: 'png',
      channels: 1,
    })
  })

  test('returns an empty low-confidence result when recognition fails', async () => {
    const engine = new FakeOcrEngine(new Error('OCR failed'))
    await expect(readReceipt(await image(), 'de', engine)).resolves.toEqual({
      confidence: 'low',
      rawText: '',
    })
  })

  test('returns an empty low-confidence result when preprocessing fails', async () => {
    const engine = new FakeOcrEngine({ text: 'unused', confidence: 100 })
    await expect(
      readReceipt(Buffer.from('not an image'), 'en', engine),
    ).resolves.toEqual({
      confidence: 'low',
      rawText: '',
    })
    expect(engine.calls).toEqual([])
  })
})
