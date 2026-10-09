import { useRef, useState, type FormEvent, type RefObject } from 'react'
import type { TransactionListInput } from '../../../../shared/transactions'
import type { CsvDecimalSeparator } from '../../../../shared/transaction-csv'
import type { Language, MessageKey } from '../../i18n'
import { useAmountFormatters } from '../../lib/privacy'
import { useDialogFocus } from '../../lib/use-dialog-focus'
import { Button } from '../ui/button'
import { NativeSelect } from '../ui/native-select'
import { HelpHint } from '../ui/help-hint'

interface Props {
  input: TransactionListInput
  language: Language
  t(key: MessageKey): string
  exportRef: RefObject<HTMLButtonElement | null>
  onClose(): void
  onSaved(): void
}

export function ExportCsvDialog({
  input,
  language,
  t,
  exportRef,
  onClose,
  onSaved,
}: Props) {
  const format = useAmountFormatters(language)
  const dialogRef = useRef<HTMLElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  useDialogFocus(true, dialogRef, selectRef, exportRef)
  const [separator, setSeparator] = useState<'profile' | CsvDecimalSeparator>(
    'profile',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(false)
    try {
      const saved = await window.app.transactions.exportCsv({
        ...input,
        decimalSeparator: separator === 'profile' ? undefined : separator,
      })
      if (saved) onSaved()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-csv-title"
        tabIndex={-1}
        className="w-full max-w-lg space-y-4 rounded-lg border bg-background p-6 shadow-xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            if (!busy) onClose()
          }
        }}
      >
        <div className="flex items-center gap-1">
          <h2 id="export-csv-title" className="text-xl font-semibold">
            {t('csv.export')}
          </h2>
          <HelpHint
            t={t}
            topicKey="csv.export"
            textKey="help.transactions.csvExport"
          />
        </div>
        <p className="text-sm text-muted-foreground">{t('csv.description')}</p>
        {error && (
          <p role="alert" className="text-sm text-error">
            {t('csv.error')}
          </p>
        )}
        {busy && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('csv.saving')}
          </p>
        )}
        <form onSubmit={(event) => void save(event)} className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <label
                htmlFor="csv-decimal-separator"
                className="text-sm font-medium"
              >
                {t('csv.decimalSeparator')}
              </label>
              <HelpHint
                t={t}
                topicKey="csv.decimalSeparator"
                textKey="help.transactions.csvSeparator"
              />
            </div>
            <NativeSelect
              id="csv-decimal-separator"
              ref={selectRef}
              value={separator}
              disabled={busy}
              onChange={(event) =>
                setSeparator(event.target.value as typeof separator)
              }
            >
              <option value="profile">
                {t('csv.profileDefault')} ·{' '}
                {format.privateText(language === 'en' ? '123.45' : '123,45')}
              </option>
              <option value=".">
                {t('csv.dot').replace('123.45', format.privateText('123.45'))}
              </option>
              <option value=",">
                {t('csv.comma').replace('123,45', format.privateText('123,45'))}
              </option>
            </NativeSelect>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onClose}
            >
              {t('transactions.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t('csv.save')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
