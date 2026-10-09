import { useEffect, useState } from 'react'
import type { AutostartStatus } from '../../../shared/desktop'
import type { MessageKey } from '../i18n'

export function AutostartSettings({ t }: { t: (key: MessageKey) => string }) {
  const [status, setStatus] = useState<AutostartStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let ignore = false
    void window.app.desktop
      .autostartStatus()
      .then((next) => {
        if (!ignore) setStatus(next)
      })
      .catch(() => {
        if (!ignore) setError(true)
      })
    return () => {
      ignore = true
    }
  }, [])

  async function toggle(openAtLogin: boolean) {
    setBusy(true)
    setError(false)
    try {
      setStatus(await window.app.desktop.setAutostart({ openAtLogin }))
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={status?.openAtLogin ?? false}
          disabled={!status?.supported || busy}
          aria-describedby="autostart-description"
          onChange={(event) => void toggle(event.target.checked)}
        />
        {t('settings.autostart')}
      </label>
      <p id="autostart-description" className="text-sm text-muted-foreground">
        {t('settings.autostartDescription')}
        {status && !status.supported && (
          <> {t('settings.autostartUnavailable')}</>
        )}
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-error">
          {t('settings.autostartError')}
        </p>
      )}
    </section>
  )
}
