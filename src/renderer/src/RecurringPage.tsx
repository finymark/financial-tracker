import { useEffect, useState, type FormEvent } from 'react'
import { parseAmountExpression } from '../../shared/amount-expression'
import {
  dueDates,
  type CreateRecurringTransactionInput,
  type PendingTransaction,
  type RecurringSchedule,
  type RecurringTransaction,
} from '../../shared/recurring'
import type { AccountOption } from '../../shared/accounts'
import type { Category } from '../../shared/categories'
import type { Tag } from '../../shared/tags'
import type { Language, MessageKey } from './i18n'
import { amountInput } from './lib/amount-input-value'
import { useAmountFormatters } from './lib/privacy'
import { AmountInput } from './components/amount-input'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import type { RecurringPrefill } from './lib/recurring-prefill'

interface Props {
  language: Language
  t(key: MessageKey): string
  undoRevision: number
  onChanged(): void
  initialPrefill?: RecurringPrefill | null
  onPrefillHandled?(): void
}

function localToday(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function futureLimit(from: string): string {
  const date = new Date(`${from}T00:00:00`)
  date.setFullYear(date.getFullYear() + 100)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function nextDue(item: RecurringTransaction): string | null {
  if (item.paused) return null
  const from = localToday()
  return (
    dueDates(
      item.schedule,
      item.startDate,
      item.endDate,
      from,
      futureLimit(from),
    )[0] ?? null
  )
}

function scheduleText(schedule: RecurringSchedule, t: Props['t']): string {
  if (schedule.type === 'monthly')
    return `${t('recurring.schedule.monthly')} · ${schedule.day}. · ${t('recurring.every')} ${schedule.intervalMonths} ${t('recurring.months')}`
  if (schedule.type === 'weekly')
    return `${t(`recurring.weekday.${schedule.weekday}` as MessageKey)} · ${t('recurring.every')} ${schedule.intervalWeeks} ${t('recurring.weeks')}`
  return `${t('recurring.schedule.yearly')} · ${schedule.month}/${schedule.day}`
}

interface EditorProps extends Omit<Props, 'undoRevision' | 'onChanged'> {
  item?: RecurringTransaction
  prefill?: RecurringPrefill | null
  accounts: AccountOption[]
  categories: Category[]
  tags: Tag[]
  busy: boolean
  onSave(input: CreateRecurringTransactionInput): void
  onCancel(): void
}

function RecurringEditor({
  item,
  prefill,
  accounts,
  categories,
  tags,
  language,
  t,
  busy,
  onSave,
  onCancel,
}: EditorProps) {
  const initialSchedule = item?.schedule ??
    prefill?.schedule ?? {
      type: 'monthly' as const,
      day: new Date().getDate(),
      intervalMonths: 1,
    }
  const [draft, setDraft] = useState({
    kind: item?.kind ?? prefill?.kind ?? ('expense' as const),
    accountId: item?.accountId ?? prefill?.accountId ?? accounts[0]?.id ?? '',
    amount:
      item?.amountMinor !== undefined
        ? amountInput(item.amountMinor)
        : prefill?.amountMinor
          ? amountInput(prefill.amountMinor)
          : '',
    payeeName: item?.payeeName ?? prefill?.payeeName ?? '',
    categoryId: item?.categoryId ?? prefill?.categoryId ?? '',
    tagIds: item?.tagIds ?? prefill?.tagIds ?? ([] as string[]),
    note: item?.note ?? prefill?.note ?? '',
    scheduleType: initialSchedule.type,
    day: initialSchedule.type === 'weekly' ? 1 : initialSchedule.day,
    month: initialSchedule.type === 'yearly' ? initialSchedule.month : 1,
    weekday: initialSchedule.type === 'weekly' ? initialSchedule.weekday : 1,
    interval:
      initialSchedule.type === 'monthly'
        ? initialSchedule.intervalMonths
        : initialSchedule.type === 'weekly'
          ? initialSchedule.intervalWeeks
          : 1,
    startDate: item?.startDate ?? prefill?.startDate ?? localToday(),
    endDate: item?.endDate ?? prefill?.endDate ?? '',
  })
  const [error, setError] = useState(false)
  const currency =
    accounts.find((account) => account.id === draft.accountId)?.currency ??
    'HUF'
  const activeCategories = categories.filter(
    (category) =>
      category.kind === draft.kind &&
      (category.id === item?.categoryId ||
        (!category.archived &&
          (category.parentId === null ||
            !categories.find((parent) => parent.id === category.parentId)
              ?.archived))),
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      const schedule: RecurringSchedule =
        draft.scheduleType === 'monthly'
          ? { type: 'monthly', day: draft.day, intervalMonths: draft.interval }
          : draft.scheduleType === 'weekly'
            ? {
                type: 'weekly',
                weekday: draft.weekday,
                intervalWeeks: draft.interval,
              }
            : { type: 'yearly', month: draft.month, day: draft.day }
      onSave({
        kind: draft.kind,
        accountId: draft.accountId,
        amountMinor: parseAmountExpression(
          draft.amount,
          currency,
          'transactions.error.amount',
        ),
        payeeName: draft.payeeName || null,
        categoryId: draft.categoryId || null,
        tagIds: draft.tagIds,
        note: draft.note,
        schedule,
        startDate: draft.startDate,
        endDate: draft.endDate || null,
      })
    } catch {
      setError(true)
    }
  }

  return (
    <form className="space-y-4 rounded-lg border p-4" onSubmit={submit}>
      <h3 className="font-semibold">
        {t(item ? 'recurring.edit' : 'recurring.create')}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t('recurring.creationHint')}
      </p>
      {error && (
        <p role="alert" className="text-sm text-error">
          {t('recurring.error')}
        </p>
      )}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium">
          {t('transactions.kind')}
          <NativeSelect
            value={draft.kind}
            onChange={(event) =>
              setDraft({
                ...draft,
                kind: event.target.value as 'expense' | 'income',
                categoryId: '',
              })
            }
          >
            <option value="expense">{t('transactions.expense')}</option>
            <option value="income">{t('transactions.income')}</option>
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t('transactions.account')}
          <NativeSelect
            required
            value={draft.accountId}
            onChange={(event) =>
              setDraft({ ...draft, accountId: event.target.value })
            }
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="space-y-1">
          <label htmlFor="recurring-amount" className="text-sm font-medium">
            {t('transactions.amount')}
          </label>
          <AmountInput
            id="recurring-amount"
            value={draft.amount}
            currency={currency}
            language={language}
            t={t}
            errorKey="transactions.error.amount"
            hintKey="transactions.amountHint"
            disabled={busy}
            onChange={(amount) => {
              setError(false)
              setDraft({ ...draft, amount })
            }}
          />
        </div>
        <label className="space-y-1 text-sm font-medium">
          {t('transactions.payee')}
          <Input
            maxLength={100}
            value={draft.payeeName}
            onChange={(event) =>
              setDraft({ ...draft, payeeName: event.target.value })
            }
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t('transactions.category')}
          <NativeSelect
            value={draft.categoryId}
            onChange={(event) =>
              setDraft({ ...draft, categoryId: event.target.value })
            }
          >
            <option value="">{t('transactions.noCategory')}</option>
            {activeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.parentId ? '— ' : ''}
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t('recurring.schedule.label')}
          <NativeSelect
            value={draft.scheduleType}
            onChange={(event) =>
              setDraft({
                ...draft,
                scheduleType: event.target.value as RecurringSchedule['type'],
              })
            }
          >
            <option value="monthly">{t('recurring.schedule.monthly')}</option>
            <option value="weekly">{t('recurring.schedule.weekly')}</option>
            <option value="yearly">{t('recurring.schedule.yearly')}</option>
          </NativeSelect>
        </label>
        {draft.scheduleType === 'yearly' && (
          <label className="space-y-1 text-sm font-medium">
            {t('recurring.month')}
            <Input
              type="number"
              min={1}
              max={12}
              value={draft.month}
              onChange={(event) =>
                setDraft({ ...draft, month: Number(event.target.value) })
              }
            />
          </label>
        )}
        {draft.scheduleType !== 'weekly' && (
          <label className="space-y-1 text-sm font-medium">
            {t('recurring.day')}
            <Input
              type="number"
              min={1}
              max={31}
              value={draft.day}
              onChange={(event) =>
                setDraft({ ...draft, day: Number(event.target.value) })
              }
            />
          </label>
        )}
        {draft.scheduleType === 'weekly' && (
          <label className="space-y-1 text-sm font-medium">
            {t('recurring.weekday')}
            <NativeSelect
              value={draft.weekday}
              onChange={(event) =>
                setDraft({ ...draft, weekday: Number(event.target.value) })
              }
            >
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <option key={day} value={day}>
                  {t(`recurring.weekday.${day}` as MessageKey)}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        {draft.scheduleType !== 'yearly' && (
          <label className="space-y-1 text-sm font-medium">
            {t('recurring.interval')}
            <Input
              type="number"
              min={1}
              required
              value={draft.interval}
              onChange={(event) =>
                setDraft({ ...draft, interval: Number(event.target.value) })
              }
            />
          </label>
        )}
        <label className="space-y-1 text-sm font-medium">
          {t('recurring.startDate')}
          <Input
            type="date"
            required
            value={draft.startDate}
            onChange={(event) =>
              setDraft({ ...draft, startDate: event.target.value })
            }
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          {t('recurring.endDate')}
          <Input
            type="date"
            min={draft.startDate}
            value={draft.endDate}
            onChange={(event) =>
              setDraft({ ...draft, endDate: event.target.value })
            }
          />
        </label>
        <label className="space-y-1 text-sm font-medium sm:col-span-2">
          {t('tags.title')}
          <span className="flex flex-wrap gap-3 rounded-md border p-3">
            {tags.length === 0
              ? t('tags.empty')
              : tags.map((tag) => (
                  <span key={tag.id} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={draft.tagIds.includes(tag.id)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          tagIds: event.target.checked
                            ? [...draft.tagIds, tag.id]
                            : draft.tagIds.filter((id) => id !== tag.id),
                        })
                      }
                    />
                    {tag.name}
                  </span>
                ))}
          </span>
        </label>
        <label className="space-y-1 text-sm font-medium sm:col-span-2">
          {t('transactions.note')}
          <textarea
            className="min-h-20 w-full rounded-md border bg-transparent px-3 py-2"
            maxLength={1000}
            value={draft.note}
            onChange={(event) =>
              setDraft({ ...draft, note: event.target.value })
            }
          />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit">{t('recurring.save')}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('transactions.cancel')}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}

function PendingEditor({
  pending,
  account,
  language,
  t,
  busy,
  onCancel,
  onConfirm,
}: {
  pending: PendingTransaction
  account?: AccountOption
  language: Language
  t: Props['t']
  busy: boolean
  onCancel(): void
  onConfirm(amountMinor: number, date: string): void
}) {
  const [amount, setAmount] = useState(amountInput(pending.amountMinor))
  const [date, setDate] = useState(pending.dueDate)
  const [error, setError] = useState(false)
  return (
    <div className="fixed inset-0 z-50 bg-foreground/20 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-editor-title"
        className="mx-auto mt-20 max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault()
          try {
            onConfirm(
              parseAmountExpression(
                amount,
                account?.currency ?? 'HUF',
                'transactions.error.amount',
              ),
              date,
            )
          } catch {
            setError(true)
          }
        }}
      >
        <h3 id="pending-editor-title" className="text-lg font-semibold">
          {t('pending.editAndConfirm')}
        </h3>
        {error && (
          <p role="alert" className="text-sm text-error">
            {t('transactions.error.amount')}
          </p>
        )}
        <div className="space-y-1">
          <label htmlFor="pending-amount" className="text-sm font-medium">
            {t('transactions.amount')}
          </label>
          <AmountInput
            id="pending-amount"
            value={amount}
            currency={account?.currency ?? 'HUF'}
            language={language}
            t={t}
            errorKey="transactions.error.amount"
            hintKey="transactions.amountHint"
            disabled={busy}
            onChange={setAmount}
          />
        </div>
        <label className="block space-y-1 text-sm font-medium">
          {t('transactions.date')}
          <Input
            type="date"
            value={date}
            max={localToday()}
            required
            disabled={busy}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {t('pending.confirm')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            {t('transactions.cancel')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export function RecurringPage({
  language,
  t,
  undoRevision,
  onChanged,
  initialPrefill = null,
  onPrefillHandled,
}: Props) {
  const [items, setItems] = useState<RecurringTransaction[]>([])
  const [pending, setPending] = useState<PendingTransaction[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [editing, setEditing] = useState<
    RecurringTransaction | null | undefined
  >(initialPrefill ? null : undefined)
  const [editingPending, setEditingPending] =
    useState<PendingTransaction | null>(null)
  const [tab, setTab] = useState<'pending' | 'definitions'>(
    initialPrefill ? 'definitions' : 'pending',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const format = new Intl.DateTimeFormat(
    language === 'hu' ? 'hu-HU' : language === 'de' ? 'de-DE' : 'en-GB',
    { dateStyle: 'medium', timeZone: 'UTC' },
  )
  const amountFormat = useAmountFormatters(language)

  async function load() {
    const [nextItems, nextPending, nextAccounts, nextCategories, nextTags] =
      await Promise.all([
        window.app.recurring.list(),
        window.app.recurring.pending(),
        window.app.accounts.listOptions({ includeArchived: true }),
        window.app.categories.list(),
        window.app.tags.list(),
      ])
    setItems(nextItems)
    setPending(nextPending)
    setAccounts(nextAccounts)
    setCategories(nextCategories)
    setTags(nextTags)
  }
  useEffect(() => {
    onPrefillHandled?.()
  }, [onPrefillHandled])
  useEffect(() => {
    void Promise.all([
      window.app.recurring.list(),
      window.app.recurring.pending(),
      window.app.accounts.listOptions({ includeArchived: true }),
      window.app.categories.list(),
      window.app.tags.list(),
    ])
      .then(
        ([nextItems, nextPending, nextAccounts, nextCategories, nextTags]) => {
          setItems(nextItems)
          setPending(nextPending)
          setAccounts(nextAccounts)
          setCategories(nextCategories)
          setTags(nextTags)
        },
      )
      .catch(() => setError('recurring.error'))
  }, [undoRevision])
  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
      setEditing(undefined)
      onChanged()
    } catch (caught) {
      setError(
        String(caught).includes('pending.error.accountArchived')
          ? 'pending.error.accountArchived'
          : String(caught).includes('transactions.error.futureDate')
            ? 'transactions.error.futureDate'
            : 'recurring.error',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-6 pt-0">
      {error && (
        <p role="alert" className="text-sm text-error">
          {t(error)}
        </p>
      )}
      <div
        className="flex gap-2"
        role="tablist"
        aria-label={t('recurring.sections')}
      >
        <Button
          role="tab"
          aria-selected={tab === 'pending'}
          variant={tab === 'pending' ? 'default' : 'ghost'}
          onClick={() => setTab('pending')}
        >
          {t('pending.title')} ({pending.length})
        </Button>
        <Button
          role="tab"
          aria-selected={tab === 'definitions'}
          variant={tab === 'definitions' ? 'default' : 'ghost'}
          onClick={() => setTab('definitions')}
        >
          {t('recurring.definitions')}
        </Button>
      </div>
      {tab === 'definitions' && editing === undefined && (
        <Button
          disabled={busy || accounts.every((account) => account.archived)}
          onClick={() => setEditing(null)}
        >
          {t('recurring.create')}
        </Button>
      )}
      {tab === 'definitions' && accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('transactions.noAccounts')}
        </p>
      )}
      {tab === 'definitions' && editing !== undefined && (
        <RecurringEditor
          item={editing ?? undefined}
          prefill={editing === null ? initialPrefill : null}
          accounts={
            editing ? accounts : accounts.filter((account) => !account.archived)
          }
          categories={categories}
          tags={tags}
          language={language}
          t={t}
          busy={busy}
          onCancel={() => setEditing(undefined)}
          onSave={(input) =>
            void run(() =>
              editing
                ? window.app.recurring.update({ ...input, id: editing.id })
                : window.app.recurring.create(input),
            )
          }
        />
      )}
      {tab === 'pending' &&
        (pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('pending.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((item) => {
              const account = accounts.find(({ id }) => id === item.accountId)
              const overdue = item.dueDate < localToday()
              return (
                <li
                  key={item.id}
                  className={`rounded-lg border p-4 ${overdue ? 'border-error' : ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {item.payeeName ?? t('transactions.noPayee')}
                      </p>
                      <p className={overdue ? 'text-sm text-error' : 'text-sm'}>
                        {format.format(
                          new Date(`${item.dueDate}T00:00:00.000Z`),
                        )}
                        {overdue ? ` · ${t('pending.overdue')}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {account?.name ?? t('transactions.unknownAccount')} ·{' '}
                        {amountFormat.amount(
                          item.amountMinor,
                          account?.currency ?? 'HUF',
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            window.app.recurring.confirm({ id: item.id }),
                          )
                        }
                      >
                        {t('pending.confirm')}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setEditingPending(item)}
                      >
                        {t('pending.editAndConfirm')}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            window.app.recurring.skip({ id: item.id }),
                          )
                        }
                      >
                        {t('pending.skip')}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ))}
      {tab === 'definitions' &&
        (items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('recurring.empty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const account = accounts.find(
                (candidate) => candidate.id === item.accountId,
              )
              const due = nextDue(item)
              return (
                <li key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {item.payeeName ?? t('transactions.noPayee')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {account?.name ?? t('transactions.unknownAccount')} ·{' '}
                        {amountFormat.amount(
                          item.amountMinor,
                          account?.currency ?? 'HUF',
                        )}{' '}
                        · {scheduleText(item.schedule, t)}
                      </p>
                      <p className="text-sm">
                        {item.paused
                          ? t('recurring.paused')
                          : due
                            ? `${t('recurring.nextDue')}: ${format.format(new Date(`${due}T00:00:00.000Z`))}`
                            : t('recurring.noNextDue')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setEditing(item)}
                      >
                        {t('recurring.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            item.paused
                              ? window.app.recurring.resume({ id: item.id })
                              : window.app.recurring.pause({ id: item.id }),
                          )
                        }
                      >
                        {t(
                          item.paused ? 'recurring.resume' : 'recurring.pause',
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(t('recurring.deleteConfirmation')))
                            void run(() =>
                              window.app.recurring.delete({ id: item.id }),
                            )
                        }}
                      >
                        {t('recurring.delete')}
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ))}
      {editingPending && (
        <PendingEditor
          pending={editingPending}
          account={accounts.find(({ id }) => id === editingPending.accountId)}
          language={language}
          t={t}
          busy={busy}
          onCancel={() => setEditingPending(null)}
          onConfirm={(amountMinor, date) =>
            void run(() =>
              window.app.recurring.confirm({
                id: editingPending.id,
                amountMinor,
                date,
              }),
            ).then(() => setEditingPending(null))
          }
        />
      )}
    </div>
  )
}
