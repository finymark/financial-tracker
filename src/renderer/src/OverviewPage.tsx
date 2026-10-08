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
import type { OverviewDashboard } from '../../shared/report-overview'
import type { TransactionListInput } from '../../shared/transactions'
import { Button } from './components/ui/button'
import { CardContent } from './components/ui/card'
import { HelpHint } from './components/ui/help-hint'
import { type Language, type MessageKey } from './i18n'

interface OverviewPageProps {
  language: Language
  t(key: MessageKey): string
  onOpenReports(): void
  onOpenTransactions(input: TransactionListInput): void
}

export function OverviewPage({
  language,
  t,
  onOpenReports,
  onOpenTransactions,
}: OverviewPageProps) {
  const format = useAmountFormatters(language)
  const { privacyMode } = usePrivacy()
  const requestKey = useMemo(() => ({ language }), [language])
  const [result, setResult] = useState<{
    key: typeof requestKey
    report: OverviewDashboard | null
    error: boolean
  } | null>(null)
  const currentResult = result?.key === requestKey ? result : null
  const report = currentResult?.report ?? null

  useEffect(() => {
    let ignore = false
    let latestRequest = 0
    const load = () => {
      const request = ++latestRequest
      void window.app.reports
        .overviewDashboard()
        .then((value) => {
          if (!ignore && request === latestRequest)
            setResult({ key: requestKey, report: value, error: false })
        })
        .catch(() => {
          if (!ignore && request === latestRequest)
            setResult({ key: requestKey, report: null, error: true })
        })
    }
    load()
    const unsubscribe = window.app.rates.onStatusChanged(load)
    window.addEventListener('focus', load)
    return () => {
      ignore = true
      unsubscribe()
      window.removeEventListener('focus', load)
    }
  }, [requestKey])

  function amount(total: BaseCurrencyConversion, showSign = false) {
    return (
      <>
        <span className="tabular-nums">
          {showSign && total.roundedMinor > 0 ? '+' : ''}
          {format.amount(total.roundedMinor, total.baseCurrency)}
        </span>
        {total.stale && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {t('reports.provisional')}
          </span>
        )}
        {total.unconverted.map((item) => (
          <span
            key={item.currency}
            className="mt-1 block text-xs font-normal text-muted-foreground"
          >
            {t('reports.unconverted')}:{' '}
            {showSign && item.amountMinor > 0 ? '+' : ''}
            {format.amount(item.amountMinor, item.currency)}
          </span>
        ))}
      </>
    )
  }

  function rangeLabel(range: { from: string; to: string }) {
    const date = (value: string) =>
      format.date(new Date(`${value}T00:00:00Z`), {
        dateStyle: 'medium',
        timeZone: 'UTC',
      })
    return `${date(range.from)} – ${date(range.to)}`
  }

  function openTransactions(
    kind: 'expense' | 'income',
    categoryId?: string | null,
  ) {
    if (!report) return
    onOpenTransactions({
      period: 'custom',
      ...report.thisMonth.range,
      kind,
      exclusion: 'hideExcluded',
      ...(categoryId === null
        ? { uncategorized: true }
        : categoryId
          ? { categoryId }
          : {}),
      limit: 200,
      offset: 0,
    })
  }

  const chartData = (report?.topCategories ?? []).map((category) => ({
    name: category.name ?? t('reports.uncategorized'),
    value: category.total.roundedMinor,
    id: category.categoryId ?? 'uncategorized',
  }))

  return (
    <CardContent className="space-y-6">
      {!currentResult && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('reports.loading')}
        </p>
      )}
      {currentResult?.error && (
        <p role="alert" className="text-sm font-medium text-error">
          {t('overview.error')}
        </p>
      )}
      {report && (
        <>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              <span className="font-medium">
                {t('overview.thisMonthToDate')}:
              </span>{' '}
              {rangeLabel(report.thisMonth.range)}
            </p>
            <p>
              <span className="font-medium">
                {t('overview.fullLastMonth')}:
              </span>{' '}
              {rangeLabel(report.lastMonth.range)}
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {(['expenses', 'incomes', 'net'] as const).map((key) => (
              <section
                key={key}
                aria-labelledby={`overview-${key}`}
                className="space-y-3 rounded-lg border p-4"
              >
                <h3
                  id={`overview-${key}`}
                  className="flex items-center gap-1 font-medium"
                >
                  {t(`overview.${key}`)}
                  <HelpHint
                    t={t}
                    topicKey={`overview.${key}`}
                    textKey={`help.overview.${key}`}
                  />
                </h3>
                <p className="text-2xl font-semibold">
                  {amount(report.thisMonth[key])}
                </p>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">
                      {t('overview.fullLastMonth')}
                    </dt>
                    <dd>{amount(report.lastMonth[key])}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t('overview.change')}
                    </dt>
                    <dd>{amount(report.change[key], true)}</dd>
                  </div>
                </dl>
                {key !== 'net' && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      openTransactions(
                        key === 'expenses' ? 'expense' : 'income',
                      )
                    }
                  >
                    {t('overview.transactions')}
                  </Button>
                )}
              </section>
            ))}
          </div>
          <section
            className="space-y-3"
            aria-labelledby="overview-top-categories"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3
                id="overview-top-categories"
                className="flex items-center gap-1 font-medium"
              >
                {t('overview.topCategories')}
                <HelpHint
                  t={t}
                  topicKey="overview.topCategories"
                  textKey="help.overview.topCategories"
                />
              </h3>
              <Button variant="ghost" onClick={onOpenReports}>
                {t('overview.reports')}
              </Button>
            </div>
            {chartData.length === 0 ? (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                {t('reports.empty')}
              </p>
            ) : (
              <>
                <div
                  className={`h-64 w-full${privacyMode ? ' private-amount' : ''}`}
                  role="img"
                  aria-label={t('overview.chartLabel')}
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
                        width={120}
                        tick={{ fill: 'var(--foreground)', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value) =>
                          format.money(
                            Number(value),
                            report.thisMonth.expenses.baseCurrency,
                          )
                        }
                        contentStyle={{
                          background: 'var(--card)',
                          borderColor: 'var(--border)',
                          color: 'var(--card-foreground)',
                        }}
                        itemStyle={{ color: 'var(--card-foreground)' }}
                      />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={entry.id}
                            fill={`var(--chart-${index + 1})`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">
                          {t('transactions.category')}
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          {t('reports.amount')}
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          {t('reports.share')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topCategories.map((category) => (
                        <tr key={category.categoryId ?? 'uncategorized'}>
                          <td className="border-t px-3 py-2">
                            <button
                              type="button"
                              className="font-medium text-primary hover:underline"
                              onClick={() =>
                                openTransactions('expense', category.categoryId)
                              }
                            >
                              {category.name ?? t('reports.uncategorized')}
                            </button>
                          </td>
                          <td className="border-t px-3 py-2 text-right">
                            {amount(category.total)}
                          </td>
                          <td className="border-t px-3 py-2 text-right tabular-nums">
                            {format.amountText(
                              format.number(category.shareBasisPoints / 100, {
                                maximumFractionDigits: 2,
                              }),
                            )}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              {t('overview.shareHint')}
            </p>
          </section>
        </>
      )}
    </CardContent>
  )
}
