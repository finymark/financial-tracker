import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  MnbExchangeRateSource,
  parseMnbExchangeRates,
  type MnbTransportRequest,
} from './mnb-source'

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, 'fixtures', `${name}.xml`), 'utf8')

describe('MNB SOAP exchange-rate adapter', () => {
  test('posts the SOAP 1.1 request and parses decimal strings without floating point', async () => {
    let request: MnbTransportRequest | undefined
    const source = new MnbExchangeRateSource(async (input) => {
      request = input
      return { status: 200, body: fixture('range-holiday-weekend-chf') }
    })

    const rates = await source.fetchRates({
      startDate: '2026-08-14',
      endDate: '2026-08-25',
      currencies: ['CHF'],
    })

    expect(request).toEqual({
      url: 'http://www.mnb.hu/arfolyamok.asmx',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction:
          '"http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetExchangeRates"',
      },
      body: expect.stringContaining(
        '<web:startDate>2026-08-14</web:startDate>',
      ),
    })
    expect(request!.body).toContain(
      '<web:currencyNames>CHF</web:currencyNames>',
    )
    expect(rates[0]).toEqual({
      date: '2026-08-25',
      currency: 'CHF',
      rate: '387,17',
      unit: 1,
    })
    expect(rates).toHaveLength(6)
  })

  test.each([
    'weekend-only-chf',
    'future-empty-chf',
    'year-end-chf',
    'unknown-currency',
  ])('represents an empty %s response as no rates', (name) => {
    expect(parseMnbExchangeRates(fixture(name), new Set(['CHF']))).toEqual([])
  })

  test('parses varying decimals, multiple requested currencies, and quoted units strictly', () => {
    const multiple = parseMnbExchangeRates(
      fixture('two-currencies'),
      new Set(['CHF', 'EUR']),
    )
    expect(multiple.slice(0, 2)).toEqual([
      { date: '2026-10-07', currency: 'CHF', rate: '393,09000', unit: 1 },
      { date: '2026-10-07', currency: 'EUR', rate: '366,76000', unit: 1 },
    ])
    expect(multiple.at(-2)?.rate).toBe('388,56000')
    expect(multiple.at(-1)?.rate).toBe('367,38000')
  })

  test.each(['currency-units-chf', 'date-interval'])(
    'rejects a non-exchange-rate SOAP response from %s',
    (name) => {
      expect(() =>
        parseMnbExchangeRates(fixture(name), new Set(['CHF'])),
      ).toThrow('exchangeRates.error.response')
    },
  )

  test('rejects SOAP faults and HTTP failures', async () => {
    expect(() =>
      parseMnbExchangeRates(fixture('bad-date'), new Set(['CHF'])),
    ).toThrow('exchangeRates.error.response')
    const source = new MnbExchangeRateSource(async () => ({
      status: 500,
      body: fixture('bad-date'),
    }))
    await expect(
      source.fetchRates({
        startDate: 'bad',
        endDate: '2026-08-25',
        currencies: ['CHF'],
      }),
    ).rejects.toThrow('exchangeRates.error.response')
  })
})
