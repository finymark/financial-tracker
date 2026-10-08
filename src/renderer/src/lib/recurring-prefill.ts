import type { CategoryKind } from '../../../shared/categories'
import type { RecurringSchedule } from '../../../shared/recurring'
import type { Tag } from '../../../shared/tags'
import type { TransactionTemplate } from '../../../shared/templates'
import { tagKey } from '../../../shared/text-keys'
import type { Transaction } from '../../../shared/transactions'

export interface RecurringPrefill {
  kind: CategoryKind
  accountId: string | null
  amountMinor: number | null
  payeeName: string | null
  categoryId: string | null
  tagIds: string[]
  note: string
  schedule: RecurringSchedule
  startDate: string
  endDate: null
}

function monthlyDefaults(sourceDate: string) {
  const source = new Date(`${sourceDate}T00:00:00.000Z`)
  const day = source.getUTCDate()
  const nextMonth = source.getUTCMonth() + 1
  const lastDay = new Date(
    Date.UTC(source.getUTCFullYear(), nextMonth + 1, 0),
  ).getUTCDate()
  const next = new Date(
    Date.UTC(source.getUTCFullYear(), nextMonth, Math.min(day, lastDay)),
  )
  return {
    schedule: { type: 'monthly' as const, day, intervalMonths: 1 },
    startDate: next.toISOString().slice(0, 10),
  }
}

export function recurringPrefillFromTransaction(
  transaction: Transaction,
): RecurringPrefill | null {
  if (transaction.lines.length !== 1) return null
  return {
    kind: transaction.kind,
    accountId: transaction.accountId,
    amountMinor: transaction.totalMinor,
    payeeName: transaction.payeeName,
    categoryId: transaction.line.categoryId,
    tagIds: transaction.line.tags.map((tag) => tag.id),
    note: transaction.note,
    ...monthlyDefaults(transaction.date),
    endDate: null,
  }
}

export function recurringPrefillFromTemplate(
  template: TransactionTemplate,
  sourceDate: string,
  tags: readonly Tag[],
  categories: readonly { id: string; kind: CategoryKind }[],
): RecurringPrefill {
  const tagIds = new Map(tags.map((tag) => [tagKey(tag.name), tag.id]))
  return {
    kind:
      template.kind ??
      categories.find((category) => category.id === template.categoryId)
        ?.kind ??
      'expense',
    accountId: template.accountId,
    amountMinor: template.totalMinor,
    payeeName: template.payeeName,
    categoryId: template.categoryId,
    tagIds: template.tagNames.flatMap((name) => {
      const id = tagIds.get(tagKey(name))
      return id ? [id] : []
    }),
    note: template.note ?? '',
    ...monthlyDefaults(sourceDate),
    endDate: null,
  }
}
