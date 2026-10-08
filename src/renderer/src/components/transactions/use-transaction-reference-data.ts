import { useEffect, useMemo, useState } from 'react'
import type { AccountOption } from '../../../../shared/accounts'
import type { Category } from '../../../../shared/categories'
import type { Payee, TransactionKind } from '../../../../shared/transactions'
import type { Tag } from '../../../../shared/tags'
import type { TransactionTemplate } from '../../../../shared/templates'
import type { Language, MessageKey } from '../../i18n'
import { transactionError } from './transaction-form'

export function useTransactionReferenceData(
  revision: number,
  language: Language,
  undoRevision: number,
) {
  const [data, setData] = useState({
    accounts: [] as AccountOption[],
    categories: [] as Category[],
    accountOptions: [] as AccountOption[],
    categoryOptions: { expense: [], income: [] } as Record<
      TransactionKind,
      Category[]
    >,
    payees: [] as Payee[],
    tags: [] as Tag[],
    templates: [] as TransactionTemplate[],
  })
  const key = useMemo(
    () => ({ revision, language, undoRevision }),
    [revision, language, undoRevision],
  )
  const [loadedKey, setLoadedKey] = useState<typeof key | null>(null)
  const [failure, setFailure] = useState<{
    key: typeof key
    error: MessageKey
  } | null>(null)
  useEffect(() => {
    let ignore = false
    void Promise.all([
      window.app.accounts.listOptions({ includeArchived: true }),
      window.app.categories.list(),
      Promise.all([
        window.app.categories.listOptions({ kind: 'expense' }),
        window.app.categories.listOptions({ kind: 'income' }),
      ]),
      window.app.payees.list(),
      window.app.tags.list(),
      window.app.templates.list(),
    ])
      .then(
        ([
          accounts,
          categories,
          [expense, income],
          payees,
          tags,
          templates,
        ]) => {
          if (!ignore) {
            setFailure(null)
            setData({
              accounts,
              categories,
              accountOptions: accounts.filter((account) => !account.archived),
              categoryOptions: { expense, income },
              payees,
              tags,
              templates,
            })
          }
        },
      )
      .catch((error: unknown) => {
        if (!ignore) setFailure({ key, error: transactionError(error) })
      })
      .finally(() => {
        if (!ignore) setLoadedKey(key)
      })
    return () => {
      ignore = true
    }
  }, [key])
  return {
    ...data,
    loading: loadedKey !== key,
    error: failure?.key === key ? failure.error : null,
  }
}

export type TransactionReferenceData = ReturnType<
  typeof useTransactionReferenceData
>
