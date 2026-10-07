import { en, type MessageKey } from './en'
import { hu } from './hu'
import { de } from './de'

export const catalogs = { hu, en, de }
export const languages = ['hu', 'en', 'de'] as const
export type Language = (typeof languages)[number]
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
    number: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
  }
}
