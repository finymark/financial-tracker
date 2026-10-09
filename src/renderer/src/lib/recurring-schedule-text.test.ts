import { expect, test } from 'vitest'
import { translate, type Language } from '../i18n'
import { recurringScheduleText } from './recurring-schedule-text'

const text = (language: Language) => (key: Parameters<typeof translate>[1]) =>
  translate(language, key)

test('omits the interval for schedules that repeat every month or week', () => {
  expect(
    recurringScheduleText(
      { type: 'monthly', day: 15, intervalMonths: 1 },
      'hu',
      text('hu'),
    ),
  ).toBe('Havonta · 15.')
  expect(
    recurringScheduleText(
      { type: 'weekly', weekday: 1, intervalWeeks: 1 },
      'en',
      text('en'),
    ),
  ).toBe('Monday')
})

test.each([
  ['hu', '3 havonta · 15.', 'Hétfő · 2 hetente'],
  ['en', 'every 3 months · 15.', 'Monday · every 2 weeks'],
  ['de', 'alle 3 Monate · 15.', 'Montag · alle 2 Wochen'],
] as const)('formats longer intervals in %s', (language, monthly, weekly) => {
  expect(
    recurringScheduleText(
      { type: 'monthly', day: 15, intervalMonths: 3 },
      language,
      text(language),
    ),
  ).toBe(monthly)
  expect(
    recurringScheduleText(
      { type: 'weekly', weekday: 1, intervalWeeks: 2 },
      language,
      text(language),
    ),
  ).toBe(weekly)
})

test.each([
  ['hu', 'Évente · március 15.'],
  ['en', 'Yearly · 15 March'],
  ['de', 'Jährlich · 15. März'],
] as const)(
  'formats yearly month and day with the %s locale',
  (language, expected) => {
    expect(
      recurringScheduleText(
        { type: 'yearly', month: 3, day: 15 },
        language,
        text(language),
      ),
    ).toBe(expected)
  },
)
