import { expect, test } from 'vitest'

import { titleBarOverlay } from './window-chrome'

test.each([
  ['light', '#f1f6f4', '#263d36'],
  ['dark', '#1b2a27', '#edf4f1'],
] as const)(
  'maps the resolved %s theme to title bar colors',
  (theme, color, symbolColor) => {
    expect(titleBarOverlay(theme)).toEqual({
      color,
      symbolColor,
      height: 36,
    })
  },
)
