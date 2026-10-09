import type { RecurringSchedule } from '../../../shared/recurring'
import { createFormatters, type Language, type MessageKey } from '../i18n'

type Translate = (key: MessageKey) => string

function withInterval(
  parts: string[],
  interval: number,
  key: 'recurring.interval.months' | 'recurring.interval.weeks',
  t: Translate,
): string {
  if (interval > 1) parts.push(t(key).replace('{n}', String(interval)))
  return parts.join(' · ')
}

export function recurringScheduleText(
  schedule: RecurringSchedule,
  language: Language,
  t: Translate,
): string {
  if (schedule.type === 'monthly')
    return withInterval(
      [t('recurring.schedule.monthly'), `${schedule.day}.`],
      schedule.intervalMonths,
      'recurring.interval.months',
      t,
    )
  if (schedule.type === 'weekly')
    return withInterval(
      [t(`recurring.weekday.${schedule.weekday}` as MessageKey)],
      schedule.intervalWeeks,
      'recurring.interval.weeks',
      t,
    )

  const date = new Date(Date.UTC(2000, schedule.month - 1, schedule.day))
  const formattedDate = createFormatters(language).date(date, {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return `${t('recurring.schedule.yearly')} · ${formattedDate}`
}
