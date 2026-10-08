import { describe, expect, test } from 'vitest'
import swissApostrophe from './receipt-fixtures/ch-apostrophe-mwst.txt?raw'
import swissCurlyApostrophe from './receipt-fixtures/ch-curly-apostrophe.txt?raw'
import swissTotal from './receipt-fixtures/ch-total.txt?raw'
import germanSumme from './receipt-fixtures/de-summe-eur.txt?raw'
import germanZuZahlen from './receipt-fixtures/de-zu-zahlen.txt?raw'
import hungarianCash from './receipt-fixtures/hu-cash-rounding.txt?raw'
import hungarianLong from './receipt-fixtures/hu-long-vat.txt?raw'
import hungarianNoise from './receipt-fixtures/hu-ocr-noise.txt?raw'
import hungarianSupermarket from './receipt-fixtures/hu-supermarket.txt?raw'
import conflictingTotals from './receipt-fixtures/low-conflicting-totals.txt?raw'
import garbage from './receipt-fixtures/low-garbage.txt?raw'
import noTotalKeyword from './receipt-fixtures/low-no-total-keyword.txt?raw'
import { parseReceipt } from './receipt-parser'

describe('receipt parser', () => {
  test.each([
    [
      'supermarket card receipt',
      hungarianSupermarket,
      {
        payeeName: 'MINTA MARKET Kft.',
        date: '2025-01-31',
        total: 1_234_500,
        currency: 'HUF',
        confidence: 'high',
      },
    ],
    [
      'cash rounding receipt',
      hungarianCash,
      {
        payeeName: 'PÉLDA BOLT Bt.',
        date: '2025-02-01',
        total: 235_000,
        currency: 'HUF',
        confidence: 'high',
      },
    ],
    [
      'noisy unaccented receipt',
      hungarianNoise,
      {
        payeeName: 'PR0BA ABC Zrt.',
        date: '2025-02-02',
        total: 123_400,
        currency: 'HUF',
        confidence: 'high',
      },
    ],
    [
      'long receipt with VAT summary',
      hungarianLong,
      {
        payeeName: 'HOSSZÚ MINTA Kft.',
        date: '2025-02-03',
        total: 999_900,
        currency: 'HUF',
        confidence: 'high',
      },
    ],
  ] as const)('parses Hungarian %s', (_name, fixture, expected) => {
    expect(parseReceipt(fixture, 'hu')).toEqual(expected)
  })

  test.each([
    [
      'Total CHF',
      swissTotal,
      {
        payeeName: 'MUSTER MARKT AG',
        date: '2025-01-31',
        total: 1_250,
        currency: 'CHF',
        confidence: 'high',
      },
    ],
    [
      'apostrophe thousands and MWST table',
      swissApostrophe,
      {
        payeeName: 'ALPEN BEISPIEL AG',
        date: '2025-02-01',
        total: 123_450,
        currency: 'CHF',
        confidence: 'high',
      },
    ],
    [
      'curly-apostrophe thousands and SFr.',
      swissCurlyApostrophe,
      {
        payeeName: 'BERG TEST LADEN AG',
        date: '2025-02-02',
        total: 234_560,
        currency: 'CHF',
        confidence: 'high',
      },
    ],
  ] as const)('parses Swiss %s', (_name, fixture, expected) => {
    expect(parseReceipt(fixture, 'de')).toEqual(expected)
  })

  test.each([
    [
      'SUMME with comma decimals',
      germanSumme,
      {
        payeeName: 'BEISPIEL HANDEL GmbH',
        date: '2025-02-03',
        total: 4_290,
        currency: 'EUR',
        confidence: 'high',
      },
    ],
    [
      'Zu zahlen with European separators',
      germanZuZahlen,
      {
        payeeName: 'TEST KAUFHAUS GmbH',
        date: '2025-02-04',
        total: 123_450,
        currency: 'EUR',
        confidence: 'high',
      },
    ],
  ] as const)('parses German %s', (_name, fixture, expected) => {
    expect(parseReceipt(fixture, 'de')).toEqual(expected)
  })

  test('tries every language as a fallback after the preferred rule order', () => {
    expect(parseReceipt(germanSumme, 'hu')).toEqual(
      parseReceipt(germanSumme, 'de'),
    )
    expect(parseReceipt(hungarianSupermarket, 'en')).toEqual(
      parseReceipt(hungarianSupermarket, 'hu'),
    )
  })

  test('uses the separators in the amount token without floating-point parsing', () => {
    expect(
      parseReceipt('FORMAT TEST AG\nTOTAL CHF 1,234.50\n07.02.2025', 'en'),
    ).toMatchObject({ total: 123_450, confidence: 'high' })
    expect(
      parseReceipt('FORMAT TEST AG\nTOTAL CHF 1.234.50\n07.02.2025', 'en'),
    ).toEqual({
      payeeName: 'FORMAT TEST AG',
      date: '2025-02-07',
      confidence: 'low',
    })
    expect(
      parseReceipt('FORMAT TEST AG\nTOTAL CHF -12.50\n07.02.2025', 'en'),
    ).toEqual({
      payeeName: 'FORMAT TEST AG',
      date: '2025-02-07',
      confidence: 'low',
    })
  })

  test('returns low confidence when no keyword identifies a total', () => {
    expect(parseReceipt(noTotalKeyword, 'de')).toEqual({
      payeeName: 'MUSTER EINKAUF AG',
      date: '2025-02-05',
      confidence: 'low',
    })
  })

  test('omits fields when OCR text has no plausible receipt data', () => {
    expect(parseReceipt(garbage, 'en')).toEqual({ confidence: 'low' })
  })

  test('keeps the preferred total but lowers confidence for conflicting totals', () => {
    expect(parseReceipt(conflictingTotals, 'de')).toEqual({
      payeeName: 'KONFLIKT TEST AG',
      date: '2025-02-06',
      total: 1_000,
      currency: 'CHF',
      confidence: 'low',
    })
  })

  test('rejects invalid dates and dates over one year beyond optional today', () => {
    expect(
      parseReceipt(
        'DATE TEST AG\nTOTAL CHF 12.50\n31.02.2025\n02.01.2026',
        'de',
        '2025-01-01',
      ),
    ).toEqual({
      payeeName: 'DATE TEST AG',
      total: 1_250,
      currency: 'CHF',
      confidence: 'low',
    })
    expect(
      parseReceipt(
        'DATE TEST AG\nTOTAL CHF 12.50\n01.01.2026',
        'de',
        '2025-01-01',
      ),
    ).toMatchObject({ date: '2026-01-01', confidence: 'high' })
  })

  test('lowers confidence when distinct strong date patterns conflict', () => {
    expect(
      parseReceipt(
        'DATE TEST AG\nTOTAL CHF 12.50\n01.02.2025\n02.02.2025',
        'de',
      ),
    ).toMatchObject({ date: '2025-02-01', confidence: 'low' })
  })
})
