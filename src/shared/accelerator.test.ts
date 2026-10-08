import { describe, expect, test } from 'vitest'
import {
  DEFAULT_QUICK_ADD_ACCELERATOR,
  displayAccelerator,
  normaliseAccelerator,
} from './accelerator'

describe('global shortcut accelerators', () => {
  test.each([
    ['Ctrl+Alt+n', 'Control+Alt+N'],
    ['alt + control + N', 'Control+Alt+N'],
    ['Shift+Control+F12', 'Control+Shift+F12'],
  ])('normalises %s', (input, expected) => {
    expect(normaliseAccelerator(input)).toBe(expected)
  })

  test.each([
    '',
    'N',
    'Control',
    'Control+Alt',
    'Control+N+M',
    'Control+Control+N',
    'Control+Escape',
    'CommandOrControl+N',
  ])('rejects invalid accelerator %j', (input) => {
    expect(() => normaliseAccelerator(input)).toThrow('Invalid accelerator')
  })

  test('uses the ticket default', () => {
    expect(DEFAULT_QUICK_ADD_ACCELERATOR).toBe('Control+Alt+N')
    expect(displayAccelerator(DEFAULT_QUICK_ADD_ACCELERATOR)).toBe('Ctrl+Alt+N')
  })
})
