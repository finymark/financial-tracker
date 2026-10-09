import { useEffect, useRef, useState, type RefObject } from 'react'
import type { PhoneUploadSessionInfo } from '../../../shared/phone-upload'
import type { MessageKey } from '../i18n'
import { useDialogFocus } from '../lib/use-dialog-focus'
import { Button } from './ui/button'
import { NativeSelect } from './ui/native-select'
import { HelpHint } from './ui/help-hint'

interface Props {
  t(key: MessageKey): string
  triggerRef?: RefObject<HTMLElement | null>
  onClose(): void
}

function countdown(expiresAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function PhoneUploadDialog({ t, triggerRef, onClose }: Props) {
  const [dialogId] = useState(() => crypto.randomUUID())
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useDialogFocus(true, dialogRef, closeRef, triggerRef)
  const [session, setSession] = useState<PhoneUploadSessionInfo | null>(null)
  const [noPrivateNetwork, setNoPrivateNetwork] = useState(false)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    const unsubscribe = window.app.phoneUpload.onReceived((received) => {
      if (!active || received.dialogId !== dialogId) return
      setSession((value) =>
        value ? { ...value, uploadedCount: received.uploadedCount } : value,
      )
    })
    void window.app.phoneUpload
      .start({ dialogId })
      .then((result) => {
        if (!active) return
        if (result.available) setSession(result)
        else setNoPrivateNetwork(true)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => {
      active = false
      unsubscribe()
      void window.app.phoneUpload.stop({ dialogId })
    }
  }, [dialogId])

  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [session])

  async function selectAddress(address: string) {
    if (!session || busy || now >= session.expiresAt) return
    setBusy(true)
    setError(false)
    try {
      const result = await window.app.phoneUpload.start({ dialogId, address })
      if (result.available) setSession(result)
      else {
        setSession(null)
        setNoPrivateNetwork(true)
      }
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  function close() {
    void window.app.phoneUpload.stop({ dialogId })
    onClose()
  }

  const expired = Boolean(session && now >= session.expiresAt)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/20 p-6">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-upload-title"
        tabIndex={-1}
        className="w-full max-w-xl space-y-4 rounded-lg border bg-background p-6 shadow-xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
          }
        }}
      >
        <div className="flex items-center gap-1">
          <h2 id="phone-upload-title" className="text-xl font-semibold">
            {t('phoneUpload.title')}
          </h2>
          <HelpHint
            t={t}
            topicKey="phoneUpload.title"
            textKey="help.receipts.phoneUpload"
          />
        </div>
        {busy && !session && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('phoneUpload.starting')}
          </p>
        )}
        {noPrivateNetwork && (
          <p role="alert" className="text-sm text-error">
            {t('phoneUpload.noPrivateNetwork')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-error">
            {t('phoneUpload.error')}
          </p>
        )}
        {session && (
          <>
            {session.interfaces.length > 1 && (
              <label className="block space-y-1 text-sm font-medium">
                {t('phoneUpload.interface')}
                <NativeSelect
                  value={session.selectedAddress}
                  disabled={busy || expired}
                  onChange={(event) => void selectAddress(event.target.value)}
                >
                  {session.interfaces.map((networkInterface) => (
                    <option
                      key={networkInterface.address}
                      value={networkInterface.address}
                    >
                      {networkInterface.interfaceName} —{' '}
                      {networkInterface.address}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            )}
            <div className="flex justify-center">
              <img
                src={session.qrDataUrl}
                alt={t('phoneUpload.qrAlt')}
                className="size-64 max-w-full rounded border bg-white"
              />
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{t('phoneUpload.address')}</p>
              <code className="block select-all break-all rounded bg-muted p-2">
                {session.url}
              </code>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <p role="timer">
                {expired
                  ? t('phoneUpload.expired')
                  : t('phoneUpload.expiresIn').replace(
                      '{time}',
                      countdown(session.expiresAt, now),
                    )}
              </p>
              <p>
                {t('phoneUpload.uploaded').replace(
                  '{count}',
                  String(session.uploadedCount),
                )}
              </p>
            </div>
          </>
        )}
        <aside className="space-y-1 rounded border p-3 text-sm">
          <h3 className="font-semibold">{t('phoneUpload.firewallTitle')}</h3>
          <p>{t('phoneUpload.firewallGuidance')}</p>
        </aside>
        <div className="flex justify-end">
          <Button ref={closeRef} variant="ghost" onClick={close}>
            {t('phoneUpload.close')}
          </Button>
        </div>
      </section>
    </div>
  )
}
