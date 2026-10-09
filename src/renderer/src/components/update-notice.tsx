import { useEffect, useState } from 'react'
import type { UpdateState } from '../../../shared/ipc'
import type { MessageKey } from '../i18n'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'

const UPDATED_CONFIRMATION_MS = 6000

export function UpdateNotice({ t }: { t: (key: MessageKey) => string }) {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })
  const [hiddenReadyVersion, setHiddenReadyVersion] = useState<string | null>(
    null,
  )
  const [updatedVersion, setUpdatedVersion] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    let confirmationTimer: number | undefined
    const unsubscribe = window.app.updates.onStateChanged((nextState) => {
      if (active) setState(nextState)
    })
    void window.app.updates
      .state()
      .then((currentState) => {
        if (active) setState(currentState)
      })
      .catch(() => {})
    void window.app.updates
      .justUpdated()
      .then((version) => {
        if (!active || !version) return
        setUpdatedVersion(version)
        confirmationTimer = window.setTimeout(
          () => setUpdatedVersion(null),
          UPDATED_CONFIRMATION_MS,
        )
      })
      .catch(() => {})
    return () => {
      active = false
      unsubscribe()
      if (confirmationTimer !== undefined)
        window.clearTimeout(confirmationTimer)
    }
  }, [])

  async function restart() {
    setBusy(true)
    setError(false)
    try {
      await window.app.updates.restart()
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  const ready = state.status === 'ready' && state.version !== hiddenReadyVersion

  if (state.status !== 'downloading' && !ready && !updatedVersion) return null
  return (
    <div className="fixed top-[calc(var(--title-bar-height)+1rem)] right-4 z-50 flex w-[min(calc(100vw-2rem),24rem)] flex-col items-end gap-3">
      {state.status === 'downloading' && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-full border bg-card px-3 py-1.5 text-xs text-card-foreground shadow-sm"
        >
          {t('updates.downloading').replace('{percent}', String(state.percent))}
        </p>
      )}
      {ready && state.status === 'ready' && (
        <Card
          role="status"
          aria-live="polite"
          className="w-full gap-3 py-4 shadow-lg"
        >
          <CardContent className="space-y-3 px-4">
            <p className="text-sm">
              {t('updates.ready').replace('{version}', state.version)}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setHiddenReadyVersion(state.version)
                  setError(false)
                }}
              >
                {t('updates.later')}
              </Button>
              <Button disabled={busy} onClick={() => void restart()}>
                {t(busy ? 'updates.restarting' : 'updates.restart')}
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-error">
                {t('updates.error')}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {updatedVersion && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground shadow-lg"
        >
          {t('updates.updated').replace('{version}', updatedVersion)}
        </p>
      )}
    </div>
  )
}
