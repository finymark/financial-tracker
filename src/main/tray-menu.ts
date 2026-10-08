import type { MenuItemConstructorOptions } from 'electron'
import { desktopMessages } from '../shared/desktop-translations'
import type { Language } from '../shared/settings'

export function trayLanguage(
  profileLanguage: Language | undefined,
  osLocale: string,
): Language {
  if (profileLanguage) return profileLanguage
  const language = osLocale.toLowerCase().split(/[-_]/)[0]
  return language === 'hu' || language === 'de' ? language : 'en'
}

export function buildTrayMenu(
  language: Language,
  actions: { open(): void; quickAdd(): void; quit(): void },
): MenuItemConstructorOptions[] {
  const messages = desktopMessages[language]
  return [
    { label: messages['tray.open'], click: actions.open },
    { label: messages['tray.quickAdd'], click: actions.quickAdd },
    { type: 'separator' },
    { label: messages['tray.quit'], click: actions.quit },
  ]
}
