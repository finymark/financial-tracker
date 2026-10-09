import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import type { Receipt } from '../../shared/receipts'
import type { Language, MessageKey } from './i18n'
import { CardContent } from './components/ui/card'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import { AmountInput } from './components/amount-input'
import {
  addPendingTag,
  createTransactionInput,
  emptyForm,
  transactionError,
  type TransactionForm,
} from './components/transactions/transaction-form'
import { useTransactionReferenceData } from './components/transactions/use-transaction-reference-data'
import { createFormatters } from './i18n'
import { matchShortcut } from './lib/shortcuts'
import { shortcutTargetContext } from './lib/shortcut-context'
import { today } from '../../shared/date'
import { PhoneUploadDialog } from './components/phone-upload-dialog'
import { amountInput } from './lib/amount-input-value'
import { HelpHint } from './components/ui/help-hint'

type OcrField = 'amount' | 'date' | 'account' | 'payee' | 'category' | 'tags'

interface Props {
  language: Language
  t(key: MessageKey): string
  undoRevision: number
  onChanged(): void
}

function ReceiptImage({
  receipt,
  thumbnail,
  alt,
}: {
  receipt: Receipt
  thumbnail: boolean
  alt: string
}) {
  const [source, setSource] = useState<string | null>(null)
  useEffect(() => {
    let ignore = false
    void window.app.receipts
      .preview({ id: receipt.id, thumbnail })
      .then((value) => {
        if (!ignore) setSource(value)
      })
      .catch(() => {
        if (!ignore) setSource(null)
      })
    return () => {
      ignore = true
    }
  }, [receipt.id, thumbnail])
  return source ? (
    <img
      src={source}
      alt={alt}
      className={
        thumbnail
          ? 'size-20 rounded-md object-cover'
          : 'max-h-[70vh] w-full rounded-lg object-contain'
      }
    />
  ) : (
    <div
      className={
        thumbnail
          ? 'grid size-20 place-items-center rounded-md bg-muted'
          : 'grid min-h-64 place-items-center rounded-lg bg-muted'
      }
      aria-label={alt}
    >
      <ImageIcon aria-hidden="true" className="text-muted-foreground" />
    </div>
  )
}

export function ReceiptInboxPage({
  language,
  t,
  undoRevision,
  onChanged,
}: Props) {
  const [items, setItems] = useState<Receipt[]>([])
  const [selected, setSelected] = useState<Receipt | null>(null)
  const [form, setForm] = useState<TransactionForm | null>(null)
  const [defaultAccountId, setDefaultAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [showPhoneUpload, setShowPhoneUpload] = useState(false)
  const phoneUploadRef = useRef<HTMLButtonElement>(null)
  const [ocrFields, setOcrFields] = useState<Set<OcrField>>(new Set())
  const [lowConfidence, setLowConfidence] = useState(false)
  const [currencyMismatch, setCurrencyMismatch] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const manuallyEdited = useRef(new Set<OcrField>())
  const prefetchedReceiptId = useRef<string | null>(null)
  const references = useTransactionReferenceData(0, language, undoRevision)
  const format = createFormatters(language)
  const selectedId = selected?.id
  const selectedStatus = selected?.status

  const load = useCallback(() => {
    void Promise.all([
      window.app.receipts.list(),
      window.app.receipts.defaultAccountId(),
    ])
      .then(([receipts, accountId]) => {
        setItems(receipts)
        setSelected((current) =>
          current
            ? (receipts.find((receipt) => receipt.id === current.id) ?? null)
            : null,
        )
        setDefaultAccountId(accountId ?? '')
        setError(null)
      })
      .catch(() => setError('receipts.error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load, undoRevision])
  useEffect(() => window.app.receipts.onChanged(load), [load])
  useEffect(() => {
    if (selectedId) amountRef.current?.focus()
  }, [selectedId])
  useEffect(() => {
    if (
      !selectedId ||
      selectedStatus !== 'read' ||
      prefetchedReceiptId.current === selectedId
    )
      return
    prefetchedReceiptId.current = selectedId
    let ignore = false
    void window.app.receipts
      .prefill({ id: selectedId })
      .then((prefill) => {
        if (ignore) return
        const fields = new Set<OcrField>()
        if (
          prefill.totalMinor !== null &&
          !manuallyEdited.current.has('amount')
        )
          fields.add('amount')
        if (prefill.date && !manuallyEdited.current.has('date'))
          fields.add('date')
        if (
          prefill.accountId &&
          prefill.detectedCurrency &&
          !manuallyEdited.current.has('account')
        )
          fields.add('account')
        if (prefill.payeeName && !manuallyEdited.current.has('payee'))
          fields.add('payee')
        if (prefill.categoryId && !manuallyEdited.current.has('category'))
          fields.add('category')
        if (prefill.tagNames.length && !manuallyEdited.current.has('tags'))
          fields.add('tags')
        setForm((current) => {
          if (!current || selectedId !== prefetchedReceiptId.current)
            return current
          const next = { ...current }
          if (fields.has('amount') && prefill.totalMinor !== null) {
            next.amount = amountInput(prefill.totalMinor)
          }
          if (fields.has('date')) {
            next.date = prefill.date
          }
          if (prefill.accountId && !manuallyEdited.current.has('account')) {
            next.accountId = prefill.accountId
          }
          if (fields.has('payee')) {
            next.payeeName = prefill.payeeName
          }
          if (fields.has('category')) {
            next.categoryId = prefill.categoryId
          }
          if (fields.has('tags')) {
            next.tagNames = prefill.tagNames
          }
          return next
        })
        setOcrFields(fields)
        setLowConfidence(prefill.confidence === 'low')
        setCurrencyMismatch(
          prefill.currencyAccountMismatch ? prefill.detectedCurrency : null,
        )
      })
      .catch(() => setLowConfidence(true))
    return () => {
      ignore = true
    }
  }, [selectedId, selectedStatus])

  function open(receipt: Receipt) {
    setSelected(receipt)
    setForm(emptyForm(defaultAccountId))
    manuallyEdited.current.clear()
    prefetchedReceiptId.current = null
    setOcrFields(new Set())
    setLowConfidence(false)
    setCurrencyMismatch(null)
    setError(null)
  }

  function markManual(field: OcrField) {
    manuallyEdited.current.add(field)
    setOcrFields((current) => {
      const next = new Set(current)
      next.delete(field)
      return next
    })
  }

  function back() {
    if (busy) return
    setSelected(null)
    setForm(null)
    setError(null)
  }

  async function discard(receipt: Receipt) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await window.app.receipts.discard({ id: receipt.id })
      onChanged()
      setSelected(null)
      setForm(null)
      load()
    } catch (caught) {
      setError(
        String(caught).includes('receipts.error.notFound')
          ? 'receipts.error.notFound'
          : 'receipts.error',
      )
    } finally {
      setBusy(false)
    }
  }

  function confirm(event?: FormEvent) {
    event?.preventDefault()
    if (!selected || !form || busy) return
    const account = references.accountOptions.find(
      ({ id }) => id === form.accountId,
    )
    setBusy(true)
    setError(null)
    let transaction
    try {
      transaction = createTransactionInput(form, account?.currency ?? 'HUF')
    } catch (caught) {
      setError(transactionError(caught))
      setBusy(false)
      return
    }
    void window.app.receipts
      .confirm({
        id: selected.id,
        transaction,
      })
      .then(() => {
        onChanged()
        setSelected(null)
        setForm(null)
        load()
      })
      .catch((caught: unknown) => setError(transactionError(caught)))
      .finally(() => setBusy(false))
  }

  const categories = form
    ? references.categoryOptions[form.kind]
    : references.categoryOptions.expense
  const account = references.accountOptions.find(
    ({ id }) => id === form?.accountId,
  )

  if (selected && form) {
    return (
      <CardContent className="space-y-4">
        <Button variant="ghost" disabled={busy} onClick={back}>
          {t('receipts.back')}
        </Button>
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label={t('receipts.preview')}>
            <ReceiptImage
              receipt={selected}
              thumbnail={false}
              alt={selected.originalFileName}
            />
          </section>
          <form
            className="space-y-4"
            onSubmit={confirm}
            onKeyDownCapture={(event) => {
              const action = matchShortcut(event.nativeEvent, {
                scope: 'drawer',
                ...shortcutTargetContext(event.target),
              })
              if (
                action === 'save' &&
                event.target instanceof Element &&
                event.target.closest('[data-native-enter]')
              )
                return
              if (action === 'close') {
                event.preventDefault()
                back()
              } else if (action === 'save' || action === 'saveAndAddAnother') {
                event.preventDefault()
                if (event.currentTarget.reportValidity()) confirm()
              }
            }}
          >
            {selected.status === 'received' && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('receipts.reading')}
              </p>
            )}
            {lowConfidence && (
              <p className="text-sm text-muted-foreground">
                {t('receipts.ocrLowConfidence')}
              </p>
            )}
            {currencyMismatch && (
              <p className="text-sm text-muted-foreground">
                {t('receipts.currencyMismatch')} {currencyMismatch}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label
                    htmlFor="receipt-amount"
                    className="text-sm font-medium"
                  >
                    {t('transactions.amount')}
                    {ocrFields.has('amount') && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t('receipts.ocrPrefilled')}
                      </span>
                    )}
                  </label>
                  <HelpHint
                    t={t}
                    topicKey="transactions.amount"
                    textKey="help.transactions.amountCalculator"
                  />
                </div>
                <AmountInput
                  id="receipt-amount"
                  ref={amountRef}
                  value={form.amount}
                  currency={account?.currency ?? 'HUF'}
                  language={language}
                  t={t}
                  errorKey="transactions.error.amount"
                  hintKey="transactions.amountHint"
                  disabled={busy}
                  onChange={(amount) => {
                    markManual('amount')
                    setForm({ ...form, amount })
                  }}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="receipt-date" className="text-sm font-medium">
                  {t('transactions.date')}
                  {ocrFields.has('date') && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t('receipts.ocrPrefilled')}
                    </span>
                  )}
                </label>
                <Input
                  id="receipt-date"
                  type="date"
                  max={today()}
                  value={form.date}
                  required
                  disabled={busy}
                  onChange={(event) => {
                    markManual('date')
                    setForm({ ...form, date: event.target.value })
                  }}
                />
              </div>
            </div>
            <label className="block space-y-2 text-sm font-medium">
              {t('transactions.kind')}
              <NativeSelect
                value={form.kind}
                disabled={busy}
                onChange={(event) =>
                  setForm({
                    ...form,
                    kind: event.target.value as 'expense' | 'income',
                    categoryId: '',
                  })
                }
              >
                <option value="expense">{t('transactions.expense')}</option>
                <option value="income">{t('transactions.income')}</option>
              </NativeSelect>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              {t('transactions.account')}
              {ocrFields.has('account') && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('receipts.ocrPrefilled')}
                </span>
              )}
              <NativeSelect
                value={form.accountId}
                required
                disabled={busy}
                onChange={(event) => {
                  markManual('account')
                  setForm({ ...form, accountId: event.target.value })
                }}
              >
                <option value="" disabled>
                  {t('transactions.chooseAccount')}
                </option>
                {references.accountOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.currency})
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              {t(`transactions.payee.${form.kind}`)}
              {ocrFields.has('payee') && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('receipts.ocrPrefilled')}
                </span>
              )}
              <Input
                data-native-enter
                list="receipt-payees"
                value={form.payeeName}
                maxLength={100}
                disabled={busy}
                onChange={(event) => {
                  markManual('payee')
                  setForm({ ...form, payeeName: event.target.value })
                }}
              />
              <datalist id="receipt-payees">
                {references.payees.map((payee) => (
                  <option key={payee.id} value={payee.name} />
                ))}
              </datalist>
            </label>
            <div className="space-y-2">
              <label htmlFor="receipt-tag" className="text-sm font-medium">
                {t('tags.title')}
                {ocrFields.has('tags') && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t('receipts.ocrPrefilled')}
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <Input
                  id="receipt-tag"
                  data-native-enter
                  list="receipt-tags"
                  value={form.pendingTagName}
                  maxLength={100}
                  disabled={busy}
                  onChange={(event) => {
                    markManual('tags')
                    setForm({ ...form, pendingTagName: event.target.value })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      markManual('tags')
                      setForm(addPendingTag(form))
                    }
                  }}
                />
                <Button
                  disabled={busy || !form.pendingTagName.trim()}
                  onClick={() => {
                    markManual('tags')
                    setForm(addPendingTag(form))
                  }}
                >
                  {t('tags.add')}
                </Button>
              </div>
              <datalist id="receipt-tags">
                {references.tags.map((tag) => (
                  <option key={tag.id} value={tag.name} />
                ))}
              </datalist>
              <ul className="flex flex-wrap gap-2">
                {form.tagNames.map((name) => (
                  <li
                    key={name}
                    className="inline-flex items-center rounded-md bg-muted pl-2 text-sm"
                  >
                    {name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`${t('tags.remove')}: ${name}`}
                      disabled={busy}
                      onClick={() => {
                        markManual('tags')
                        setForm({
                          ...form,
                          tagNames: form.tagNames.filter(
                            (candidate) => candidate !== name,
                          ),
                        })
                      }}
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            <label className="block space-y-2 text-sm font-medium">
              {t('transactions.category')}
              {ocrFields.has('category') && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t('receipts.ocrPrefilled')}
                </span>
              )}
              <NativeSelect
                value={form.categoryId}
                disabled={busy}
                onChange={(event) => {
                  markManual('category')
                  setForm({ ...form, categoryId: event.target.value })
                }}
              >
                <option value="">{t('transactions.noCategory')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parentId ? '— ' : ''}
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.excluded}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({ ...form, excluded: event.target.checked })
                  }
                  className="size-4 accent-primary"
                />
                {t('transactions.excluded')}
              </label>
              <HelpHint
                t={t}
                topicKey="transactions.excluded"
                textKey="help.transactions.excluded"
              />
            </div>
            <label className="block space-y-2 text-sm font-medium">
              {t('transactions.note')}
              <textarea
                className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                value={form.note}
                maxLength={1000}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, note: event.target.value })
                }
              />
            </label>
            {references.accountOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('transactions.noAccounts')}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-error">
                {t(error)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={busy || references.accountOptions.length === 0}
              >
                {t('receipts.confirm')}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void discard(selected)}
              >
                {t('receipts.discard')}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={back}>
                {t('transactions.cancel')}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    )
  }

  return (
    <CardContent className="space-y-4">
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1">
          <Button ref={phoneUploadRef} onClick={() => setShowPhoneUpload(true)}>
            {t('phoneUpload.title')}
          </Button>
          <HelpHint
            t={t}
            topicKey="phoneUpload.title"
            textKey="help.receipts.phoneUpload"
          />
        </span>
      </div>
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('receipts.loading')}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {t('receipts.empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((receipt) => (
            <li
              key={receipt.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => open(receipt)}
              >
                <ReceiptImage
                  receipt={receipt}
                  thumbnail
                  alt={receipt.originalFileName}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {receipt.originalFileName}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {format.date(new Date(receipt.receivedAt))} ·{' '}
                    {t(`receipts.source.${receipt.source}`)}
                  </span>
                  {receipt.status === 'received' && (
                    <span className="block text-sm text-muted-foreground">
                      {t('receipts.reading')}
                    </span>
                  )}
                </span>
              </button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void discard(receipt)}
              >
                {t('receipts.discard')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-error">
          {t(error)}
        </p>
      )}
      {showPhoneUpload && (
        <PhoneUploadDialog
          t={t}
          triggerRef={phoneUploadRef}
          onClose={() => setShowPhoneUpload(false)}
        />
      )}
    </CardContent>
  )
}
