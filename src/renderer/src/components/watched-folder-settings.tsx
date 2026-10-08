import { useEffect, useState } from 'react'
import type {
  ProfileSettingsChanges,
  WatchedFolderStatus,
} from '../../../shared/settings'
import type { MessageKey } from '../i18n'
import { Button } from './ui/button'

interface WatchedFolderSettingsProps {
  watchedFolder: string | null
  disabled: boolean
  t(key: MessageKey): string
  onChange(changes: ProfileSettingsChanges): Promise<void>
  onError(): void
}

export function WatchedFolderSettings({
  watchedFolder,
  disabled,
  t,
  onChange,
  onError,
}: WatchedFolderSettingsProps) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<WatchedFolderStatus | null>(null)

  useEffect(() => {
    let ignore = false
    void window.app.profiles
      .watchedFolderStatus()
      .then((next) => {
        if (!ignore) setStatus(next)
      })
      .catch(() => {
        if (!ignore) setStatus(watchedFolder ? 'unavailable' : null)
      })
    const unsubscribe = window.app.profiles.onWatchedFolderStatusChanged(
      (next) => {
        if (!ignore) setStatus(next)
      },
    )
    return () => {
      ignore = true
      unsubscribe()
    }
  }, [watchedFolder])

  async function choose() {
    setBusy(true)
    try {
      const folder = await window.app.profiles.pickWatchedFolder()
      if (folder) await onChange({ watchedFolder: folder })
    } catch {
      onError()
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    setBusy(true)
    try {
      await onChange({ watchedFolder: null })
    } catch {
      onError()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-medium">{t('watchedFolder.title')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('watchedFolder.hint')}
        </p>
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">
            {t('watchedFolder.current')}
          </dt>
          <dd className="mt-1 break-all font-medium">
            {watchedFolder ?? t('watchedFolder.none')}
          </dd>
        </div>
        {status && (
          <div>
            <dt className="text-muted-foreground">
              {t('watchedFolder.status')}
            </dt>
            <dd className="mt-1 font-medium" role="status">
              {t(`watchedFolder.status.${status}`)}
            </dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled || busy} onClick={() => void choose()}>
          {t('watchedFolder.choose')}
        </Button>
        {watchedFolder && (
          <Button
            variant="ghost"
            disabled={disabled || busy}
            onClick={() => void clear()}
          >
            {t('watchedFolder.clear')}
          </Button>
        )}
      </div>
    </section>
  )
}
