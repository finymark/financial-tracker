import { useState, type FormEvent } from 'react'
import type { AccountOption } from '../../../shared/accounts'
import type { Category } from '../../../shared/categories'
import type {
  CreateTemplateInput,
  TransactionTemplate,
} from '../../../shared/templates'
import type { TransactionKind } from '../../../shared/transactions'
import { parseAmountExpression } from '../../../shared/amount-expression'
import type { Language, MessageKey } from '../i18n'
import { amountInput } from '../lib/amount-input-value'
import { AmountInput } from './amount-input'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { NativeSelect } from './ui/native-select'
import { HelpHint } from './ui/help-hint'

interface Props {
  template?: TransactionTemplate
  accounts: AccountOption[]
  categories: Category[]
  language: Language
  t(key: MessageKey): string
  busy: boolean
  onSave(input: CreateTemplateInput): void
  onCancel(): void
}

export function TemplateEditor({
  template,
  accounts,
  categories,
  language,
  t,
  busy,
  onSave,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState({
    name: template?.name ?? '',
    kind: template?.kind ?? '',
    accountId: template?.accountId ?? '',
    amount:
      template?.totalMinor == null ? '' : amountInput(template.totalMinor),
    payeeName: template?.payeeName ?? '',
    categoryId: template?.categoryId ?? '',
    tags: template?.tagNames.join('\n') ?? '',
    note: template?.note ?? '',
    excluded: template?.excluded ?? false,
  })
  const [error, setError] = useState(false)
  const currency =
    accounts.find((account) => account.id === draft.accountId)?.currency ??
    'HUF'
  function submit(event: FormEvent) {
    event.preventDefault()
    let totalMinor: number | null = null
    try {
      if (draft.amount.trim())
        totalMinor = parseAmountExpression(
          draft.amount,
          currency,
          'transactions.error.amount',
        )
    } catch {
      setError(true)
      return
    }
    setError(false)
    onSave({
      name: draft.name,
      kind: (draft.kind || null) as TransactionKind | null,
      accountId: draft.accountId || null,
      totalMinor,
      payeeName: draft.payeeName || null,
      categoryId: draft.categoryId || null,
      tagNames: draft.tags
        .split('\n')
        .map((name) => name.trim())
        .filter(Boolean),
      note: draft.note || null,
      excluded: draft.excluded,
    })
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border p-3">
      <div className="flex items-center gap-1">
        <h3 className="font-semibold">
          {t(template ? 'templates.edit' : 'templates.create')}
        </h3>
        <HelpHint
          t={t}
          topicKey={template ? 'templates.edit' : 'templates.create'}
          textKey="help.transactions.templates"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {t('templates.optionalHint')}
      </p>
      {error && (
        <p role="alert" className="text-sm text-error">
          {t('transactions.error.amount')}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-4">
        <label className="block space-y-1 text-sm font-medium">
          {t('templates.name')}
          <Input
            value={draft.name}
            required
            maxLength={100}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          {t('transactions.kind')}
          <NativeSelect
            value={draft.kind}
            onChange={(event) =>
              setDraft({ ...draft, kind: event.target.value, categoryId: '' })
            }
          >
            <option value="">{t('transactions.optional')}</option>
            <option value="expense">{t('transactions.expense')}</option>
            <option value="income">{t('transactions.income')}</option>
          </NativeSelect>
        </label>
        <label className="block space-y-1 text-sm font-medium">
          {t('transactions.account')}
          <NativeSelect
            value={draft.accountId}
            onChange={(event) =>
              setDraft({ ...draft, accountId: event.target.value })
            }
          >
            <option value="">{t('transactions.optional')}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="space-y-1">
          <label htmlFor="template-amount" className="text-sm font-medium">
            {t('transactions.amount')}
          </label>
          <AmountInput
            id="template-amount"
            value={draft.amount}
            currency={currency}
            language={language}
            t={t}
            errorKey="transactions.error.amount"
            hintKey="transactions.amountHint"
            required={false}
            disabled={busy}
            onChange={(amount) => {
              setError(false)
              setDraft({ ...draft, amount })
            }}
          />
        </div>
        <label className="block space-y-1 text-sm font-medium">
          {t('transactions.payee')}
          <Input
            value={draft.payeeName}
            maxLength={100}
            onChange={(event) =>
              setDraft({ ...draft, payeeName: event.target.value })
            }
          />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          {t('transactions.category')}
          <NativeSelect
            value={draft.categoryId}
            onChange={(event) =>
              setDraft({ ...draft, categoryId: event.target.value })
            }
          >
            <option value="">{t('transactions.optional')}</option>
            {categories
              .filter((category) => !draft.kind || category.kind === draft.kind)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.parentId ? '— ' : ''}
                  {category.name}
                </option>
              ))}
          </NativeSelect>
        </label>
        <label className="block space-y-1 text-sm font-medium">
          {t('tags.title')}
          <textarea
            className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2"
            value={draft.tags}
            aria-describedby="template-tags-hint"
            onChange={(event) =>
              setDraft({ ...draft, tags: event.target.value })
            }
          />
        </label>
        <p id="template-tags-hint" className="text-xs text-muted-foreground">
          {t('templates.tagsHint')}
        </p>
        <label className="block space-y-1 text-sm font-medium">
          {t('transactions.note')}
          <textarea
            className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2"
            value={draft.note}
            maxLength={1000}
            onChange={(event) =>
              setDraft({ ...draft, note: event.target.value })
            }
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={draft.excluded}
            onChange={(event) =>
              setDraft({ ...draft, excluded: event.target.checked })
            }
            className="size-4 accent-primary"
          />
          {t('transactions.excluded')}
        </label>
        <div className="flex gap-2">
          <Button type="submit">{t('templates.save')}</Button>
          <Button variant="ghost" onClick={onCancel}>
            {t('transactions.cancel')}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
