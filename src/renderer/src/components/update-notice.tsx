import { useEffect, useState } from 'react'
import type { MessageKey } from '../i18n'
import { Button } from './ui/button'

export function UpdateNotice({ t }: { t: (key: MessageKey) => string }) {
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    const unsubscribe = window.app.updates.onReady(() => setReady(true))
    void window.app.updates.isReady().then((downloaded) => {
      if (downloaded) setReady(true)
    })
    return unsubscribe
  }, [])

  async function restart() {
    setBusy(true)
    setError(false)
    try {
      await window.app.updates.restart()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return null
  return (
    <aside
      role="status"
      className="fixed right-4 bottom-4 z-50 max-w-sm space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-lg"
    >
      <p className="text-sm">{t('updates.ready')}</p>
      <Button disabled={busy} onClick={() => void restart()}>
        {t('updates.restart')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-error">
          {t('updates.error')}
        </p>
      )}
    </aside>
  )
}
