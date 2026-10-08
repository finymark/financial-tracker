import { useEffect, useState, type KeyboardEvent } from 'react'
import type { ShortcutStatus } from '../../../shared/desktop'
import {
  acceleratorFromKeyEvent,
  DEFAULT_QUICK_ADD_ACCELERATOR,
  displayAccelerator,
} from '../../../shared/accelerator'
import type { MessageKey } from '../i18n'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { HelpHint } from './ui/help-hint'

export function shortcutConflictMessage(
  t: (key: MessageKey) => string,
  accelerator: string,
  previousKept = false,
): string {
  return t(
    previousKept
      ? 'settings.shortcutConflictKept'
      : 'settings.shortcutConflict',
  ).replace('{shortcut}', displayAccelerator(accelerator))
}

export function ShortcutSettings({ t }: { t: (key: MessageKey) => string }) {
  const [status, setStatus] = useState<ShortcutStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let ignore = false
    void window.app.desktop
      .shortcutStatus()
      .then((next) => {
        if (!ignore) {
          setStatus(next)
        }
      })
      .catch(() => {
        if (!ignore) setError(true)
      })
    return () => {
      ignore = true
    }
  }, [])

  async function save(accelerator: string) {
    setBusy(true)
    setError(false)
    try {
      const next = await window.app.desktop.setShortcut({ accelerator })
      setStatus(next)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  function capture(event: KeyboardEvent<HTMLInputElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (event.repeat || event.nativeEvent.isComposing) return
    const accelerator = acceleratorFromKeyEvent(event)
    if (accelerator) void save(accelerator)
  }

  return (
    <section className="space-y-2" aria-labelledby="shortcut-heading">
      <h3
        id="shortcut-heading"
        className="flex items-center gap-1 text-sm font-medium"
      >
        {t('settings.shortcut')}
        <HelpHint
          t={t}
          topicKey="settings.shortcut"
          textKey="help.settings.shortcut"
        />
      </h3>
      <p className="text-sm text-muted-foreground">
        {t('settings.shortcutDescription')}
      </p>
      <div className="flex max-w-lg flex-wrap gap-2">
        <Input
          className="min-w-56 flex-1"
          value={status ? displayAccelerator(status.accelerator) : ''}
          placeholder={t('settings.shortcutCapture')}
          aria-label={t('settings.shortcutCapture')}
          readOnly
          disabled={busy}
          onKeyDown={capture}
        />
        <Button
          type="button"
          variant="ghost"
          disabled={
            busy ||
            (status?.accelerator === DEFAULT_QUICK_ADD_ACCELERATOR &&
              !status.failureAccelerator)
          }
          onClick={() => void save(DEFAULT_QUICK_ADD_ACCELERATOR)}
        >
          {t('settings.shortcutReset')}
        </Button>
      </div>
      {status?.failureAccelerator && (
        <p role="alert" className="text-sm font-medium text-error">
          {shortcutConflictMessage(
            t,
            status.failureAccelerator,
            status.registered,
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-error">
          {t('settings.shortcutError')}
        </p>
      )}
    </section>
  )
}
