import { describe, expect, test } from 'vitest'
import { ocrLanguagesForProfile } from './ocr-engine'

describe('OCR language selection', () => {
  test.each([
    ['hu', ['hun', 'eng']],
    ['de', ['deu', 'eng']],
    ['en', ['eng']],
  ] as const)(
    'maps profile language %s to local OCR models',
    (profile, expected) => {
      expect(ocrLanguagesForProfile(profile)).toEqual(expected)
    },
  )
})
