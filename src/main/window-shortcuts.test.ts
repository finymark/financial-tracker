import { expect, test } from 'vitest'

import {
  blocksPackagedShortcut,
  developmentWindowCommand,
  nextZoomLevel,
  zoomCommand,
} from './window-shortcuts'

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

test.each([
  [input('r'), 'reload'],
  [input('R', { shift: true }), 'reload'],
  [input('i', { shift: true }), 'toggle-devtools'],
  [input('F12', { control: false }), 'toggle-devtools'],
] as const)('maps development window input %j to %s', (value, command) => {
  expect(developmentWindowCommand(value)).toBe(command)
})

test.each([
  input('i'),
  input('r', { alt: true }),
  input('F12', { control: false, type: 'keyUp' }),
] as const)('ignores unrelated development window input: %j', (value) => {
  expect(developmentWindowCommand(value)).toBeNull()
})

test.each([
  [0, 'in', 0.5],
  [0, 'out', -0.5],
  [2.75, 'in', 3],
  [3, 'in', 3],
  [-2.75, 'out', -3],
  [-3, 'out', -3],
  [2, 'reset', 0],
] as const)(
  'clamps zoom level %s with %s to %s',
  (level, command, expected) => {
    expect(nextZoomLevel(level, command)).toBe(expected)
  },
)
