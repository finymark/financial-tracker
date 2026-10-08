import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from 'react'
import type { AccountOption } from '../../../../shared/accounts'
import { parseAmountExpression } from '../../../../shared/amount-expression'
import {
  mergeRuleAutofill,
  type ProtectedAutofillFields,
} from '../../lib/rule-autofill'
import type { DrawerForm } from './transaction-form'

export function useRuleAutofill(
  form: DrawerForm | null,
  setForm: Dispatch<SetStateAction<DrawerForm | null>>,
  accounts: AccountOption[],
  autofillProtected: RefObject<ProtectedAutofillFields>,
  focusRevision: number,
) {
  const autofillRequest = useRef(0)
  const autofillAccountId = form?.accountId
  const autofillKind =
    form?.kind === 'expense' || form?.kind === 'income' ? form.kind : null
  const autofillAmount = form?.amount
  const autofillNote = form?.note
  const autofillPayeeName =
    form && (form.kind === 'expense' || form.kind === 'income')
      ? form.payeeName
      : undefined
  const autofillSplit =
    form && (form.kind === 'expense' || form.kind === 'income')
      ? form.splitLines
      : undefined
  const autofillId = form?.id
  useEffect(() => {
    const requestId = ++autofillRequest.current
    if (
      autofillId !== null ||
      !autofillAccountId ||
      !autofillKind ||
      autofillSplit
    )
      return
    let totalMinor: number | null = null
    const account = accounts.find(
      (candidate) => candidate.id === autofillAccountId,
    )
    if (autofillAmount && account) {
      try {
        totalMinor = parseAmountExpression(
          autofillAmount,
          account.currency,
          'transactions.error.amount',
        )
      } catch {
        totalMinor = null
      }
    }
    const timer = setTimeout(() => {
      void window.app.rules
        .autofill({
          accountId: autofillAccountId,
          kind: autofillKind,
          totalMinor,
          payeeName: autofillPayeeName?.trim() || null,
          note: autofillNote ?? '',
        })
        .then((autofill) => {
          if (requestId !== autofillRequest.current) return
          setForm((current) => {
            if (
              !current ||
              current.id !== null ||
              (current.kind !== 'expense' && current.kind !== 'income') ||
              current.splitLines
            )
              return current
            return mergeRuleAutofill(
              current,
              autofill,
              autofillProtected.current,
            )
          })
        })
        .catch(() => {})
    }, 150)
    return () => {
      clearTimeout(timer)
      autofillRequest.current += 1
    }
  }, [
    setForm,
    autofillProtected,
    accounts,
    autofillAccountId,
    autofillAmount,
    autofillId,
    autofillKind,
    autofillNote,
    autofillPayeeName,
    autofillSplit,
    // Template use may change only protected fields, not the rule conditions.
    focusRevision,
  ])

  return autofillRequest
}
