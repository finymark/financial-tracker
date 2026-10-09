import type { RecurringSchedule } from '../../../shared/recurring'
import { createFormatters, type Language, type MessageKey } from '../i18n'

type Translate = (key: MessageKey) => string

function intervalText(
  interval: number,
  key: 'recurring.interval.months' | 'recurring.interval.weeks',
  t: Translate,
): string | undefined {
  return interval > 1 ? t(key).replace('{n}', String(interval)) : undefined
}

export function recurringScheduleText(
  schedule: RecurringSchedule,
  language: Language,
  t: Translate,
): string {
  if (schedule.type === 'monthly')
    return [
      intervalText(schedule.intervalMonths, 'recurring.interval.months', t) ??
        t('recurring.schedule.monthly'),
      `${schedule.day}.`,
    ].join(' · ')
  if (schedule.type === 'weekly') {
    const interval = intervalText(
      schedule.intervalWeeks,
      'recurring.interval.weeks',
      t,
    )
    const weekday = t(`recurring.weekday.${schedule.weekday}` as MessageKey)
    return interval ? `${weekday} · ${interval}` : weekday
  }

  const date = new Date(Date.UTC(2000, schedule.month - 1, schedule.day))
  const formattedDate = createFormatters(language).date(date, {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  return `${t('recurring.schedule.yearly')} · ${formattedDate}`
}
