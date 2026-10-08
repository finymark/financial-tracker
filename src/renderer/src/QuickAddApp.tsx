import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ActiveProfileInfo } from '../../shared/profiles'
import type { TransactionKind } from '../../shared/transactions'
import { parseAmountExpression } from '../../shared/amount-expression'
import { tagKey } from '../../shared/text-keys'
import { DEFAULT_PROFILE_SETTINGS } from '../../shared/settings'
import type { PayeeSuggestion } from '../../shared/payees'
import { AmountInput } from './components/amount-input'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import {
  emptyForm,
  transactionError,
  type TransactionForm,
} from './components/transactions/transaction-form'
import { useTransactionReferenceData } from './components/transactions/use-transaction-reference-data'
import { useRuleAutofill } from './components/transactions/use-rule-autofill'
import { translate, type MessageKey } from './i18n'
import { matchShortcut } from './lib/shortcuts'
import { shortcutTargetContext } from './lib/shortcut-context'
import { PrivacyProvider } from './lib/privacy'
import { useTheme } from './lib/theme'
import { today } from '../../shared/date'

type Translate = (key: MessageKey) => string

function QuickAddForm({
  active,
  t,
}: {
  active: ActiveProfileInfo
  t: Translate
}) {
  const { language } = active.settings
  const references = useTransactionReferenceData(0, language, 0)
  const { accounts, accountOptions, categoryOptions, tags } = references
  const [form, setForm] = useState<TransactionForm>(() => emptyForm())
  const [payeeSuggestions, setPayeeSuggestions] = useState<PayeeSuggestion[]>(
    [],
  )
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [initialised, setInitialised] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const autofillProtected = useRef({
    payee: false,
    category: false,
    tags: false,
  })

  useRuleAutofill(
    form,
    (value) =>
      setForm((current) => {
        const next = typeof value === 'function' ? value(current) : value
        return next && (next.kind === 'expense' || next.kind === 'income')
          ? next
          : current
      }),
    accounts,
    autofillProtected,
    0,
  )

  useEffect(() => {
    if (references.loading || initialised) return
    let ignore = false
    void window.app.transactions
      .list({ period: 'all', limit: 1, offset: 0 })
      .then((page) => {
        if (ignore) return
        const latest = page.rows[0]
        const latestAccountId =
          latest?.kind === 'transfer' ? latest.fromAccountId : latest?.accountId
        const accountId = accountOptions.some(
          (account) => account.id === latestAccountId,
        )
          ? latestAccountId!
          : (accountOptions[0]?.id ?? '')
        setForm(emptyForm(accountId))
      })
      .catch((caught: unknown) => {
        if (!ignore) setError(transactionError(caught))
      })
      .finally(() => {
        if (!ignore) {
          setInitialised(true)
          queueMicrotask(() => amountRef.current?.focus())
        }
      })
    return () => {
      ignore = true
    }
  }, [accountOptions, initialised, references.loading])

  useEffect(() => {
    let ignore = false
    void window.app.payees
      .suggest({ query: form.payeeName, limit: 10 })
      .then((suggestions) => {
        if (!ignore) setPayeeSuggestions(suggestions)
      })
      .catch(() => {
        if (!ignore) setPayeeSuggestions([])
      })
    return () => {
      ignore = true
    }
  }, [form.payeeName])

  function changeKind(kind: TransactionKind) {
    if (busy || form.kind === kind) return
    autofillProtected.current.category = false
    setForm({ ...form, kind, categoryId: '' })
    queueMicrotask(() => amountRef.current?.focus())
  }

  function addTag() {
    const name = form.pendingTagName.trim()
    if (!name) return
    autofillProtected.current.tags = true
    setForm({
      ...form,
      tagNames: form.tagNames.some((tag) => tagKey(tag) === tagKey(name))
        ? form.tagNames
        : [...form.tagNames, name],
      pendingTagName: '',
    })
  }

  async function save(keepOpen: boolean) {
    if (busy) return
    const account = accountOptions.find(
      (candidate) => candidate.id === form.accountId,
    )
    if (!account) return
    setBusy(true)
    setSaved(false)
    setError(null)
    let completed = false
    try {
      await window.app.transactions.create({
        accountId: form.accountId,
        kind: form.kind,
        date: form.date,
        totalMinor: parseAmountExpression(
          form.amount,
          account.currency,
          'transactions.error.amount',
        ),
        payeeName: form.payeeName,
        categoryId: form.categoryId || null,
        note: form.note,
        tagNames: form.pendingTagName.trim()
          ? [...form.tagNames, form.pendingTagName.trim()]
          : form.tagNames,
        excluded: false,
      })
      await window.app.desktop.quickAddSaved({ keepOpen })
      completed = true
      setSaved(true)
      if (keepOpen) {
        setForm({
          ...emptyForm(form.accountId),
          kind: form.kind,
          date: form.date,
        })
        autofillProtected.current = {
          payee: false,
          category: false,
          tags: false,
        }
        queueMicrotask(() => amountRef.current?.focus())
      } else {
        window.setTimeout(() => void window.app.desktop.closeQuickAdd(), 450)
      }
    } catch (caught) {
      setError(transactionError(caught))
    } finally {
      if (!completed || keepOpen) setBusy(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void save(false)
  }

  if (references.loading || !initialised) {
    return (
      <p className="text-sm text-muted-foreground">{t('quickAdd.loading')}</p>
    )
  }
  if (accountOptions.length === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {t('quickAdd.noAccounts')}
        </p>
        <Button onClick={() => void window.app.desktop.showMain()}>
          {t('tray.open')}
        </Button>
      </div>
    )
  }

  const account = accountOptions.find(
    (candidate) => candidate.id === form.accountId,
  )
  return (
    <div
      onKeyDownCapture={(event) => {
        const action = matchShortcut(event.nativeEvent, {
          scope: 'drawer',
          ...shortcutTargetContext(event.target),
        })
        if (!action || action === 'privacy' || action === 'transfer') return
        if (
          action === 'save' &&
          event.target instanceof Element &&
          event.target.closest('[data-native-enter]')
        )
          return
        event.preventDefault()
        event.stopPropagation()
        if (busy) return
        if (action === 'close') void window.app.desktop.closeQuickAdd()
        else if (action === 'expense' || action === 'income') changeKind(action)
        else if (action === 'save') formRef.current?.requestSubmit()
        else if (
          action === 'saveAndAddAnother' &&
          formRef.current?.reportValidity()
        )
          void save(true)
      }}
    >
      <form ref={formRef} className="space-y-4" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="quick-amount" className="text-sm font-medium">
              {t('transactions.amount')}
            </label>
            <AmountInput
              id="quick-amount"
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
          <label className="space-y-2 text-sm font-medium">
            {t('transactions.date')}
            <Input
              type="date"
              max={today()}
              value={form.date}
              required
              disabled={busy}
              onChange={(event) =>
                setForm({ ...form, date: event.target.value })
              }
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-2 text-sm font-medium">
            {t('transactions.kind')}
            <NativeSelect
              value={form.kind}
              disabled={busy}
              onChange={(event) =>
                changeKind(event.target.value as TransactionKind)
              }
            >
              <option value="expense">{t('transactions.expense')}</option>
              <option value="income">{t('transactions.income')}</option>
            </NativeSelect>
          </label>
          <label className="space-y-2 text-sm font-medium">
            {t('transactions.account')}
            <NativeSelect
              value={form.accountId}
              required
              disabled={busy}
              onChange={(event) =>
                setForm({ ...form, accountId: event.target.value })
              }
            >
              {accountOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} ({option.currency})
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <label className="block space-y-2 text-sm font-medium">
          {t('transactions.payee')}
          <Input
            data-native-enter
            list="quick-payees"
            value={form.payeeName}
            maxLength={100}
            disabled={busy}
            onChange={(event) => {
              autofillProtected.current.payee = true
              setForm({ ...form, payeeName: event.target.value })
            }}
          />
          <datalist id="quick-payees">
            {payeeSuggestions.map((payee) => (
              <option key={payee.id} value={payee.name} />
            ))}
          </datalist>
        </label>
        <label className="block space-y-2 text-sm font-medium">
          {t('transactions.category')}
          <NativeSelect
            value={form.categoryId}
            disabled={busy}
            onChange={(event) => {
              autofillProtected.current.category = true
              setForm({ ...form, categoryId: event.target.value })
            }}
          >
            <option value="">{t('transactions.noCategory')}</option>
            {categoryOptions[form.kind].map((category) => (
              <option key={category.id} value={category.id}>
                {category.parentId ? '— ' : ''}
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="space-y-2">
          <label htmlFor="quick-tag" className="text-sm font-medium">
            {t('tags.title')}
          </label>
          <div className="flex gap-2">
            <Input
              id="quick-tag"
              data-native-enter
              list="quick-tags"
              value={form.pendingTagName}
              maxLength={100}
              disabled={busy}
              onChange={(event) => {
                autofillProtected.current.tags = true
                setForm({ ...form, pendingTagName: event.target.value })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addTag()
                }
              }}
            />
            <Button type="button" disabled={busy} onClick={addTag}>
              {t('tags.add')}
            </Button>
          </div>
          <datalist id="quick-tags">
            {tags.map((tag) => (
              <option key={tag.id} value={tag.name} />
            ))}
          </datalist>
          {form.tagNames.length > 0 && (
            <div className="flex flex-wrap gap-2 text-sm">
              {form.tagNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="rounded-md bg-muted px-2 py-1"
                  onClick={() =>
                    setForm({
                      ...form,
                      tagNames: form.tagNames.filter((tag) => tag !== name),
                    })
                  }
                >
                  {name} ×
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="block space-y-2 text-sm font-medium">
          {t('transactions.note')}
          <textarea
            className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={form.note}
            maxLength={1000}
            disabled={busy}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
        {error && <p className="text-sm font-medium text-error">{t(error)}</p>}
        {saved && (
          <p role="status" className="text-sm font-medium text-primary">
            {t('quickAdd.saved')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {t('transactions.save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (formRef.current?.reportValidity()) void save(true)
            }}
          >
            {t('transactions.saveAndAddAnother')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void window.app.desktop.closeQuickAdd()}
          >
            {t('transactions.cancel')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function QuickAddApp() {
  const [active, setActive] = useState<ActiveProfileInfo | null | undefined>()
  const systemLanguage = navigator.language.toLowerCase().split(/[-_]/)[0]
  const settings =
    active?.settings ??
    ({
      ...DEFAULT_PROFILE_SETTINGS,
      language:
        systemLanguage === 'hu' || systemLanguage === 'de'
          ? systemLanguage
          : 'en',
    } as const)
  const t: Translate = (key) => translate(settings.language, key)
  useTheme(settings.theme)

  useEffect(() => {
    document.documentElement.lang = settings.language
    document.title = translate(settings.language, 'quickAdd.title')
  }, [settings.language])

  useEffect(() => {
    void window.app.profiles
      .getActive()
      .then(setActive)
      .catch(() => setActive(null))
  }, [])

  return (
    <PrivacyProvider
      privacyMode={settings.privacyMode}
      language={settings.language}
    >
      <main className="min-h-dvh bg-background p-5 text-foreground">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{t('quickAdd.title')}</h1>
          <Button
            variant="ghost"
            onClick={() => void window.app.desktop.closeQuickAdd()}
          >
            {t('transactions.close')}
          </Button>
        </header>
        {active === undefined ? (
          <p className="text-sm text-muted-foreground">
            {t('quickAdd.loading')}
          </p>
        ) : active === null ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              {t('quickAdd.noProfiles')}
            </p>
            <Button onClick={() => void window.app.desktop.showMain()}>
              {t('tray.open')}
            </Button>
          </div>
        ) : (
          <QuickAddForm active={active} t={t} />
        )}
      </main>
    </PrivacyProvider>
  )
}
