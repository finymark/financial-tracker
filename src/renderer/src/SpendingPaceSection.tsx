import { useAmountFormatters, usePrivacy } from './lib/privacy'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { BaseCurrencyConversion } from '../../shared/exchange-rates'
import type {
  ReportDateRange,
  SpendingPaceComparison,
  SpendingPaceReport,
} from '../../shared/reports'
import { Button } from './components/ui/button'
import { type Language, type MessageKey } from './i18n'

interface SpendingPaceSectionProps {
  language: Language
  t(key: MessageKey): string
}

/** Self-contained so Overview can reuse the same API-backed comparison later. */
export function SpendingPaceSection({ language, t }: SpendingPaceSectionProps) {
  const format = useAmountFormatters(language)
  const { privacyMode } = usePrivacy()
  const [revision, setRevision] = useState(0)
  const key = useMemo(() => ({ language, revision }), [language, revision])
  const [result, setResult] = useState<{
    key: typeof key
    report: SpendingPaceReport | null
  } | null>(null)
  const currentResult = result?.key === key ? result : null
  const loading = currentResult === null
  const report = currentResult?.report

  useEffect(() => {
    let ignore = false
    void window.app.reports.spendingPace().then(
      (value) => {
        if (!ignore) setResult({ key, report: value })
      },
      () => {
        if (!ignore) setResult({ key, report: null })
      },
    )
    return () => {
      ignore = true
    }
  }, [key])

  useEffect(
    () =>
      window.app.rates.onStatusChanged(() => setRevision((value) => value + 1)),
    [],
  )

  function dateRange(range: ReportDateRange) {
    return `${format.date(new Date(`${range.from}T00:00:00`))} – ${format.date(new Date(`${range.to}T00:00:00`))}`
  }

  function amount(
    value: BaseCurrencyConversion | SpendingPaceComparison['average'],
  ) {
    return (
      <>
        <span>{format.amount(value.roundedMinor, value.baseCurrency)}</span>
        {value.stale && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {t('reports.provisional')}
          </span>
        )}
        {'unconverted' in value &&
          value.unconverted.map((item) => (
            <span
              key={item.currency}
              className="block text-xs font-normal text-muted-foreground"
            >
              {t('reports.unconverted')}:{' '}
              {format.amount(item.amountMinor, item.currency)}
            </span>
          ))}
      </>
    )
  }

  function average(comparison: SpendingPaceComparison) {
    return (
      <>
        {amount(comparison.average)}
        {comparison.previousMonths
          .filter((month) => month.total.unconverted.length > 0)
          .map((month) => (
            <span
              key={month.range.from}
              className="block text-xs font-normal text-muted-foreground"
            >
              {dateRange(month.range)} — {t('reports.unconverted')}:{' '}
              {month.total.unconverted.map((item) => (
                <span key={item.currency}>
                  {format.amount(item.amountMinor, item.currency)}{' '}
                </span>
              ))}
            </span>
          ))}
      </>
    )
  }

  function difference(comparison: SpendingPaceComparison) {
    return (
      <>
        <span className="font-medium">
          {t(`reports.pace.${comparison.direction}`)}
        </span>{' '}
        {format.amount(
          Math.abs(comparison.differenceMinor),
          comparison.current.baseCurrency,
        )}
        <span className="block text-xs font-normal text-muted-foreground">
          {comparison.percentageBasisPoints === null
            ? t('reports.pace.noBaseline')
            : format.amountText(
                `${format.number(Math.abs(comparison.percentageBasisPoints) / 100, { maximumFractionDigits: 2 })}%`,
              )}
        </span>
        {comparison.incomplete && (
          <span className="block text-xs text-muted-foreground">
            {t('reports.unconverted')}
          </span>
        )}
      </>
    )
  }

  const chartData = report
    ? [
        {
          name: t('reports.pace.current'),
          value: report.total.current.roundedMinor,
        },
        {
          name: t('reports.pace.average'),
          value: report.total.average.roundedMinor,
        },
      ]
    : []

  return (
    <section
      className="space-y-4 border-t pt-6"
      aria-labelledby="spending-pace-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="spending-pace-title" className="font-semibold">
          {t('reports.pace.title')}
        </h3>
        <Button
          variant="ghost"
          disabled={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          {t('reports.pace.refresh')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('reports.pace.description')}
      </p>
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('reports.loading')}
        </p>
      )}
      {!loading && !report && (
        <p role="alert" className="text-sm font-medium text-error">
          {t('reports.error')}
        </p>
      )}
      {report && (
        <>
          <p className="text-sm text-muted-foreground">
            {dateRange(report.range)}
          </p>
          {report.total.incomplete && (
            <p
              role="status"
              className="rounded-md border border-dashed p-3 text-sm"
            >
              {t('reports.pace.partial')}
            </p>
          )}
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">
                {t('reports.pace.current')}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">
                {amount(report.total.current)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                {t('reports.pace.average')}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">
                {average(report.total)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                {t('reports.pace.difference')}
              </dt>
              <dd className="text-xl tabular-nums">
                {difference(report.total)}
              </dd>
            </div>
          </dl>
          <div
            className={`h-48 w-full${privacyMode ? ' private-amount' : ''}`}
            role="img"
            aria-label={t('reports.pace.chartLabel')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 12, right: 16 }}
              >
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={150}
                  tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) =>
                    format.money(
                      Number(value),
                      report.total.current.baseCurrency,
                    )
                  }
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    color: 'var(--card-foreground)',
                    borderColor: 'var(--border)',
                  }}
                />
                <Bar
                  dataKey="value"
                  name={t('reports.amount')}
                  radius={[0, 5, 5, 0]}
                >
                  <Cell fill="var(--chart-1)" />
                  <Cell fill="var(--chart-2)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t('reports.pace.months')}</h4>
            <ul className="grid gap-3 sm:grid-cols-3">
              {report.total.previousMonths.map((month) => (
                <li
                  key={month.range.from}
                  className="rounded-md border p-3 text-sm"
                >
                  <p className="text-xs text-muted-foreground">
                    {dateRange(month.range)}
                  </p>
                  <p className="tabular-nums">{amount(month.total)}</p>
                </li>
              ))}
            </ul>
          </div>
          {report.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('reports.empty')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <caption className="p-3 text-left font-medium">
                  {t('reports.categories')}
                </caption>
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {t('transactions.category')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t('reports.pace.current')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t('reports.pace.average')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t('reports.pace.difference')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.categories.map((category) => (
                    <tr key={category.categoryId ?? 'uncategorized'}>
                      <th
                        scope="row"
                        className="border-t px-3 py-2 text-left font-medium"
                      >
                        {category.name ?? t('reports.uncategorized')}
                      </th>
                      <td className="border-t px-3 py-2 text-right tabular-nums">
                        {amount(category.current)}
                      </td>
                      <td className="border-t px-3 py-2 text-right tabular-nums">
                        {average(category)}
                      </td>
                      <td className="border-t px-3 py-2 text-right tabular-nums">
                        {difference(category)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
