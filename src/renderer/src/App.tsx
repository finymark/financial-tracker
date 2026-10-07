import { useEffect, useState } from 'react'
import {
  ArrowLeftRight,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UsersRound,
  Wallet,
} from 'lucide-react'
import { Button } from './components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card'
import { NativeSelect } from './components/ui/native-select'
import { createFormatters, languages, translate, type Language } from './i18n'
import { themeModes, useTheme, type ThemeMode } from './lib/theme'
import { cn } from './lib/utils'

const pages = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'transactions', icon: ArrowLeftRight },
  { id: 'accounts', icon: Wallet },
  { id: 'settings', icon: Settings },
] as const
type Page = (typeof pages)[number]['id']

export default function App() {
  const [page, setPage] = useState<Page>('overview')
  const [collapsed, setCollapsed] = useState(false)
  const [language, setLanguage] = useState<Language>('en')
  const [theme, setTheme] = useState<ThemeMode>('system')
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key)
  const format = createFormatters(language)
  useTheme(theme)

  useEffect(() => {
    document.documentElement.lang = language
    document.title = translate(language, 'app.name')
  }, [language])

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
        <div className="mt-auto border-t pt-4" title={t('sidebar.profileHint')}>
          <div
            className={cn(
              'flex items-center gap-3 text-muted-foreground',
              collapsed && 'justify-center',
            )}
          >
            <UsersRound className="size-5 shrink-0" aria-hidden="true" />
            <span className={cn('text-sm font-medium', collapsed && 'sr-only')}>
              {t('sidebar.profile')}
            </span>
          </div>
          {!collapsed && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t('sidebar.profileHint')}
            </p>
          )}
        </div>
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
                      onChange={(event) => {
                        const value = languages.find(
                          (item) => item === event.target.value,
                        )
                        if (value) setLanguage(value)
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
                      onChange={(event) => {
                        const value = themeModes.find(
                          (item) => item === event.target.value,
                        )
                        if (value) setTheme(value)
                      }}
                    >
                      {themeModes.map((value) => (
                        <option key={value} value={value}>
                          {t(`theme.${value}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
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
