import type Database from 'better-sqlite3'
import type { Currency } from '../../shared/accounts'
import type {
  BaseCurrencyConversion,
  ConversionLine,
  RateCoverage,
  RateStatus,
} from '../../shared/exchange-rates'
import { today } from '../../shared/date'
import type {
  ExchangeRate,
  ExchangeRateSource,
} from '../exchange-rates/exchange-rate-source'

interface Rational {
  numerator: bigint
  denominator: bigint
}

interface StoredRate {
  rate: string
  unit: number
}

interface StoredCoverage {
  startDate: string | null
  endDate: string | null
  lastRefresh: string | null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

function hasRateCache(database: Database.Database): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'exchange_rates'",
      )
      .get(),
  )
}

function gcd(left: bigint, right: bigint): bigint {
  left = left < 0n ? -left : left
  right = right < 0n ? -right : right
  while (right !== 0n) [left, right] = [right, left % right]
  return left || 1n
}

function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator === 0n) throw new Error('exchangeRates.error.rate')
  if (denominator < 0n) {
    numerator = -numerator
    denominator = -denominator
  }
  const divisor = gcd(numerator, denominator)
  return { numerator: numerator / divisor, denominator: denominator / divisor }
}

function add(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  )
}

function decimal(value: string): Rational {
  const match = /^(\d+)(?:[,.](\d+))?$/.exec(value)
  if (!match) throw new Error('exchangeRates.error.rate')
  const fraction = match[2] ?? ''
  const parsed = rational(
    BigInt(match[1] + fraction),
    10n ** BigInt(fraction.length),
  )
  if (parsed.numerator <= 0n) throw new Error('exchangeRates.error.rate')
  return parsed
}

function safe(value: bigint): number {
  const result = Number(value)
  if (!Number.isSafeInteger(result))
    throw new Error('exchangeRates.error.total')
  return result
}

function round(ratio: Rational): number {
  const negative = ratio.numerator < 0n
  const absolute = negative ? -ratio.numerator : ratio.numerator
  let result = absolute / ratio.denominator
  if ((absolute % ratio.denominator) * 2n >= ratio.denominator) result += 1n
  return safe(negative ? -result : result)
}

function coverage(database: Database.Database): StoredCoverage {
  if (!hasRateCache(database))
    return { startDate: null, endDate: null, lastRefresh: null }
  return database
    .prepare(
      `SELECT coverage_start_date AS startDate,
        coverage_end_date AS endDate, last_refresh_at AS lastRefresh
       FROM exchange_rate_cache_metadata WHERE id = 1`,
    )
    .get() as StoredCoverage
}

function baseCurrency(database: Database.Database): Currency {
  return (
    database
      .prepare(
        'SELECT base_currency AS baseCurrency FROM profile_settings WHERE id = 1',
      )
      .get() as { baseCurrency: Currency }
  ).baseCurrency
}

function earliestNeededDate(
  database: Database.Database,
  base: Currency,
): string | null {
  const result = database
    .prepare(
      `SELECT MIN(date) AS date FROM (
        SELECT opening_date AS date FROM accounts WHERE currency <> ?
        UNION ALL
        SELECT transactions.date AS date
        FROM transactions
        JOIN accounts ON accounts.id = transactions.account_id
        WHERE accounts.currency <> ?
      )`,
    )
    .get(base, base) as { date: string | null }
  return result.date
}

function findRate(
  database: Database.Database,
  date: string,
): StoredRate | null {
  if (!hasRateCache(database)) return null
  return (
    (database
      .prepare(
        `SELECT rate, unit FROM exchange_rates
         WHERE currency = 'CHF' AND date <= ?
         ORDER BY date DESC LIMIT 1`,
      )
      .get(date) as StoredRate | undefined) ?? null
  )
}

function moveDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function validateFetchedRate(
  rate: ExchangeRate,
  startDate: string,
  endDate: string,
): void {
  if (
    !DATE.test(rate.date) ||
    rate.date < startDate ||
    rate.date > endDate ||
    rate.currency !== 'CHF' ||
    !Number.isSafeInteger(rate.unit) ||
    rate.unit <= 0
  )
    throw new Error('exchangeRates.error.rate')
  decimal(rate.rate)
}

export async function refreshExchangeRates(
  database: Database.Database,
  source: ExchangeRateSource,
  clock: () => Date,
  assertAvailable: () => void,
  write: (operation: () => void) => void,
): Promise<void> {
  assertAvailable()
  if (!hasRateCache(database)) throw new Error('exchangeRates.error.schema')
  const earliest = earliestNeededDate(database, baseCurrency(database))
  if (!earliest) return
  const current = today(clock)
  const stored = coverage(database)
  const spans: { startDate: string; endDate: string }[] = []
  if (!stored.startDate || !stored.endDate) {
    spans.push({ startDate: earliest, endDate: current })
  } else {
    if (earliest < stored.startDate) {
      spans.push({
        startDate: earliest,
        endDate: moveDate(stored.startDate, -1),
      })
    }
    if (stored.endDate < current) {
      spans.push({ startDate: moveDate(stored.endDate, 1), endDate: current })
    }
  }
  for (const span of spans) {
    if (span.startDate > span.endDate) continue
    const rates = await source.fetchRates({ ...span, currencies: ['CHF'] })
    const keys = new Set<string>()
    for (const rate of rates) {
      validateFetchedRate(rate, span.startDate, span.endDate)
      const key = `${rate.date}:${rate.currency}`
      if (keys.has(key)) throw new Error('exchangeRates.error.rate')
      keys.add(key)
    }
    assertAvailable()
    write(() => {
      const insert = database.prepare(
        `INSERT INTO exchange_rates (date, currency, rate, unit)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (date, currency) DO UPDATE
         SET rate = excluded.rate, unit = excluded.unit`,
      )
      for (const rate of rates)
        insert.run(rate.date, rate.currency, rate.rate, rate.unit)
      const before = coverage(database)
      const startDate = before.startDate
        ? before.startDate < span.startDate
          ? before.startDate
          : span.startDate
        : span.startDate
      const endDate = before.endDate
        ? before.endDate > span.endDate
          ? before.endDate
          : span.endDate
        : span.endDate
      const refreshedAt = clock().toISOString()
      database
        .prepare(
          `UPDATE exchange_rate_cache_metadata
           SET coverage_start_date = ?, coverage_end_date = ?,
             last_refresh_at = CASE
               WHEN last_refresh_at IS NULL OR last_refresh_at < ? THEN ?
               ELSE last_refresh_at END
           WHERE id = 1`,
        )
        .run(startDate, endDate, refreshedAt, refreshedAt)
    })
  }
}

export function getRateStatus(
  database: Database.Database,
  clock: () => Date,
): RateStatus {
  const base = baseCurrency(database)
  const earliest = earliestNeededDate(database, base)
  const stored = coverage(database)
  const validCoverage =
    stored.startDate && stored.endDate
      ? ({
          startDate: stored.startDate,
          endDate: stored.endDate,
        } satisfies RateCoverage)
      : null
  return {
    coverage: validCoverage,
    lastRefresh: stored.lastRefresh,
    stale: Boolean(
      earliest && (!stored.endDate || stored.endDate < today(clock)),
    ),
    missing: Boolean(earliest && !findRate(database, earliest)),
  }
}

export function convertToBaseCurrency(
  database: Database.Database,
  lines: readonly ConversionLine[],
  clock: () => Date,
): BaseCurrencyConversion {
  const base = baseCurrency(database)
  const stored = coverage(database)
  let total = rational(0n)
  let usesRate = false
  let usesRateAfterCoverage = false
  const unconverted = new Map<Currency, bigint>()
  for (const line of lines) {
    if (
      !DATE.test(line.date) ||
      !Number.isSafeInteger(line.amountMinor) ||
      (line.currency !== 'HUF' && line.currency !== 'CHF')
    )
      throw new Error('exchangeRates.error.line')
    if (line.amountMinor === 0) continue
    if (line.currency === base) {
      total = add(total, rational(BigInt(line.amountMinor)))
      continue
    }
    const rate = findRate(database, line.date)
    if (!rate) {
      unconverted.set(
        line.currency,
        (unconverted.get(line.currency) ?? 0n) + BigInt(line.amountMinor),
      )
      continue
    }
    usesRate = true
    if (!stored.endDate || line.date > stored.endDate)
      usesRateAfterCoverage = true
    const quoted = decimal(rate.rate)
    const amount = BigInt(line.amountMinor)
    total = add(
      total,
      base === 'HUF'
        ? rational(
            amount * quoted.numerator,
            quoted.denominator * BigInt(rate.unit),
          )
        : rational(
            amount * quoted.denominator * BigInt(rate.unit),
            quoted.numerator,
          ),
    )
  }
  return {
    baseCurrency: base,
    exactTotal: {
      numerator: total.numerator.toString(),
      denominator: total.denominator.toString(),
    },
    roundedMinor: round(total),
    unconverted: [...unconverted.entries()]
      .map(([currency, amount]) => ({ currency, amountMinor: safe(amount) }))
      .sort((left, right) => left.currency.localeCompare(right.currency)),
    stale: Boolean(
      usesRate &&
      (usesRateAfterCoverage ||
        !stored.endDate ||
        stored.endDate < today(clock)),
    ),
  }
}
