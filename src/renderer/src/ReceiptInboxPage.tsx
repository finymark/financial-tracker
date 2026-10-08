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
  const amountRef = useRef<HTMLInputElement>(null)
  const phoneUploadRef = useRef<HTMLButtonElement>(null)
  const references = useTransactionReferenceData(0, language, undoRevision)
  const format = createFormatters(language)

  const load = useCallback(() => {
    void Promise.all([
      window.app.receipts.list(),
      window.app.receipts.defaultAccountId(),
    ])
      .then(([receipts, accountId]) => {
        setItems(receipts)
        setDefaultAccountId(accountId ?? '')
        setError(null)
      })
      .catch(() => setError('receipts.error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load, undoRevision])
  useEffect(() => window.app.receipts.onChanged(load), [load])
  useEffect(() => {
    if (selected) amountRef.current?.focus()
  }, [selected])

  function open(receipt: Receipt) {
    setSelected(receipt)
    setForm(emptyForm(defaultAccountId))
    setError(null)
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="receipt-amount" className="text-sm font-medium">
                  {t('transactions.amount')}
                </label>
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
                  onChange={(amount) => setForm({ ...form, amount })}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="receipt-date" className="text-sm font-medium">
                  {t('transactions.date')}
                </label>
                <Input
                  id="receipt-date"
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
              <NativeSelect
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
                {references.accountOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.currency})
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              {t('transactions.payee')}
              <Input
                data-native-enter
                list="receipt-payees"
                value={form.payeeName}
                maxLength={100}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, payeeName: event.target.value })
                }
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
              </label>
              <div className="flex gap-2">
                <Input
                  id="receipt-tag"
                  data-native-enter
                  list="receipt-tags"
                  value={form.pendingTagName}
                  maxLength={100}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({ ...form, pendingTagName: event.target.value })
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      setForm(addPendingTag(form))
                    }
                  }}
                />
                <Button
                  disabled={busy || !form.pendingTagName.trim()}
                  onClick={() => setForm(addPendingTag(form))}
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
                      onClick={() =>
                        setForm({
                          ...form,
                          tagNames: form.tagNames.filter(
                            (candidate) => candidate !== name,
                          ),
                        })
                      }
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
            <label className="block space-y-2 text-sm font-medium">
              {t('transactions.category')}
              <NativeSelect
                value={form.categoryId}
                disabled={busy}
                onChange={(event) =>
                  setForm({ ...form, categoryId: event.target.value })
                }
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
        <Button ref={phoneUploadRef} onClick={() => setShowPhoneUpload(true)}>
          {t('phoneUpload.title')}
        </Button>
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
