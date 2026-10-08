import { useState, type Dispatch, type SetStateAction } from 'react'
import type { TransactionTemplate } from '../../../../shared/templates'
import type { Transaction } from '../../../../shared/transactions'
import type { MessageKey } from '../../i18n'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { NativeSelect } from '../ui/native-select'
import type { RunCommand } from './transaction-form'

interface TemplatePickerProps {
  templates: TransactionTemplate[]
  selectedTemplateId: string
  setSelectedTemplateId: Dispatch<SetStateAction<string>>
  setTemplateEditor: Dispatch<
    SetStateAction<TransactionTemplate | 'new' | null>
  >
  savedTransaction?: Transaction
  busy: boolean
  error: MessageKey | null
  t(key: MessageKey): string
  applyTemplate(template: TransactionTemplate): void
  run: RunCommand
  onCreateRecurring(template: TransactionTemplate): void
  onCreateRecurringFromTransaction(transaction: Transaction): void
}

export function TemplatePicker({
  templates,
  selectedTemplateId,
  setSelectedTemplateId,
  setTemplateEditor,
  savedTransaction,
  busy,
  error,
  t,
  applyTemplate,
  run,
  onCreateRecurring,
  onCreateRecurringFromTransaction,
}: TemplatePickerProps) {
  const [deletingTemplate, setDeletingTemplate] =
    useState<TransactionTemplate | null>(null)
  const [saveTemplateName, setSaveTemplateName] = useState<string | null>(null)
  return (
    <>
      {error && saveTemplateName !== null && (
        <p role="alert" className="mb-4 text-sm text-error">
          {t(error)}
        </p>
      )}
      <section
        data-template-controls
        className="mb-6 space-y-3 rounded-md border p-3"
        aria-label={t('templates.title')}
      >
        <label className="block space-y-1 text-sm font-medium">
          {t('templates.title')}
          <NativeSelect
            value={selectedTemplateId}
            disabled={busy}
            onChange={(event) => {
              setSelectedTemplateId(event.target.value)
              setDeletingTemplate(null)
              setTemplateEditor(null)
            }}
          >
            <option value="">{t('templates.choose')}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !selectedTemplateId}
            onClick={() => {
              const template = templates.find(
                ({ id }) => id === selectedTemplateId,
              )
              if (template) {
                applyTemplate(template)
                setSaveTemplateName(null)
                setDeletingTemplate(null)
              }
            }}
          >
            {t('templates.use')}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setTemplateEditor('new')
              setSaveTemplateName(null)
              setDeletingTemplate(null)
            }}
          >
            {t('templates.create')}
          </Button>
          <Button
            variant="ghost"
            disabled={busy || !selectedTemplateId}
            onClick={() => {
              setTemplateEditor(
                templates.find(({ id }) => id === selectedTemplateId) ?? null,
              )
              setSaveTemplateName(null)
              setDeletingTemplate(null)
            }}
          >
            {t('templates.edit')}
          </Button>
          <Button
            variant="ghost"
            disabled={busy || !selectedTemplateId}
            onClick={() => {
              setDeletingTemplate(
                templates.find(({ id }) => id === selectedTemplateId) ?? null,
              )
              setTemplateEditor(null)
              setSaveTemplateName(null)
            }}
          >
            {t('templates.delete')}
          </Button>
          <Button
            variant="ghost"
            disabled={busy || !selectedTemplateId}
            onClick={() => {
              const template = templates.find(
                ({ id }) => id === selectedTemplateId,
              )
              if (template) onCreateRecurring(template)
            }}
          >
            {t('recurring.fromTemplate')}
          </Button>
        </div>
        {savedTransaction && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={busy || savedTransaction.lines.length > 1}
              onClick={() => {
                setSaveTemplateName('')
                setTemplateEditor(null)
                setDeletingTemplate(null)
              }}
            >
              {t('templates.saveTransaction')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    window.app.transactions.duplicate({
                      id: savedTransaction.id,
                    }),
                  true,
                )
              }
            >
              {t('transactions.duplicate')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy || savedTransaction.lines.length > 1}
              title={
                savedTransaction.lines.length > 1
                  ? t('recurring.fromSplitHint')
                  : undefined
              }
              onClick={() => onCreateRecurringFromTransaction(savedTransaction)}
            >
              {t('recurring.fromTransaction')}
            </Button>
          </div>
        )}
        {saveTemplateName !== null && savedTransaction?.lines.length === 1 && (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault()
              void run(
                () =>
                  window.app.templates.saveTransaction({
                    transactionId: savedTransaction.id,
                    name: saveTemplateName,
                  }),
                true,
              )
            }}
          >
            <p className="text-xs text-muted-foreground">
              {t('templates.savedTransactionHint')}
            </p>
            <label className="block space-y-1 text-sm font-medium">
              {t('templates.name')}
              <Input
                value={saveTemplateName}
                required
                maxLength={100}
                disabled={busy}
                onChange={(event) => setSaveTemplateName(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {t('templates.save')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setSaveTemplateName(null)}
            >
              {t('transactions.cancel')}
            </Button>
          </form>
        )}
        {deletingTemplate && (
          <section role="alert" className="space-y-2">
            <p>
              {t('templates.deleteConfirmation')}{' '}
              <strong>{deletingTemplate.name}</strong>
            </p>
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    window.app.templates.delete({
                      id: deletingTemplate.id,
                    }),
                  true,
                )
              }
            >
              {t('templates.delete')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDeletingTemplate(null)}
            >
              {t('transactions.cancel')}
            </Button>
          </section>
        )}
      </section>
    </>
  )
}
