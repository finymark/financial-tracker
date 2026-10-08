interface KeyboardInput {
  type: string
  key: string
  control: boolean
  alt: boolean
  meta: boolean
  shift?: boolean
}

export type ZoomCommand = 'in' | 'out' | 'reset'

export function blocksPackagedShortcut(input: KeyboardInput): boolean {
  if (input.type !== 'keyDown' || input.alt || input.meta) return false
  if (!input.control && input.key === 'F12') return true
  const key = input.key.toLowerCase()
  return input.control && (key === 'r' || (input.shift === true && key === 'i'))
}

export function zoomCommand(input: KeyboardInput): ZoomCommand | null {
  if (input.type !== 'keyDown' || !input.control || input.alt || input.meta)
    return null
  if (input.key === '=' || input.key === '+') return 'in'
  if (input.key === '-') return 'out'
  if (input.key === '0') return 'reset'
  return null
}
