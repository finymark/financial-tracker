import { net } from 'electron'
import type {
  ExchangeRate,
  ExchangeRateRequest,
  ExchangeRateSource,
} from './exchange-rate-source'

const ENDPOINT = 'http://www.mnb.hu/arfolyamok.asmx'
const ACTION =
  'http://www.mnb.hu/webservices/MNBArfolyamServiceSoap/GetExchangeRates'
const DATE = /^\d{4}-\d{2}-\d{2}$/

export interface MnbTransportRequest {
  url: string
  headers: Record<string, string>
  body: string
}

export interface MnbTransportResponse {
  status: number
  body: string
}

export type MnbTransport = (
  request: MnbTransportRequest,
) => Promise<MnbTransportResponse>

function responseError(cause?: unknown): Error {
  return new Error('exchangeRates.error.response', { cause })
}

function decodeXmlText(value: string): string {
  return value.replace(
    /&(?:lt|gt|amp|quot|apos);/g,
    (entity) =>
      ({
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&',
        '&quot;': '"',
        '&apos;': "'",
      })[entity]!,
  )
}

interface ParsedMnbRate {
  date: string
  currency: string
  rate: string
  unit: number
}

/** Parses only the small, recorded MNB GetExchangeRates SOAP shape. */
export function parseMnbExchangeRates(
  soap: string,
  requestedCurrencies: ReadonlySet<string>,
): ParsedMnbRate[] {
  try {
    if (/<(?:\w+:)?Fault(?:\s|>)/.test(soap)) throw responseError()
    const result =
      /<(?:\w+:)?GetExchangeRatesResult>([\s\S]*?)<\/(?:\w+:)?GetExchangeRatesResult>/.exec(
        soap,
      )
    if (!result) throw responseError()
    const inner = decodeXmlText(result[1].trim())
    if (/^<MNBExchangeRates\s*\/>$/.test(inner)) return []
    const root = /^<MNBExchangeRates>([\s\S]*)<\/MNBExchangeRates>$/.exec(inner)
    if (!root) throw responseError()
    const rates: ParsedMnbRate[] = []
    const dayPattern = /<Day date="([^"]+)"\s*(?:\/>|>([\s\S]*?)<\/Day>)/g
    let consumed = ''
    let day: RegExpExecArray | null
    while ((day = dayPattern.exec(root[1]))) {
      consumed += day[0]
      const date = day[1]
      if (!DATE.test(date)) throw responseError()
      const content = day[2] ?? ''
      const ratePattern =
        /<Rate unit="([1-9]\d*)" curr="([A-Z]{3})">(\d+(?:[,.]\d+)?)<\/Rate>/g
      let rate: RegExpExecArray | null
      let rateConsumed = ''
      while ((rate = ratePattern.exec(content))) {
        rateConsumed += rate[0]
        if (!requestedCurrencies.has(rate[2])) throw responseError()
        const unit = Number(rate[1])
        if (!Number.isSafeInteger(unit) || unit <= 0) throw responseError()
        rates.push({
          date,
          currency: rate[2],
          rate: rate[3],
          unit,
        })
      }
      if (content.replace(/\s/g, '') !== rateConsumed.replace(/\s/g, ''))
        throw responseError()
    }
    if (root[1].replace(/\s/g, '') !== consumed.replace(/\s/g, ''))
      throw responseError()
    return rates
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'exchangeRates.error.response'
    )
      throw error
    throw responseError(error)
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export class MnbExchangeRateSource implements ExchangeRateSource {
  readonly #transport: MnbTransport

  constructor(transport: MnbTransport) {
    this.#transport = transport
  }

  async fetchRates(input: ExchangeRateRequest): Promise<ExchangeRate[]> {
    const currencies = [...new Set(input.currencies)]
    if (
      !DATE.test(input.startDate) ||
      !DATE.test(input.endDate) ||
      input.startDate > input.endDate ||
      currencies.length === 0
    )
      throw responseError()
    const currencyNames = currencies.join(',')
    const body =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
      '<s:Body>' +
      '<web:GetExchangeRates xmlns:web="http://www.mnb.hu/webservices/">' +
      `<web:startDate>${escapeXml(input.startDate)}</web:startDate>` +
      `<web:endDate>${escapeXml(input.endDate)}</web:endDate>` +
      `<web:currencyNames>${escapeXml(currencyNames)}</web:currencyNames>` +
      '</web:GetExchangeRates>' +
      '</s:Body>' +
      '</s:Envelope>'
    const response = await this.#transport({
      url: ENDPOINT,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"${ACTION}"`,
      },
      body,
    })
    if (response.status < 200 || response.status >= 300) throw responseError()
    const parsed = parseMnbExchangeRates(response.body, new Set(currencies))
    return parsed.map((rate) => {
      if (rate.date < input.startDate || rate.date > input.endDate)
        throw responseError()
      return { ...rate, currency: rate.currency as ExchangeRate['currency'] }
    })
  }
}

export function createElectronNetTransport(timeoutMs = 10_000): MnbTransport {
  return async ({ url, headers, body }) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await net.fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })
      return { status: response.status, body: await response.text() }
    } finally {
      clearTimeout(timeout)
    }
  }
}
