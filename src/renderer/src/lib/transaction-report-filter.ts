import type { TransactionListInput } from '../../../shared/transactions'

export function reportFlagsForCategory(
  request: TransactionListInput,
  categoryId: string,
): Pick<TransactionListInput, 'kind' | 'uncategorized' | 'exactCategory'> {
  return {
    kind: request.kind,
    uncategorized: !categoryId && request.uncategorized ? true : undefined,
    exactCategory:
      categoryId && categoryId === request.categoryId && request.exactCategory
        ? true
        : undefined,
  }
}
