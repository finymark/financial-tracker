import { useAmountFormatters } from './lib/privacy'
import { useEffect, useState, type FormEvent } from 'react'
import { currencies, type Account, type Currency } from '../../shared/accounts'
import { Button } from './components/ui/button'
import { CardContent } from './components/ui/card'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import { type Language, type MessageKey } from './i18n'
import { parseAmountExpression } from '../../shared/amount-expression'
import { AmountInput } from './components/amount-input'

const errorKeys = [
  'accounts.error.name',
  'accounts.error.currency',
  'accounts.error.balance',
  'accounts.error.date',
  'accounts.error.notFound',
  'accounts.error.currencyLocked',
  'accounts.error.notEmpty',
] as const satisfies readonly MessageKey[]

interface AccountsPageProps {
  language: Language
  t(key: MessageKey): string
  onBusyChange(busy: boolean): void
  onChanged(): void
}

type Editing = { id: string; kind: 'rename' | 'currency' | 'delete' } | null

export function AccountsPage({
  language,
  t,
  onChanged,
  onBusyChange,
}: AccountsPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>('HUF')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [openingDate, setOpeningDate] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [newName, setNewName] = useState('')
  const [newCurrency, setNewCurrency] = useState<Currency>('HUF')
  const format = useAmountFormatters(language)

  useEffect(() => {
    let ignore = false
    void window.app.accounts
      .list()
      .then((next) => {
        if (!ignore) setAccounts(next)
      })
      .catch(() => {
        if (!ignore) setError('accounts.error')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  async function run(action: () => Promise<unknown>, offerUndo = true) {
    setBusy(true)
    onBusyChange(true)
    setError(null)
    try {
      await action()
      setAccounts(await window.app.accounts.list())
      setEditing(null)
      if (offerUndo) onChanged()
    } catch (error) {
      setError(
        errorKeys.find((key) => String(error).includes(key)) ??
          'accounts.error',
      )
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  function submitCreate(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      await window.app.accounts.create({
        name,
        currency,
        openingBalance: parseAmountExpression(
          openingBalance,
          currency,
          'accounts.error.balance',
          {
            allowNegative: true,
            allowZero: true,
          },
        ),
        openingDate,
      })
      setName('')
      setOpeningBalance('0')
      setOpeningDate('')
    })
  }

  return (
    <CardContent className="space-y-6">
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-error">{t(error)}</p>
          <Button
            variant="ghost"
            disabled={busy || loading}
            onClick={() => void run(async () => {}, false)}
          >
            {t('accounts.refresh')}
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('accounts.loading')}
        </p>
      ) : accounts.length === 0 ? (
        <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          {t('accounts.empty')}
        </p>
      ) : (
        <ul className="space-y-3" aria-label={t('navigation.accounts')}>
          {accounts.map((account) => (
            <li key={account.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-medium">{account.name}</h3>
                  {account.archived && (
                    <p className="text-sm text-muted-foreground">
                      {t('accounts.archived')}
                    </p>
                  )}
                </div>
                <dl className="text-right">
                  <dt className="text-xs text-muted-foreground">
                    {t('accounts.balance')}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {format.amount(account.balance, account.currency)}
                  </dd>
                </dl>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('accounts.openingBalance')}:{' '}
                {format.amount(account.openingBalance, account.currency)}
                {' · '}
                {t('accounts.openingDate')}:{' '}
                {format.date(new Date(`${account.openingDate}T00:00:00`))}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setNewName(account.name)
                    setEditing({ id: account.id, kind: 'rename' })
                  }}
                >
                  {t('accounts.rename')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || account.hasTransactions}
                  onClick={() => {
                    setNewCurrency(account.currency)
                    setEditing({ id: account.id, kind: 'currency' })
                  }}
                >
                  {t('accounts.changeCurrency')}
                </Button>
                {!account.archived ? (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        window.app.accounts.archive({ id: account.id }),
                      )
                    }
                  >
                    {t('accounts.archive')}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        window.app.accounts.unarchive({ id: account.id }),
                      )
                    }
                  >
                    {t('accounts.unarchive')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  disabled={busy || account.hasTransactions}
                  onClick={() => setEditing({ id: account.id, kind: 'delete' })}
                >
                  {t('accounts.delete')}
                </Button>
              </div>
              {account.hasTransactions && (
                <p className="text-sm text-muted-foreground">
                  {t('accounts.locked')}
                </p>
              )}
              {editing?.id === account.id && (
                <form
                  className="space-y-3 rounded-lg bg-muted p-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void run(() =>
                      editing.kind === 'rename'
                        ? window.app.accounts.rename({
                            id: account.id,
                            name: newName,
                          })
                        : editing.kind === 'currency'
                          ? window.app.accounts.changeCurrency({
                              id: account.id,
                              currency: newCurrency,
                            })
                          : window.app.accounts.delete({ id: account.id }),
                    )
                  }}
                >
                  {editing.kind === 'rename' ? (
                    <>
                      <label
                        htmlFor={`rename-${account.id}`}
                        className="text-sm font-medium"
                      >
                        {t('accounts.name')}
                      </label>
                      <Input
                        id={`rename-${account.id}`}
                        value={newName}
                        maxLength={100}
                        required
                        autoFocus
                        disabled={busy}
                        onChange={(event) => setNewName(event.target.value)}
                      />
                    </>
                  ) : editing.kind === 'currency' ? (
                    <>
                      <label
                        htmlFor={`currency-${account.id}`}
                        className="text-sm font-medium"
                      >
                        {t('accounts.currency')}
                      </label>
                      <NativeSelect
                        id={`currency-${account.id}`}
                        value={newCurrency}
                        disabled={busy}
                        onChange={(event) => {
                          const selected = currencies.find(
                            (currency) => currency === event.target.value,
                          )
                          if (selected) setNewCurrency(selected)
                        }}
                      >
                        {currencies.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </NativeSelect>
                    </>
                  ) : (
                    <p className="text-sm">
                      {t('accounts.deleteConfirmation')}{' '}
                      <strong>{account.name}</strong>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy}>
                      {t(
                        editing.kind === 'delete'
                          ? 'accounts.confirmDelete'
                          : 'accounts.save',
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setEditing(null)}
                    >
                      {t('accounts.cancel')}
                    </Button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <section
        className="space-y-4 border-t pt-6"
        aria-labelledby="create-account-title"
      >
        <h3 id="create-account-title" className="font-semibold">
          {t('accounts.create')}
        </h3>
        <form className="space-y-4" onSubmit={submitCreate}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="account-name" className="text-sm font-medium">
                {t('accounts.name')}
              </label>
              <Input
                id="account-name"
                value={name}
                maxLength={100}
                required
                disabled={busy || loading}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="account-currency" className="text-sm font-medium">
                {t('accounts.currency')}
              </label>
              <NativeSelect
                id="account-currency"
                value={currency}
                disabled={busy || loading}
                onChange={(event) => {
                  const selected = currencies.find(
                    (currency) => currency === event.target.value,
                  )
                  if (selected) setCurrency(selected)
                }}
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="account-opening-balance"
                className="text-sm font-medium"
              >
                {t('accounts.openingBalance')}
              </label>
              <AmountInput
                id="account-opening-balance"
                value={openingBalance}
                currency={currency}
                language={language}
                t={t}
                errorKey="accounts.error.balance"
                hintKey="accounts.balanceHint"
                allowNegative
                allowZero
                disabled={busy || loading}
                onChange={setOpeningBalance}
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="account-opening-date"
                className="text-sm font-medium"
              >
                {t('accounts.openingDate')}
              </label>
              <Input
                id="account-opening-date"
                type="date"
                value={openingDate}
                required
                disabled={busy || loading}
                onChange={(event) => setOpeningDate(event.target.value)}
              />
            </div>
          </div>
          <Button type="submit" disabled={busy || loading || !name.trim()}>
            {t('accounts.create')}
          </Button>
        </form>
      </section>
    </CardContent>
  )
}
