import { reportError } from './lib/report-error'
import { useAmountFormatters, usePrivacy } from './lib/privacy'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TransactionListInput } from '../../shared/transactions'
import type {
  CategoryBreakdownCategory,
  CategoryBreakdownReport,
  ReportDateRangeInput,
  ReportPeriod,
} from '../../shared/reports'
import { CashFlowReport } from './CashFlowReport'
import { SpendingPaceSection } from './SpendingPaceSection'
import { Button } from './components/ui/button'
import { CardContent } from './components/ui/card'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import { type Language, type MessageKey } from './i18n'
import { MonthlyTrendReport } from './MonthlyTrendReport'
import { HelpHint } from './components/ui/help-hint'

interface ReportsPageProps {
  language: Language
  t(key: MessageKey): string
  onOpenTransactions(input: TransactionListInput): void
}

type ChartKind = 'pie' | 'bar'

const chartColors = Array.from(
  { length: 8 },
  (_, index) => `var(--chart-${index + 1})`,
)

export function ReportsPage({
  language,
  t,
  onOpenTransactions,
}: ReportsPageProps) {
  const format = useAmountFormatters(language)
  const { privacyMode } = usePrivacy()
  const [tab, setTab] = useState<'category' | 'trend' | 'pace' | 'cashFlow'>(
    'category',
  )
  const [filters, setFilters] = useState({
    period: 'thisMonth' as ReportPeriod,
    from: '',
    to: '',
  })
  const [request, setRequest] = useState<ReportDateRangeInput>({
    period: 'thisMonth',
  })
  const reportKey = useMemo(() => ({ request, language }), [request, language])
  const [result, setResult] = useState<{
    key: typeof reportKey
    report: CategoryBreakdownReport | null
    error: MessageKey | null
  } | null>(null)
  const currentResult = result?.key === reportKey ? result : null
  const report = currentResult?.report ?? null
  const loading = tab === 'category' && currentResult === null
  const error = currentResult?.error ?? null
  const [chartKind, setChartKind] = useState<ChartKind>('pie')
  const [selectedId, setSelectedId] = useState<string | null | undefined>()

  useEffect(() => {
    if (tab !== 'category') return
    let ignore = false
    void window.app.reports
      .categoryBreakdown(request)
      .then((value) => {
        if (!ignore) {
          setResult({ key: reportKey, report: value, error: null })
          setSelectedId(undefined)
        }
      })
      .catch((error: unknown) => {
        if (!ignore)
          setResult({ key: reportKey, report: null, error: reportError(error) })
      })
    return () => {
      ignore = true
    }
  }, [request, reportKey, tab])

  const chartData = useMemo(
    () =>
      (report?.categories ?? []).map((category) => ({
        id: category.categoryId ?? 'uncategorized',
        category,
        name: category.name ?? t('reports.uncategorized'),
        value: category.total.roundedMinor,
      })),
    [report, t],
  )
  const selected = report?.categories.find(
    (category) => category.categoryId === selectedId,
  )

  function apply(event: FormEvent) {
    event.preventDefault()
    setRequest(
      filters.period === 'custom'
        ? {
            period: 'custom',
            from: filters.from,
            to: filters.to,
          }
        : { period: filters.period },
    )
  }

  function openTransactions(categoryId: string | null, exactCategory = false) {
    if (!report) return
    onOpenTransactions({
      period: 'custom',
      from: report.range.from,
      to: report.range.to,
      kind: 'expense',
      exclusion: 'hideExcluded',
      ...(categoryId === null
        ? { uncategorized: true }
        : { categoryId, exactCategory }),
      limit: 200,
      offset: 0,
    })
  }

  function categoryName(category: CategoryBreakdownCategory): string {
    return category.name ?? t('reports.uncategorized')
  }

  function selectMainCategory(category: CategoryBreakdownCategory) {
    if (category.categoryId === null) openTransactions(null)
    else setSelectedId(category.categoryId)
  }

  return (
    <CardContent className="space-y-6">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('reports.view')}
      >
        <Button
          type="button"
          variant={tab === 'category' ? 'default' : 'ghost'}
          aria-pressed={tab === 'category'}
          onClick={() => setTab('category')}
        >
          {t('reports.title')}
        </Button>
        <Button
          type="button"
          variant={tab === 'trend' ? 'default' : 'ghost'}
          aria-pressed={tab === 'trend'}
          onClick={() => setTab('trend')}
        >
          {t('reports.trend.title')}
        </Button>
        <Button
          type="button"
          variant={tab === 'pace' ? 'default' : 'ghost'}
          aria-pressed={tab === 'pace'}
          onClick={() => setTab('pace')}
        >
          {t('reports.pace.title')}
        </Button>
        <Button
          type="button"
          variant={tab === 'cashFlow' ? 'default' : 'ghost'}
          aria-pressed={tab === 'cashFlow'}
          onClick={() => setTab('cashFlow')}
        >
          {t('reports.cashFlow.title')}
        </Button>
      </div>
      {tab !== 'pace' && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-md border p-3"
          onSubmit={apply}
          aria-label={t('reports.dateRange')}
        >
          <div className="flex items-center gap-1 self-center text-xs font-medium">
            {t('reports.dateRange')}
            <HelpHint
              t={t}
              topicKey="reports.dateRange"
              textKey="help.reports.dateRange"
            />
          </div>
          <label className="min-w-40 space-y-1 text-xs font-medium">
            {t('transactions.period')}
            <NativeSelect
              value={filters.period}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  period: event.target.value as ReportPeriod,
                })
              }
            >
              {(
                [
                  'thisMonth',
                  'lastMonth',
                  'thisYear',
                  'last12Months',
                  'custom',
                ] as const
              ).map((period) => (
                <option key={period} value={period}>
                  {t(`reports.period.${period}`)}
                </option>
              ))}
            </NativeSelect>
          </label>
          {filters.period === 'custom' && (
            <>
              <label className="space-y-1 text-xs font-medium">
                {t('transactions.from')}
                <Input
                  type="date"
                  value={filters.from}
                  required
                  onChange={(event) =>
                    setFilters({ ...filters, from: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1 text-xs font-medium">
                {t('transactions.to')}
                <Input
                  type="date"
                  value={filters.to}
                  min={filters.from || undefined}
                  required
                  onChange={(event) =>
                    setFilters({ ...filters, to: event.target.value })
                  }
                />
              </label>
            </>
          )}
          <Button type="submit" disabled={loading}>
            {t('reports.apply')}
          </Button>
        </form>
      )}

      {tab === 'cashFlow' && (
        <CashFlowReport request={request} language={language} t={t} />
      )}
      {tab === 'trend' && (
        <MonthlyTrendReport request={request} language={language} t={t} />
      )}
      {tab === 'category' && loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('reports.loading')}
        </p>
      )}
      {tab === 'category' && error && (
        <p role="alert" className="text-sm font-medium text-error">
          {t(error)}
        </p>
      )}
      {tab === 'category' && !loading && !error && report && (
        <>
          <section className="space-y-3" aria-labelledby="report-total">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3
                  id="report-total"
                  className="flex items-center gap-1 text-sm font-medium"
                >
                  {t('reports.total')}
                  <HelpHint
                    t={t}
                    topicKey="reports.title"
                    textKey="help.reports.category"
                  />
                </h3>
                <p className="text-2xl font-semibold tabular-nums">
                  {format.amount(
                    report.total.roundedMinor,
                    report.total.baseCurrency,
                  )}
                  {report.total.stale && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {t('reports.provisional')}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2" aria-label={t('reports.chartType')}>
                <Button
                  type="button"
                  variant={chartKind === 'pie' ? 'default' : 'ghost'}
                  aria-pressed={chartKind === 'pie'}
                  onClick={() => setChartKind('pie')}
                >
                  {t('reports.pie')}
                </Button>
                <Button
                  type="button"
                  variant={chartKind === 'bar' ? 'default' : 'ghost'}
                  aria-pressed={chartKind === 'bar'}
                  onClick={() => setChartKind('bar')}
                >
                  {t('reports.bar')}
                </Button>
              </div>
            </div>
            {report.total.unconverted.length > 0 && (
              <div className="rounded-md border border-dashed p-3 text-sm">
                <p className="font-medium">{t('reports.unconverted')}</p>
                {report.total.unconverted.map((item) => (
                  <p key={item.currency} className="tabular-nums">
                    {format.amount(item.amountMinor, item.currency)}
                  </p>
                ))}
              </div>
            )}
          </section>

          {chartData.length === 0 ? (
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              {t('reports.empty')}
            </p>
          ) : (
            <div
              className={`h-80 w-full${privacyMode ? ' private-amount' : ''}`}
              role="img"
              aria-label={t('reports.chartLabel')}
            >
              <ResponsiveContainer width="100%" height="100%">
                {chartKind === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="42%"
                      outerRadius="78%"
                      onClick={(entry) =>
                        selectMainCategory(
                          (entry.payload as (typeof chartData)[number])
                            .category,
                        )
                      }
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={entry.id}
                          fill={chartColors[index % chartColors.length]}
                          stroke="var(--background)"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        format.money(Number(value), report.total.baseCurrency)
                      }
                      contentStyle={{
                        background: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--card-foreground)',
                      }}
                      itemStyle={{ color: 'var(--card-foreground)' }}
                    />
                  </PieChart>
                ) : (
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
                        format.money(Number(value), report.total.baseCurrency)
                      }
                      contentStyle={{
                        background: 'var(--card)',
                        borderColor: 'var(--border)',
                        color: 'var(--card-foreground)',
                      }}
                      itemStyle={{ color: 'var(--card-foreground)' }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 5, 5, 0]}
                      onClick={(entry) =>
                        selectMainCategory(
                          (entry.payload as (typeof chartData)[number])
                            .category,
                        )
                      }
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={entry.id}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          <section className="space-y-3" aria-labelledby="breakdown-table">
            <div className="flex items-center gap-2">
              {selected && (
                <Button
                  variant="ghost"
                  onClick={() => setSelectedId(undefined)}
                >
                  {t('reports.back')}
                </Button>
              )}
              <h3 id="breakdown-table" className="font-medium">
                {selected
                  ? `${categoryName(selected)} — ${t('reports.subcategories')}`
                  : t('reports.categories')}
              </h3>
              <HelpHint
                t={t}
                topicKey="reports.categories"
                textKey="help.reports.breakdown"
              />
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
                  {(selected ? selected.subcategories : report.categories).map(
                    (category) => {
                      const name = category.name ?? t('reports.uncategorized')
                      return (
                        <tr key={category.categoryId ?? 'uncategorized'}>
                          <td className="border-t px-3 py-2">
                            <button
                              type="button"
                              className="font-medium text-primary hover:underline"
                              onClick={() => {
                                if (selected)
                                  openTransactions(
                                    category.categoryId,
                                    category.categoryId === selected.categoryId,
                                  )
                                else if (category.categoryId === null)
                                  openTransactions(null)
                                else setSelectedId(category.categoryId)
                              }}
                            >
                              {name}
                            </button>
                          </td>
                          <td className="border-t px-3 py-2 text-right tabular-nums">
                            {format.amount(
                              category.total.roundedMinor,
                              category.total.baseCurrency,
                            )}
                            {category.total.unconverted.map((item) => (
                              <span
                                key={item.currency}
                                className="block text-xs text-muted-foreground"
                              >
                                {t('reports.unconverted')}:{' '}
                                {format.amount(item.amountMinor, item.currency)}
                              </span>
                            ))}
                          </td>
                          <td className="border-t px-3 py-2 text-right tabular-nums">
                            {format.amountText(
                              format.number(category.shareBasisPoints / 100, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              }),
                            )}
                            %
                          </td>
                        </tr>
                      )
                    },
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('reports.drillHint')}
            </p>
          </section>
        </>
      )}
      {tab === 'pace' && <SpendingPaceSection language={language} t={t} />}
    </CardContent>
  )
}
