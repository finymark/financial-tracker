import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { Account } from '../../shared/accounts'
import type { Category } from '../../shared/categories'
import type { Tag } from '../../shared/tags'
import type {
  Payee,
  Transaction,
  TransactionKind,
  TransactionPage,
  TransactionListInput,
  TransactionPeriod,
  TransactionExclusionFilter,
} from '../../shared/transactions'
import type { TransactionTemplate } from '../../shared/templates'
import { TemplateEditor } from './components/template-editor'
import { amountInput } from './lib/amount-input-value'
import type { PayeeSuggestion } from '../../shared/payees'
import type { Transfer } from '../../shared/transfers'
import type { BalanceAdjustment } from '../../shared/adjustments'
import { Button } from './components/ui/button'
import { CardContent } from './components/ui/card'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import { createFormatters, type Language, type MessageKey } from './i18n'
import { TransactionTable, Totals } from './components/transaction-table'
import { parseAmountExpression } from '../../shared/amount-expression'
import { AmountInput } from './components/amount-input'
import { today } from '../../shared/date'
import { matchShortcut } from './lib/shortcuts'
import { shortcutTargetContext } from './lib/shortcut-context'
import { useDialogFocus } from './lib/use-dialog-focus'
import {
  mergeRuleAutofill,
  templateAutofillProtection,
} from './lib/rule-autofill'

const errorKeys = [
  'templates.error.name',
  'templates.error.notFound',
  'templates.error.split',
  'transactions.error.account',
  'transactions.error.kind',
  'transactions.error.date',
  'transactions.error.futureDate',
  'transactions.error.amount',
  'transactions.error.payee',
  'transactions.error.category',
  'transactions.error.note',
  'transactions.error.excluded',
  'transactions.error.notFound',
  'transactions.error.lines',
  'transactions.error.filters',
  'transactions.error.totals',
  'tags.error.name',
  'tags.error.notFound',
  'tags.error.duplicate',
  'transfers.error.accountsDiffer',
  'transfers.error.equalAmounts',
  'transfers.error.notFound',
  'transfers.error.linkedFee',
  'adjustments.error.account',
  'adjustments.error.date',
  'adjustments.error.futureDate',
  'adjustments.error.balance',
  'adjustments.error.note',
  'adjustments.error.notFound',
] as const satisfies readonly MessageKey[]

interface TransactionsPageProps {
  language: Language
  t(key: MessageKey): string
  undoRevision: number
  newTransactionRequested: boolean
  onNewTransactionHandled(): void
  onTransactionChanged(): void
}

interface FormState {
  id: string | null
  kind: TransactionKind | 'transfer' | 'adjustment'
  date: string
  accountId: string
  amount: string
  payeeName: string
  categoryId: string
  note: string
  tagNames: string[]
  pendingTagName: string
  toAccountId: string
  toAmount: string
  feeAmount: string
  feeCategoryId: string
  excluded: boolean
  feeExcluded: boolean
  splitLines: SplitLineForm[] | null
}

interface SplitLineForm {
  key: string
  amount: string
  categoryId: string
  note: string
  tagNames: string[]
  pendingTagName: string
}

let nextSplitLineKey = 0

function splitLine(overrides: Partial<SplitLineForm> = {}): SplitLineForm {
  nextSplitLineKey += 1
  return {
    key: `split-line-${nextSplitLineKey}`,
    amount: '',
    categoryId: '',
    note: '',
    tagNames: [],
    pendingTagName: '',
    ...overrides,
  }
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
    tagNames: [],
    pendingTagName: '',
    toAccountId: '',
    toAmount: '',
    feeAmount: '',
    feeCategoryId: '',
    excluded: false,
    feeExcluded: false,
    splitLines: null,
  }
}

function emptyAdjustmentForm(accountId = ''): FormState {
  return {
    ...emptyForm(accountId),
    kind: 'adjustment',
  }
}

export function TransactionsPage({
  language,
  t,
  undoRevision,
  newTransactionRequested,
  onNewTransactionHandled,
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
    tagId: '',
    search: '',
    exclusion: 'all' as TransactionExclusionFilter,
  })
  const [revision, setRevision] = useState(0)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accountOptions, setAccountOptions] = useState<Account[]>([])
  const [categoryOptions, setCategoryOptions] = useState<
    Record<TransactionKind, Category[]>
  >({ expense: [], income: [] })
  const [payees, setPayees] = useState<Payee[]>([])
  const [payeeSuggestions, setPayeeSuggestions] = useState<PayeeSuggestion[]>(
    [],
  )
  const [templates, setTemplates] = useState<TransactionTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateEditor, setTemplateEditor] = useState<
    TransactionTemplate | 'new' | null
  >(null)
  const [deletingTemplate, setDeletingTemplate] =
    useState<TransactionTemplate | null>(null)
  const [saveTemplateName, setSaveTemplateName] = useState<string | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [renamingTag, setRenamingTag] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const autofillProtected = useRef({ category: false, tags: false })
  const autofillRequest = useRef(0)
  const dialogRef = useRef<HTMLElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const createRef = useRef<HTMLButtonElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [focusRevision, setFocusRevision] = useState(0)
  const [deleting, setDeleting] = useState<
    Transaction | Transfer | BalanceAdjustment | null
  >(null)
  useDialogFocus(Boolean(form), dialogRef, amountRef, createRef)

  useEffect(() => {
    if (focusRevision) amountRef.current?.focus()
  }, [focusRevision])

  useEffect(() => {
    if (!newTransactionRequested || loading || busy) return
    if (accountOptions.length > 0) {
      autofillProtected.current = { category: false, tags: false }
      setError(null)
      setDeleting(null)
      setForm(emptyForm(accountOptions[0].id))
    }
    onNewTransactionHandled()
  }, [
    newTransactionRequested,
    loading,
    busy,
    accountOptions,
    onNewTransactionHandled,
  ])

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
      window.app.tags.list(),
      window.app.templates.list(),
    ])
      .then(
        ([
          nextPage,
          nextAccounts,
          nextCategories,
          nextAccountOptions,
          [expenseOptions, incomeOptions],
          nextPayees,
          nextTags,
          nextTemplates,
        ]) => {
          if (ignore) return
          setPage(nextPage)
          setAccounts(nextAccounts)
          setCategories(nextCategories)
          setAccountOptions(nextAccountOptions)
          setCategoryOptions({ expense: expenseOptions, income: incomeOptions })
          setPayees(nextPayees)
          setTags(nextTags)
          setTemplates(nextTemplates)
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

  const payeeQuery =
    form?.kind === 'expense' || form?.kind === 'income'
      ? form.payeeName
      : undefined
  useEffect(() => {
    if (payeeQuery === undefined) {
      setPayeeSuggestions([])
      return
    }
    let ignore = false
    void window.app.payees
      .suggest({ query: payeeQuery, limit: 10 })
      .then((suggestions) => {
        if (!ignore) setPayeeSuggestions(suggestions)
      })
      .catch(() => {
        if (!ignore) setPayeeSuggestions([])
      })
    return () => {
      ignore = true
    }
  }, [payeeQuery])

  const autofillAccountId = form?.accountId
  const autofillKind =
    form?.kind === 'expense' || form?.kind === 'income' ? form.kind : null
  const autofillAmount = form?.amount
  const autofillNote = form?.note
  const autofillPayeeName = form?.payeeName
  const autofillSplit = form?.splitLines
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
          return mergeRuleAutofill(current, autofill, autofillProtected.current)
        })
      })
      .catch(() => {})
    return () => {
      autofillRequest.current += 1
    }
  }, [
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

  function closeDrawer() {
    autofillRequest.current += 1
    setForm(null)
    setTemplateEditor(null)
    setDeletingTemplate(null)
    setSaveTemplateName(null)
    setSelectedTemplateId('')
  }

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
      tagId: filters.tagId || undefined,
      search: filters.search,
      exclusion: filters.exclusion,
      limit: 200,
      offset: 0,
    })
  }

  async function run(
    action: () => Promise<unknown>,
    offerUndo = false,
    nextForm: FormState | null = null,
  ) {
    setBusy(true)
    setError(null)
    try {
      await action()
      if (offerUndo) onTransactionChanged()
      setRequest((current) => ({ ...current, offset: 0 }))
      setRevision((current) => current + 1)
      closeDrawer()
      setForm(nextForm)
      if (nextForm) {
        autofillProtected.current = { category: false, tags: false }
        setFocusRevision((current) => current + 1)
      }
      setDeleting(null)
      setRenamingTag(null)
      setDeletingTag(null)
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
    save()
  }

  const feeCategoryDefault =
    categories.find(
      (category) => category.seedKey === 'expense.fees' && !category.archived,
    )?.id ?? ''

  function changeKind(kind: TransactionKind | 'transfer') {
    if (!form || busy || form.kind === kind || form.kind === 'adjustment')
      return
    // Expense/income can change kind; transfers use a separate command family.
    if (form.id && (form.kind === 'transfer' || kind === 'transfer')) return
    setForm({
      ...form,
      kind,
      categoryId: '',
      splitLines:
        kind === 'transfer'
          ? null
          : (form.splitLines?.map((line) => ({
              ...line,
              categoryId: '',
            })) ?? null),
      feeCategoryId: kind === 'transfer' ? feeCategoryDefault : '',
    })
  }

  function save(addAnother = false) {
    if (!form || busy) return
    const nextForm =
      addAnother && form.kind !== 'adjustment'
        ? {
            ...emptyForm(form.accountId),
            date: form.date,
            kind: form.kind,
            toAccountId: form.toAccountId,
            feeCategoryId: form.kind === 'transfer' ? feeCategoryDefault : '',
          }
        : null
    void run(
      () => {
        if (form.kind === 'adjustment') {
          const input = {
            accountId: form.accountId,
            date: form.date,
            observedMinor: parseAmountExpression(
              form.amount,
              selectedAccount?.currency ?? 'HUF',
              'adjustments.error.balance',
              { allowNegative: true, allowZero: true },
            ),
            note: form.note,
          }
          return form.id
            ? window.app.adjustments.update({ id: form.id, ...input })
            : window.app.adjustments.create(input)
        }
        if (form.kind === 'transfer') {
          const input = {
            fromAccountId: form.accountId,
            fromAmountMinor: parseAmountExpression(
              form.amount,
              selectedAccount?.currency ?? 'HUF',
              'transactions.error.amount',
            ),
            toAccountId: form.toAccountId,
            toAmountMinor: parseAmountExpression(
              form.toAmount,
              selectedToAccount?.currency ?? 'HUF',
              'transactions.error.amount',
            ),
            date: form.date,
            note: form.note,
            fee: form.feeAmount
              ? {
                  amountMinor: parseAmountExpression(
                    form.feeAmount,
                    selectedAccount?.currency ?? 'HUF',
                    'transactions.error.amount',
                  ),
                  categoryId: form.feeCategoryId || null,
                  excluded: form.feeExcluded,
                }
              : null,
          }
          return form.id
            ? window.app.transfers.update({ id: form.id, ...input })
            : window.app.transfers.create(input)
        }
        const input = {
          accountId: form.accountId,
          kind: form.kind,
          date: form.date,
          totalMinor: parseAmountExpression(
            form.amount,
            selectedAccount?.currency ?? 'HUF',
            'transactions.error.amount',
          ),
          payeeName: form.payeeName,
          categoryId: form.categoryId || null,
          note: form.note,
          tagNames: form.pendingTagName.trim()
            ? [...form.tagNames, form.pendingTagName.trim()]
            : form.tagNames,
          excluded: form.excluded,
          ...(form.splitLines
            ? {
                categoryId: null,
                note: '',
                tagNames: [],
                lines: form.splitLines.map((line) => ({
                  amountMinor: parseAmountExpression(
                    line.amount,
                    selectedAccount?.currency ?? 'HUF',
                    'transactions.error.amount',
                  ),
                  categoryId: line.categoryId || null,
                  note: line.note,
                  tagNames: line.pendingTagName.trim()
                    ? [...line.tagNames, line.pendingTagName.trim()]
                    : line.tagNames,
                })),
              }
            : {}),
        }
        return form.id
          ? window.app.transactions.update({ id: form.id, ...input })
          : window.app.transactions.create(input)
      },
      true,
      nextForm,
    )
  }

  function applyTemplate(template: TransactionTemplate) {
    autofillRequest.current += 1
    autofillProtected.current = templateAutofillProtection(template)
    const kind =
      template.kind ??
      categories.find((category) => category.id === template.categoryId)
        ?.kind ??
      'expense'
    const categoryId = template.categoryId ?? ''
    const accountId = template.accountId ?? accountOptions[0]?.id ?? ''
    setForm({
      ...emptyForm(accountId),
      kind,
      categoryId,
      amount:
        template.totalMinor === null ? '' : amountInput(template.totalMinor),
      payeeName: template.payeeName ?? '',
      note: template.note ?? '',
      tagNames: template.tagNames,
    })
    setTemplateEditor(null)
    setSaveTemplateName(null)
    setDeletingTemplate(null)
    setError(null)
    setFocusRevision((current) => current + 1)
  }

  function addTag() {
    if (!form || !form.pendingTagName.trim()) return
    const name = form.pendingTagName.trim()
    const key = (value: string) =>
      value.normalize('NFC').toLocaleLowerCase('und').normalize('NFC')
    autofillProtected.current.tags = true
    setForm({
      ...form,
      tagNames: form.tagNames.some((tag) => key(tag) === key(name))
        ? form.tagNames
        : [...form.tagNames, name],
      pendingTagName: '',
    })
  }

  function addSplitTag(key: string) {
    if (!form?.splitLines) return
    const line = form.splitLines.find((candidate) => candidate.key === key)
    if (!line?.pendingTagName.trim()) return
    const name = line.pendingTagName.trim()
    const normalized = (value: string) =>
      value.normalize('NFC').toLocaleLowerCase('und').normalize('NFC')
    setForm({
      ...form,
      splitLines: form.splitLines.map((candidate) =>
        candidate.key === key
          ? {
              ...candidate,
              tagNames: candidate.tagNames.some(
                (tag) => normalized(tag) === normalized(name),
              )
                ? candidate.tagNames
                : [...candidate.tagNames, name],
              pendingTagName: '',
            }
          : candidate,
      ),
    })
  }

  const savedTransaction = form?.id
    ? page.rows.find(
        (row): row is Transaction =>
          row.id === form.id &&
          (row.kind === 'expense' || row.kind === 'income'),
      )
    : undefined
  const selectedAccount = form
    ? accounts.find((account) => account.id === form.accountId)
    : undefined
  const selectedCategory = form
    ? categories.find((category) => category.id === form.categoryId)
    : undefined
  const formTransactionKind =
    form?.kind === 'expense' || form?.kind === 'income' ? form.kind : null
  const drawerAccounts = selectedAccount?.archived
    ? [selectedAccount, ...accountOptions]
    : accountOptions
  const drawerCategories =
    form && formTransactionKind
      ? [
          ...categories.filter(
            (category) =>
              (category.id === selectedCategory?.id ||
                form.splitLines?.some(
                  (line) => line.categoryId === category.id,
                )) &&
              !categoryOptions[formTransactionKind].some(
                ({ id }) => id === category.id,
              ),
          ),
          ...categoryOptions[formTransactionKind],
        ]
      : []
  const selectedToAccount = form
    ? accounts.find((account) => account.id === form.toAccountId)
    : undefined
  const transferAccounts = [
    ...[selectedAccount, selectedToAccount].filter(
      (account): account is Account => Boolean(account?.archived),
    ),
    ...accountOptions,
  ].filter(
    (account, index, all) =>
      all.findIndex((candidate) => candidate.id === account.id) === index,
  )
  const splitRemaining = (() => {
    if (!form?.splitLines || !selectedAccount) return null
    try {
      const total = parseAmountExpression(
        form.amount,
        selectedAccount.currency,
        'transactions.error.amount',
      )
      const used = form.splitLines.reduce(
        (sum, line) =>
          sum +
          parseAmountExpression(
            line.amount,
            selectedAccount.currency,
            'transactions.error.amount',
          ),
        0,
      )
      return total - used
    } catch {
      return null
    }
  })()

  return (
    <CardContent className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('transactions.listDescription')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={busy || loading}
            onClick={() => setForm(emptyForm(accountOptions[0]?.id))}
          >
            {t('templates.title')}
          </Button>
          <Button
            variant="ghost"
            disabled={busy || loading || accountOptions.length === 0}
            onClick={() => setForm(emptyAdjustmentForm(accountOptions[0]?.id))}
          >
            {t('adjustments.setRealBalance')}
          </Button>
          <Button
            ref={createRef}
            disabled={busy || loading || accountOptions.length === 0}
            onClick={() => {
              autofillProtected.current = { category: false, tags: false }
              setError(null)
              setDeleting(null)
              setForm(emptyForm(accountOptions[0]?.id))
            }}
          >
            {t('transactions.create')}
          </Button>
        </div>
      </div>
      {accountOptions.length === 0 && !loading && (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {t('transactions.noAccounts')}
        </p>
      )}
      {error && !form && (
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
          {t('tags.title')}
          <NativeSelect
            value={filters.tagId}
            onChange={(event) =>
              setFilters({ ...filters, tagId: event.target.value })
            }
          >
            <option value="">{t('tags.all')}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
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
        <label className="space-y-1 text-xs font-medium">
          {t('transactions.exclusion')}
          <NativeSelect
            value={filters.exclusion}
            onChange={(event) =>
              setFilters({
                ...filters,
                exclusion: event.target.value as TransactionExclusionFilter,
              })
            }
          >
            {(['all', 'onlyExcluded', 'hideExcluded'] as const).map(
              (exclusion) => (
                <option key={exclusion} value={exclusion}>
                  {t(`transactions.exclusion.${exclusion}`)}
                </option>
              ),
            )}
          </NativeSelect>
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
                onEdit={(transaction) => {
                  autofillProtected.current = { category: true, tags: true }
                  setForm(
                    transaction.kind === 'transfer'
                      ? {
                          id: transaction.id,
                          kind: 'transfer',
                          tagNames: [],
                          pendingTagName: '',
                          date: transaction.date,
                          accountId: transaction.fromAccountId,
                          amount: amountInput(transaction.fromAmountMinor),
                          payeeName: '',
                          categoryId: '',
                          note: transaction.note,
                          toAccountId: transaction.toAccountId,
                          toAmount: amountInput(transaction.toAmountMinor),
                          feeAmount: transaction.fee
                            ? amountInput(transaction.fee.totalMinor)
                            : '',
                          feeCategoryId: transaction.fee?.line.categoryId ?? '',
                          excluded: false,
                          feeExcluded: transaction.fee?.excluded ?? false,
                          splitLines: null,
                        }
                      : transaction.kind === 'adjustment'
                        ? {
                            id: transaction.id,
                            kind: 'adjustment',
                            tagNames: [],
                            pendingTagName: '',
                            date: transaction.date,
                            accountId: transaction.accountId,
                            amount: amountInput(transaction.observedMinor),
                            payeeName: '',
                            categoryId: '',
                            note: transaction.note,
                            toAccountId: '',
                            toAmount: '',
                            feeAmount: '',
                            feeCategoryId: '',
                            excluded: false,
                            feeExcluded: false,
                            splitLines: null,
                          }
                        : {
                            id: transaction.id,
                            kind: transaction.kind,
                            tagNames: transaction.line.tags.map(
                              (tag) => tag.name,
                            ),
                            pendingTagName: '',
                            date: transaction.date,
                            accountId: transaction.accountId,
                            amount: amountInput(transaction.totalMinor),
                            payeeName: transaction.payeeName ?? '',
                            categoryId: transaction.line.categoryId ?? '',
                            note: transaction.note,
                            toAccountId: '',
                            toAmount: '',
                            feeAmount: '',
                            feeCategoryId: '',
                            excluded: transaction.excluded,
                            feeExcluded: false,
                            splitLines:
                              transaction.lines.length > 1
                                ? transaction.lines.map((line) =>
                                    splitLine({
                                      amount: amountInput(line.amountMinor),
                                      categoryId: line.categoryId ?? '',
                                      note: line.note,
                                      tagNames: line.tags.map(
                                        (tag) => tag.name,
                                      ),
                                    }),
                                  )
                                : null,
                          },
                  )
                }}
                onDuplicate={(transaction) =>
                  void run(
                    () =>
                      window.app.transactions.duplicate({ id: transaction.id }),
                    true,
                  )
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
      <details className="space-y-3 rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {t('tags.manage')}
        </summary>
        {tags.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('tags.empty')}</p>
        )}
        <ul className="space-y-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span className="mr-auto">{tag.name}</span>
              <Button
                variant="ghost"
                disabled={busy || loading}
                onClick={() => {
                  setRenamingTag({ id: tag.id, name: tag.name })
                  setDeletingTag(null)
                }}
              >
                {t('tags.rename')}
              </Button>
              <Button
                variant="ghost"
                disabled={busy || loading}
                onClick={() => {
                  setDeletingTag(tag)
                  setRenamingTag(null)
                }}
              >
                {t('tags.delete')}
              </Button>
            </li>
          ))}
        </ul>
        {renamingTag && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void run(() => window.app.tags.rename(renamingTag), true)
            }}
          >
            <label className="space-y-1 text-sm">
              {t('tags.name')}
              <Input
                value={renamingTag.name}
                maxLength={100}
                required
                disabled={busy}
                onChange={(event) =>
                  setRenamingTag({ ...renamingTag, name: event.target.value })
                }
              />
            </label>
            <Button type="submit" disabled={busy}>
              {t('tags.save')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setRenamingTag(null)}
            >
              {t('transactions.cancel')}
            </Button>
          </form>
        )}
        {deletingTag && (
          <section role="alert" className="space-y-2 rounded-md bg-muted p-3">
            <p className="text-sm">
              {t('tags.deleteConfirmation')} <strong>{deletingTag.name}</strong>
            </p>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await window.app.tags.delete({ id: deletingTag.id })
                    if (filters.tagId === deletingTag.id)
                      setFilters({ ...filters, tagId: '' })
                    setRequest((current) =>
                      current.tagId === deletingTag.id
                        ? { ...current, tagId: undefined, offset: 0 }
                        : current,
                    )
                  }, true)
                }
              >
                {t('tags.delete')}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setDeletingTag(null)}
              >
                {t('transactions.cancel')}
              </Button>
            </div>
          </section>
        )}
      </details>
      {deleting && (
        <section role="alert" className="space-y-3 rounded-lg bg-muted p-4">
          <p className="text-sm">
            {t(
              deleting.kind === 'adjustment'
                ? 'adjustments.deleteConfirmation'
                : 'transactions.deleteConfirmation',
            )}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={busy || loading}
              onClick={() =>
                void run(
                  () =>
                    deleting.kind === 'transfer'
                      ? window.app.transfers.delete({ id: deleting.id })
                      : deleting.kind === 'adjustment'
                        ? window.app.adjustments.delete({ id: deleting.id })
                        : window.app.transactions.delete({ id: deleting.id }),
                  true,
                )
              }
            >
              {t(
                deleting.kind === 'adjustment'
                  ? 'adjustments.confirmDelete'
                  : 'transactions.confirmDelete',
              )}
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
            if (event.target === event.currentTarget && !busy) closeDrawer()
          }}
        >
          <section
            ref={dialogRef}
            tabIndex={-1}
            onKeyDownCapture={(event) => {
              const action = matchShortcut(event.nativeEvent, {
                scope: 'drawer',
                ...shortcutTargetContext(event.target),
              })
              if (!action) return
              if (
                action !== 'close' &&
                (templateEditor ||
                  (event.target instanceof Element &&
                    event.target.closest('[data-template-controls]')))
              )
                return
              // Let datalist fields accept a suggestion and tag fields add a
              // tag with Enter. Ctrl+Enter remains the batch-entry shortcut.
              if (
                action === 'save' &&
                event.target instanceof Element &&
                event.target.closest('[data-native-enter]')
              )
                return
              event.preventDefault()
              event.stopPropagation()
              if (busy) return
              if (action === 'close') closeDrawer()
              else if (
                action === 'expense' ||
                action === 'income' ||
                action === 'transfer'
              ) {
                changeKind(action)
                setFocusRevision((current) => current + 1)
              } else if (action === 'save') formRef.current?.requestSubmit()
              else if (
                action === 'saveAndAddAnother' &&
                formRef.current?.reportValidity()
              )
                save(true)
            }}
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
                {t(
                  form.kind === 'adjustment'
                    ? form.id
                      ? 'adjustments.edit'
                      : 'adjustments.setRealBalance'
                    : form.id
                      ? 'transactions.edit'
                      : 'transactions.create',
                )}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('transactions.close')}
                disabled={busy}
                onClick={closeDrawer}
              >
                <X aria-hidden="true" />
              </Button>
            </div>

            {error && (templateEditor || saveTemplateName !== null) && (
              <p role="alert" className="mb-4 text-sm text-error">
                {t(error)}
              </p>
            )}
            <section
              data-template-controls
              className="mb-6 space-y-3 rounded-md border p-3"
              aria-label={t('templates.title')}
            >
              <label className="block space-y-1 text-sm font-medium">
                {t('templates.title')}
                <NativeSelect
                  value={selectedTemplateId}
                  disabled={busy}
                  onChange={(event) => {
                    setSelectedTemplateId(event.target.value)
                    setDeletingTemplate(null)
                    setTemplateEditor(null)
                  }}
                >
                  <option value="">{t('templates.choose')}</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || !selectedTemplateId}
                  onClick={() => {
                    const template = templates.find(
                      ({ id }) => id === selectedTemplateId,
                    )
                    if (template) applyTemplate(template)
                  }}
                >
                  {t('templates.use')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setTemplateEditor('new')
                    setSaveTemplateName(null)
                    setDeletingTemplate(null)
                  }}
                >
                  {t('templates.create')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || !selectedTemplateId}
                  onClick={() => {
                    setTemplateEditor(
                      templates.find(({ id }) => id === selectedTemplateId) ??
                        null,
                    )
                    setSaveTemplateName(null)
                    setDeletingTemplate(null)
                  }}
                >
                  {t('templates.edit')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || !selectedTemplateId}
                  onClick={() => {
                    setDeletingTemplate(
                      templates.find(({ id }) => id === selectedTemplateId) ??
                        null,
                    )
                    setTemplateEditor(null)
                    setSaveTemplateName(null)
                  }}
                >
                  {t('templates.delete')}
                </Button>
              </div>
              {savedTransaction && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    disabled={busy || savedTransaction.lines.length > 1}
                    onClick={() => {
                      setSaveTemplateName('')
                      setTemplateEditor(null)
                      setDeletingTemplate(null)
                    }}
                  >
                    {t('templates.saveTransaction')}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          window.app.transactions.duplicate({
                            id: savedTransaction.id,
                          }),
                        true,
                      )
                    }
                  >
                    {t('transactions.duplicate')}
                  </Button>
                </div>
              )}
              {saveTemplateName !== null &&
                savedTransaction?.lines.length === 1 && (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void run(
                        () =>
                          window.app.templates.saveTransaction({
                            transactionId: savedTransaction.id,
                            name: saveTemplateName,
                          }),
                        true,
                      )
                    }}
                  >
                    <p className="text-xs text-muted-foreground">
                      {t('templates.savedTransactionHint')}
                    </p>
                    <label className="block space-y-1 text-sm font-medium">
                      {t('templates.name')}
                      <Input
                        value={saveTemplateName}
                        required
                        maxLength={100}
                        disabled={busy}
                        onChange={(event) =>
                          setSaveTemplateName(event.target.value)
                        }
                      />
                    </label>
                    <Button type="submit" disabled={busy}>
                      {t('templates.save')}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setSaveTemplateName(null)}
                    >
                      {t('transactions.cancel')}
                    </Button>
                  </form>
                )}
              {deletingTemplate && (
                <section role="alert" className="space-y-2">
                  <p>
                    {t('templates.deleteConfirmation')}{' '}
                    <strong>{deletingTemplate.name}</strong>
                  </p>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          window.app.templates.delete({
                            id: deletingTemplate.id,
                          }),
                        true,
                      )
                    }
                  >
                    {t('templates.delete')}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setDeletingTemplate(null)}
                  >
                    {t('transactions.cancel')}
                  </Button>
                </section>
              )}
            </section>
            {templateEditor ? (
              <TemplateEditor
                key={templateEditor === 'new' ? 'new' : templateEditor.id}
                template={templateEditor === 'new' ? undefined : templateEditor}
                accounts={accounts}
                categories={categories}
                language={language}
                t={t}
                busy={busy}
                onCancel={() => setTemplateEditor(null)}
                onSave={(input) =>
                  void run(
                    () =>
                      templateEditor === 'new'
                        ? window.app.templates.create(input)
                        : window.app.templates.update({
                            id: templateEditor.id,
                            ...input,
                          }),
                    true,
                  )
                }
              />
            ) : (
              <form ref={formRef} className="space-y-4" onSubmit={submit}>
                {selectedTemplateId && !form.amount && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {t('templates.amountRequired')}
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="transaction-amount"
                      className="text-sm font-medium"
                    >
                      {t(
                        form.kind === 'transfer'
                          ? 'transactions.fromAmount'
                          : form.kind === 'adjustment'
                            ? 'adjustments.observedBalance'
                            : 'transactions.amount',
                      )}
                    </label>
                    <AmountInput
                      id="transaction-amount"
                      ref={amountRef}
                      value={form.amount}
                      currency={selectedAccount?.currency ?? 'HUF'}
                      language={language}
                      t={t}
                      errorKey={
                        form.kind === 'adjustment'
                          ? 'adjustments.error.balance'
                          : 'transactions.error.amount'
                      }
                      hintKey="transactions.amountHint"
                      allowNegative={form.kind === 'adjustment'}
                      allowZero={form.kind === 'adjustment'}
                      disabled={busy}
                      onChange={(amount) => setForm({ ...form, amount })}
                    />
                  </div>
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
                </div>
                {form.kind !== 'adjustment' && (
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
                        changeKind(
                          event.target.value as TransactionKind | 'transfer',
                        )
                      }
                    >
                      <option
                        value="expense"
                        disabled={Boolean(form.id && form.kind === 'transfer')}
                      >
                        {t('transactions.expense')}
                      </option>
                      <option
                        value="income"
                        disabled={Boolean(form.id && form.kind === 'transfer')}
                      >
                        {t('transactions.income')}
                      </option>
                      <option
                        value="transfer"
                        disabled={Boolean(form.id && form.kind !== 'transfer')}
                      >
                        {t('transactions.transfer')}
                      </option>
                    </NativeSelect>
                  </div>
                )}
                <div className="space-y-2">
                  <label
                    htmlFor="transaction-account"
                    className="text-sm font-medium"
                  >
                    {t(
                      form.kind === 'transfer'
                        ? 'transactions.fromAccount'
                        : 'transactions.account',
                    )}
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
                    {(form.kind === 'transfer'
                      ? transferAccounts
                      : drawerAccounts
                    ).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.currency})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                {form.kind === 'transfer' && (
                  <>
                    <div className="space-y-2">
                      <label
                        htmlFor="transfer-to-account"
                        className="text-sm font-medium"
                      >
                        {t('transactions.toAccount')}
                      </label>
                      <NativeSelect
                        id="transfer-to-account"
                        value={form.toAccountId}
                        required
                        disabled={busy}
                        onChange={(event) =>
                          setForm({ ...form, toAccountId: event.target.value })
                        }
                      >
                        <option value="" disabled>
                          {t('transactions.chooseAccount')}
                        </option>
                        {transferAccounts.map((account) => (
                          <option
                            key={account.id}
                            value={account.id}
                            disabled={account.id === form.accountId}
                          >
                            {account.name} ({account.currency})
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="transfer-to-amount"
                        className="text-sm font-medium"
                      >
                        {t('transactions.toAmount')}
                      </label>
                      <AmountInput
                        id="transfer-to-amount"
                        value={form.toAmount}
                        currency={selectedToAccount?.currency ?? 'HUF'}
                        language={language}
                        t={t}
                        errorKey="transactions.error.amount"
                        hintKey="transactions.amountHint"
                        disabled={busy}
                        onChange={(toAmount) => setForm({ ...form, toAmount })}
                      />
                    </div>
                  </>
                )}

                {(form.kind === 'expense' || form.kind === 'income') && (
                  <div className="flex flex-wrap items-center gap-2">
                    {!form.splitLines ? (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          autofillProtected.current = {
                            category: true,
                            tags: true,
                          }
                          setForm({
                            ...form,
                            splitLines: [
                              splitLine({
                                categoryId: form.categoryId,
                                note: form.note,
                                tagNames: form.tagNames,
                                pendingTagName: form.pendingTagName,
                              }),
                              splitLine(),
                            ],
                          })
                        }}
                      >
                        {t('splits.split')}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            autofillProtected.current = {
                              category: true,
                              tags: true,
                            }
                            const first = form.splitLines![0]
                            setForm({
                              ...form,
                              categoryId: first.categoryId,
                              note: first.note,
                              tagNames: first.tagNames,
                              pendingTagName: first.pendingTagName,
                              splitLines: null,
                            })
                          }}
                        >
                          {t('splits.unsplit')}
                        </Button>
                        <span
                          className={`text-sm font-medium ${splitRemaining === 0 ? '' : 'text-error'}`}
                          role="status"
                        >
                          {t('splits.remaining')}:{' '}
                          {splitRemaining === null || !selectedAccount
                            ? '—'
                            : createFormatters(language).money(
                                splitRemaining,
                                selectedAccount.currency,
                              )}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {(form.kind === 'expense' || form.kind === 'income') &&
                  form.splitLines && (
                    <div className="space-y-3">
                      <datalist id="transaction-tags">
                        {tags.map((tag) => (
                          <option key={tag.id} value={tag.name} />
                        ))}
                      </datalist>
                      {form.splitLines.map((line, lineIndex) => (
                        <section
                          key={line.key}
                          className="space-y-3 rounded-md border p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">
                              {t('splits.part')} {lineIndex + 1}
                            </h3>
                            <Button
                              variant="ghost"
                              disabled={busy || form.splitLines!.length <= 1}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  splitLines: form.splitLines!.filter(
                                    (candidate) => candidate.key !== line.key,
                                  ),
                                })
                              }
                            >
                              {t('splits.remove')}
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor={`split-amount-${line.key}`}
                              className="text-sm font-medium"
                            >
                              {t('transactions.amount')}
                            </label>
                            <AmountInput
                              id={`split-amount-${line.key}`}
                              value={line.amount}
                              currency={selectedAccount?.currency ?? 'HUF'}
                              language={language}
                              t={t}
                              errorKey="transactions.error.amount"
                              hintKey="transactions.amountHint"
                              disabled={busy}
                              onChange={(amount) =>
                                setForm({
                                  ...form,
                                  splitLines: form.splitLines!.map(
                                    (candidate) =>
                                      candidate.key === line.key
                                        ? { ...candidate, amount }
                                        : candidate,
                                  ),
                                })
                              }
                            />
                          </div>
                          <label className="block space-y-1 text-sm font-medium">
                            {t('transactions.category')}
                            <NativeSelect
                              value={line.categoryId}
                              disabled={busy}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  splitLines: form.splitLines!.map(
                                    (candidate) =>
                                      candidate.key === line.key
                                        ? {
                                            ...candidate,
                                            categoryId: event.target.value,
                                          }
                                        : candidate,
                                  ),
                                })
                              }
                            >
                              <option value="">
                                {t('transactions.noCategory')}
                              </option>
                              {drawerCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.parentId
                                    ? `— ${category.name}`
                                    : category.name}
                                </option>
                              ))}
                            </NativeSelect>
                          </label>
                          <div className="space-y-1">
                            <label
                              htmlFor={`split-tag-${line.key}`}
                              className="text-sm font-medium"
                            >
                              {t('tags.title')}
                            </label>
                            <div className="flex gap-2">
                              <Input
                                id={`split-tag-${line.key}`}
                                data-native-enter
                                list="transaction-tags"
                                value={line.pendingTagName}
                                maxLength={100}
                                disabled={busy}
                                onChange={(event) =>
                                  setForm({
                                    ...form,
                                    splitLines: form.splitLines!.map(
                                      (candidate) =>
                                        candidate.key === line.key
                                          ? {
                                              ...candidate,
                                              pendingTagName:
                                                event.target.value,
                                            }
                                          : candidate,
                                    ),
                                  })
                                }
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    addSplitTag(line.key)
                                  }
                                }}
                              />
                              <Button
                                disabled={busy || !line.pendingTagName.trim()}
                                onClick={() => addSplitTag(line.key)}
                              >
                                {t('tags.add')}
                              </Button>
                            </div>
                            <ul className="flex flex-wrap gap-2">
                              {line.tagNames.map((name, tagIndex) => (
                                <li
                                  key={`${name}-${tagIndex}`}
                                  className="inline-flex items-center rounded-md bg-muted px-2 text-sm"
                                >
                                  {name}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    disabled={busy}
                                    aria-label={`${t('tags.remove')}: ${name}`}
                                    onClick={() =>
                                      setForm({
                                        ...form,
                                        splitLines: form.splitLines!.map(
                                          (candidate) =>
                                            candidate.key === line.key
                                              ? {
                                                  ...candidate,
                                                  tagNames:
                                                    candidate.tagNames.filter(
                                                      (_, index) =>
                                                        index !== tagIndex,
                                                    ),
                                                }
                                              : candidate,
                                        ),
                                      })
                                    }
                                  >
                                    <X aria-hidden="true" className="size-3" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <label className="block space-y-1 text-sm font-medium">
                            {t('transactions.note')}
                            <textarea
                              className="min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                              value={line.note}
                              maxLength={1000}
                              disabled={busy}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  splitLines: form.splitLines!.map(
                                    (candidate) =>
                                      candidate.key === line.key
                                        ? {
                                            ...candidate,
                                            note: event.target.value,
                                          }
                                        : candidate,
                                  ),
                                })
                              }
                            />
                          </label>
                        </section>
                      ))}
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          setForm({
                            ...form,
                            splitLines: [...form.splitLines!, splitLine()],
                          })
                        }
                      >
                        {t('splits.addPart')}
                      </Button>
                    </div>
                  )}
                {(form.kind === 'expense' || form.kind === 'income') && (
                  <div className="space-y-2">
                    <label
                      htmlFor="transaction-payee"
                      className="text-sm font-medium"
                    >
                      {t('transactions.payee')}
                    </label>
                    <Input
                      id="transaction-payee"
                      data-native-enter
                      list="transaction-payees"
                      value={form.payeeName}
                      maxLength={100}
                      disabled={busy}
                      onChange={(event) =>
                        setForm({ ...form, payeeName: event.target.value })
                      }
                    />
                    <datalist id="transaction-payees">
                      {payeeSuggestions.map((payee) => (
                        <option key={payee.id} value={payee.name} />
                      ))}
                    </datalist>
                    <p className="text-xs text-muted-foreground">
                      {t('transactions.payeeHint')}
                    </p>
                  </div>
                )}

                {(form.kind === 'expense' || form.kind === 'income') &&
                  !form.splitLines && (
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
                        onChange={(event) => {
                          autofillProtected.current.category = true
                          setForm({
                            ...form,
                            categoryId: event.target.value,
                          })
                        }}
                      >
                        <option value="">{t('transactions.noCategory')}</option>
                        {drawerCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.parentId
                              ? `— ${category.name}`
                              : category.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  )}
                {form.kind === 'transfer' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        htmlFor="transfer-fee"
                        className="text-sm font-medium"
                      >
                        {t('transactions.fee')}
                      </label>
                      <AmountInput
                        id="transfer-fee"
                        value={form.feeAmount}
                        currency={selectedAccount?.currency ?? 'HUF'}
                        language={language}
                        t={t}
                        errorKey="transactions.error.amount"
                        hintKey="transactions.amountHint"
                        required={false}
                        placeholder={t('transactions.optional')}
                        disabled={busy}
                        onChange={(feeAmount) =>
                          setForm({ ...form, feeAmount })
                        }
                      />
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={form.feeExcluded}
                          disabled={busy || !form.feeAmount}
                          aria-describedby="transfer-fee-excluded-hint"
                          onChange={(event) =>
                            setForm({
                              ...form,
                              feeExcluded: event.target.checked,
                            })
                          }
                          className="size-4 accent-primary"
                        />
                        {t('transactions.excluded')}
                      </label>
                      <p
                        id="transfer-fee-excluded-hint"
                        className="text-xs text-muted-foreground"
                      >
                        {t('transactions.excludedHint')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="transfer-fee-category"
                        className="text-sm font-medium"
                      >
                        {t('transactions.feeCategory')}
                      </label>
                      <NativeSelect
                        id="transfer-fee-category"
                        value={form.feeCategoryId}
                        disabled={busy || !form.feeAmount}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            feeCategoryId: event.target.value,
                          })
                        }
                      >
                        <option value="">{t('transactions.noCategory')}</option>
                        {categoryOptions.expense.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.parentId
                              ? `— ${category.name}`
                              : category.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  </div>
                )}

                {(form.kind === 'expense' || form.kind === 'income') &&
                  !form.splitLines && (
                    <div className="space-y-2">
                      <label
                        htmlFor="transaction-tag"
                        className="text-sm font-medium"
                      >
                        {t('tags.title')}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          id="transaction-tag"
                          data-native-enter
                          list="transaction-tags"
                          value={form.pendingTagName}
                          maxLength={100}
                          disabled={busy}
                          onChange={(event) => {
                            autofillProtected.current.tags = true
                            setForm({
                              ...form,
                              pendingTagName: event.target.value,
                            })
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              addTag()
                            }
                          }}
                        />
                        <Button
                          disabled={busy || !form.pendingTagName.trim()}
                          onClick={addTag}
                        >
                          {t('tags.add')}
                        </Button>
                      </div>
                      <datalist id="transaction-tags">
                        {tags.map((tag) => (
                          <option key={tag.id} value={tag.name} />
                        ))}
                      </datalist>
                      <p className="text-xs text-muted-foreground">
                        {t('tags.hint')}
                      </p>
                      <ul className="flex flex-wrap gap-2">
                        {form.tagNames.map((name, index) => (
                          <li
                            key={name}
                            className="inline-flex items-center rounded-md bg-muted px-2 text-sm"
                          >
                            {name}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={busy}
                              aria-label={`${t('tags.remove')}: ${name}`}
                              onClick={() => {
                                autofillProtected.current.tags = true
                                setForm({
                                  ...form,
                                  tagNames: form.tagNames.filter(
                                    (_, candidate) => candidate !== index,
                                  ),
                                })
                              }}
                            >
                              <X aria-hidden="true" className="size-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {!form.splitLines && (
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
                )}
                {(form.kind === 'expense' || form.kind === 'income') && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={form.excluded}
                        disabled={busy}
                        aria-describedby="transaction-excluded-hint"
                        onChange={(event) =>
                          setForm({ ...form, excluded: event.target.checked })
                        }
                        className="size-4 accent-primary"
                      />
                      {t('transactions.excluded')}
                    </label>
                    <p
                      id="transaction-excluded-hint"
                      className="text-xs text-muted-foreground"
                    >
                      {t('transactions.excludedHint')}
                    </p>
                  </div>
                )}
                {error && (
                  <p role="alert" className="text-sm font-medium text-error">
                    {t(error)}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="submit" disabled={busy}>
                    {t(
                      form.kind === 'adjustment'
                        ? 'adjustments.save'
                        : 'transactions.save',
                    )}
                  </Button>
                  {form.kind !== 'adjustment' && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (formRef.current?.reportValidity()) save(true)
                      }}
                    >
                      {t('transactions.saveAndAddAnother')}
                    </Button>
                  )}
                  <Button variant="ghost" disabled={busy} onClick={closeDrawer}>
                    {t('transactions.cancel')}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </CardContent>
  )
}
