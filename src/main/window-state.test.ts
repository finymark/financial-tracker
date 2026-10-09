import { afterEach, expect, test, vi } from 'vitest'
import {
  initialWindowState,
  parseWindowState,
  windowStateToSave,
  WindowStateTracker,
  type WindowSnapshot,
  type WindowState,
  type WindowDisplays,
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

test('a usable visible corner is moved inside the work area, while a sliver falls back', () => {
  const sliver = {
    bounds: { x: 1959, y: 20, width: 900, height: 600 },
    maximized: false,
  }
  expect(initialWindowState(sliver, [primary], primary)).toEqual({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: false,
  })
  const corner = { ...sliver, bounds: { ...sliver.bounds, x: 1860, y: 960 } }
  expect(initialWindowState(corner, [primary], primary)).toEqual({
    bounds: { x: 1060, y: 460, width: 900, height: 600 },
    maximized: false,
  })
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

test.each([-300, 0, 1025])(
  'a saved title strip outside the primary work area falls back safely: y=%s',
  (y) => {
    expect(
      initialWindowState(
        { bounds: { x: 200, y, width: 1000, height: 800 }, maximized: false },
        [primary],
        primary,
      ),
    ).toEqual({
      bounds: { x: 550, y: 240, width: 900, height: 600 },
      maximized: false,
    })
  },
)

test('a title strip exactly at the top work-area boundary is reachable', () => {
  const state = {
    bounds: { x: 200, y: 20, width: 1000, height: 800 },
    maximized: false,
  }
  expect(initialWindowState(state, [primary], primary)).toEqual(state)
})

test.each([false, true])(
  'an oversized saved window is clamped into its matched secondary work area, maximized=%s',
  (maximized) => {
    expect(
      initialWindowState(
        { bounds: { x: -1200, y: 80, width: 1800, height: 1200 }, maximized },
        [primary, secondary],
        primary,
      ),
    ).toEqual({
      bounds: { x: -1280, y: 0, width: 1280, height: 984 },
      maximized,
    })
  },
)

test('clamping only oversized height also adjusts position to fit, preserving a smaller width', () => {
  expect(
    initialWindowState(
      {
        bounds: { x: 150, y: 80, width: 1000, height: 1200 },
        maximized: false,
      },
      [primary],
      primary,
    ),
  ).toEqual({
    bounds: { x: 150, y: 20, width: 1000, height: 1040 },
    maximized: false,
  })
})

afterEach(() => vi.useRealTimers())

function trackerFixture(savedState: unknown = restored) {
  vi.useFakeTimers()
  const displays: WindowDisplays = {
    workAreas: [primary],
    primaryWorkArea: primary,
  }
  let snapshot: WindowSnapshot = {
    bounds: restored.bounds,
    normalBounds: restored.bounds,
    maximized: false,
    minimized: false,
    fullscreen: false,
  }
  const getSnapshot = vi.fn((): WindowSnapshot | undefined => snapshot)
  const save = vi.fn()
  const tracker = new WindowStateTracker({
    savedState,
    getSnapshot,
    save,
    getDisplays: () => displays,
    timers: { setTimeout, clearTimeout },
  })
  const apply = vi.fn((state: WindowState) => {
    snapshot = {
      ...snapshot,
      bounds: state.bounds,
      normalBounds: state.bounds,
      maximized: state.maximized,
    }
    // Native setBounds/maximize can emit events synchronously while applying restoration.
    tracker.changed()
  })
  return {
    tracker,
    displays,
    save,
    getSnapshot,
    apply,
    snapshot: () => snapshot,
    setSnapshot: (next: WindowSnapshot) => {
      snapshot = next
    },
  }
}

test('a never-shown hidden window cannot capture or save on events, tray Quit or session-end flush', () => {
  const { tracker, save, getSnapshot } = trackerFixture()
  expect(tracker.initialState()).toEqual({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: false,
  })
  tracker.changed()
  vi.advanceTimersByTime(5000)
  tracker.flush()
  expect(save).not.toHaveBeenCalled()
  expect(getSnapshot).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test('first tray Open rechecks the original secondary-display state after docking, not the startup fallback', () => {
  const saved = { ...restored, maximized: true }
  const { tracker, displays, apply, save, getSnapshot } = trackerFixture(saved)
  expect(tracker.initialState()).toEqual({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: true,
  })
  displays.workAreas = [primary, secondary]
  tracker.showFirstTime(apply)
  expect(apply).toHaveBeenCalledExactlyOnceWith(saved)
  expect(getSnapshot).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
  vi.advanceTimersByTime(999)
  expect(save).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(save).toHaveBeenCalledExactlyOnceWith(saved)
})

test('first tray Open falls back using current displays when a monitor disappears while hidden', () => {
  const { tracker, displays, apply, save } = trackerFixture(restored)
  displays.workAreas = [primary, secondary]
  expect(tracker.initialState()).toEqual(restored)
  displays.workAreas = [primary]
  tracker.showFirstTime(apply)
  expect(apply).toHaveBeenCalledExactlyOnceWith({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: false,
  })
  tracker.flush()
  expect(save).toHaveBeenCalledExactlyOnceWith({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: false,
  })
})

test('first launch applies maximized primary bounds without capturing intermediate native resize events', () => {
  const { tracker, apply, save, getSnapshot } = trackerFixture(null)
  tracker.showFirstTime((state) => {
    apply(state)
    tracker.flush()
    expect(save).not.toHaveBeenCalled()
    expect(getSnapshot).not.toHaveBeenCalled()
  })
  expect(apply).toHaveBeenCalledExactlyOnceWith({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: true,
  })
  vi.advanceTimersByTime(1000)
  expect(save).toHaveBeenCalledExactlyOnceWith({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: true,
  })
})

test('move and resize bursts save only the latest snapshot after 1000 ms of quiet', () => {
  const { tracker, apply, save, snapshot, setSnapshot } = trackerFixture()
  tracker.showFirstTime(apply)
  vi.advanceTimersByTime(1000)
  save.mockClear()
  setSnapshot({
    ...snapshot(),
    bounds: { x: 200, y: 150, width: 1100, height: 800 },
  })
  tracker.changed()
  vi.advanceTimersByTime(500)
  setSnapshot({
    ...snapshot(),
    bounds: { x: 240, y: 200, width: 1200, height: 850 },
  })
  tracker.changed()
  vi.advanceTimersByTime(999)
  expect(save).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(save).toHaveBeenCalledExactlyOnceWith({
    bounds: { x: 240, y: 200, width: 1200, height: 850 },
    maximized: false,
  })
  expect(vi.getTimerCount()).toBe(0)
})

test('close-to-tray or quit flush captures current bounds immediately and cancels a pending debounce', () => {
  const { tracker, apply, save, snapshot, setSnapshot } = trackerFixture()
  tracker.showFirstTime(apply)
  setSnapshot({
    ...snapshot(),
    bounds: { x: 200, y: 150, width: 1100, height: 800 },
  })
  tracker.changed()
  // Closing before the next native move event still captures the final position.
  setSnapshot({
    ...snapshot(),
    bounds: { x: 250, y: 180, width: 1100, height: 800 },
  })
  tracker.flush()
  expect(save).toHaveBeenCalledExactlyOnceWith({
    bounds: { x: 250, y: 180, width: 1100, height: 800 },
    maximized: false,
  })
  vi.advanceTimersByTime(2000)
  expect(save).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

test.each(['minimized', 'fullscreen'] as const)(
  'a pending usable snapshot survives %s for debounce and quit',
  (flag) => {
    const { tracker, apply, save, snapshot, setSnapshot } = trackerFixture()
    tracker.showFirstTime(apply)
    const bounds = { x: 200, y: 150, width: 1100, height: 800 }
    setSnapshot({ ...snapshot(), bounds })
    tracker.changed()
    vi.advanceTimersByTime(500)
    setSnapshot({ ...snapshot(), bounds: primary, [flag]: true })
    tracker.changed()
    vi.advanceTimersByTime(500)
    expect(save).toHaveBeenCalledExactlyOnceWith({ bounds, maximized: false })
    tracker.flush()
    expect(save).toHaveBeenLastCalledWith({ bounds, maximized: false })
    expect(vi.getTimerCount()).toBe(0)
  },
)

test('maximizing saves normal bounds and minimizing before quit cannot replace them', () => {
  const { tracker, apply, save, snapshot, setSnapshot } = trackerFixture()
  tracker.showFirstTime(apply)
  const normalBounds = { x: 250, y: 180, width: 1100, height: 800 }
  setSnapshot({ ...snapshot(), bounds: primary, normalBounds, maximized: true })
  tracker.changed()
  setSnapshot({
    ...snapshot(),
    bounds: { x: -32000, y: -32000, width: 0, height: 0 },
    maximized: false,
    minimized: true,
  })
  tracker.flush()
  expect(save).toHaveBeenCalledExactlyOnceWith({
    bounds: normalBounds,
    maximized: true,
  })
})

test('unmaximizing captures restored bounds rather than stale normal bounds', () => {
  const { tracker, apply, save, snapshot, setSnapshot } = trackerFixture({
    ...restored,
    maximized: true,
  })
  tracker.showFirstTime(apply)
  const bounds = { x: 250, y: 180, width: 1100, height: 800 }
  setSnapshot({ ...snapshot(), bounds, maximized: false })
  tracker.changed()
  tracker.flush()
  expect(save).toHaveBeenCalledExactlyOnceWith({ bounds, maximized: false })
})

test('reopening an already shown window does not reapply the old saved rectangle', () => {
  const { tracker, apply, displays, snapshot, setSnapshot, save } =
    trackerFixture()
  tracker.showFirstTime(apply)
  const bounds = { x: 200, y: 150, width: 1100, height: 800 }
  setSnapshot({ ...snapshot(), bounds })
  tracker.changed()
  displays.workAreas = [primary, secondary]
  tracker.showFirstTime(apply)
  expect(apply).toHaveBeenCalledTimes(1)
  tracker.flush()
  expect(save).toHaveBeenCalledExactlyOnceWith({ bounds, maximized: false })
})

test('flush retains the last usable state if the window snapshot is no longer available', () => {
  const { tracker, apply, getSnapshot, save } = trackerFixture()
  tracker.showFirstTime(apply)
  getSnapshot.mockReturnValue(undefined)
  tracker.flush()
  expect(save).toHaveBeenCalledExactlyOnceWith({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: false,
  })
})

test('a window with its title strip on a top monitor restores there until that monitor is removed', () => {
  const top = { x: 40, y: -1080, width: 1920, height: 1080 }
  const state = {
    bounds: { x: 200, y: -300, width: 1000, height: 800 },
    maximized: false,
  }
  expect(initialWindowState(state, [primary, top], primary)).toEqual({
    bounds: { x: 200, y: -800, width: 1000, height: 800 },
    maximized: false,
  })
  expect(initialWindowState(state, [primary], primary)).toEqual({
    bounds: { x: 550, y: 240, width: 900, height: 600 },
    maximized: false,
  })
})

test('clamping only oversized width preserves a smaller height and its vertical position', () => {
  expect(
    initialWindowState(
      {
        bounds: { x: 100, y: 100, width: 2500, height: 700 },
        maximized: false,
      },
      [primary],
      primary,
    ),
  ).toEqual({
    bounds: { x: 40, y: 100, width: 1920, height: 700 },
    maximized: false,
  })
})

test.each([false, true])(
  'a side-by-side span moves into the display holding most of it, reversed order=%s',
  (reversed) => {
    const left = { x: 0, y: 0, width: 1920, height: 1040 }
    const right = { x: 1920, y: 0, width: 1920, height: 1040 }
    const state = {
      bounds: { x: 1500, y: 100, width: 1000, height: 700 },
      maximized: false,
    }
    expect(
      initialWindowState(state, reversed ? [right, left] : [left, right], left),
    ).toEqual({
      bounds: { x: 1920, y: 100, width: 1000, height: 700 },
      maximized: false,
    })
  },
)

test.each([
  { x: -50, expectedX: 0 },
  { x: 1700, expectedX: 920 },
])(
  'a window past a horizontal edge keeps its size and moves inside: x=$x',
  ({ x, expectedX }) => {
    const area = { x: 0, y: 0, width: 1920, height: 1040 }
    expect(
      initialWindowState(
        { bounds: { x, y: 100, width: 1000, height: 700 }, maximized: false },
        [area],
        area,
      ),
    ).toEqual({
      bounds: { x: expectedX, y: 100, width: 1000, height: 700 },
      maximized: false,
    })
  },
)

test('flush saves supplied normal bounds even when they equal the maximized bounds', () => {
  const { tracker, apply, save, snapshot, setSnapshot } = trackerFixture()
  tracker.showFirstTime(apply)
  setSnapshot({
    ...snapshot(),
    bounds: primary,
    normalBounds: { ...primary },
    maximized: true,
  })
  tracker.flush()
  expect(save).toHaveBeenCalledExactlyOnceWith({
    bounds: primary,
    maximized: true,
  })
  expect(vi.getTimerCount()).toBe(0)
})
