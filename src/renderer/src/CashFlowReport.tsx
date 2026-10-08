import { reportError } from './lib/report-error'
import { useAmountFormatters, usePrivacy } from './lib/privacy'
import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  Sankey,
  Tooltip,
  type SankeyNodeProps,
} from 'recharts'
import type {
  CashFlowNode,
  CashFlowReport as CashFlowData,
} from '../../shared/report-cash-flow'
import type { ReportDateRangeInput } from '../../shared/reports'
import { type Language, type MessageKey } from './i18n'
import { HelpHint } from './components/ui/help-hint'

interface CashFlowReportProps {
  request: ReportDateRangeInput
  language: Language
  t(key: MessageKey): string
}

const nodeColors: Record<CashFlowNode['kind'], string> = {
  income: 'var(--chart-2)',
  expense: 'var(--chart-1)',
  center: 'var(--chart-3)',
  deficit: 'var(--chart-5)',
  surplus: 'var(--chart-6)',
}

export function CashFlowReport({ request, language, t }: CashFlowReportProps) {
  const format = useAmountFormatters(language)
  const { privacyMode } = usePrivacy()
  const reportKey = useMemo(() => ({ request, language }), [request, language])
  const [result, setResult] = useState<{
    key: typeof reportKey
    report: CashFlowData | null
    error: MessageKey | null
  } | null>(null)
  const currentResult = result?.key === reportKey ? result : null
  const report = currentResult?.report ?? null

  useEffect(() => {
    let ignore = false
    void window.app.reports
      .cashFlow(request)
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

  function nodeName(node: CashFlowNode): string {
    if (node.name !== null) return node.name
    switch (node.kind) {
      case 'income':
        return t('reports.cashFlow.uncategorizedIncome')
      case 'expense':
        return t('reports.cashFlow.uncategorizedExpense')
      case 'center':
        return t('reports.cashFlow.income')
      case 'deficit':
        return t('reports.cashFlow.deficit')
      case 'surplus':
        return t('reports.cashFlow.surplus')
    }
  }

  const data = report
    ? {
        nodes: report.nodes.map((node) => ({ ...node, name: nodeName(node) })),
        links: report.links,
      }
    : null

  function drawNode({ x, y, width, height, index }: SankeyNodeProps) {
    const node = data!.nodes[index]
    const source = node.kind === 'income' || node.kind === 'deficit'
    const central = node.kind === 'center'
    return (
      <g>
        <title>
          {node.name} — {format.money(node.value, report!.baseCurrency)}
        </title>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={nodeColors[node.kind]}
        />
        <text
          x={central ? x + width / 2 : source ? x - 8 : x + width + 8}
          y={central ? y - 8 : y + height / 2}
          textAnchor={central ? 'middle' : source ? 'end' : 'start'}
          dominantBaseline={central ? 'auto' : 'central'}
          fill="var(--foreground)"
          fontSize={12}
        >
          {node.name.length > 24 ? `${node.name.slice(0, 23)}…` : node.name}
        </text>
      </g>
    )
  }

  if (!currentResult)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t('reports.loading')}
      </p>
    )
  if (currentResult.error || !report || !data)
    return (
      <p role="alert" className="text-sm font-medium text-error">
        {t(currentResult.error ?? 'reports.error')}
      </p>
    )

  return (
    <section className="space-y-4" aria-labelledby="cash-flow-title">
      <div>
        <h3
          id="cash-flow-title"
          className="flex items-center gap-1 font-medium"
        >
          {t('reports.cashFlow.title')}
          <HelpHint
            t={t}
            topicKey="reports.cashFlow.title"
            textKey="help.reports.cashFlow"
          />
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('reports.cashFlow.description')}
        </p>
        {report.stale && (
          <p className="text-sm text-muted-foreground">
            {t('reports.provisional')}
          </p>
        )}
      </div>
      {report.unconverted.length > 0 && (
        <div className="rounded-md border border-dashed p-3 text-sm">
          <p className="font-medium">{t('reports.unconverted')}</p>
          {report.unconverted.map((item) => (
            <div key={item.currency} className="tabular-nums">
              <p>
                {t('reports.cashFlow.income')}:{' '}
                {format.amount(item.incomeMinor, item.currency)}
              </p>
              <p>
                {t('reports.cashFlow.expense')}:{' '}
                {format.amount(item.expenseMinor, item.currency)}
              </p>
            </div>
          ))}
        </div>
      )}
      {data.nodes.length === 0 ? (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {t('reports.cashFlow.empty')}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div
              className={`min-w-160 w-full${privacyMode ? ' private-amount' : ''}`}
              style={{ height: Math.max(320, data.nodes.length * 32) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={data}
                  node={drawNode}
                  nodeWidth={14}
                  nodePadding={20}
                  sort={false}
                  margin={{ top: 28, bottom: 16, left: 170, right: 170 }}
                  link={{ stroke: 'var(--chart-4)', strokeOpacity: 0.3 }}
                  title={t('reports.cashFlow.title')}
                  desc={t('reports.cashFlow.description')}
                >
                  <Tooltip
                    formatter={(value) =>
                      format.money(Number(value), report.baseCurrency)
                    }
                    contentStyle={{
                      background: 'var(--card)',
                      borderColor: 'var(--border)',
                      color: 'var(--card-foreground)',
                    }}
                    itemStyle={{ color: 'var(--card-foreground)' }}
                  />
                </Sankey>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                {t('reports.cashFlow.title')}
              </caption>
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t('transactions.category')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t('reports.amount')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.nodes
                  .filter((node) => node.kind !== 'center')
                  .map((node, index) => (
                    <tr key={index}>
                      <td className="border-t px-3 py-2">{node.name}</td>
                      <td className="border-t px-3 py-2 text-right tabular-nums">
                        {format.amount(node.value, report.baseCurrency)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('reports.cashFlow.rounding')}
          </p>
        </>
      )}
    </section>
  )
}
