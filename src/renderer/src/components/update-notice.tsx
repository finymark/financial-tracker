import { useEffect, useReducer, useState } from 'react'
import type { MessageKey } from '../i18n'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import {
  initialUpdateNoticeState,
  isReadyVisible,
  updateNoticeReducer,
} from './update-notice-state'

const UPDATED_CONFIRMATION_MS = 6000

export function UpdateNotice({ t }: { t: (key: MessageKey) => string }) {
  const [notice, dispatch] = useReducer(
    updateNoticeReducer,
    initialUpdateNoticeState,
  )
  const [updatedVersion, setUpdatedVersion] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let confirmationTimer: number | undefined
    const unsubscribe = window.app.updates.onStateChanged((nextState) => {
      if (active)
        dispatch({ type: 'main-state', source: 'push', state: nextState })
    })
    void window.app.updates
      .state()
      .then((currentState) => {
        if (active)
          dispatch({
            type: 'main-state',
            source: 'pull',
            state: currentState,
          })
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
    dispatch({ type: 'restart' })
    try {
      await window.app.updates.restart()
    } catch {
      dispatch({ type: 'restart-rejected' })
    }
  }

  const { update, busy, error } = notice
  const ready = isReadyVisible(notice)

  if (update.status !== 'downloading' && !ready && !updatedVersion) return null
  return (
    <div className="flex w-full max-w-sm flex-col items-end gap-3">
      {update.status === 'downloading' && (
        <>
          <div
            role="progressbar"
            aria-label={t('updates.downloadingStarted')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={update.percent}
            className="rounded-full border bg-card px-3 py-1.5 text-xs text-card-foreground shadow-sm"
          >
            {t('updates.downloading').replace(
              '{percent}',
              String(update.percent),
            )}
          </div>
          <p role="status" aria-live="polite" className="sr-only">
            {t('updates.downloadingStarted')}
          </p>
        </>
      )}
      {ready && update.status === 'ready' && (
        <Card className="w-full gap-3 py-4 shadow-lg">
          <CardContent className="space-y-3 px-4">
            <p role="status" aria-live="polite" className="text-sm">
              {t('updates.ready').replace('{version}', update.version)}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => dispatch({ type: 'later' })}
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
