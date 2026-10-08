import { foldTextKey } from './text-keys'

export type ReceiptLanguage = 'hu' | 'de' | 'en'
export type ReceiptCurrency = 'HUF' | 'CHF' | 'EUR'

export interface ParsedReceipt {
  payeeName?: string
  date?: string
  /** Integer hundredths of the currency unit, including HUF. */
  total?: number
  currency?: ReceiptCurrency
  confidence: 'high' | 'low'
}

type AmountStyle = 'hungarian' | 'western'

interface TotalRule {
  keyword: RegExp
  style: AmountStyle
}

interface TotalCandidate {
  total: number
  currency?: ReceiptCurrency
}

const hungarianRules: TotalRule[] = [
  { keyword: /\bf[il1]zetend[o0]\b/u, style: 'hungarian' },
  { keyword: /\b[o0]sszesen\b/u, style: 'hungarian' },
]

const westernRules: TotalRule[] = [
  { keyword: /\btotal\b/u, style: 'western' },
  { keyword: /\bsumme\b/u, style: 'western' },
  { keyword: /\bgesamt\b/u, style: 'western' },
  { keyword: /\bzu\s+zahlen\b/u, style: 'western' },
  { keyword: /\bbetrag\b/u, style: 'western' },
]

const amountToken =
  /(?<![\p{L}\p{N}.,'’+-])([0-9OolI|]+(?:[ \u00a0\u202f'’.,][0-9OolI|]+)*(?:\s*,-)?)(?![\p{L}\p{N}])/gu

function rulesFor(language: ReceiptLanguage): TotalRule[] {
  if (language === 'hu') return [...hungarianRules, ...westernRules]
  return [...westernRules, ...hungarianRules]
}

function currenciesIn(value: string): ReceiptCurrency[] {
  const folded = foldTextKey(value)
  const currencies: ReceiptCurrency[] = []
  if (/\b(?:huf|ft)\b/u.test(folded)) currencies.push('HUF')
  if (/\b(?:chf|sfr\.?)\b/u.test(folded) || /\bfr\.(?=\s|$)/u.test(folded))
    currencies.push('CHF')
  if (/\beur\b/u.test(folded) || value.includes('€')) currencies.push('EUR')
  return currencies
}

function uniqueCurrency(value: string): ReceiptCurrency | undefined {
  const currencies = [...new Set(currenciesIn(value))]
  return currencies.length === 1 ? currencies[0] : undefined
}

function parseAmountToken(value: string): number | undefined {
  let normalized = value
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/’/g, "'")
    .trim()
  const dashAmount = normalized.endsWith(',-')
  if (dashAmount) normalized = normalized.slice(0, -2).trimEnd()
  if (!/^\d[\d .,']*\d$|^\d$/u.test(normalized)) return undefined

  if (normalized.includes("'")) {
    if (!/^\d{1,3}(?:'\d{3})+(?:[.,]\d{1,2})?$/u.test(normalized))
      return undefined
    normalized = normalized.replace(/'/g, '')
  }
  if (normalized.includes(' ')) {
    if (!/^\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$/u.test(normalized))
      return undefined
    normalized = normalized.replace(/ /g, '')
  }

  let integer = normalized
  let fraction = ''
  const dots = [...normalized.matchAll(/\./g)].map((match) => match.index)
  const commas = [...normalized.matchAll(/,/g)].map((match) => match.index)

  if (dashAmount) {
    if (commas.length && dots.length) return undefined
    if (
      !/^\d+$/u.test(normalized) &&
      !/^\d{1,3}(?:[.,]\d{3})+$/u.test(normalized)
    )
      return undefined
    integer = normalized.replace(/[.,]/g, '')
  } else if (dots.length && commas.length) {
    const decimalIndex = Math.max(dots.at(-1) ?? -1, commas.at(-1) ?? -1)
    const decimalSeparator = normalized[decimalIndex]
    const groupingSeparator = decimalSeparator === '.' ? ',' : '.'
    const groupingPattern = groupingSeparator === '.' ? '\\.' : ','
    fraction = normalized.slice(decimalIndex + 1)
    const groupedInteger = normalized.slice(0, decimalIndex)
    if (
      !/^\d{1,2}$/u.test(fraction) ||
      !new RegExp(`^\\d{1,3}(?:${groupingPattern}\\d{3})+$`, 'u').test(
        groupedInteger,
      )
    )
      return undefined
    integer = groupedInteger.replace(/[.,]/g, '')
  } else if (dots.length || commas.length) {
    const separator = dots.length ? '.' : ','
    const parts = normalized.split(separator)
    const tail = parts.at(-1) ?? ''
    if (parts.length === 2 && tail.length <= 2) {
      if (!/^\d{1,2}$/u.test(tail)) return undefined
      fraction = tail
      integer = parts[0]
    } else if (
      parts.length >= 2 &&
      /^\d{1,3}$/u.test(parts[0]) &&
      parts.slice(1).every((part) => /^\d{3}$/u.test(part))
    ) {
      integer = parts.join('')
    } else {
      return undefined
    }
  }

  if (!/^\d+$/u.test(integer) || !/^\d{0,2}$/u.test(fraction)) return undefined
  const hundredths =
    BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0') || '0')
  const total = Number(hundredths)
  return Number.isSafeInteger(total) && total > 0 ? total : undefined
}

function amountAfterKeyword(value: string): number | undefined {
  for (const match of value.matchAll(amountToken)) {
    const total = parseAmountToken(match[1])
    if (total !== undefined) return total
  }
  return undefined
}

function isTaxSummaryLine(value: string, style: AmountStyle): boolean {
  const folded = foldTextKey(value)
  return style === 'hungarian'
    ? /\bafa\b/u.test(folded)
    : /\b(?:mwst|ust|uid)\b/u.test(folded) || /\bche-/u.test(folded)
}

function totalCandidates(
  lines: string[],
  language: ReceiptLanguage,
  wholeReceiptCurrency: ReceiptCurrency | undefined,
): TotalCandidate[] {
  for (const rule of rulesFor(language)) {
    const candidates: TotalCandidate[] = []
    for (const [index, line] of lines.entries()) {
      const folded = foldTextKey(line)
      const keyword = rule.keyword.exec(folded)
      if (!keyword || isTaxSummaryLine(line, rule.style)) continue
      let amountSource = line.slice((keyword.index ?? 0) + keyword[0].length)
      let currencySource = line
      let total = amountAfterKeyword(amountSource)
      if (total === undefined) {
        const nextLine = lines
          .slice(index + 1)
          .find((candidate) => candidate.trim())
        if (nextLine !== undefined) {
          amountSource = nextLine
          currencySource = `${line}\n${nextLine}`
          total = amountAfterKeyword(amountSource)
        }
      }
      if (total === undefined) continue
      const currency =
        uniqueCurrency(currencySource) ??
        wholeReceiptCurrency ??
        (rule.style === 'hungarian' ? 'HUF' : undefined)
      candidates.push({ total, currency })
    }
    if (candidates.length) return candidates
  }
  return []
}

function isoDate(year: number, month: number, day: number): string | undefined {
  if (year < 1900 || year > 2099) return undefined
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  )
    return undefined
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parsedToday(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (!match) return undefined
  const iso = isoDate(Number(match[1]), Number(match[2]), Number(match[3]))
  return iso ? new Date(`${iso}T00:00:00.000Z`) : undefined
}

function isAllowedDate(value: string, today: Date | undefined): boolean {
  if (!today) return true
  const latest = new Date(today)
  latest.setUTCFullYear(latest.getUTCFullYear() + 1)
  return new Date(`${value}T00:00:00.000Z`) <= latest
}

function datesIn(text: string, todayValue: string | undefined): string[] {
  const dates: string[] = []
  const today = parsedToday(todayValue)
  for (const match of text.matchAll(
    /\b(20\d{2})\s*(?:\.\s*|-\s*)(\d{1,2})\s*(?:\.\s*|-\s*)(\d{1,2})(?:\s*\.)?/gu,
  )) {
    const date = isoDate(Number(match[1]), Number(match[2]), Number(match[3]))
    if (date && isAllowedDate(date, today)) dates.push(date)
  }
  for (const match of text.matchAll(
    /\b(\d{1,2})([./])(\d{1,2})\2(\d{2}|\d{4})\b/gu,
  )) {
    const shortYear = Number(match[4])
    const year = match[4].length === 2 ? 2000 + shortYear : shortYear
    const date = isoDate(year, Number(match[3]), Number(match[1]))
    if (date && isAllowedDate(date, today)) dates.push(date)
  }
  return [...new Set(dates)]
}

function isPlausiblePayee(value: string): boolean {
  const folded = foldTextKey(value).trim()
  if ((value.match(/\p{L}/gu) ?? []).length < 2) return false
  if (value.length > 120) return false
  if (
    /\b(?:nyugta|receipt|quittung|kassenzettel|nav|adoszam|telefon|phone|tel|bankkartya|keszpenz|mwst|ust|uid|afa|total|summe|gesamt|fizetendo|osszesen)\b/u.test(
      folded,
    ) ||
    /\bche-/u.test(folded)
  )
    return false
  if (/\+?\d[\d ()/-]{6,}/u.test(value)) return false
  if (/^(?:h-?)?\d{4,5}\s+\p{L}/u.test(folded)) return false
  if (
    /\b(?:utca|ut|ter|koz|strasse|straße|gasse|weg|platz|allee|street|road)\b.*\d/u.test(
      folded,
    )
  )
    return false
  if (/\b(?:huf|chf|sfr|eur|ft)\b/u.test(folded) || value.includes('€'))
    return false
  if (/\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/u.test(value)) return false
  return true
}

function payeeIn(lines: string[]): string | undefined {
  return lines
    .filter((line) => line.trim())
    .slice(0, 15)
    .map((line) => line.trim())
    .find(isPlausiblePayee)
}

/**
 * Extracts receipt fields from OCR text without I/O or profile state.
 * `today` is optional; when supplied as YYYY-MM-DD, dates more than one
 * calendar year in the future are ignored.
 */
export function parseReceipt(
  text: string,
  language: ReceiptLanguage,
  today?: string,
): ParsedReceipt {
  const lines = text.replace(/^\uFEFF/u, '').split(/\r?\n/u)
  const receiptDates = datesIn(text, today)
  const totals = totalCandidates(lines, language, uniqueCurrency(text))
  const chosenTotal = totals[0]
  const result: ParsedReceipt = { confidence: 'low' }
  const payeeName = payeeIn(lines)
  if (payeeName) result.payeeName = payeeName
  if (receiptDates[0]) result.date = receiptDates[0]
  if (chosenTotal) {
    result.total = chosenTotal.total
    if (chosenTotal.currency) result.currency = chosenTotal.currency
  }
  const distinctTotals = new Set(
    totals.map((candidate) => `${candidate.total}:${candidate.currency ?? ''}`),
  )
  if (chosenTotal && receiptDates.length === 1 && distinctTotals.size === 1)
    result.confidence = 'high'
  return result
}
