import { TITLE_BAR_HEIGHT } from '../shared/window-chrome'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowState {
  bounds: WindowBounds
  maximized: boolean
}

export function parseWindowState(value: unknown): WindowState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const input = value as Record<string, unknown>
  if (
    typeof input.maximized !== 'boolean' ||
    Object.keys(input).some((key) => key !== 'bounds' && key !== 'maximized') ||
    !input.bounds ||
    typeof input.bounds !== 'object' ||
    Array.isArray(input.bounds)
  )
    return
  const bounds = input.bounds as Record<string, unknown>
  if (
    Object.keys(bounds).some(
      (key) => !['x', 'y', 'width', 'height'].includes(key),
    )
  )
    return
  for (const key of ['x', 'y', 'width', 'height']) {
    const value = bounds[key]
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < -2147483648 ||
      value > 2147483647
    )
      return
  }
  if ((bounds.width as number) <= 0 || (bounds.height as number) <= 0) return
  return {
    bounds: {
      x: bounds.x as number,
      y: bounds.y as number,
      width: bounds.width as number,
      height: bounds.height as number,
    },
    maximized: input.maximized,
  }
}

export function initialWindowState(
  saved: unknown,
  workAreas: readonly WindowBounds[],
  primaryWorkArea: WindowBounds,
): WindowState {
  const state = parseWindowState(saved)
  let match: { bounds: WindowBounds; intersection: number } | undefined
  if (state) {
    for (const area of workAreas) {
      const savedBounds = state.bounds
      const visibleWidth =
        Math.min(savedBounds.x + savedBounds.width, area.x + area.width) -
        Math.max(savedBounds.x, area.x)
      const visibleHeight =
        Math.min(savedBounds.y + savedBounds.height, area.y + area.height) -
        Math.max(savedBounds.y, area.y)
      // A body sliver or an off-screen title strip is not a recoverable window.
      if (
        visibleWidth < Math.min(100, savedBounds.width, area.width) ||
        visibleHeight < Math.min(100, savedBounds.height, area.height) ||
        savedBounds.y < area.y ||
        savedBounds.y + TITLE_BAR_HEIGHT > area.y + area.height
      )
        continue
      let bounds = savedBounds
      if (bounds.width > area.width || bounds.height > area.height) {
        const width = Math.min(bounds.width, area.width)
        const height = Math.min(bounds.height, area.height)
        bounds = {
          x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)),
          y: Math.max(
            area.y,
            Math.min(bounds.y, area.y + area.height - height),
          ),
          width,
          height,
        }
      }
      if (bounds.x < area.x || bounds.x + bounds.width > area.x + area.width)
        continue
      const intersection = visibleWidth * visibleHeight
      // Prefer the display containing most of a rectangle spanning multiple displays.
      if (!match || intersection > match.intersection)
        match = { bounds, intersection }
    }
  }
  if (match && state)
    return { bounds: match.bounds, maximized: state.maximized }
  const width = Math.min(900, primaryWorkArea.width)
  const height = Math.min(600, primaryWorkArea.height)
  return {
    bounds: {
      x: primaryWorkArea.x + Math.round((primaryWorkArea.width - width) / 2),
      y: primaryWorkArea.y + Math.round((primaryWorkArea.height - height) / 2),
      width,
      height,
    },
    maximized: state?.maximized ?? true,
  }
}

export interface WindowSnapshot {
  bounds: WindowBounds
  normalBounds: WindowBounds
  maximized: boolean
  minimized: boolean
  fullscreen: boolean
}

export function windowStateToSave(
  snapshot: WindowSnapshot,
): WindowState | undefined {
  if (snapshot.minimized || snapshot.fullscreen) return
  return parseWindowState({
    bounds: snapshot.maximized ? snapshot.normalBounds : snapshot.bounds,
    maximized: snapshot.maximized,
  })
}

export interface WindowDisplays {
  workAreas: readonly WindowBounds[]
  primaryWorkArea: WindowBounds
}

interface WindowStateTimers {
  setTimeout: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setTimeout>
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void
}

export class WindowStateTracker {
  readonly #savedState: WindowState | undefined
  readonly #getSnapshot: () => WindowSnapshot | undefined
  readonly #getDisplays: () => WindowDisplays
  readonly #save: (state: WindowState) => void
  readonly #timers: WindowStateTimers
  #shown = false
  #lastState: WindowState | undefined
  #timer: ReturnType<typeof setTimeout> | undefined

  constructor(options: {
    savedState: unknown
    getSnapshot: () => WindowSnapshot | undefined
    getDisplays: () => WindowDisplays
    save: (state: WindowState) => void
    timers?: WindowStateTimers
  }) {
    this.#savedState = parseWindowState(options.savedState)
    this.#getSnapshot = options.getSnapshot
    this.#getDisplays = options.getDisplays
    this.#save = options.save
    this.#timers = options.timers ?? { setTimeout, clearTimeout }
  }

  initialState(): WindowState {
    const displays = this.#getDisplays()
    return initialWindowState(
      this.#savedState,
      displays.workAreas,
      displays.primaryWorkArea,
    )
  }

  showFirstTime(apply: (state: WindowState) => void): void {
    if (this.#shown) return
    // Re-evaluate the original saved rectangle: docking may have changed displays.
    const state = this.initialState()
    apply(state)
    // Ignore synchronous resize/maximize events emitted while applying restoration.
    this.#lastState = state
    this.#shown = true
    this.#schedule()
  }

  changed(): void {
    if (!this.#shown) return
    const state = this.#capture()
    if (!state) return
    // Capture now, before minimize/fullscreen can hide a pending usable change.
    this.#lastState = state
    this.#schedule()
  }

  flush(): void {
    this.#cancelTimer()
    if (!this.#shown) return
    this.#lastState = this.#capture() ?? this.#lastState
    if (this.#lastState) this.#save(this.#lastState)
  }

  #capture(): WindowState | undefined {
    const snapshot = this.#getSnapshot()
    return snapshot ? windowStateToSave(snapshot) : undefined
  }

  #schedule(): void {
    this.#cancelTimer()
    this.#timer = this.#timers.setTimeout(() => this.flush(), 1000)
  }

  #cancelTimer(): void {
    if (this.#timer === undefined) return
    this.#timers.clearTimeout(this.#timer)
    this.#timer = undefined
  }
}
