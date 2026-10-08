import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { Account } from '../../shared/accounts'
import type { Category } from '../../shared/categories'
import type {
  Payee,
  Transaction,
  TransactionKind,
  TransactionPage,
  TransactionListInput,
  TransactionPeriod,
} from '../../shared/transactions'
import { Button } from './components/ui/button'
import { CardContent } from './components/ui/card'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import { type Language, type MessageKey } from './i18n'
import { TransactionTable, Totals } from './components/transaction-table'
import { parseAmountInput } from './lib/amount-input'
import { today } from '../../shared/date'

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
  'transactions.error.filters',
  'transactions.error.totals',
] as const satisfies readonly MessageKey[]

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
  undoRevision: number
  onTransactionChanged(): void
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

export function TransactionsPage({
  language,
  t,
  undoRevision,
  onTransactionChanged,
}: TransactionsPageProps) {
  const [page, setPage] = useState<TransactionPage>({
    rows: [],
    totals: [],
    days: [],
    totalCount: 0,
  })
  const [request, setRequest] = useState<TransactionListInput>({
    period: 'all',
    limit: 200,
    offset: 0,
  })
  const [filters, setFilters] = useState({
    period: 'all' as TransactionPeriod,
    from: '',
    to: '',
    accountId: '',
    categoryId: '',
    payeeId: '',
    search: '',
  })
  const [revision, setRevision] = useState(0)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accountOptions, setAccountOptions] = useState<Account[]>([])
  const [categoryOptions, setCategoryOptions] = useState<
    Record<TransactionKind, Category[]>
  >({ expense: [], income: [] })
  const [payees, setPayees] = useState<Payee[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    void Promise.all([
      window.app.transactions.list(request),
      window.app.accounts.list(),
      window.app.categories.list(),
      window.app.accounts.listOptions(),
      Promise.all([
        window.app.categories.listOptions({ kind: 'expense' }),
        window.app.categories.listOptions({ kind: 'income' }),
      ]),
      window.app.payees.list(),
    ])
      .then(
        ([
          nextPage,
          nextAccounts,
          nextCategories,
          nextAccountOptions,
          [expenseOptions, incomeOptions],
          nextPayees,
        ]) => {
          if (ignore) return
          setPage(nextPage)
          setAccounts(nextAccounts)
          setCategories(nextCategories)
          setAccountOptions(nextAccountOptions)
          setCategoryOptions({ expense: expenseOptions, income: incomeOptions })
          setPayees(nextPayees)
        },
      )
      .catch((error: unknown) => {
        if (!ignore)
          setError(
            errorKeys.find((key) => String(error).includes(key)) ??
              'transactions.error',
          )
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [request, revision, language, undoRevision])

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    setRequest({
      period: filters.period,
      ...(filters.period === 'custom'
        ? { from: filters.from, to: filters.to }
        : {}),
      accountId: filters.accountId || undefined,
      categoryId: filters.categoryId || undefined,
      payeeId: filters.payeeId || undefined,
      search: filters.search,
      limit: 200,
      offset: 0,
    })
  }

  async function run(action: () => Promise<unknown>, offerUndo = false) {
    setBusy(true)
    setError(null)
    try {
      await action()
      if (offerUndo) onTransactionChanged()
      setRequest((current) => ({ ...current, offset: 0 }))
      setRevision((current) => current + 1)
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
        totalMinor: parseAmountInput(form.amount, 'transactions.error.amount'),
        payeeName: form.payeeName,
        categoryId: form.categoryId || null,
        note: form.note,
      }
      return form.id
        ? window.app.transactions.update({ id: form.id, ...input })
        : window.app.transactions.create(input)
    }, true)
  }

  const selectedAccount = form
    ? accounts.find((account) => account.id === form.accountId)
    : undefined
  const selectedCategory = form
    ? categories.find((category) => category.id === form.categoryId)
    : undefined
  const drawerAccounts = selectedAccount?.archived
    ? [selectedAccount, ...accountOptions]
    : accountOptions
  const drawerCategories = form
    ? selectedCategory &&
      !categoryOptions[form.kind].some(({ id }) => id === selectedCategory.id)
      ? [selectedCategory, ...categoryOptions[form.kind]]
      : categoryOptions[form.kind]
    : []

  return (
    <CardContent className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('transactions.listDescription')}
        </p>
        <Button
          disabled={busy || loading || accountOptions.length === 0}
          onClick={() => setForm(emptyForm(accountOptions[0]?.id))}
        >
          {t('transactions.create')}
        </Button>
      </div>
      {accountOptions.length === 0 && !loading && (
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

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-md border p-3 sm:grid-cols-3 lg:grid-cols-6"
        aria-label={t('transactions.filters')}
      >
        <label className="space-y-1 text-xs font-medium">
          {t('transactions.period')}
          <NativeSelect
            value={filters.period}
            onChange={(event) =>
              setFilters({
                ...filters,
                period: event.target.value as TransactionPeriod,
              })
            }
          >
            {(
              ['all', 'thisMonth', 'lastMonth', 'thisYear', 'custom'] as const
            ).map((period) => (
              <option key={period} value={period}>
                {t(`transactions.period.${period}`)}
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
        <label className="space-y-1 text-xs font-medium">
          {t('transactions.account')}
          <NativeSelect
            value={filters.accountId}
            onChange={(event) =>
              setFilters({ ...filters, accountId: event.target.value })
            }
          >
            <option value="">{t('transactions.allAccounts')}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-xs font-medium">
          {t('transactions.category')}
          <NativeSelect
            value={filters.categoryId}
            onChange={(event) =>
              setFilters({ ...filters, categoryId: event.target.value })
            }
          >
            <option value="">{t('transactions.allCategories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.parentId ? '— ' : ''}
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-xs font-medium">
          {t('transactions.payee')}
          <NativeSelect
            value={filters.payeeId}
            onChange={(event) =>
              setFilters({ ...filters, payeeId: event.target.value })
            }
          >
            <option value="">{t('transactions.allPayees')}</option>
            {payees.map((payee) => (
              <option key={payee.id} value={payee.id}>
                {payee.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-xs font-medium">
          {t('transactions.search')}
          <Input
            value={filters.search}
            maxLength={1000}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
          />
        </label>
        <Button type="submit" disabled={busy || loading} className="self-end">
          {t('transactions.applyFilters')}
        </Button>
      </form>
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('transactions.loading')}
        </p>
      ) : (
        !error && (
          <>
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 text-sm"
            >
              <span>
                {t('transactions.filteredTotals')} · {page.totalCount}{' '}
                {t('transactions.matches')}
              </span>
              <Totals totals={page.totals} language={language} t={t} />
            </div>
            {page.rows.length === 0 ? (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                {t('transactions.noMatches')}
              </p>
            ) : (
              <TransactionTable
                key={`${JSON.stringify(request)}-${revision}`}
                page={page}
                accounts={accounts}
                categories={categories}
                language={language}
                t={t}
                busy={busy}
                onEdit={(transaction) =>
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
                onDelete={setDeleting}
              />
            )}
            <div className="flex items-center justify-end gap-3 text-sm">
              <Button
                variant="ghost"
                disabled={busy || !request.offset}
                onClick={() => {
                  setDeleting(null)
                  setRequest({
                    ...request,
                    offset: Math.max(0, (request.offset ?? 0) - 200),
                  })
                }}
              >
                {t('transactions.previousPage')}
              </Button>
              <span>
                {page.totalCount ? (request.offset ?? 0) + 1 : 0}–
                {Math.min((request.offset ?? 0) + 200, page.totalCount)} /{' '}
                {page.totalCount}
              </span>
              <Button
                variant="ghost"
                disabled={
                  busy || (request.offset ?? 0) + 200 >= page.totalCount
                }
                onClick={() => {
                  setDeleting(null)
                  setRequest({
                    ...request,
                    offset: (request.offset ?? 0) + 200,
                  })
                }}
              >
                {t('transactions.nextPage')}
              </Button>
            </div>
          </>
        )
      )}
      {deleting && (
        <section role="alert" className="space-y-3 rounded-lg bg-muted p-4">
          <p className="text-sm">{t('transactions.deleteConfirmation')}</p>
          <div className="flex gap-2">
            <Button
              disabled={busy || loading}
              onClick={() =>
                void run(
                  () => window.app.transactions.delete({ id: deleting.id }),
                  true,
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
        </section>
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
                  {drawerAccounts.map((account) => (
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
                  {drawerCategories.map((category) => (
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
