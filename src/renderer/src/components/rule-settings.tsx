import { useAmountFormatters } from '../lib/privacy'
import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { AccountOption } from '../../../shared/accounts'
import type { Category } from '../../../shared/categories'
import type { Payee } from '../../../shared/payees'
import type { CategorisationRule } from '../../../shared/rules'
import type { Currency } from '../../../shared/accounts'
import type { Tag } from '../../../shared/tags'
import type { Language, MessageKey } from '../i18n'
import { Button } from './ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import {
  RuleEditor,
  emptyRuleForm,
  ruleError,
  type RuleForm,
} from './rule-editor'
import { amountInput } from '../lib/amount-input-value'

interface RuleSettingsProps {
  disabled: boolean
  language: Language
  baseCurrency: Currency
  t(key: MessageKey): string
  onBusyChange(busy: boolean): void
  onChanged(): void
}

export function RuleSettings({
  disabled,
  language,
  baseCurrency,
  t,
  onBusyChange,
  onChanged,
}: RuleSettingsProps) {
  const [rules, setRules] = useState<CategorisationRule[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [payees, setPayees] = useState<Payee[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [form, setForm] = useState<RuleForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const locked = disabled || loading || busy
  const format = useAmountFormatters(language)

  async function load() {
    return Promise.all([
      window.app.rules.list(),
      window.app.accounts.listOptions(),
      window.app.categories.list(),
      window.app.payees.list(),
      window.app.tags.list(),
    ])
  }

  const loaded = useCallback(
    ([nextRules, nextAccounts, nextCategories, nextPayees, nextTags]: Awaited<
      ReturnType<typeof load>
    >) => {
      setRules(nextRules)
      setAccounts(nextAccounts)
      setCategories(nextCategories)
      setPayees(nextPayees)
      setTags(nextTags)
    },
    [],
  )

  useEffect(() => {
    let ignore = false
    void load()
      .then((data) => {
        if (!ignore) loaded(data)
      })
      .catch(() => {
        if (!ignore) setError('rules.error')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [loaded])

  async function run(action: () => Promise<unknown>, offerUndo = true) {
    setBusy(true)
    onBusyChange(true)
    setError(null)
    try {
      await action()
      loaded(await load())
      setForm(null)
      if (offerUndo) onChanged()
    } catch (caught) {
      setError(ruleError(caught))
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  function edit(rule: CategorisationRule) {
    setForm({
      id: rule.id,
      enabled: rule.enabled,
      payeeId: rule.payeeId ?? '',
      textContains: rule.textContains ?? '',
      accountId: rule.accountId ?? '',
      minAmount:
        rule.minAmountMinor === null ? '' : amountInput(rule.minAmountMinor),
      maxAmount:
        rule.maxAmountMinor === null ? '' : amountInput(rule.maxAmountMinor),
      amountCurrency: rule.amountCurrency ?? baseCurrency,
      actionPayeeId: rule.actionPayeeId ?? '',
      categoryId: rule.categoryId ?? '',
      tagIds: rule.tags.map((tag) => tag.id),
    })
  }

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
                    {index + 1}.{' '}
                    {rule.payeeName ??
                      rule.textContains ??
                      (rule.accountId
                        ? accountName(rule.accountId)
                        : t('rules.amountCondition'))}
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
                  {rule.minAmountMinor !== null && (
                    <>
                      {t('rules.minimum')}:{' '}
                      {format.amount(rule.minAmountMinor, rule.amountCurrency!)}
                      ;{' '}
                    </>
                  )}
                  {rule.maxAmountMinor !== null && (
                    <>
                      {t('rules.maximum')}:{' '}
                      {format.amount(rule.maxAmountMinor, rule.amountCurrency!)}
                      ;{' '}
                    </>
                  )}
                  {rule.actionPayeeName &&
                    `${t('rules.payeeAction')}: ${rule.actionPayeeName}; `}
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
          onClick={() => setForm(emptyRuleForm(baseCurrency))}
        >
          {t('rules.create')}
        </Button>

        {form && (
          <RuleEditor
            key={form.id ?? 'new'}
            initial={form}
            accounts={accounts}
            categories={categories}
            payees={payees}
            tags={tags}
            language={language}
            baseCurrency={baseCurrency}
            t={t}
            locked={locked}
            onCancel={() => setForm(null)}
            onSave={(input) =>
              void run(() =>
                form.id
                  ? window.app.rules.update({ id: form.id, ...input })
                  : window.app.rules.create(input),
              )
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
