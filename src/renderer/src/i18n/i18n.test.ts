import { expect, test } from 'vitest'
import { catalogs, createFormatters, languages, translate } from './index'

test('every message key has a non-empty translation in HU, EN and DE', () => {
  const allKeys = [
    ...new Set(Object.values(catalogs).flatMap(Object.keys)),
  ].sort()

  for (const language of languages) {
    const catalog = catalogs[language]
    expect(Object.keys(catalog).sort(), language).toEqual(allKeys)
    for (const message of Object.values(catalog)) {
      expect(message.trim().length, language).toBeGreaterThan(0)
    }
  }
})

test.each(languages)('translates messages in %s', (language) => {
  const names = { hu: 'Beállítások', en: 'Settings', de: 'Einstellungen' }
  expect(translate(language, 'navigation.settings')).toBe(names[language])
})

test.each([
  ['hu', 'hu-HU'],
  ['en', 'en-GB'],
  ['de', 'de-DE'],
] as const)('formats dates and numbers for %s', (language, locale) => {
  const format = createFormatters(language)
  const date = new Date('2026-01-15T12:00:00Z')
  const dateOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  } as const
  const numberOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }

  expect(format.date(date, dateOptions)).toBe(
    new Intl.DateTimeFormat(locale, dateOptions).format(date),
  )
  expect(format.date(date)).toBe(
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date),
  )
  expect(format.number(12345.67, numberOptions)).toBe(
    new Intl.NumberFormat(locale, numberOptions).format(12345.67),
  )
  expect(format.number(12345.67)).toBe(
    new Intl.NumberFormat(locale).format(12345.67),
  )
})
