import { expect, test } from 'vitest'
import { matchShortcut, type ShortcutKeyEvent } from './shortcuts'

function key(
  key: string,
  changes: Partial<ShortcutKeyEvent> = {},
): ShortcutKeyEvent {
  return {
    key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    ...changes,
  }
}

test('starts a new transaction with N or Ctrl+N outside text editing controls', () => {
  expect(matchShortcut(key('n'), { scope: 'app' })).toBe('newTransaction')
  expect(matchShortcut(key('N'), { scope: 'app' })).toBe('newTransaction')
  expect(matchShortcut(key('n', { ctrlKey: true }), { scope: 'app' })).toBe(
    'newTransaction',
  )
  expect(
    matchShortcut(key('n'), { scope: 'app', editingText: true }),
  ).toBeNull()
  expect(
    matchShortcut(key('n', { ctrlKey: true }), {
      scope: 'app',
      editingText: true,
    }),
  ).toBeNull()
})

test('switches expense, income and transfer in the drawer, including while typing', () => {
  expect(
    matchShortcut(key('1', { altKey: true }), {
      scope: 'drawer',
      editingText: true,
    }),
  ).toBe('expense')
  expect(matchShortcut(key('2', { altKey: true }), { scope: 'drawer' })).toBe(
    'income',
  )
  expect(matchShortcut(key('3', { altKey: true }), { scope: 'drawer' })).toBe(
    'transfer',
  )
  expect(matchShortcut(key('1', { altKey: true }), { scope: 'app' })).toBeNull()
  expect(matchShortcut(key('1'), { scope: 'drawer' })).toBeNull()
})

test('Enter saves except in a multiline note or when activating a button; Ctrl+Enter saves and adds another everywhere in the drawer', () => {
  expect(
    matchShortcut(key('Enter'), { scope: 'drawer', editingText: true }),
  ).toBe('save')
  expect(
    matchShortcut(key('Enter'), { scope: 'drawer', multiline: true }),
  ).toBeNull()
  expect(
    matchShortcut(key('Enter'), { scope: 'drawer', activatingControl: true }),
  ).toBeNull()
  expect(
    matchShortcut(key('Enter', { ctrlKey: true }), {
      scope: 'drawer',
      multiline: true,
    }),
  ).toBe('saveAndAddAnother')
  expect(matchShortcut(key('Enter'), { scope: 'app' })).toBeNull()
  expect(
    matchShortcut(key('Enter', { ctrlKey: true }), { scope: 'help' }),
  ).toBeNull()
})

test('Esc closes the drawer or help, and question mark opens translated help outside typing', () => {
  expect(
    matchShortcut(key('Escape'), { scope: 'drawer', editingText: true }),
  ).toBe('close')
  expect(matchShortcut(key('Escape'), { scope: 'help' })).toBe('close')
  expect(matchShortcut(key('Escape'), { scope: 'app' })).toBeNull()
  expect(matchShortcut(key('?', { shiftKey: true }), { scope: 'app' })).toBe(
    'help',
  )
  expect(matchShortcut(key('?'), { scope: 'app' })).toBe('help')
  expect(
    matchShortcut(key('?'), { scope: 'app', editingText: true }),
  ).toBeNull()
})

test('a focused help hint owns Esc but keeps the global question-mark shortcut', () => {
  expect(
    matchShortcut(key('Escape'), { scope: 'drawer', helpHint: true }),
  ).toBeNull()
  expect(
    matchShortcut(key('?'), {
      scope: 'app',
      activatingControl: true,
      helpHint: true,
    }),
  ).toBe('help')
})

test('Ctrl+Z retains app undo outside text controls and never intercepts text undo', () => {
  expect(matchShortcut(key('z', { ctrlKey: true }), { scope: 'app' })).toBe(
    'undo',
  )
  expect(
    matchShortcut(key('z', { ctrlKey: true }), {
      scope: 'app',
      editingText: true,
    }),
  ).toBeNull()
})

test.each([
  { repeat: true },
  { isComposing: true },
  { defaultPrevented: true },
  { altKey: true },
  { metaKey: true },
  { shiftKey: true },
  { ctrlKey: true, altKey: true },
])(
  'ignores held keys, composition, handled events and unexpected modifiers: %j',
  (changes) => {
    expect(matchShortcut(key('n', changes), { scope: 'app' })).toBeNull()
    expect(matchShortcut(key('Enter', changes), { scope: 'drawer' })).toBeNull()
  },
)

test('Ctrl+Shift+H toggles privacy globally, including typing, without taking editing keys', () => {
  for (const scope of ['app', 'drawer', 'help'] as const) {
    expect(
      matchShortcut(key('H', { ctrlKey: true, shiftKey: true }), {
        scope,
        editingText: true,
        multiline: true,
      }),
    ).toBe('privacy')
    for (const modifiers of [
      {},
      { ctrlKey: true },
      { shiftKey: true },
      { ctrlKey: true, shiftKey: true, altKey: true },
      { ctrlKey: true, shiftKey: true, metaKey: true },
      { ctrlKey: true, shiftKey: true, repeat: true },
      { ctrlKey: true, shiftKey: true, isComposing: true },
      { ctrlKey: true, shiftKey: true, defaultPrevented: true },
    ]) {
      expect(
        matchShortcut(key('h', modifiers), { scope, editingText: true }),
      ).toBeNull()
    }
  }
})
