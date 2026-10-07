import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeftRight,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react'
import type {
  ActiveProfileInfo,
  ProfileRegistrySnapshot,
} from '../../shared/profiles'
import { Button } from './components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'
import { createFormatters, languages, translate, type MessageKey } from './i18n'
import { themeModes, useTheme } from './lib/theme'
import {
  baseCurrencies,
  DEFAULT_PROFILE_SETTINGS,
  type ProfileSettingsChanges,
} from '../../shared/settings'
import { cn } from './lib/utils'

const pages = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'transactions', icon: ArrowLeftRight },
  { id: 'accounts', icon: Wallet },
  { id: 'settings', icon: Settings },
] as const
type Page = (typeof pages)[number]['id']
type Translate = (key: MessageKey) => string

const emptySnapshot: ProfileRegistrySnapshot = {
  profiles: [],
  lastUsedProfileId: null,
}

interface ProfilePickerProps {
  snapshot: ProfileRegistrySnapshot
  active: ActiveProfileInfo | null
  t: Translate
  onSnapshotChange(snapshot: ProfileRegistrySnapshot): void
  onActiveChange(profile: ActiveProfileInfo | null): void
  onOpen(profile: ActiveProfileInfo): void
  onCancel(): void
}

function ProfilePicker({
  snapshot,
  active,
  t,
  onSnapshotChange,
  onActiveChange,
  onOpen,
  onCancel,
}: ProfilePickerProps) {
  const initialId =
    snapshot.lastUsedProfileId ?? snapshot.profiles[0]?.id ?? null
  const [selectedId, setSelectedId] = useState<string | null>(initialId)
  const [newName, setNewName] = useState('')
  const [renameName, setRenameName] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [mode, setMode] = useState<'none' | 'rename' | 'delete'>('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const selected = snapshot.profiles.find((item) => item.id === selectedId)

  async function refresh(preferredId?: string) {
    const [next, current] = await Promise.all([
      window.app.profiles.list(),
      window.app.profiles.getActive(),
    ])
    onSnapshotChange(next)
    onActiveChange(current)
    setSelectedId(
      preferredId ?? next.lastUsedProfileId ?? next.profiles[0]?.id ?? null,
    )
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(false)
    try {
      await action()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  function submitCreate(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      const created = await window.app.profiles.create({ name: newName })
      const opened = await window.app.profiles.open({ id: created.id })
      await refresh(created.id)
      onOpen(opened)
    })
  }

  function submitRename(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    void run(async () => {
      await window.app.profiles.rename({ id: selected.id, name: renameName })
      await refresh(selected.id)
      setMode('none')
      setRenameName('')
    })
  }

  function submitDelete(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    void run(async () => {
      await window.app.profiles.delete({
        id: selected.id,
        confirmation,
      })
      await refresh()
      setMode('none')
      setConfirmation('')
    })
  }

  function openSelected() {
    if (!selected) return
    void run(async () => {
      const opened = await window.app.profiles.open({ id: selected.id })
      await refresh(selected.id)
      onOpen(opened)
    })
  }

  return (
    <main className="min-h-dvh bg-muted p-6 sm:p-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="text-center">
          <UsersRound
            className="mx-auto mb-3 size-9 text-primary"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-semibold">{t('profilePicker.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('profilePicker.description')}
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{t('profilePicker.choose')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.profiles.length === 0 ? (
              <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                {t('profilePicker.empty')}
              </p>
            ) : (
              <div
                className="grid gap-2"
                role="radiogroup"
                aria-label={t('profilePicker.choose')}
              >
                {snapshot.profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedId === profile.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      selectedId === profile.id && 'border-primary bg-accent',
                    )}
                    onClick={() => {
                      setSelectedId(profile.id)
                      setMode('none')
                    }}
                  >
                    <UserRound
                      className="size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="font-medium">{profile.name}</span>
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm font-medium text-error">
                {t('profile.error')}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button disabled={!selected || busy} onClick={openSelected}>
                {t('profile.open')}
              </Button>
              <Button
                variant="ghost"
                disabled={!selected || busy}
                onClick={() => {
                  setRenameName(selected?.name ?? '')
                  setMode('rename')
                }}
              >
                {t('profile.rename')}
              </Button>
              <Button
                variant="ghost"
                disabled={!selected || busy}
                onClick={() => setMode('delete')}
              >
                {t('profile.delete')}
              </Button>
              {active && (
                <Button variant="ghost" disabled={busy} onClick={onCancel}>
                  {t('profile.cancel')}
                </Button>
              )}
            </div>

            {mode === 'rename' && selected && (
              <form
                className="space-y-3 rounded-lg border p-4"
                onSubmit={submitRename}
              >
                <label htmlFor="rename-profile" className="text-sm font-medium">
                  {t('profile.renameLabel')}
                </label>
                <Input
                  id="rename-profile"
                  value={renameName}
                  maxLength={100}
                  required
                  autoFocus
                  onChange={(event) => setRenameName(event.target.value)}
                />
                <Button type="submit" disabled={busy}>
                  {t('profile.save')}
                </Button>
              </form>
            )}

            {mode === 'delete' && selected && (
              <form
                className="space-y-3 rounded-lg border p-4"
                onSubmit={submitDelete}
              >
                <p className="text-sm text-muted-foreground">
                  {t('profile.deleteDescription')}
                </p>
                <label htmlFor="delete-profile" className="text-sm font-medium">
                  {t('profile.typeName')} <strong>{selected.name}</strong>
                </label>
                <Input
                  id="delete-profile"
                  value={confirmation}
                  autoComplete="off"
                  required
                  autoFocus
                  onChange={(event) => setConfirmation(event.target.value)}
                />
                <Button
                  type="submit"
                  disabled={busy || confirmation !== selected.name}
                >
                  {t('profile.confirmDelete')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.create')}</CardTitle>
            <CardDescription>{t('profile.createDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex gap-2" onSubmit={submitCreate}>
              <label htmlFor="new-profile" className="sr-only">
                {t('profile.name')}
              </label>
              <Input
                id="new-profile"
                value={newName}
                placeholder={t('profile.name')}
                maxLength={100}
                required
                onChange={(event) => setNewName(event.target.value)}
              />
              <Button
                type="submit"
                disabled={busy || newName.trim().length === 0}
              >
                {t('profile.create')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

interface ShellProps {
  active: ActiveProfileInfo
  t: Translate
  onSettingsChange(changes: ProfileSettingsChanges): Promise<void>
  onSwitchProfile(): void
}

function Shell({ active, t, onSettingsChange, onSwitchProfile }: ShellProps) {
  const [page, setPage] = useState<Page>('overview')
  const [collapsed, setCollapsed] = useState(false)
  const { language, theme, baseCurrency } = active.settings
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState(false)
  const format = createFormatters(language)

  async function saveSettings(changes: ProfileSettingsChanges) {
    setSavingSettings(true)
    setSettingsError(false)
    try {
      await onSettingsChange(changes)
    } catch {
      setSettingsError(true)
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r bg-sidebar p-4',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        <div
          className={cn(
            'mb-8 flex items-center gap-2',
            collapsed && 'justify-center',
          )}
        >
          {!collapsed && (
            <span className="flex-1 font-semibold">{t('app.name')}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t(collapsed ? 'sidebar.expand' : 'sidebar.collapse')}
            title={t(collapsed ? 'sidebar.expand' : 'sidebar.collapse')}
            aria-expanded={!collapsed}
            aria-controls="sidebar-navigation"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </Button>
        </div>
        <nav
          id="sidebar-navigation"
          aria-label={t('navigation.label')}
          className="space-y-2"
        >
          {pages.map(({ id, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              size={collapsed ? 'icon' : 'default'}
              className={cn(
                'w-full',
                !collapsed && 'justify-start',
                page === id && 'bg-accent text-accent-foreground',
              )}
              aria-label={t(`navigation.${id}`)}
              aria-current={page === id ? 'page' : undefined}
              title={collapsed ? t(`navigation.${id}`) : undefined}
              onClick={() => setPage(id)}
            >
              <Icon aria-hidden="true" />
              {!collapsed && t(`navigation.${id}`)}
            </Button>
          ))}
        </nav>
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          className={cn(
            'mt-auto border-t pt-4',
            !collapsed && 'h-auto justify-start',
          )}
          aria-label={t('profile.switch')}
          title={
            collapsed ? `${active.name} — ${t('profile.switch')}` : undefined
          }
          onClick={onSwitchProfile}
        >
          <UsersRound className="size-5 shrink-0" aria-hidden="true" />
          {!collapsed && (
            <span className="min-w-0 text-left">
              <span className="block truncate font-medium">{active.name}</span>
              <span className="block text-xs text-muted-foreground">
                {t('profile.switch')}
              </span>
            </span>
          )}
        </Button>
      </aside>

      <main
        className="min-w-0 flex-1 overflow-y-auto p-6 sm:p-8"
        aria-labelledby="page-title"
      >
        <div className="mx-auto max-w-4xl space-y-8">
          <header>
            <p className="mb-2 text-sm text-muted-foreground">
              {t('app.tagline')}
            </p>
            <h1
              id="page-title"
              className="text-2xl font-semibold tracking-tight"
            >
              {t(`navigation.${page}`)}
            </h1>
          </header>
          <Card>
            <CardHeader>
              <CardTitle>{t(`${page}.title`)}</CardTitle>
              <CardDescription>{t(`${page}.description`)}</CardDescription>
            </CardHeader>
            {page === 'settings' && (
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="language" className="text-sm font-medium">
                      {t('settings.language')}
                    </label>
                    <NativeSelect
                      id="language"
                      value={language}
                      disabled={savingSettings}
                      onChange={(event) => {
                        const value = languages.find(
                          (item) => item === event.target.value,
                        )
                        if (value) void saveSettings({ language: value })
                      }}
                    >
                      {languages.map((value) => (
                        <option key={value} value={value}>
                          {t(`language.${value}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="theme" className="text-sm font-medium">
                      {t('settings.theme')}
                    </label>
                    <NativeSelect
                      id="theme"
                      value={theme}
                      disabled={savingSettings}
                      onChange={(event) => {
                        const value = themeModes.find(
                          (item) => item === event.target.value,
                        )
                        if (value) void saveSettings({ theme: value })
                      }}
                    >
                      {themeModes.map((value) => (
                        <option key={value} value={value}>
                          {t(`theme.${value}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="base-currency"
                      className="text-sm font-medium"
                    >
                      {t('settings.baseCurrency')}
                    </label>
                    <NativeSelect
                      id="base-currency"
                      value={baseCurrency}
                      disabled={savingSettings}
                      onChange={(event) => {
                        const value = baseCurrencies.find(
                          (item) => item === event.target.value,
                        )
                        if (value) void saveSettings({ baseCurrency: value })
                      }}
                    >
                      {baseCurrencies.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
                {settingsError && (
                  <p role="alert" className="text-sm font-medium text-error">
                    {t('settings.error')}
                  </p>
                )}
                <section
                  className="rounded-lg bg-muted p-4"
                  aria-labelledby="formatting-preview"
                >
                  <h3
                    id="formatting-preview"
                    className="mb-3 text-sm font-medium"
                  >
                    {t('settings.preview')}
                  </h3>
                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">
                        {t('settings.date')}
                      </dt>
                      <dd className="mt-1 font-medium">
                        {format.date(new Date(2026, 0, 15))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        {t('settings.number')}
                      </dt>
                      <dd className="mt-1 font-medium tabular-nums">
                        {format.number(12345.67)}
                      </dd>
                    </div>
                  </dl>
                </section>
              </CardContent>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [snapshot, setSnapshot] = useState(emptySnapshot)
  const [active, setActive] = useState<ActiveProfileInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(true)
  const { language, theme } = active?.settings ?? DEFAULT_PROFILE_SETTINGS
  const t: Translate = (key) => translate(language, key)
  useTheme(theme)

  useEffect(() => {
    document.documentElement.lang = language
    document.title = translate(language, 'app.name')
  }, [language])

  useEffect(() => {
    void Promise.all([
      window.app.profiles.list(),
      window.app.profiles.getActive(),
    ])
      .then(([registry, current]) => {
        setSnapshot(registry)
        setActive(current)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        {t('profile.loading')}
      </main>
    )
  }
  if (showPicker || !active) {
    return (
      <ProfilePicker
        snapshot={snapshot}
        active={active}
        t={t}
        onSnapshotChange={setSnapshot}
        onActiveChange={setActive}
        onOpen={(profile) => {
          setActive(profile)
          setShowPicker(false)
        }}
        onCancel={() => setShowPicker(false)}
      />
    )
  }
  return (
    <Shell
      key={active.id}
      active={active}
      t={t}
      onSettingsChange={async (settings) => {
        const saved = await window.app.profiles.updateSettings({
          id: active.id,
          settings,
        })
        setActive((current) =>
          current?.id === active.id ? { ...current, settings: saved } : current,
        )
      }}
      onSwitchProfile={() => setShowPicker(true)}
    />
  )
}
