import { expect, test, vi } from 'vitest'
import { buildTrayMenu, trayLanguage } from './tray-menu'
import { desktopMessages } from '../shared/desktop-translations'
import { languages } from '../shared/settings'

test.each([
  [undefined, 'hu-HU', 'hu'],
  [undefined, 'DE_de', 'de'],
  [undefined, 'en-US', 'en'],
  [undefined, 'fr-FR', 'en'],
  [undefined, '', 'en'],
  ['hu', 'de-DE', 'hu'],
  ['en', 'hu-HU', 'en'],
  ['de', 'en-US', 'de'],
] as const)('profile %s and locale %s use %s', (profile, locale, expected) => {
  expect(trayLanguage(profile, locale)).toBe(expected)
})

test.each(languages)(
  'builds translated tray actions and tooltip for %s',
  (language) => {
    const actions = { open: vi.fn(), quickAdd: vi.fn(), quit: vi.fn() }
    const menu = buildTrayMenu(language, actions)
    const expected = {
      hu: ['Megnyitás', 'Gyors rögzítés', undefined, 'Kilépés'],
      en: ['Open', 'Quick add', undefined, 'Quit'],
      de: ['Öffnen', 'Schnell erfassen', undefined, 'Beenden'],
    }
    expect(menu.map((item) => item.label)).toEqual(expected[language])
    expect(menu[2]).toEqual({ type: 'separator' })
    expect(menu[0].click).toBe(actions.open)
    expect(menu[1].click).toBe(actions.quickAdd)
    expect(menu[3].click).toBe(actions.quit)
    expect(desktopMessages[language]['tray.tooltip'].trim()).not.toBe('')
  },
)

test('rebuilding the menu follows language changes without changing the actions', () => {
  const actions = { open: vi.fn(), quickAdd: vi.fn(), quit: vi.fn() }
  const before = buildTrayMenu('hu', actions)
  const after = buildTrayMenu('de', actions)
  expect(after[0].label).not.toBe(before[0].label)
  expect(after[0].click).toBe(before[0].click)
})
