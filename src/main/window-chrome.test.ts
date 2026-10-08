import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

import { parseResolvedTheme } from './window-chrome'
import { TITLE_BAR_COLORS, TITLE_BAR_HEIGHT } from '../shared/window-chrome'

test.each(['light', 'dark'] as const)(
  'accepts the resolved title bar theme %s',
  (theme) => {
    expect(parseResolvedTheme(theme)).toBe(theme)
  },
)

test.each([
  undefined,
  null,
  'system',
  'LIGHT',
  true,
  1,
  {},
  { theme: 'dark' },
] as const)('rejects malformed title bar theme IPC input: %j', (value) => {
  expect(() => parseResolvedTheme(value)).toThrow('title bar theme')
})

test('renderer title bar tokens stay aligned with native overlay colors', () => {
  const css = readFileSync(
    new URL('../renderer/src/tokens.css', import.meta.url),
    'utf8',
  )
  expect(css).toContain(`--title-bar: ${TITLE_BAR_COLORS.light.color};`)
  expect(css).toContain(
    `--title-bar-foreground: ${TITLE_BAR_COLORS.light.symbolColor};`,
  )
  expect(css).toContain(`--title-bar: ${TITLE_BAR_COLORS.dark.color};`)
  expect(css).toContain(
    `--title-bar-foreground: ${TITLE_BAR_COLORS.dark.symbolColor};`,
  )
  expect(css).toContain(`--title-bar-height: ${TITLE_BAR_HEIGHT}px;`)
})
