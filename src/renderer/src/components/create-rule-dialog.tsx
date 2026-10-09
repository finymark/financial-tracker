import { useRef, type RefObject } from 'react'
import type { Currency } from '../../../shared/accounts'
import type { CreateCategorisationRuleInput } from '../../../shared/rules'
import type { Language, MessageKey } from '../i18n'
import { useDialogFocus } from '../lib/use-dialog-focus'
import { HelpHint } from './ui/help-hint'
import { RuleEditor, emptyRuleForm } from './rule-editor'
import type { TransactionReferenceData } from './transactions/use-transaction-reference-data'

interface Props {
  prefill: CreateCategorisationRuleInput
  references: TransactionReferenceData
  baseCurrency: Currency
  language: Language
  t(key: MessageKey): string
  busy: boolean
  error: MessageKey | null
  createRef: RefObject<HTMLButtonElement | null>
  onClose(): void
  onSave(input: CreateCategorisationRuleInput): void
}

export function CreateRuleDialog({
  prefill,
  references,
  baseCurrency,
  language,
  t,
  busy,
  error,
  createRef,
  onClose,
  onSave,
}: Props) {
  const dialogRef = useRef<HTMLElement>(null)
  useDialogFocus(true, dialogRef, dialogRef, createRef)
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-foreground/20 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-rule-title"
        className="mx-auto max-w-2xl space-y-4 rounded-lg border bg-background p-6 shadow-xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            if (!busy) onClose()
          }
        }}
      >
        <div className="flex items-center gap-1">
          <h2 id="create-rule-title" className="text-xl font-semibold">
            {t('rules.create')}
          </h2>
          <HelpHint
            t={t}
            topicKey="rules.create"
            textKey="help.settings.rules"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-error">
            {t(error)}
          </p>
        )}
        <RuleEditor
          initial={{
            ...emptyRuleForm(baseCurrency),
            payeeId: prefill.payeeId ?? '',
            textContains: prefill.textContains ?? '',
            categoryId: prefill.categoryId ?? '',
            tagIds: prefill.tagIds,
          }}
          accounts={references.accountOptions}
          categories={references.categories}
          payees={references.payees}
          tags={references.tags}
          baseCurrency={baseCurrency}
          language={language}
          t={t}
          locked={busy || references.loading}
          onCancel={onClose}
          onSave={onSave}
        />
      </section>
    </div>
  )
}
