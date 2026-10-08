import { useState } from 'react'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Pencil,
  Copy,
  Scale,
  Trash2,
} from 'lucide-react'
import type { AccountOption } from '../../../shared/accounts'
import type { Category } from '../../../shared/categories'
import type {
  Transaction,
  TransactionLine,
  TransactionPage,
  TransactionTotals,
} from '../../../shared/transactions'
import type { Transfer } from '../../../shared/transfers'
import type { BalanceAdjustment } from '../../../shared/adjustments'
import { createFormatters, type Language, type MessageKey } from '../i18n'
import { Button } from './ui/button'

interface Props {
  page: TransactionPage
  accounts: AccountOption[]
  categories: Category[]
  language: Language
  t(key: MessageKey): string
  busy: boolean
  onDuplicate(transaction: Transaction): void
  onEdit(transaction: Transaction | Transfer | BalanceAdjustment): void
  onDelete(transaction: Transaction | Transfer | BalanceAdjustment): void
}

export function Totals({
  totals,
  language,
  t,
}: Pick<Props, 'language' | 't'> & { totals: TransactionTotals[] }) {
  const format = createFormatters(language)
  return (
    <span className="inline-flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
      {totals.map((total) => (
        <span
          key={total.currency}
          className="inline-flex items-center gap-1 whitespace-nowrap"
        >
          <ArrowUpRight aria-hidden="true" className="size-3" />
          <span className="sr-only">{t('transactions.expense')}</span>−
          {format.money(total.expenseMinor, total.currency)}
          <ArrowDownLeft aria-hidden="true" className="ml-2 size-3" />
          <span className="sr-only">{t('transactions.income')}</span>+
          {format.money(total.incomeMinor, total.currency)}
        </span>
      ))}
    </span>
  )
}

// Fixed-height rows keep windowing small and dependency-free. Overscan permits
// nearby keyboard focus; only the visible window is mounted, even on a full page.
const ROW_HEIGHT = 40
const VIEWPORT_HEIGHT = 480
const OVERSCAN = 4

export function TransactionTable({
  page,
  accounts,
  categories,
  language,
  t,
  busy,
  onEdit,
  onDelete,
  onDuplicate,
}: Props) {
  const [scrollTop, setScrollTop] = useState(0)
  const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set())
  const format = createFormatters(language)
  const items: (
    | { day: string }
    | { transaction: Transaction | Transfer | BalanceAdjustment }
    | { part: TransactionLine; parent: Transaction; partIndex: number }
  )[] = []
  let day = ''
  for (const transaction of page.rows) {
    if (day !== transaction.date) {
      day = transaction.date
      items.push({ day })
    }
    items.push({ transaction })
    if (
      (transaction.kind === 'expense' || transaction.kind === 'income') &&
      transaction.lines.length > 1 &&
      expandedSplits.has(transaction.id)
    ) {
      transaction.lines.forEach((part, partIndex) =>
        items.push({ part, parent: transaction, partIndex }),
      )
    }
  }
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(
    items.length,
    start + Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2,
  )
  return (
    <div
      className="overflow-auto rounded-md border"
      style={{ height: VIEWPORT_HEIGHT }}
      tabIndex={0}
      aria-label={t('navigation.transactions')}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <table
        className="w-full min-w-[950px] table-fixed text-sm"
        aria-rowcount={items.length + 1}
      >
        <thead className="sticky top-0 z-10 bg-background text-left">
          <tr style={{ height: ROW_HEIGHT }}>
            <th className="w-[18%] px-3">{t('transactions.payee')}</th>
            <th className="w-[14%] px-3">{t('transactions.account')}</th>
            <th className="w-[14%] px-3">{t('transactions.category')}</th>
            <th className="w-[14%] px-3">{t('tags.title')}</th>
            <th className="w-[14%] px-3">{t('transactions.note')}</th>
            <th className="w-[14%] px-3 text-right">
              {t('transactions.amount')}
            </th>
            <th className="w-[12%] px-3">
              <span className="sr-only">{t('transactions.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {start > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={7}
                style={{ height: start * ROW_HEIGHT, padding: 0 }}
              />
            </tr>
          )}
          {items.slice(start, end).map((item, index) => {
            if ('day' in item)
              return (
                <tr
                  key={item.day}
                  aria-rowindex={start + index + 2}
                  className="bg-muted"
                  style={{ height: ROW_HEIGHT }}
                >
                  <th
                    scope="rowgroup"
                    colSpan={7}
                    className="px-3 text-left font-medium"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="shrink-0">
                        {format.date(new Date(`${item.day}T00:00:00`))}
                      </span>
                      <span className="min-w-0 overflow-x-auto whitespace-nowrap text-xs [&>span]:flex-nowrap">
                        <Totals
                          totals={
                            page.days.find((day) => day.date === item.day)
                              ?.totals ?? []
                          }
                          language={language}
                          t={t}
                        />
                      </span>
                    </div>
                  </th>
                </tr>
              )
            if ('part' in item) {
              const account = accounts.find(
                (candidate) => candidate.id === item.parent.accountId,
              )
              const category = categories.find(
                (candidate) => candidate.id === item.part.categoryId,
              )
              return (
                <tr
                  key={item.part.id}
                  aria-rowindex={start + index + 2}
                  className="border-b bg-muted/30 text-xs"
                  style={{ height: ROW_HEIGHT }}
                >
                  <td className="truncate py-1 pl-8 pr-3 font-medium">
                    {t('splits.part')} {item.partIndex + 1}
                  </td>
                  <td />
                  <td className="truncate px-3" title={category?.name}>
                    {category?.name ?? t('transactions.noCategory')}
                  </td>
                  <td
                    className="truncate px-3"
                    title={item.part.tags.map((tag) => tag.name).join(', ')}
                  >
                    {item.part.tags.map((tag) => tag.name).join(', ')}
                  </td>
                  <td className="truncate px-3" title={item.part.note}>
                    {item.part.note}
                  </td>
                  <td className="truncate px-3 text-right font-medium tabular-nums">
                    {format.money(
                      item.part.amountMinor,
                      account?.currency ?? 'HUF',
                    )}
                  </td>
                  <td />
                </tr>
              )
            }
            const transaction = item.transaction
            if (transaction.kind === 'transfer') {
              const from = accounts.find(
                (account) => account.id === transaction.fromAccountId,
              )
              const to = accounts.find(
                (account) => account.id === transaction.toAccountId,
              )
              const rate = transaction.actualRate
              const rateText = rate
                ? `${t('transactions.actualRate')}: 1 ${rate.fromCurrency} = ${formatRate(rate.numerator, rate.denominator, language)} ${rate.toCurrency}`
                : ''
              return (
                <tr
                  key={transaction.id}
                  aria-rowindex={start + index + 2}
                  className="border-b bg-muted/40"
                  style={{ height: ROW_HEIGHT }}
                >
                  <td className="truncate px-3 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <ArrowLeftRight aria-hidden="true" className="size-3" />
                      {t('transactions.transfer')}
                    </span>
                  </td>
                  <td
                    className="truncate px-3"
                    title={`${from?.name ?? ''} → ${to?.name ?? ''}`}
                  >
                    {from?.name ?? t('transactions.unknownAccount')} →{' '}
                    {to?.name ?? t('transactions.unknownAccount')}
                  </td>
                  <td className="truncate px-3" title={rateText}>
                    {rateText}
                  </td>
                  <td />
                  <td className="truncate px-3" title={transaction.note}>
                    {transaction.note}
                  </td>
                  <td className="truncate px-3 text-right font-medium tabular-nums">
                    <span className="whitespace-nowrap">
                      −
                      {format.money(
                        transaction.fromAmountMinor,
                        from?.currency ?? 'HUF',
                      )}
                      {' → '}+
                      {format.money(
                        transaction.toAmountMinor,
                        to?.currency ?? 'HUF',
                      )}
                    </span>
                  </td>
                  <td className="px-1">
                    <RowActions
                      transaction={transaction}
                      busy={busy}
                      t={t}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                    />
                  </td>
                </tr>
              )
            }
            if (transaction.kind === 'adjustment') {
              const account = accounts.find(
                (account) => account.id === transaction.accountId,
              )
              const sign = transaction.differenceMinor < 0 ? '−' : '+'
              const absoluteDifference = Math.abs(transaction.differenceMinor)
              return (
                <tr
                  key={transaction.id}
                  aria-rowindex={start + index + 2}
                  className="border-b bg-primary/5"
                  style={{ height: ROW_HEIGHT }}
                >
                  <td className="truncate px-3 font-medium">
                    <span className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Scale aria-hidden="true" className="size-3" />
                        {t('adjustments.rowType')}
                      </span>
                      {transaction.noLongerCorrectsAnything && (
                        <span
                          className="shrink-0 rounded border px-1 text-xs text-muted-foreground"
                          title={t('adjustments.zeroDifferenceHint')}
                        >
                          {t('adjustments.zeroDifference')}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="truncate px-3" title={account?.name}>
                    {account?.name ?? t('transactions.unknownAccount')}
                  </td>
                  <td className="truncate px-3">
                    {t('adjustments.observedBalance')}
                  </td>
                  <td />
                  <td className="truncate px-3" title={transaction.note}>
                    {transaction.note}
                  </td>
                  <td
                    className="truncate px-3 text-right font-medium tabular-nums"
                    title={t('adjustments.difference')}
                  >
                    <span className="whitespace-nowrap">
                      {sign}
                      {format.money(
                        absoluteDifference,
                        account?.currency ?? 'HUF',
                      )}
                    </span>
                  </td>
                  <td className="px-1">
                    <RowActions
                      transaction={transaction}
                      busy={busy}
                      t={t}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                    />
                  </td>
                </tr>
              )
            }
            const account = accounts.find(
              (account) => account.id === transaction.accountId,
            )
            const split = transaction.lines.length > 1
            const category = categories.find(
              (category) => category.id === transaction.line.categoryId,
            )
            const Icon =
              transaction.kind === 'expense' ? ArrowUpRight : ArrowDownLeft
            return (
              <tr
                key={transaction.id}
                aria-rowindex={start + index + 2}
                className={`border-b ${transaction.linkedTransferId ? 'bg-muted/20' : ''}`}
                style={{ height: ROW_HEIGHT }}
              >
                <td
                  className="truncate px-3"
                  title={transaction.payeeName ?? ''}
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate">
                      {transaction.payeeName ?? t('transactions.noPayee')}
                    </span>
                    {transaction.excluded && (
                      <span
                        className="shrink-0 rounded border px-1 text-xs text-muted-foreground"
                        title={t('transactions.excludedHint')}
                      >
                        {t('transactions.excluded')}
                      </span>
                    )}
                  </span>
                </td>
                <td className="truncate px-3" title={account?.name}>
                  {account?.name ?? t('transactions.unknownAccount')}
                </td>
                <td
                  className="truncate px-3"
                  title={split ? t('splits.indicator') : category?.name}
                >
                  {split ? (
                    <Button
                      className="h-7 gap-1 px-1 text-xs"
                      variant="ghost"
                      disabled={busy}
                      aria-expanded={expandedSplits.has(transaction.id)}
                      onClick={() =>
                        setExpandedSplits((current) => {
                          const next = new Set(current)
                          if (next.has(transaction.id))
                            next.delete(transaction.id)
                          else next.add(transaction.id)
                          return next
                        })
                      }
                    >
                      {expandedSplits.has(transaction.id) ? (
                        <ChevronDown aria-hidden="true" className="size-3" />
                      ) : (
                        <ChevronRight aria-hidden="true" className="size-3" />
                      )}
                      {t('splits.indicator')} · {transaction.lines.length}
                    </Button>
                  ) : (
                    (category?.name ?? t('transactions.noCategory'))
                  )}
                </td>
                <td
                  className="truncate px-3"
                  title={
                    split
                      ? undefined
                      : transaction.line.tags.map((tag) => tag.name).join(', ')
                  }
                >
                  {split
                    ? ''
                    : transaction.line.tags.map((tag) => tag.name).join(', ')}
                </td>
                <td className="truncate px-3" title={transaction.note}>
                  {transaction.note}
                </td>
                <td
                  className="truncate px-3 text-right font-medium tabular-nums"
                  title={
                    account
                      ? format.money(transaction.totalMinor, account.currency)
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Icon aria-hidden="true" className="size-3" />
                    <span className="sr-only">
                      {t(
                        transaction.kind === 'expense'
                          ? 'transactions.expense'
                          : 'transactions.income',
                      )}
                    </span>
                    {transaction.kind === 'expense' ? '−' : '+'}
                    {account
                      ? format.money(transaction.totalMinor, account.currency)
                      : format.money(transaction.totalMinor, 'HUF')}
                  </span>
                </td>
                <td className="px-1">
                  {!transaction.linkedTransferId && (
                    <RowActions
                      transaction={transaction}
                      busy={busy}
                      t={t}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                    />
                  )}
                </td>
              </tr>
            )
          })}
          {end < items.length && (
            <tr aria-hidden="true">
              <td
                colSpan={7}
                style={{
                  height: (items.length - end) * ROW_HEIGHT,
                  padding: 0,
                }}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function formatRate(
  numerator: number,
  denominator: number,
  language: Language,
): string {
  const scale = 100_000_000n
  const rounded =
    (BigInt(numerator) * scale + BigInt(denominator) / 2n) / BigInt(denominator)
  const units = rounded / scale
  const fraction = String(rounded % scale)
    .padStart(8, '0')
    .replace(/0+$/, '')
  const separator = language === 'en' ? '.' : ','
  return fraction ? `${units}${separator}${fraction}` : String(units)
}

function RowActions({
  transaction,
  busy,
  t,
  onEdit,
  onDelete,
  onDuplicate,
}: Pick<Props, 'busy' | 't' | 'onEdit' | 'onDelete' | 'onDuplicate'> & {
  transaction: Transaction | Transfer | BalanceAdjustment
}) {
  return (
    <div className="flex gap-1">
      {(transaction.kind === 'expense' || transaction.kind === 'income') && (
        <Button
          className="size-7"
          size="icon"
          variant="ghost"
          disabled={busy}
          onClick={() => onDuplicate(transaction)}
          aria-label={t('transactions.duplicate')}
          title={t('transactions.duplicate')}
        >
          <Copy aria-hidden="true" className="size-3" />
        </Button>
      )}
      <Button
        className="size-7"
        size="icon"
        variant="ghost"
        disabled={busy}
        onClick={() => onEdit(transaction)}
        aria-label={t('transactions.edit')}
        title={t('transactions.edit')}
      >
        <Pencil aria-hidden="true" className="size-3" />
      </Button>
      <Button
        className="size-7"
        size="icon"
        variant="ghost"
        disabled={busy}
        onClick={() => onDelete(transaction)}
        aria-label={t('transactions.delete')}
        title={t('transactions.delete')}
      >
        <Trash2 aria-hidden="true" className="size-3" />
      </Button>
    </div>
  )
}
