import { expect, test } from 'vitest'
import { startsHidden } from './desktop'

test.each([
  [[], false],
  [['Financial Tracker.exe'], false],
  [['Financial Tracker.exe', '--hidden'], true],
  [['electron', '.', '--hidden'], true],
  [['--hidden', '--smoke-test'], true],
  [['--hidden', '--hidden'], true],
  [['--hidden=true'], false],
  [['--Hidden'], false],
  [['C:/synthetic/--hidden/app.exe'], false],
] as const)('parses exact --hidden in %j', (args, expected) => {
  expect(startsHidden(args)).toBe(expected)
})
