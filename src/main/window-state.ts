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
  if (
    state &&
    workAreas.some((area) => {
      // Require a usable visible patch, not just a thin sliver at a screen edge.
      const bounds = state.bounds
      return (
        Math.min(bounds.x + bounds.width, area.x + area.width) -
          Math.max(bounds.x, area.x) >=
          Math.min(100, bounds.width) &&
        Math.min(bounds.y + bounds.height, area.y + area.height) -
          Math.max(bounds.y, area.y) >=
          Math.min(100, bounds.height)
      )
    })
  )
    return state
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

export function windowStateToSave(snapshot: {
  bounds: WindowBounds
  normalBounds: WindowBounds
  maximized: boolean
  minimized: boolean
  fullscreen: boolean
}): WindowState | undefined {
  if (snapshot.minimized || snapshot.fullscreen) return
  return parseWindowState({
    bounds: snapshot.maximized ? snapshot.normalBounds : snapshot.bounds,
    maximized: snapshot.maximized,
  })
}
