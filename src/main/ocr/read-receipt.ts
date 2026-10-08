import { parseReceipt, type ParsedReceipt } from '../../shared/receipt-parser'
import type { Language } from '../../shared/settings'
import { ocrLanguagesForProfile, type OcrEngine } from './ocr-engine'
import { preprocessReceiptImage } from './receipt-preprocessing'

export interface ReadReceiptResult extends ParsedReceipt {
  rawText: string
}

export async function readReceipt(
  image: Buffer,
  profileLanguage: Language,
  engine: OcrEngine,
  today?: string,
): Promise<ReadReceiptResult> {
  try {
    const prepared = await preprocessReceiptImage(image)
    const { text } = await engine.recognize(
      prepared,
      ocrLanguagesForProfile(profileLanguage),
    )
    return { ...parseReceipt(text, profileLanguage, today), rawText: text }
  } catch {
    return { confidence: 'low', rawText: '' }
  }
}
