import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { Account } from '../../shared/accounts'
import type { Category } from '../../shared/categories'
import type {
  Payee,
  Transaction,
  TransactionKind,
} from '../../shared/transactions'
import { Button } from './components/ui/button'
import { CardContent } from './components/ui/card'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import { createFormatters, type Language, type MessageKey } from './i18n'

const errorKeys = [
  'transactions.error.account',
  'transactions.error.kind',
  'transactions.error.date',
  'transactions.error.futureDate',
  'transactions.error.amount',
  'transactions.error.payee',
  'transactions.error.category',
  'transactions.error.note',
  'transactions.error.notFound',
  'transactions.error.lines',
] as const satisfies readonly MessageKey[]

function today(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseAmount(value: string): number {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim())
  if (!match) throw new Error('transactions.error.amount')
  const minor =
    BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
  const amount = Number(minor)
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('transactions.error.amount')
  }
  return amount
}

function amountInput(minor: number): string {
  const value = BigInt(minor)
  const fraction = String(value % 100n).padStart(2, '0')
  return fraction === '00'
    ? String(value / 100n)
    : `${value / 100n}.${fraction}`
}

interface TransactionsPageProps {
  language: Language
  t(key: MessageKey): string
}

interface FormState {
  id: string | null
  kind: TransactionKind
  date: string
  accountId: string
  amount: string
  payeeName: string
  categoryId: string
  note: string
}

function emptyForm(accountId = ''): FormState {
  return {
    id: null,
    kind: 'expense',
    date: today(),
    accountId,
    amount: '',
    payeeName: '',
    categoryId: '',
    note: '',
  }
}

export function TransactionsPage({ language, t }: TransactionsPageProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [payees, setPayees] = useState<Payee[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const format = createFormatters(language)

  async function load() {
    const [nextTransactions, nextAccounts, nextCategories, nextPayees] =
      await Promise.all([
        window.app.transactions.list(),
        window.app.accounts.list(),
        window.app.categories.list(),
        window.app.payees.list(),
      ])
    setTransactions(nextTransactions)
    setAccounts(nextAccounts)
    setCategories(nextCategories)
    setPayees(nextPayees)
  }

  useEffect(() => {
    let ignore = false
    void load()
      .catch(() => {
        if (!ignore) setError('transactions.error')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
      setForm(null)
      setDeleting(null)
    } catch (error) {
      setError(
        errorKeys.find((key) => String(error).includes(key)) ??
          'transactions.error',
      )
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    void run(() => {
      const input = {
        accountId: form.accountId,
        kind: form.kind,
        date: form.date,
        totalMinor: parseAmount(form.amount),
        payeeName: form.payeeName,
        categoryId: form.categoryId || null,
        note: form.note,
      }
      return form.id
        ? window.app.transactions.update({ id: form.id, ...input })
        : window.app.transactions.create(input)
    })
  }

  const categoryOptions = categories.filter((category) => {
    if (category.kind !== form?.kind || category.archived) return false
    if (category.parentId === null) return true
    return !categories.find((parent) => parent.id === category.parentId)
      ?.archived
  })
  const activeAccounts = accounts.filter((account) => !account.archived)

  return (
    <CardContent className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('transactions.listDescription')}
        </p>
        <Button
          disabled={busy || loading || activeAccounts.length === 0}
          onClick={() => setForm(emptyForm(activeAccounts[0]?.id))}
        >
          {t('transactions.create')}
        </Button>
      </div>
      {activeAccounts.length === 0 && !loading && (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {t('transactions.noAccounts')}
        </p>
      )}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-error">{t(error)}</p>
          <Button
            variant="ghost"
            disabled={busy || loading}
            onClick={() => void run(async () => {})}
          >
            {t('transactions.refresh')}
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('transactions.loading')}
        </p>
      ) : transactions.length === 0 ? (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {t('transactions.empty')}
        </p>
      ) : (
        <ul className="space-y-3" aria-label={t('navigation.transactions')}>
          {transactions.map((transaction) => {
            const account = accounts.find(
              (candidate) => candidate.id === transaction.accountId,
            )
            const category = categories.find(
              (candidate) => candidate.id === transaction.line.categoryId,
            )
            return (
              <li key={transaction.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {transaction.payeeName ?? t('transactions.noPayee')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format.date(new Date(`${transaction.date}T00:00:00`))}
                      {' · '}
                      {account?.name ?? t('transactions.unknownAccount')}
                      {' · '}
                      {category?.name ?? t('transactions.noCategory')}
                    </p>
                    {transaction.note && (
                      <p className="break-words text-sm">{transaction.note}</p>
                    )}
                  </div>
                  <p className="font-semibold tabular-nums">
                    {transaction.kind === 'expense' ? '−' : '+'}
                    {account
                      ? format.money(transaction.totalMinor, account.currency)
                      : amountInput(transaction.totalMinor)}
                  </p>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      setForm({
                        id: transaction.id,
                        kind: transaction.kind,
                        date: transaction.date,
                        accountId: transaction.accountId,
                        amount: amountInput(transaction.totalMinor),
                        payeeName: transaction.payeeName ?? '',
                        categoryId: transaction.line.categoryId ?? '',
                        note: transaction.note,
                      })
                    }
                  >
                    {t('transactions.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setDeleting(transaction)}
                  >
                    {t('transactions.delete')}
                  </Button>
                </div>
                {deleting?.id === transaction.id && (
                  <div className="mt-3 space-y-3 rounded-lg bg-muted p-4">
                    <p className="text-sm">
                      {t('transactions.deleteConfirmation')}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            window.app.transactions.delete({
                              id: transaction.id,
                            }),
                          )
                        }
                      >
                        {t('transactions.confirmDelete')}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setDeleting(null)}
                      >
                        {t('transactions.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {form && (
        <div
          className="fixed inset-0 z-50 bg-foreground/20"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setForm(null)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-drawer-title"
            className="ml-auto h-full w-full max-w-lg overflow-y-auto border-l bg-background p-6 shadow-xl"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2
                id="transaction-drawer-title"
                className="text-xl font-semibold"
              >
                {t(form.id ? 'transactions.edit' : 'transactions.create')}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('transactions.close')}
                disabled={busy}
                onClick={() => setForm(null)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <label
                  htmlFor="transaction-kind"
                  className="text-sm font-medium"
                >
                  {t('transactions.kind')}
                </label>
                <NativeSelect
                  id="transaction-kind"
                  value={form.kind}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      kind: event.target.value as TransactionKind,
                      categoryId: '',
                    })
                  }
                >
                  <option value="expense">{t('transactions.expense')}</option>
                  <option value="income">{t('transactions.income')}</option>
                </NativeSelect>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="transaction-date"
                    className="text-sm font-medium"
                  >
                    {t('transactions.date')}
                  </label>
                  <Input
                    id="transaction-date"
                    type="date"
                    max={today()}
                    value={form.date}
                    required
                    disabled={busy}
                    onChange={(event) =>
                      setForm({ ...form, date: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="transaction-amount"
                    className="text-sm font-medium"
                  >
                    {t('transactions.amount')}
                  </label>
                  <Input
                    id="transaction-amount"
                    inputMode="decimal"
                    value={form.amount}
                    placeholder="0.00"
                    maxLength={20}
                    required
                    disabled={busy}
                    onChange={(event) =>
                      setForm({ ...form, amount: event.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('transactions.amountHint')}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="transaction-account"
                  className="text-sm font-medium"
                >
                  {t('transactions.account')}
                </label>
                <NativeSelect
                  id="transaction-account"
                  value={form.accountId}
                  required
                  disabled={busy}
                  onChange={(event) =>
                    setForm({ ...form, accountId: event.target.value })
                  }
                >
                  <option value="" disabled>
                    {t('transactions.chooseAccount')}
                  </option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="transaction-payee"
                  className="text-sm font-medium"
                >
                  {t('transactions.payee')}
                </label>
                <Input
                  id="transaction-payee"
                  list="transaction-payees"
                  value={form.payeeName}
                  maxLength={100}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({ ...form, payeeName: event.target.value })
                  }
                />
                <datalist id="transaction-payees">
                  {payees.map((payee) => (
                    <option key={payee.id} value={payee.name} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  {t('transactions.payeeHint')}
                </p>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="transaction-category"
                  className="text-sm font-medium"
                >
                  {t('transactions.category')}
                </label>
                <NativeSelect
                  id="transaction-category"
                  value={form.categoryId}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({ ...form, categoryId: event.target.value })
                  }
                >
                  <option value="">{t('transactions.noCategory')}</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentId ? `— ${category.name}` : category.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="transaction-note"
                  className="text-sm font-medium"
                >
                  {t('transactions.note')}
                </label>
                <textarea
                  id="transaction-note"
                  className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={form.note}
                  maxLength={1000}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({ ...form, note: event.target.value })
                  }
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={busy}>
                  {t('transactions.save')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setForm(null)}
                >
                  {t('transactions.cancel')}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </CardContent>
  )
}
