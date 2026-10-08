import { useState, type FormEvent } from 'react'
import type { AccountOption, Currency } from '../../../shared/accounts'
import type { Category } from '../../../shared/categories'
import type { Payee } from '../../../shared/payees'
import type { CreateCategorisationRuleInput } from '../../../shared/rules'
import type { Tag } from '../../../shared/tags'
import { parseAmountExpression } from '../../../shared/amount-expression'
import type { Language, MessageKey } from '../i18n'
import { AmountInput } from './amount-input'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { NativeSelect } from './ui/native-select'
import { HelpHint } from './ui/help-hint'

export interface RuleForm {
  id: string | null
  enabled: boolean
  payeeId: string
  textContains: string
  accountId: string
  minAmount: string
  maxAmount: string
  amountCurrency: Currency
  actionPayeeId: string
  categoryId: string
  tagIds: string[]
}

export function emptyRuleForm(baseCurrency: Currency): RuleForm {
  return {
    id: null,
    enabled: true,
    payeeId: '',
    textContains: '',
    accountId: '',
    minAmount: '',
    maxAmount: '',
    amountCurrency: baseCurrency,
    actionPayeeId: '',
    categoryId: '',
    tagIds: [],
  }
}

const ruleErrorKeys = [
  'rules.error.notFound',
  'rules.error.condition',
  'rules.error.text',
  'rules.error.amount',
  'rules.error.amountRange',
  'rules.error.action',
  'rules.error.reference',
  'rules.error.order',
] as const satisfies readonly MessageKey[]

export function ruleError(caught: unknown): MessageKey {
  return (
    ruleErrorKeys.find((key) => String(caught).includes(key)) ?? 'rules.error'
  )
}

interface RuleEditorProps {
  initial: RuleForm
  accounts: AccountOption[]
  categories: Category[]
  payees: Payee[]
  tags: Tag[]
  language: Language
  baseCurrency: Currency
  t(key: MessageKey): string
  locked: boolean
  onSave(input: CreateCategorisationRuleInput): void
  onCancel(): void
}

export function RuleEditor({
  initial,
  accounts,
  categories,
  payees,
  tags,
  language,
  baseCurrency,
  t,
  locked,
  onSave,
  onCancel,
}: RuleEditorProps) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<MessageKey | null>(null)
  const accountCurrency =
    accounts.find((account) => account.id === form.accountId)?.currency ??
    form.amountCurrency ??
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
      amountCurrency:
        current.minAmount || current.maxAmount ? accountCurrency : null,
      actionPayeeId: current.actionPayeeId || null,
      categoryId: current.categoryId || null,
      tagIds: current.tagIds,
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const input = inputFromForm(form)
      setError(null)
      onSave(input)
    } catch (caught) {
      setError(ruleError(caught))
    }
  }

  const activeCategory = (category: Category) =>
    !category.archived &&
    (category.parentId === null ||
      !categories.find((parent) => parent.id === category.parentId)?.archived)
  return (
    <form className="space-y-4 rounded-lg border p-4" onSubmit={submit}>
      {error && (
        <p role="alert" className="text-sm text-error">
          {t(error)}
        </p>
      )}
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
        <label className="space-y-1 text-sm font-medium">
          {t('rules.payeeAction')}
          <NativeSelect
            value={form.actionPayeeId}
            disabled={locked}
            onChange={(event) =>
              setForm({ ...form, actionPayeeId: event.target.value })
            }
          >
            <option value="">{t('rules.noPayeeAction')}</option>
            {payees.map((payee) => (
              <option key={payee.id} value={payee.id}>
                {payee.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      {!form.accountId && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <label
              htmlFor="rule-amount-currency"
              className="text-sm font-medium"
            >
              {t('rules.amountCurrency')}
            </label>
            <HelpHint
              t={t}
              topicKey="rules.amountCurrency"
              textKey="help.settings.ruleAmountCurrency"
            />
          </div>
          <NativeSelect
            id="rule-amount-currency"
            value={form.amountCurrency}
            disabled={locked}
            onChange={(event) =>
              setForm({
                ...form,
                amountCurrency: event.target.value as Currency,
              })
            }
          >
            <option value="HUF">HUF</option>
            <option value="CHF">CHF</option>
          </NativeSelect>
        </div>
      )}
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
          <p className="text-sm text-muted-foreground">{t('rules.noTags')}</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-sm">
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
      <p className="text-xs text-muted-foreground">{t('rules.formHint')}</p>
      <div className="flex gap-2">
        <Button type="submit" disabled={locked}>
          {t('rules.save')}
        </Button>
        <Button variant="ghost" disabled={locked} onClick={onCancel}>
          {t('transactions.cancel')}
        </Button>
      </div>
    </form>
  )
}
