import { useEffect, useState, type FormEvent } from 'react'
import type { Payee, PayeeAlias } from '../../../shared/payees'
import type { MessageKey } from '../i18n'
import { Button } from './ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Input } from './ui/input'
import { NativeSelect } from './ui/native-select'

const errorKeys = [
  'payees.error.notFound',
  'payees.error.aliasNotFound',
  'payees.error.aliasName',
  'payees.error.aliasConflict',
  'payees.error.samePayee',
] as const satisfies readonly MessageKey[]

interface PayeeSettingsProps {
  disabled: boolean
  t(key: MessageKey): string
  onBusyChange(busy: boolean): void
  onChanged(): void
}

export function PayeeSettings({
  disabled,
  t,
  onBusyChange,
  onChanged,
}: PayeeSettingsProps) {
  const [payees, setPayees] = useState<Payee[]>([])
  const [aliases, setAliases] = useState<Record<string, PayeeAlias[]>>({})
  const [aliasNames, setAliasNames] = useState<Record<string, string>>({})
  const [survivors, setSurvivors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const locked = disabled || busy || loading

  async function load() {
    const nextPayees = await window.app.payees.list()
    const nextAliases = await Promise.all(
      nextPayees.map(
        async (payee) =>
          [
            payee.id,
            await window.app.payees.listAliases({ payeeId: payee.id }),
          ] as const,
      ),
    )
    setPayees(nextPayees)
    setAliases(Object.fromEntries(nextAliases))
  }

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        const nextPayees = await window.app.payees.list()
        const nextAliases = await Promise.all(
          nextPayees.map(
            async (payee) =>
              [
                payee.id,
                await window.app.payees.listAliases({ payeeId: payee.id }),
              ] as const,
          ),
        )
        if (!ignore) {
          setPayees(nextPayees)
          setAliases(Object.fromEntries(nextAliases))
        }
      } catch {
        if (!ignore) setError('payees.error')
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    onBusyChange(true)
    setError(null)
    try {
      await action()
      await load()
      onChanged()
    } catch (caught) {
      setError(
        errorKeys.find((key) => String(caught).includes(key)) ?? 'payees.error',
      )
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  function submitAlias(event: FormEvent, payeeId: string) {
    event.preventDefault()
    const name = aliasNames[payeeId] ?? ''
    void run(async () => {
      await window.app.payees.addAlias({ payeeId, name })
      setAliasNames((current) => ({ ...current, [payeeId]: '' }))
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('payees.title')}</CardTitle>
        <CardDescription>{t('payees.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-error">{t(error)}</p>
            <Button
              variant="ghost"
              disabled={locked}
              onClick={() => void run(async () => {})}
            >
              {t('payees.refresh')}
            </Button>
          </div>
        )}
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('payees.loading')}
          </p>
        ) : payees.length === 0 ? (
          <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            {t('payees.empty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {payees.map((payee) => (
              <li key={payee.id} className="space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold">{payee.name}</h3>
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('payees.aliases')}</p>
                  {(aliases[payee.id] ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('payees.noAliases')}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {(aliases[payee.id] ?? []).map((alias) => (
                        <li
                          key={alias.id}
                          className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm"
                        >
                          <span className="break-words">{alias.name}</span>
                          <Button
                            variant="ghost"
                            disabled={locked}
                            onClick={() =>
                              void run(() =>
                                window.app.payees.removeAlias({ id: alias.id }),
                              )
                            }
                          >
                            {t('payees.removeAlias')}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(event) => submitAlias(event, payee.id)}
                  >
                    <label
                      htmlFor={`payee-alias-${payee.id}`}
                      className="sr-only"
                    >
                      {t('payees.aliasName')}
                    </label>
                    <Input
                      id={`payee-alias-${payee.id}`}
                      value={aliasNames[payee.id] ?? ''}
                      maxLength={100}
                      required
                      disabled={locked}
                      placeholder={t('payees.aliasName')}
                      onChange={(event) =>
                        setAliasNames((current) => ({
                          ...current,
                          [payee.id]: event.target.value,
                        }))
                      }
                    />
                    <Button
                      type="submit"
                      disabled={locked || !(aliasNames[payee.id] ?? '').trim()}
                    >
                      {t('payees.addAlias')}
                    </Button>
                  </form>
                </div>
                {payees.length > 1 && (
                  <div className="space-y-2 border-t pt-4">
                    <label
                      htmlFor={`payee-survivor-${payee.id}`}
                      className="text-sm font-medium"
                    >
                      {t('payees.mergeInto')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <NativeSelect
                        id={`payee-survivor-${payee.id}`}
                        value={survivors[payee.id] ?? ''}
                        disabled={locked}
                        onChange={(event) =>
                          setSurvivors((current) => ({
                            ...current,
                            [payee.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">{t('payees.chooseSurvivor')}</option>
                        {payees
                          .filter((candidate) => candidate.id !== payee.id)
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </option>
                          ))}
                      </NativeSelect>
                      <Button
                        disabled={locked || !survivors[payee.id]}
                        onClick={() =>
                          void run(() =>
                            window.app.payees.merge({
                              sourcePayeeId: payee.id,
                              survivorPayeeId: survivors[payee.id],
                            }),
                          )
                        }
                      >
                        {t('payees.merge')}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('payees.mergeHint')}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
