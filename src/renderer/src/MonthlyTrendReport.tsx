import { reportError } from './lib/report-error'
import { useAmountFormatters, usePrivacy } from './lib/privacy'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { BaseCurrencyConversion } from '../../shared/exchange-rates'
import type {
  MonthlyTrendReport as TrendReport,
  ReportDateRangeInput,
} from '../../shared/reports'
import { type Language, type MessageKey } from './i18n'
import { HelpHint } from './components/ui/help-hint'

interface MonthlyTrendReportProps {
  request: ReportDateRangeInput
  language: Language
  t(key: MessageKey): string
}

export function MonthlyTrendReport({
  request,
  language,
  t,
}: MonthlyTrendReportProps) {
  const format = useAmountFormatters(language)
  const { privacyMode } = usePrivacy()
  const reportKey = useMemo(() => ({ request, language }), [request, language])
  const [result, setResult] = useState<{
    key: typeof reportKey
    report: TrendReport | null
    error: MessageKey | null
  } | null>(null)
  const currentResult = result?.key === reportKey ? result : null
  const report = currentResult?.report ?? null

  useEffect(() => {
    let ignore = false
    void window.app.reports
      .monthlyTrend(request)
      .then((value) => {
        if (!ignore) setResult({ key: reportKey, report: value, error: null })
      })
      .catch((error: unknown) => {
        if (!ignore)
          setResult({ key: reportKey, report: null, error: reportError(error) })
      })
    return () => {
      ignore = true
    }
  }, [request, reportKey])

  function monthLabel(month: string, partial: boolean): string {
    const label = format.date(new Date(`${month}-01T00:00:00Z`), {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    return partial ? `${label} (${t('reports.trend.partial')})` : label
  }

  function totalCell(total: BaseCurrencyConversion) {
    return (
      <>
        {format.amount(total.roundedMinor, total.baseCurrency)}
        {total.stale && (
          <span className="block text-xs text-muted-foreground">
            {t('reports.provisional')}
          </span>
        )}
        {total.unconverted.map((item) => (
          <span
            key={item.currency}
            className="block text-xs text-muted-foreground"
          >
            {t('reports.unconverted')}:{' '}
            {format.amount(item.amountMinor, item.currency)}
          </span>
        ))}
      </>
    )
  }

  if (!currentResult)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t('reports.loading')}
      </p>
    )
  if (currentResult.error || !report)
    return (
      <p role="alert" className="text-sm font-medium text-error">
        {t(currentResult.error ?? 'reports.error')}
      </p>
    )

  const chartData = report.months.map((month) => ({
    label: monthLabel(month.month, month.partial),
    expenses: month.expenses.roundedMinor,
    incomes: month.incomes.roundedMinor,
    net: month.net.roundedMinor,
  }))
  const currency = report.months[0].expenses.baseCurrency
  const provisional = report.months.some(
    (month) => month.expenses.stale || month.incomes.stale || month.net.stale,
  )
  const unconverted = report.months.some(
    (month) =>
      month.expenses.unconverted.length > 0 ||
      month.incomes.unconverted.length > 0,
  )

  return (
    <section className="space-y-4" aria-labelledby="monthly-trend-title">
      <div>
        <h3
          id="monthly-trend-title"
          className="flex items-center gap-1 font-medium"
        >
          {t('reports.trend.title')}
          <HelpHint
            t={t}
            topicKey="reports.trend.title"
            textKey="help.reports.trend"
          />
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('reports.trend.description')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('reports.trend.partialHint')}
        </p>
        {provisional && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('reports.provisional')}
          </p>
        )}
        {unconverted && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t('reports.trend.unconvertedHint')}
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <div
          className={`h-80 w-full${privacyMode ? ' private-amount' : ''}`}
          style={{ minWidth: Math.max(600, report.months.length * 72) }}
          role="img"
          aria-label={t('reports.trend.chartLabel')}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ left: 24, right: 16, top: 8 }}
            >
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                width={110}
                tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) =>
                  format.money(Math.round(value), currency)
                }
              />
              <Tooltip
                formatter={(value) => format.money(Number(value), currency)}
                cursor={{ fill: 'var(--muted)' }}
                contentStyle={{
                  background: 'var(--card)',
                  color: 'var(--card-foreground)',
                  borderColor: 'var(--border)',
                }}
              />
              <Legend />
              <Bar
                dataKey="expenses"
                name={t('reports.trend.expenses')}
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="incomes"
                name={t('reports.trend.incomes')}
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                dataKey="net"
                name={t('reports.trend.net')}
                stroke="var(--chart-3)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--chart-3)' }}
                type="linear"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <caption className="sr-only">{t('reports.trend.title')}</caption>
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2 font-medium" scope="col">
                {t('reports.trend.month')}
              </th>
              <th className="px-3 py-2 text-right font-medium" scope="col">
                {t('reports.trend.expenses')}
              </th>
              <th className="px-3 py-2 text-right font-medium" scope="col">
                {t('reports.trend.incomes')}
              </th>
              <th className="px-3 py-2 text-right font-medium" scope="col">
                {t('reports.trend.net')}
              </th>
            </tr>
          </thead>
          <tbody>
            {report.months.map((month) => (
              <tr key={month.month}>
                <th
                  className="border-t px-3 py-2 text-left font-medium"
                  scope="row"
                >
                  {monthLabel(month.month, month.partial)}
                  {month.partial && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {format.date(new Date(`${month.range.from}T00:00:00Z`), {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      })}{' '}
                      –{' '}
                      {format.date(new Date(`${month.range.to}T00:00:00Z`), {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      })}
                    </span>
                  )}
                </th>
                <td className="border-t px-3 py-2 text-right tabular-nums">
                  {totalCell(month.expenses)}
                </td>
                <td className="border-t px-3 py-2 text-right tabular-nums">
                  {totalCell(month.incomes)}
                </td>
                <td className="border-t px-3 py-2 text-right tabular-nums">
                  {totalCell(month.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
