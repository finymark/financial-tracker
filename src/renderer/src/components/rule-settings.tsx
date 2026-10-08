import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { Account } from '../../../shared/accounts'
import type { Category } from '../../../shared/categories'
import type { Payee } from '../../../shared/payees'
import type {
  CategorisationRule,
  CreateCategorisationRuleInput,
} from '../../../shared/rules'
import type { Currency } from '../../../shared/accounts'
import type { Tag } from '../../../shared/tags'
import { parseAmountExpression } from '../../../shared/amount-expression'
import type { Language, MessageKey } from '../i18n'
import { AmountInput } from './amount-input'
import { Button } from './ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Input } from './ui/input'
import { NativeSelect } from './ui/native-select'

interface RuleSettingsProps {
  disabled: boolean
  language: Language
  baseCurrency: Currency
  t(key: MessageKey): string
  onBusyChange(busy: boolean): void
  onChanged(): void
}

interface RuleForm {
  id: string | null
  enabled: boolean
  payeeId: string
  textContains: string
  accountId: string
  minAmount: string
  maxAmount: string
  categoryId: string
  tagIds: string[]
}

function emptyRuleForm(): RuleForm {
  return {
    id: null,
    enabled: true,
    payeeId: '',
    textContains: '',
    accountId: '',
    minAmount: '',
    maxAmount: '',
    categoryId: '',
    tagIds: [],
  }
}

function amountText(value: number | null): string {
  if (value === null) return ''
  const amount = BigInt(value)
  const fraction = String(amount % 100n).padStart(2, '0')
  return fraction === '00'
    ? String(amount / 100n)
    : `${amount / 100n}.${fraction}`
}

const errorKeys = [
  'rules.error.notFound',
  'rules.error.condition',
  'rules.error.text',
  'rules.error.amount',
  'rules.error.amountRange',
  'rules.error.action',
  'rules.error.reference',
  'rules.error.order',
] as const satisfies readonly MessageKey[]

export function RuleSettings({
  disabled,
  language,
  baseCurrency,
  t,
  onBusyChange,
  onChanged,
}: RuleSettingsProps) {
  const [rules, setRules] = useState<CategorisationRule[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [payees, setPayees] = useState<Payee[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [form, setForm] = useState<RuleForm | null>(null)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const locked = disabled || loading || busy

  async function load() {
    const [nextRules, nextAccounts, nextCategories, nextPayees, nextTags] =
      await Promise.all([
        window.app.rules.list(),
        window.app.accounts.listOptions(),
        window.app.categories.list(),
        window.app.payees.list(),
        window.app.tags.list(),
      ])
    setRules(nextRules)
    setAccounts(nextAccounts)
    setCategories(nextCategories)
    setPayees(nextPayees)
    setTags(nextTags)
  }

  useEffect(() => {
    let ignore = false
    void load()
      .catch(() => {
        if (!ignore) setError('rules.error')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  async function run(action: () => Promise<unknown>, offerUndo = true) {
    setBusy(true)
    onBusyChange(true)
    setError(null)
    try {
      await action()
      await load()
      setForm(null)
      setPreviewCount(null)
      if (offerUndo) onChanged()
    } catch (caught) {
      setError(
        errorKeys.find((key) => String(caught).includes(key)) ?? 'rules.error',
      )
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  async function previewApplication() {
    setBusy(true)
    onBusyChange(true)
    setError(null)
    setPreviewCount(null)
    try {
      const preview = await window.app.rules.previewApplication()
      setPreviewCount(preview.count)
    } catch {
      setError('rules.error')
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  const accountCurrency =
    accounts.find((account) => account.id === form?.accountId)?.currency ??
    baseCurrency

  function inputFromForm(current: RuleForm): CreateCategorisationRuleInput {
    return {
      enabled: current.enabled,
      payeeId: current.payeeId || null,
      textContains: current.textContains || null,
      accountId: current.accountId || null,
      minAmountMinor: current.minAmount
        ? parseAmountExpression(
            current.minAmount,
            accountCurrency,
            'rules.error.amount',
            { allowZero: true },
          )
        : null,
      maxAmountMinor: current.maxAmount
        ? parseAmountExpression(
            current.maxAmount,
            accountCurrency,
            'rules.error.amount',
          )
        : null,
      categoryId: current.categoryId || null,
      tagIds: current.tagIds,
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    const input = inputFromForm(form)
    void run(() =>
      form.id
        ? window.app.rules.update({ id: form.id, ...input })
        : window.app.rules.create(input),
    )
  }

  function edit(rule: CategorisationRule) {
    setForm({
      id: rule.id,
      enabled: rule.enabled,
      payeeId: rule.payeeId ?? '',
      textContains: rule.textContains ?? '',
      accountId: rule.accountId ?? '',
      minAmount: amountText(rule.minAmountMinor),
      maxAmount: amountText(rule.maxAmountMinor),
      categoryId: rule.categoryId ?? '',
      tagIds: rule.tags.map((tag) => tag.id),
    })
  }

  const activeCategory = (category: Category) =>
    !category.archived &&
    (category.parentId === null ||
      !categories.find((parent) => parent.id === category.parentId)?.archived)
  const categoryName = (id: string | null) =>
    categories.find((category) => category.id === id)?.name ??
    t('rules.noCategory')
  const accountName = (id: string | null) =>
    accounts.find((account) => account.id === id)?.name ?? ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('rules.title')}</CardTitle>
        <CardDescription>{t('rules.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <p role="alert" className="text-sm font-medium text-error">
            {t(error)}
          </p>
        )}
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('rules.loading')}
          </p>
        ) : rules.length === 0 ? (
          <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            {t('rules.empty')}
          </p>
        ) : (
          <ol className="space-y-3">
            {rules.map((rule, index) => (
              <li key={rule.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="mr-auto">
                    {index + 1}. {rule.payeeName ?? rule.textContains}
                  </strong>
                  {!rule.enabled && (
                    <span className="text-sm text-muted-foreground">
                      {t('rules.disabled')}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={locked || index === 0}
                    aria-label={t('rules.up')}
                    onClick={() =>
                      void run(() =>
                        window.app.rules.reorder({
                          id: rule.id,
                          sortOrder: index - 1,
                        }),
                      )
                    }
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={locked || index === rules.length - 1}
                    aria-label={t('rules.down')}
                    onClick={() =>
                      void run(() =>
                        window.app.rules.reorder({
                          id: rule.id,
                          sortOrder: index + 1,
                        }),
                      )
                    }
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={locked}
                    onClick={() => edit(rule)}
                  >
                    {t('rules.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={locked}
                    onClick={() =>
                      void run(() => window.app.rules.delete({ id: rule.id }))
                    }
                  >
                    {t('rules.delete')}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {rule.textContains &&
                    `${t('rules.textContains')}: ${rule.textContains}; `}
                  {rule.accountId &&
                    `${t('rules.account')}: ${accountName(rule.accountId)}; `}
                  {rule.minAmountMinor !== null &&
                    `${t('rules.minimum')}: ${amountText(rule.minAmountMinor)}; `}
                  {rule.maxAmountMinor !== null &&
                    `${t('rules.maximum')}: ${amountText(rule.maxAmountMinor)}; `}
                  {t('rules.action')}: {categoryName(rule.categoryId)}
                  {rule.tags.length > 0 &&
                    `; ${t('tags.title')}: ${rule.tags.map((tag) => tag.name).join(', ')}`}
                </p>
              </li>
            ))}
          </ol>
        )}

        <Button
          disabled={locked || form !== null}
          onClick={() => setForm(emptyRuleForm())}
        >
          {t('rules.create')}
        </Button>

        {form && (
          <form className="space-y-4 rounded-lg border p-4" onSubmit={submit}>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.enabled}
                disabled={locked}
                onChange={(event) =>
                  setForm({ ...form, enabled: event.target.checked })
                }
                className="size-4 accent-primary"
              />
              {t('rules.enabled')}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium">
                {t('transactions.payee')}
                <NativeSelect
                  value={form.payeeId}
                  disabled={locked}
                  onChange={(event) =>
                    setForm({ ...form, payeeId: event.target.value })
                  }
                >
                  <option value="">{t('rules.anyPayee')}</option>
                  {payees.map((payee) => (
                    <option key={payee.id} value={payee.id}>
                      {payee.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-sm font-medium">
                {t('rules.textContains')}
                <Input
                  value={form.textContains}
                  maxLength={1000}
                  disabled={locked}
                  onChange={(event) =>
                    setForm({ ...form, textContains: event.target.value })
                  }
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                {t('rules.account')}
                <NativeSelect
                  value={form.accountId}
                  disabled={locked}
                  onChange={(event) =>
                    setForm({ ...form, accountId: event.target.value })
                  }
                >
                  <option value="">{t('rules.anyAccount')}</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="space-y-1 text-sm font-medium">
                {t('transactions.category')}
                <NativeSelect
                  value={form.categoryId}
                  disabled={locked}
                  onChange={(event) =>
                    setForm({ ...form, categoryId: event.target.value })
                  }
                >
                  <option value="">{t('rules.noCategory')}</option>
                  {categories.filter(activeCategory).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentId ? '— ' : ''}
                      {category.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="rule-minimum">
                  {t('rules.minimum')}
                </label>
                <AmountInput
                  id="rule-minimum"
                  value={form.minAmount}
                  currency={accountCurrency}
                  language={language}
                  t={t}
                  required={false}
                  allowZero
                  errorKey="rules.error.amount"
                  hintKey="rules.amountHint"
                  disabled={locked}
                  onChange={(minAmount) => setForm({ ...form, minAmount })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="rule-maximum">
                  {t('rules.maximum')}
                </label>
                <AmountInput
                  id="rule-maximum"
                  value={form.maxAmount}
                  currency={accountCurrency}
                  language={language}
                  t={t}
                  required={false}
                  errorKey="rules.error.amount"
                  hintKey="rules.amountHint"
                  disabled={locked}
                  onChange={(maxAmount) => setForm({ ...form, maxAmount })}
                />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('tags.title')}</legend>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('rules.noTags')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {tags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.tagIds.includes(tag.id)}
                        disabled={locked}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            tagIds: event.target.checked
                              ? [...form.tagIds, tag.id]
                              : form.tagIds.filter((id) => id !== tag.id),
                          })
                        }
                        className="size-4 accent-primary"
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <p className="text-xs text-muted-foreground">
              {t('rules.formHint')}
            </p>
            <div className="flex gap-2">
              <Button type="submit" disabled={locked}>
                {t('rules.save')}
              </Button>
              <Button
                variant="ghost"
                disabled={locked}
                onClick={() => setForm(null)}
              >
                {t('transactions.cancel')}
              </Button>
            </div>
          </form>
        )}

        <section className="space-y-3 border-t pt-5">
          <h3 className="font-semibold">{t('rules.applyExisting')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('rules.applyExistingDescription')}
          </p>
          {previewCount !== null && (
            <p role="status" className="text-sm font-medium">
              {t('rules.previewCount')}: {previewCount}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={locked}
              onClick={() => void previewApplication()}
            >
              {t('rules.preview')}
            </Button>
            {previewCount !== null && previewCount > 0 && (
              <Button
                disabled={locked}
                onClick={() => void run(() => window.app.rules.apply())}
              >
                {t('rules.apply')}
              </Button>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
