import { tagKey } from '../../../../shared/text-keys'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react'
import { X } from 'lucide-react'
import type {
  Transaction,
  TransactionPage,
  TransactionKind,
} from '../../../../shared/transactions'
import type { AccountOption } from '../../../../shared/accounts'
import type { TransactionTemplate } from '../../../../shared/templates'
import type { PayeeSuggestion } from '../../../../shared/payees'
import { amountInput } from '../../lib/amount-input-value'
import type { CreateCategorisationRuleInput } from '../../../../shared/rules'
import { ruleOfferPrefill } from '../../lib/rule-offer'
import { TemplateEditor } from '../template-editor'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { NativeSelect } from '../ui/native-select'
import { type Language, type MessageKey } from '../../i18n'
import { parseAmountExpression } from '../../../../shared/amount-expression'
import { AmountInput } from '../amount-input'
import { today } from '../../../../shared/date'
import { matchShortcut } from '../../lib/shortcuts'
import { shortcutTargetContext } from '../../lib/shortcut-context'
import { useDialogFocus } from '../../lib/use-dialog-focus'
import { templateAutofillProtection } from '../../lib/rule-autofill'
import {
  emptyForm,
  emptyTransferForm,
  type DrawerForm,
  type TransactionForm,
  type TransferForm,
  type RunCommand,
} from './transaction-form'
import type { TransactionReferenceData } from './use-transaction-reference-data'
import { useRuleAutofill } from './use-rule-autofill'
import { SplitEditor } from './split-editor'
import { TemplatePicker } from './template-picker'
interface TransactionDrawerProps {
  draft: DrawerForm
  references: TransactionReferenceData
  rows: TransactionPage['rows']
  language: Language
  t(key: MessageKey): string
  busy: boolean
  error: MessageKey | null
  clearError(): void
  run: RunCommand
  onClose(): void
  onRuleOffer(prefill: CreateCategorisationRuleInput): void
  createRef: RefObject<HTMLButtonElement | null>
}
function commonFields(form: DrawerForm) {
  return {
    id: form.id,
    accountId: form.accountId,
    date: form.date,
    amount: form.amount,
    note: form.note,
  }
}

export function TransactionDrawer({
  draft,
  references,
  rows,
  language,
  t,
  busy,
  error,
  clearError,
  run,
  onClose,
  onRuleOffer,
  createRef,
}: TransactionDrawerProps) {
  const {
    accounts,
    categories,
    accountOptions,
    categoryOptions,
    tags,
    templates,
  } = references
  const [form, setForm] = useState<DrawerForm | null>(draft)
  const [payeeSuggestions, setPayeeSuggestions] = useState<PayeeSuggestion[]>(
    [],
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateEditor, setTemplateEditor] = useState<
    TransactionTemplate | 'new' | null
  >(null)
  const [pickerRevision, setPickerRevision] = useState(0)
  const autofillProtected = useRef({
    payee:
      Boolean(draft.id) ||
      Boolean(
        (draft.kind === 'expense' || draft.kind === 'income') &&
        draft.payeeName,
      ),
    category: Boolean(draft.id),
    tags: Boolean(draft.id),
  })
  const manualCategorisation = useRef({ category: false, tags: false })
  const categorisationBaseline = useRef({
    categoryId: '',
    tagNames: [] as string[],
  })
  function markManual(field: 'category' | 'tags') {
    if (!form || (form.kind !== 'expense' && form.kind !== 'income')) return
    if (!manualCategorisation.current[field]) {
      if (field === 'category')
        categorisationBaseline.current.categoryId = form.categoryId
      else categorisationBaseline.current.tagNames = [...form.tagNames]
    }
    manualCategorisation.current[field] = true
  }
  // Keep the inactive kind's draft so switching types does not discard entered fields.
  const transactionDraft = useRef<TransactionForm>(
    draft.kind === 'expense' || draft.kind === 'income' ? draft : emptyForm(),
  )
  const transferDraft = useRef<TransferForm>(
    draft.kind === 'transfer' ? draft : emptyTransferForm(),
  )
  const batchDraft = useRef<DrawerForm | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [focusRevision, setFocusRevision] = useState(0)
  useDialogFocus(true, dialogRef, amountRef, createRef)
  const [previousDraft, setPreviousDraft] = useState(draft)
  if (draft !== previousDraft) {
    setPreviousDraft(draft)
    setForm(draft)
    setTemplateEditor(null)
    setSelectedTemplateId('')
    setPickerRevision(pickerRevision + 1)
  }
  useEffect(() => {
    manualCategorisation.current = { category: false, tags: false }
    autofillProtected.current = {
      payee:
        Boolean(draft.id) ||
        Boolean(
          (draft.kind === 'expense' || draft.kind === 'income') &&
          draft.payeeName,
        ),
      category: Boolean(draft.id),
      tags: Boolean(draft.id),
    }
    transactionDraft.current =
      draft.kind === 'expense' || draft.kind === 'income' ? draft : emptyForm()
    transferDraft.current =
      draft.kind === 'transfer'
        ? draft
        : {
            ...emptyTransferForm(),
            toAccountId:
              batchDraft.current === draft
                ? transferDraft.current.toAccountId
                : '',
          }
    batchDraft.current = null
    amountRef.current?.focus()
  }, [draft])
  useEffect(() => {
    if (focusRevision) amountRef.current?.focus()
  }, [focusRevision])
  const payeeQuery =
    form?.kind === 'expense' || form?.kind === 'income'
      ? form.payeeName
      : undefined
  useEffect(() => {
    if (payeeQuery === undefined) return
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

  const autofillRequestRef = useRuleAutofill(
    form,
    setForm,
    accounts,
    autofillProtected,
    focusRevision,
  )
  function closeDrawer() {
    autofillRequestRef.current += 1
    onClose()
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
    if (kind === 'transfer') {
      transactionDraft.current = {
        ...(form as TransactionForm),
        categoryId: '',
        splitLines: null,
      }
      setForm({
        ...transferDraft.current,
        ...commonFields(form),
        kind,
        feeCategoryId: feeCategoryDefault,
      })
    } else {
      if (form.kind === 'transfer') transferDraft.current = form
      const transaction =
        form.kind === 'transfer' ? transactionDraft.current : form
      setForm({
        ...transaction,
        ...commonFields(form),
        kind,
        categoryId: '',
        splitLines:
          transaction.splitLines?.map((line) => ({
            ...line,
            categoryId: '',
          })) ?? null,
      })
    }
  }

  function save(addAnother = false) {
    if (!form || busy) return
    const nextForm: DrawerForm | null =
      addAnother && form.kind !== 'adjustment'
        ? form.kind === 'transfer'
          ? {
              ...emptyTransferForm(form.accountId),
              date: form.date,
              toAccountId: form.toAccountId,
              feeCategoryId: feeCategoryDefault,
            }
          : { ...emptyForm(form.accountId), date: form.date, kind: form.kind }
        : null
    batchDraft.current = nextForm
    void run(
      async () => {
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
        const saved = await (form.id
          ? window.app.transactions.update({ id: form.id, ...input })
          : window.app.transactions.create(input))
        const prefill = ruleOfferPrefill(
          saved,
          categorisationBaseline.current,
          manualCategorisation.current,
        )
        if (prefill) onRuleOffer(prefill)
        return saved
      },
      true,
      nextForm,
    )
  }

  function applyTemplate(template: TransactionTemplate) {
    autofillRequestRef.current += 1
    manualCategorisation.current = { category: false, tags: false }
    autofillProtected.current = templateAutofillProtection(template)
    const kind =
      template.kind ??
      categories.find((category) => category.id === template.categoryId)
        ?.kind ??
      'expense'
    const categoryId = template.categoryId ?? ''
    const accountId = template.accountId ?? accountOptions[0]?.id ?? ''
    transferDraft.current = emptyTransferForm()
    setForm({
      ...emptyForm(accountId),
      kind,
      categoryId,
      amount:
        template.totalMinor === null ? '' : amountInput(template.totalMinor),
      payeeName: template.payeeName ?? '',
      note: template.note ?? '',
      tagNames: template.tagNames,
      excluded: template.excluded,
    })
    setTemplateEditor(null)
    clearError()
    setFocusRevision((current) => current + 1)
  }

  function addTag() {
    if (
      !form ||
      (form.kind !== 'expense' && form.kind !== 'income') ||
      !form.pendingTagName.trim()
    )
      return
    const name = form.pendingTagName.trim()
    markManual('tags')
    autofillProtected.current.tags = true
    setForm({
      ...form,
      tagNames: form.tagNames.some((tag) => tagKey(tag) === tagKey(name))
        ? form.tagNames
        : [...form.tagNames, name],
      pendingTagName: '',
    })
  }

  const savedTransaction = form?.id
    ? rows.find(
        (row): row is Transaction =>
          row.id === form.id &&
          (row.kind === 'expense' || row.kind === 'income'),
      )
    : undefined
  const selectedAccount = form
    ? accounts.find((account) => account.id === form.accountId)
    : undefined
  const selectedCategory =
    form && (form.kind === 'expense' || form.kind === 'income')
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
                ((form.kind === 'expense' || form.kind === 'income') &&
                  form.splitLines?.some(
                    (line) => line.categoryId === category.id,
                  ))) &&
              !categoryOptions[formTransactionKind].some(
                ({ id }) => id === category.id,
              ),
          ),
          ...categoryOptions[formTransactionKind],
        ]
      : []
  const selectedToAccount =
    form?.kind === 'transfer'
      ? accounts.find((account) => account.id === form.toAccountId)
      : undefined
  const transferAccounts = [
    ...[selectedAccount, selectedToAccount].filter(
      (account): account is AccountOption => Boolean(account?.archived),
    ),
    ...accountOptions,
  ].filter(
    (account, index, all) =>
      all.findIndex((candidate) => candidate.id === account.id) === index,
  )

  return (
    <>
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
              // The shell owns the global privacy toggle, even while typing.
              if (!action || action === 'privacy') return
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

            {error && templateEditor && (
              <p role="alert" className="mb-4 text-sm text-error">
                {t(error)}
              </p>
            )}
            <TemplatePicker
              key={pickerRevision}
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              setSelectedTemplateId={setSelectedTemplateId}
              setTemplateEditor={setTemplateEditor}
              savedTransaction={savedTransaction}
              busy={busy}
              error={error}
              t={t}
              applyTemplate={applyTemplate}
              run={run}
            />
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
                  <SplitEditor
                    form={form}
                    setForm={setForm}
                    selectedAccount={selectedAccount}
                    drawerCategories={drawerCategories}
                    tags={tags}
                    busy={busy}
                    language={language}
                    t={t}
                    autofillProtectedRef={autofillProtected}
                  />
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
                      onChange={(event) => {
                        autofillProtected.current.payee = true
                        setForm({ ...form, payeeName: event.target.value })
                      }}
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
                          markManual('category')
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
                            markManual('tags')
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
                                markManual('tags')
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

                {(!(form.kind === 'expense' || form.kind === 'income') ||
                  !form.splitLines) && (
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
    </>
  )
}
