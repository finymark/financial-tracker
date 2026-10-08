import { describe, expect, test } from 'vitest'
import { dueDates, type RecurringSchedule } from './recurring'

describe('dueDates', () => {
  test('monthly schedules clamp day 31 and keep every-N-month anchors at the start month', () => {
    const schedule: RecurringSchedule = {
      type: 'monthly',
      day: 31,
      intervalMonths: 2,
    }
    expect(
      dueDates(schedule, '2025-01-15', null, '2025-01-01', '2025-08-31'),
    ).toEqual(['2025-01-31', '2025-03-31', '2025-05-31', '2025-07-31'])
    expect(
      dueDates(
        { ...schedule, intervalMonths: 1 },
        '2024-01-01',
        null,
        '2024-01-01',
        '2024-03-31',
      ),
    ).toEqual(['2024-01-31', '2024-02-29', '2024-03-31'])
    expect(
      dueDates(
        { ...schedule, intervalMonths: 1 },
        '2025-01-01',
        null,
        '2025-01-01',
        '2025-03-31',
      ),
    ).toEqual(['2025-01-31', '2025-02-28', '2025-03-31'])
  })

  test('weekly schedules use the first selected weekday on or after start as their every-N-week anchor', () => {
    const schedule: RecurringSchedule = {
      type: 'weekly',
      weekday: 1,
      intervalWeeks: 2,
    }
    expect(
      dueDates(schedule, '2026-01-01', null, '2025-12-01', '2026-02-28'),
    ).toEqual(['2026-01-05', '2026-01-19', '2026-02-02', '2026-02-16'])
  })

  test('yearly schedules clamp leap day without shifting the yearly anchor', () => {
    const schedule: RecurringSchedule = { type: 'yearly', month: 2, day: 29 }
    expect(
      dueDates(schedule, '2023-01-01', null, '2023-01-01', '2028-12-31'),
    ).toEqual([
      '2023-02-28',
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ])
  })

  test('start and end are inclusive while the generation cursor is exclusive and today inclusive', () => {
    const schedule: RecurringSchedule = {
      type: 'monthly',
      day: 10,
      intervalMonths: 1,
    }
    expect(
      dueDates(
        schedule,
        '2026-01-10',
        '2026-04-10',
        '2026-01-10',
        '2026-05-10',
      ),
    ).toEqual(['2026-02-10', '2026-03-10', '2026-04-10'])
    expect(
      dueDates(
        schedule,
        '2026-01-11',
        '2026-03-09',
        '2025-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-02-10'])
  })
})
