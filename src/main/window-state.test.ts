import { expect, test } from 'vitest'
import {
  initialWindowState,
  parseWindowState,
  windowStateToSave,
} from './window-state'

const primary = { x: 40, y: 20, width: 1920, height: 1040 }
const secondary = { x: -1280, y: 0, width: 1280, height: 984 }

test('first launch is maximized with normal bounds centred on the primary work area', () => {
  expect(initialWindowState(undefined, [secondary, primary], primary)).toEqual({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: true,
  })
})

const restored = {
  bounds: { x: -1200, y: 80, width: 1000, height: 700 },
  maximized: false,
}

test('valid saved state restores normal bounds on a secondary display', () => {
  expect(parseWindowState(restored)).toEqual(restored)
  expect(initialWindowState(restored, [primary, secondary], primary)).toEqual(
    restored,
  )
  expect(
    initialWindowState(
      { ...restored, maximized: true },
      [primary, secondary],
      primary,
    ),
  ).toEqual({ ...restored, maximized: true })
})

test.each(
  [
    undefined,
    null,
    [],
    {},
    { ...restored, maximized: 'true' },
    { ...restored, minimized: true },
    { ...restored, bounds: { ...restored.bounds, x: NaN } },
    { ...restored, bounds: { ...restored.bounds, x: Infinity } },
    { ...restored, bounds: { ...restored.bounds, y: 0.5 } },
    { ...restored, bounds: { ...restored.bounds, width: 0 } },
    { ...restored, bounds: { ...restored.bounds, height: -1 } },
    { ...restored, bounds: { ...restored.bounds, width: '900' } },
    { ...restored, bounds: { ...restored.bounds, x: 2147483648 } },
    { ...restored, bounds: { ...restored.bounds, width: 2147483648 } },
    { ...restored, bounds: { ...restored.bounds, fullscreen: true } },
  ].map((value) => [value]),
)(
  'invalid saved window values safely use the first-launch defaults: %j',
  (saved) => {
    expect(parseWindowState(saved)).toBeUndefined()
    expect(initialWindowState(saved, [primary], primary)).toEqual({
      bounds: { x: 550, y: 240, width: 900, height: 600 },
      maximized: true,
    })
  },
)

test.each([false, true])(
  'an unplugged display falls back to default primary bounds, preserving maximized=%s',
  (maximized) => {
    expect(
      initialWindowState({ ...restored, maximized }, [primary], primary),
    ).toEqual({
      bounds: { x: 550, y: 240, width: 900, height: 600 },
      maximized,
    })
  },
)

test('a sliver on screen is not enough to recover the window, but a visible 100-by-100 corner is', () => {
  const sliver = {
    bounds: { x: 1959, y: 0, width: 900, height: 600 },
    maximized: false,
  }
  expect(initialWindowState(sliver, [primary], primary)).toEqual({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: false,
  })
  const corner = { ...sliver, bounds: { ...sliver.bounds, x: 1860, y: 960 } }
  expect(initialWindowState(corner, [primary], primary)).toEqual(corner)
})

test('default bounds fit a small primary work area without overlapping the taskbar', () => {
  expect(
    initialWindowState(undefined, [{ x: 0, y: 0, width: 800, height: 500 }], {
      x: 0,
      y: 0,
      width: 800,
      height: 500,
    }),
  ).toEqual({
    bounds: { x: 0, y: 0, width: 800, height: 500 },
    maximized: true,
  })
})

test('saving maximized state keeps the normal size and position, not the maximized rectangle', () => {
  const snapshot = {
    bounds: primary,
    normalBounds: restored.bounds,
    maximized: true,
    minimized: false,
    fullscreen: false,
  }
  expect(windowStateToSave(snapshot)).toEqual({ ...restored, maximized: true })
  expect(
    windowStateToSave({
      ...snapshot,
      bounds: { x: 150, y: 120, width: 1100, height: 800 },
      maximized: false,
    }),
  ).toEqual({
    bounds: { x: 150, y: 120, width: 1100, height: 800 },
    maximized: false,
  })
  expect(windowStateToSave({ ...snapshot, minimized: true })).toBeUndefined()
  expect(windowStateToSave({ ...snapshot, fullscreen: true })).toBeUndefined()
  expect(
    windowStateToSave({
      ...snapshot,
      normalBounds: { ...restored.bounds, width: 0 },
    }),
  ).toBeUndefined()
})
