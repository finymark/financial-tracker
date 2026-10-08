import { expect, test } from 'vitest'
import { rendererView } from './view-routing'

test.each([
  ['', 'main'],
  ['?view=main', 'main'],
  ['?view=quick-add', 'quick-add'],
  ['?view=unexpected', 'main'],
  ['?other=quick-add', 'main'],
] as const)('routes %j to the %s renderer view', (search, expected) => {
  expect(rendererView(search)).toBe(expected)
})
