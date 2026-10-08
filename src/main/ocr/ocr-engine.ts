import type { Language } from '../../shared/settings'

export const ocrLanguages = ['hun', 'deu', 'eng'] as const
export type OcrLanguage = (typeof ocrLanguages)[number]

export interface OcrResult {
  text: string
  confidence: number
}

export interface OcrEngine {
  recognize(image: Buffer, languages: OcrLanguage[]): Promise<OcrResult>
  dispose(): Promise<void>
}

export function ocrLanguagesForProfile(language: Language): OcrLanguage[] {
  if (language === 'hu') return ['hun', 'eng']
  if (language === 'de') return ['deu', 'eng']
  return ['eng']
}
