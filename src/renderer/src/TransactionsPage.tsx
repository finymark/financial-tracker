import { reportFlagsForCategory } from './lib/transaction-report-filter'
import type { Currency } from '../../shared/accounts'
import type { CreateCategorisationRuleInput } from '../../shared/rules'
import { CreateRuleDialog } from './components/create-rule-dialog'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type {
  Transaction,
  TransactionPage,
  TransactionListInput,
  TransactionPeriod,
  TransactionExclusionFilter,
} from '../../shared/transactions'
import type { Transfer } from '../../shared/transfers'
import type { BalanceAdjustment } from '../../shared/adjustments'
import { Button } from './components/ui/button'
import { CardContent } from './components/ui/card'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import type { Language, MessageKey } from './i18n'
import {
  BaseCurrencyTotals,
  TransactionTable,
  Totals,
} from './components/transaction-table'
import { TransactionDrawer } from './components/transactions/transaction-drawer'
import { TagManager } from './components/transactions/tag-manager'
import { ExportCsvDialog } from './components/transactions/export-csv-dialog'
import {
  emptyForm,
  emptyAdjustmentForm,
  movementForm,
  transactionError,
  type DrawerForm,
} from './components/transactions/transaction-form'
import { useTransactionReferenceData } from './components/transactions/use-transaction-reference-data'
import {
  recurringPrefillFromTransaction,
  type RecurringPrefill,
} from './lib/recurring-prefill'
interface TransactionsPageProps {
  language: Language
  baseCurrency: Currency
  t(key: MessageKey): string
  undoRevision: number
  newTransactionRequested: boolean
  onNewTransactionHandled(): void
  onTransactionChanged(): void
  onCreateRecurring(prefill: RecurringPrefill): void
  initialReportFilter: TransactionListInput | null
}

export function TransactionsPage({
  language,
  baseCurrency,
  t,
  undoRevision,
  newTransactionRequested,
  onNewTransactionHandled,
  onTransactionChanged,
  onCreateRecurring,
  initialReportFilter,
}: TransactionsPageProps) {
  const [reportFilterActive, setReportFilterActive] = useState(
    Boolean(
      initialReportFilter?.kind ||
      initialReportFilter?.uncategorized ||
      initialReportFilter?.exactCategory,
    ),
  )
  const [page, setPage] = useState<TransactionPage>({
    rows: [],
    totals: [],
    days: [],
    totalCount: 0,
    baseTotals: {
      currency: baseCurrency,
      expenseMinor: 0,
      incomeMinor: 0,
      unconverted: [],
      stale: false,
    },
  })
  const [request, setRequest] = useState<TransactionListInput>(
    initialReportFilter ?? {
      period: 'all',
      limit: 200,
      offset: 0,
    },
  )
  const [filters, setFilters] = useState({
    period: (initialReportFilter?.period ?? 'all') as TransactionPeriod,
    from: initialReportFilter?.from ?? '',
    to: initialReportFilter?.to ?? '',
    accountId: initialReportFilter?.accountId ?? '',
    categoryId: initialReportFilter?.categoryId ?? '',
    payeeId: initialReportFilter?.payeeId ?? '',
    tagId: initialReportFilter?.tagId ?? '',
    search: initialReportFilter?.search ?? '',
    exclusion: (initialReportFilter?.exclusion ??
      'all') as TransactionExclusionFilter,
  })
  const [revision, setRevision] = useState(0)
  const references = useTransactionReferenceData(
    revision,
    language,
    undoRevision,
  )
  const { accounts, categories, accountOptions, payees, tags } = references
  const pageKey = useMemo(
    () => ({ request, revision, language, undoRevision }),
    [request, revision, language, undoRevision],
  )
  const [loadedPageKey, setLoadedPageKey] = useState<typeof pageKey | null>(
    null,
  )
  const pageLoading = loadedPageKey !== pageKey
  const loading = pageLoading || references.loading
  const [busy, setBusy] = useState(false)
  const [commandError, setError] = useState<MessageKey | null>(null)
  const [previousPageKey, setPreviousPageKey] = useState(pageKey)
  if (previousPageKey !== pageKey) {
    setPreviousPageKey(pageKey)
    setError(null)
  }
  const error = commandError ?? references.error
  const [ruleOffer, setRuleOffer] =
    useState<CreateCategorisationRuleInput | null>(null)
  const [editingRule, setEditingRule] =
    useState<CreateCategorisationRuleInput | null>(null)
  const [previousUndoRevision, setPreviousUndoRevision] = useState(undoRevision)
  if (previousUndoRevision !== undoRevision) {
    setPreviousUndoRevision(undoRevision)
    setRuleOffer(null)
    setEditingRule(null)
  }
  const [form, setForm] = useState<DrawerForm | null>(null)
  const createRef = useRef<HTMLButtonElement>(null)
  const exportRef = useRef<HTMLButtonElement>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [csvSaved, setCsvSaved] = useState(false)
  const [deleting, setDeleting] = useState<
    Transaction | Transfer | BalanceAdjustment | null
  >(null)
  useEffect(() => {
    if (!newTransactionRequested || loading || busy) return
    let ignore = false
    queueMicrotask(() => {
      if (ignore) return
      if (accountOptions.length > 0) {
        setError(null)
        setDeleting(null)
        setForm(emptyForm(accountOptions[0].id))
      }
      onNewTransactionHandled()
    })
    return () => {
      ignore = true
    }
  }, [
    newTransactionRequested,
    loading,
    busy,
    accountOptions,
    onNewTransactionHandled,
  ])

  useEffect(() => {
    let ignore = false
    void window.app.transactions
      .list(request)
      .then((nextPage) => {
        if (!ignore) setPage(nextPage)
      })
      .catch((error: unknown) => {
        if (!ignore) setError(transactionError(error))
      })
      .finally(() => {
        if (!ignore) setLoadedPageKey(pageKey)
      })
    return () => {
      ignore = true
    }
  }, [request, revision, language, undoRevision, pageKey])
  function applyFilters(event: FormEvent) {
    event.preventDefault()
    const reportFlags = reportFilterActive
      ? reportFlagsForCategory(request, filters.categoryId)
      : {}
    setReportFilterActive(
      Boolean(
        reportFlags.kind ||
        reportFlags.uncategorized ||
        reportFlags.exactCategory,
      ),
    )
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
      ...reportFlags,
      limit: 200,
      offset: 0,
    })
  }

  const reportFilterParts = reportFilterActive
    ? [
        request.uncategorized
          ? t('reports.uncategorized')
          : request.categoryId
            ? categories.find((category) => category.id === request.categoryId)
                ?.name
            : null,
        request.exactCategory
          ? t('reports.transactionFilter.exactCategory')
          : null,
        request.kind ? t(`reports.transactionFilter.${request.kind}`) : null,
      ].filter((part): part is string => Boolean(part))
    : []

  function clearReportFlags() {
    setReportFilterActive(false)
    setRequest((current) => {
      const next = { ...current }
      delete next.kind
      delete next.uncategorized
      delete next.exactCategory
      return { ...next, offset: 0 }
    })
  }

  async function run(
    action: () => Promise<unknown>,
    offerUndo = false,
    nextForm: DrawerForm | null = null,
  ) {
    setBusy(true)
    setError(null)
    setRuleOffer(null)
    try {
      await action()
      if (offerUndo) onTransactionChanged()
      setRequest((current) => ({ ...current, offset: 0 }))
      setRevision((current) => current + 1)
      setForm(nextForm)
      setEditingRule(null)
      setDeleting(null)
    } catch (error) {
      setError(transactionError(error))
    } finally {
      setBusy(false)
    }
  }

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
        {reportFilterActive && (
          <div className="flex items-center gap-2 self-end text-xs text-muted-foreground sm:col-span-3 lg:col-span-6">
            <span className="rounded-full border bg-muted px-3 py-1">
              {t('reports.transactionFilter')} {reportFilterParts.join(', ')}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={clearReportFlags}
              aria-label={t('reports.transactionFilter.clear')}
            >
              {t('reports.transactionFilter.clear')}
            </Button>
          </div>
        )}
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
        <Button
          ref={exportRef}
          type="button"
          variant="ghost"
          disabled={busy || loading}
          className="self-end"
          onClick={() => {
            setCsvSaved(false)
            setExportOpen(true)
          }}
        >
          {t('csv.export')}
        </Button>
      </form>
      {csvSaved && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('csv.saved')}
        </p>
      )}
      {exportOpen && (
        <ExportCsvDialog
          input={request}
          language={language}
          t={t}
          exportRef={exportRef}
          onClose={() => setExportOpen(false)}
          onSaved={() => {
            setCsvSaved(true)
            setExportOpen(false)
          }}
        />
      )}
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
              <span className="inline-flex flex-col items-end gap-1">
                <Totals totals={page.totals} language={language} t={t} />
                <BaseCurrencyTotals
                  totals={page.baseTotals}
                  language={language}
                  t={t}
                />
              </span>
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
                onEdit={(transaction) => setForm(movementForm(transaction))}
                onDuplicate={(transaction) =>
                  void run(
                    () =>
                      window.app.transactions.duplicate({ id: transaction.id }),
                    true,
                  )
                }
                onCreateRecurring={(transaction) => {
                  const prefill = recurringPrefillFromTransaction(transaction)
                  if (prefill) onCreateRecurring(prefill)
                }}
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
      <TagManager
        revision={revision}
        tags={tags}
        busy={busy}
        loading={loading}
        t={t}
        run={run}
        onDeleted={(id) => {
          if (filters.tagId === id) setFilters({ ...filters, tagId: '' })
          setRequest((current) =>
            current.tagId === id
              ? { ...current, tagId: undefined, offset: 0 }
              : current,
          )
        }}
      />
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
                  : deleting.kind !== 'transfer' &&
                      deleting.attachments.length > 0
                    ? 'attachments.deleteWithTransaction'
                    : 'transactions.confirmDelete',
              )}
            </Button>
            {deleting.kind !== 'transfer' &&
              deleting.kind !== 'adjustment' &&
              deleting.attachments.length > 0 && (
                <Button
                  variant="ghost"
                  disabled={busy || loading}
                  onClick={() =>
                    void window.app.attachments
                      .pickCopyFolder()
                      .then((folder) => {
                        if (folder)
                          void run(
                            () =>
                              window.app.transactions.delete({
                                id: deleting.id,
                                saveAttachmentsTo: folder,
                              }),
                            true,
                          )
                      })
                      .catch((error: unknown) =>
                        setError(transactionError(error)),
                      )
                  }
                >
                  {t('attachments.saveCopiesAndDelete')}
                </Button>
              )}
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
        <TransactionDrawer
          draft={form}
          references={references}
          rows={page.rows}
          language={language}
          t={t}
          busy={busy}
          error={error}
          clearError={() => setError(null)}
          run={run}
          onClose={() => setForm(null)}
          onRuleOffer={setRuleOffer}
          onCreateRecurring={onCreateRecurring}
          onAttachmentChanged={() => {
            onTransactionChanged()
            setRevision((current) => current + 1)
          }}
          createRef={createRef}
        />
      )}
      {ruleOffer && (
        <aside
          role="status"
          className="fixed right-4 bottom-24 z-40 max-w-sm space-y-2 rounded-lg border bg-card p-4 shadow-lg"
        >
          <p className="text-sm">{t('rules.offer')}</p>
          <div className="flex gap-2">
            <Button
              disabled={busy || loading}
              onClick={() => {
                setEditingRule(ruleOffer)
                setRuleOffer(null)
                setForm(null)
                setError(null)
              }}
            >
              {t('rules.create')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setRuleOffer(null)}
            >
              {t('rules.offerDismiss')}
            </Button>
          </div>
        </aside>
      )}
      {editingRule && (
        <CreateRuleDialog
          prefill={editingRule}
          references={references}
          baseCurrency={baseCurrency}
          language={language}
          t={t}
          busy={busy}
          error={error}
          createRef={createRef}
          onClose={() => {
            setEditingRule(null)
            setError(null)
          }}
          onSave={(input) =>
            void run(() => window.app.rules.create(input), true)
          }
        />
      )}
    </CardContent>
  )
}
