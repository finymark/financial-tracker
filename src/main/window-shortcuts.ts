interface KeyboardInput {
  type: string
  key: string
  control: boolean
  alt: boolean
  meta: boolean
  shift?: boolean
}

export type ZoomCommand = 'in' | 'out' | 'reset'
export type DevelopmentWindowCommand = 'reload' | 'toggle-devtools'

export function developmentWindowCommand(
  input: KeyboardInput,
): DevelopmentWindowCommand | null {
  if (input.type !== 'keyDown' || input.alt || input.meta) return null
  if (!input.control && input.key === 'F12') return 'toggle-devtools'
  const key = input.key.toLowerCase()
  if (input.control && key === 'r') return 'reload'
  if (input.control && input.shift === true && key === 'i')
    return 'toggle-devtools'
  return null
}

export function blocksPackagedShortcut(input: KeyboardInput): boolean {
  return developmentWindowCommand(input) !== null
}

export function zoomCommand(input: KeyboardInput): ZoomCommand | null {
  if (input.type !== 'keyDown' || !input.control || input.alt || input.meta)
    return null
  if (input.key === '=' || input.key === '+') return 'in'
  if (input.key === '-') return 'out'
  if (input.key === '0') return 'reset'
  return null
}

export function nextZoomLevel(current: number, command: ZoomCommand): number {
  if (command === 'reset') return 0
  const direction = command === 'in' ? 0.5 : -0.5
  return Math.max(-3, Math.min(3, current + direction))
}
