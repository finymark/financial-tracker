import { useEffect, useState } from 'react'
import type { ProfileBackup, ActiveProfileInfo } from '../../../shared/profiles'
import { createFormatters, type Language, type MessageKey } from '../i18n'
import { Button } from './ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { NativeSelect } from './ui/native-select'

interface BackupSettingsProps {
  language: Language
  disabled: boolean
  t(key: MessageKey): string
  onRestored(profile: ActiveProfileInfo): void
  onBusyChange(busy: boolean): void
}

export function BackupSettings({
  language,
  disabled,
  t,
  onRestored,
  onBusyChange,
}: BackupSettingsProps) {
  const [backups, setBackups] = useState<ProfileBackup[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(false)
  const [restored, setRestored] = useState(false)
  const format = createFormatters(language)

  useEffect(() => {
    let mounted = true
    void window.app.backups
      .list()
      .then((items) => {
        if (!mounted) return
        setBackups(items)
        setSelectedId(items[0]?.id ?? '')
      })
      .catch(() => {
        if (mounted) setError(true)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  async function restore() {
    setBusy(true)
    onBusyChange(true)
    setError(false)
    setRestored(false)
    try {
      const profile = await window.app.backups.restore({
        backupId: selectedId,
        confirmed: true,
      })
      onRestored(profile)
      setConfirming(false)
      setRestored(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('backups.title')}</CardTitle>
        <CardDescription>{t('backups.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t('backups.loading')}
          </p>
        ) : backups.length === 0 && !error ? (
          <p className="text-sm text-muted-foreground">{t('backups.empty')}</p>
        ) : (
          backups.length > 0 && (
            <div className="space-y-2">
              <label htmlFor="backup" className="text-sm font-medium">
                {t('backups.choose')}
              </label>
              <NativeSelect
                id="backup"
                value={selectedId}
                disabled={disabled || busy || confirming}
                onChange={(event) => {
                  setSelectedId(event.target.value)
                  setRestored(false)
                  setError(false)
                }}
              >
                {backups.map((backup) => (
                  <option key={backup.id} value={backup.id}>
                    {format.date(new Date(backup.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    })}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-error">
            {t('backups.error')}
          </p>
        )}
        {restored && (
          <p role="status" className="text-sm">
            {t('backups.restored')}
          </p>
        )}
        {confirming ? (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm">{t('backups.confirmDescription')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={disabled || busy}
                onClick={() => void restore()}
              >
                {t('backups.confirmRestore')}
              </Button>
              <Button
                variant="ghost"
                disabled={disabled || busy}
                onClick={() => setConfirming(false)}
              >
                {t('backups.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            disabled={disabled || loading || !selectedId || busy}
            onClick={() => {
              setConfirming(true)
              setRestored(false)
            }}
          >
            {t('backups.restore')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
