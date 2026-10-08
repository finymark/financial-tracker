import { expect, test } from 'vitest'

import { blocksPackagedShortcut, zoomCommand } from './window-shortcuts'

function input(
  key: string,
  overrides: Partial<Parameters<typeof zoomCommand>[0]> = {},
): Parameters<typeof zoomCommand>[0] {
  return {
    type: 'keyDown',
    key,
    control: true,
    alt: false,
    meta: false,
    ...overrides,
  }
}

test.each([
  ['=', 'in'],
  ['+', 'in'],
  ['-', 'out'],
  ['0', 'reset'],
] as const)('maps Ctrl+%s to zoom %s', (key, command) => {
  expect(zoomCommand(input(key))).toBe(command)
})

test.each([
  input('r'),
  input('i', { shift: true }),
  input('=', { control: false }),
  input('=', { alt: true }),
  input('=', { meta: true }),
  input('=', { type: 'keyUp' }),
] as const)('does not handle unrelated input: %j', (value) => {
  expect(zoomCommand(value)).toBeNull()
})

test.each([
  input('r'),
  input('R', { shift: true }),
  input('i', { shift: true }),
  input('F12', { control: false }),
] as const)('blocks packaged reload or developer shortcut: %j', (value) => {
  expect(blocksPackagedShortcut(value)).toBe(true)
})

test.each([
  input('r', { alt: true }),
  input('i'),
  input('F11', { control: false }),
  input('F12', { control: false, type: 'keyUp' }),
] as const)('allows unrelated packaged input: %j', (value) => {
  expect(blocksPackagedShortcut(value)).toBe(false)
})
