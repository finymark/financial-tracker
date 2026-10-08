import type { Currency } from '../../../shared/accounts'
import { en, type MessageKey } from './en'
import { hu } from './hu'
import { de } from './de'
import type { Language } from '../../../shared/settings'
export { languages, type Language } from '../../../shared/settings'

export const catalogs = { hu, en, de }
export type { MessageKey }

const locales: Record<Language, string> = {
  hu: 'hu-HU',
  en: 'en-GB',
  de: 'de-DE',
}

export function translate(language: Language, key: MessageKey): string {
  return catalogs[language][key]
}

export function createFormatters(language: Language) {
  const locale = locales[language]

  return {
    date: (
      value: Date,
      options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
    ) => new Intl.DateTimeFormat(locale, options).format(value),
    money: (hundredths: number, currency: Currency) => {
      const amount = BigInt(hundredths)
      const negative = amount < 0n
      const absolute = negative ? -amount : amount
      const decimals = currency === 'HUF' ? 0 : 2
      const units = decimals === 0 ? (absolute + 50n) / 100n : absolute / 100n
      const signedUnits = negative ? (units === 0n ? -0 : -units) : units
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
        .formatToParts(signedUnits)
        .map((part) =>
          part.type === 'fraction'
            ? String(absolute % 100n).padStart(2, '0')
            : part.value,
        )
        .join('')
    },
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
  }
}
