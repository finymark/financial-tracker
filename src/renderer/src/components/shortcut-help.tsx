import { useRef } from 'react'
import { X } from 'lucide-react'
import type { MessageKey } from '../i18n'
import { matchShortcut, shortcuts } from '../lib/shortcuts'
import { useDialogFocus } from '../lib/use-dialog-focus'
import { Button } from './ui/button'

interface ShortcutHelpProps {
  t(key: MessageKey): string
  onClose(): void
}

export function ShortcutHelp({ t, onClose }: ShortcutHelpProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useDialogFocus(true, dialogRef, closeRef)

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-foreground/20 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        tabIndex={-1}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg border bg-background p-6 shadow-xl"
        onKeyDown={(event) => {
          if (matchShortcut(event.nativeEvent, { scope: 'help' }) === 'close') {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="shortcut-help-title" className="text-xl font-semibold">
            {t('shortcuts.help')}
          </h2>
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon"
            aria-label={t('shortcuts.closeHelp')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('shortcuts.scope')}
        </p>
        <dl className="space-y-3 text-sm">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="grid grid-cols-[8rem_1fr] gap-3"
            >
              <dt>
                <kbd className="rounded border bg-muted px-2 py-1 font-mono">
                  {shortcut.label}
                </kbd>
              </dt>
              <dd>{t(shortcut.description)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          {t('shortcuts.navigation')} {t('privacy.shortcutScope')}
        </p>
      </section>
    </div>
  )
}
