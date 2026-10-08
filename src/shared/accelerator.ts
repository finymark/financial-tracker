export const DEFAULT_QUICK_ADD_ACCELERATOR = 'Control+Alt+N'

const modifierAliases: Readonly<Record<string, string>> = {
  control: 'Control',
  ctrl: 'Control',
  alt: 'Alt',
  shift: 'Shift',
  super: 'Super',
}
const modifierOrder = ['Control', 'Alt', 'Shift', 'Super'] as const

function normaliseKey(value: string): string | null {
  if (/^[a-z]$/i.test(value)) return value.toUpperCase()
  if (/^[0-9]$/.test(value)) return value
  const functionKey = /^f([1-9]|1[0-9]|2[0-4])$/i.exec(value)
  if (functionKey) return `F${functionKey[1]}`
  const named = {
    space: 'Space',
    left: 'Left',
    arrowleft: 'Left',
    right: 'Right',
    arrowright: 'Right',
    up: 'Up',
    arrowup: 'Up',
    down: 'Down',
    arrowdown: 'Down',
    home: 'Home',
    end: 'End',
    insert: 'Insert',
    delete: 'Delete',
    pageup: 'PageUp',
    pagedown: 'PageDown',
  }[value.toLowerCase()]
  return named ?? null
}

export function displayAccelerator(accelerator: string): string {
  return normaliseAccelerator(accelerator).replace('Control', 'Ctrl')
}

/** Returns the canonical Electron accelerator accepted by the app. */
export function normaliseAccelerator(value: string): string {
  const parts = value.split('+').map((part) => part.trim())
  const modifiers = new Set<string>()
  let key: string | null = null
  for (const part of parts) {
    const modifier = modifierAliases[part.toLowerCase()]
    if (modifier) {
      if (modifiers.has(modifier)) throw new Error('Invalid accelerator')
      modifiers.add(modifier)
      continue
    }
    const candidate = normaliseKey(part)
    if (!candidate || key) throw new Error('Invalid accelerator')
    key = candidate
  }
  if (!key || modifiers.size === 0) throw new Error('Invalid accelerator')
  return [
    ...modifierOrder.filter((modifier) => modifiers.has(modifier)),
    key,
  ].join('+')
}

export interface AcceleratorKeyEvent {
  key: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

export function acceleratorFromKeyEvent(
  event: AcceleratorKeyEvent,
): string | null {
  const key = normaliseKey(event.key)
  if (!key) return null
  const parts = [
    event.ctrlKey ? 'Control' : null,
    event.altKey ? 'Alt' : null,
    event.shiftKey ? 'Shift' : null,
    event.metaKey ? 'Super' : null,
    key,
  ].filter((part): part is string => Boolean(part))
  try {
    return normaliseAccelerator(parts.join('+'))
  } catch {
    return null
  }
}
