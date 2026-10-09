import type { MessageKey } from '../i18n'

export type ShortcutScope = 'app' | 'drawer' | 'help'

export interface ShortcutKeyEvent {
  key: string
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  shiftKey: boolean
  repeat: boolean
  isComposing: boolean
  defaultPrevented: boolean
}

interface ShortcutBinding {
  key: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
}

interface ShortcutDefinition {
  action: string
  scopes: readonly ShortcutScope[]
  label: string
  description: MessageKey
  bindings: readonly ShortcutBinding[]
  outsideEditing?: boolean
  singleLineOnly?: boolean
}

export const shortcuts = [
  {
    action: 'privacy',
    scopes: ['app', 'drawer', 'help'],
    label: 'Ctrl+Shift+H',
    description: 'privacy.toggle',
    bindings: [{ key: 'h', ctrl: true, shift: true }],
  },
  {
    action: 'newTransaction',
    scopes: ['app'],
    label: 'N / Ctrl+N',
    description: 'shortcuts.newTransaction',
    bindings: [{ key: 'n' }, { key: 'n', ctrl: true }],
    outsideEditing: true,
  },
  {
    action: 'expense',
    scopes: ['drawer'],
    label: 'Alt+1',
    description: 'transactions.expense',
    bindings: [{ key: '1', alt: true }],
  },
  {
    action: 'income',
    scopes: ['drawer'],
    label: 'Alt+2',
    description: 'transactions.income',
    bindings: [{ key: '2', alt: true }],
  },
  {
    action: 'transfer',
    scopes: ['drawer'],
    label: 'Alt+3',
    description: 'transactions.transfer',
    bindings: [{ key: '3', alt: true }],
  },
  {
    action: 'save',
    scopes: ['drawer'],
    label: 'Enter',
    description: 'shortcuts.save',
    bindings: [{ key: 'Enter' }],
    singleLineOnly: true,
  },
  {
    action: 'saveAndAddAnother',
    scopes: ['drawer'],
    label: 'Ctrl+Enter',
    description: 'shortcuts.saveAndAddAnother',
    bindings: [{ key: 'Enter', ctrl: true }],
  },
  {
    action: 'close',
    scopes: ['drawer', 'help'],
    label: 'Esc',
    description: 'shortcuts.close',
    bindings: [{ key: 'Escape' }],
  },
  {
    action: 'help',
    scopes: ['app'],
    label: '?',
    description: 'shortcuts.help',
    bindings: [{ key: '?' }, { key: '?', shift: true }],
    outsideEditing: true,
  },
  {
    action: 'undo',
    scopes: ['app'],
    label: 'Ctrl+Z',
    description: 'shortcuts.undo',
    bindings: [{ key: 'z', ctrl: true }],
    outsideEditing: true,
  },
] as const satisfies readonly ShortcutDefinition[]

export type ShortcutAction = (typeof shortcuts)[number]['action']

export interface ShortcutContext {
  scope: ShortcutScope
  editingText?: boolean
  multiline?: boolean
  activatingControl?: boolean
  helpHint?: boolean
}

/** Matches keys without depending on the DOM, React, or the active language. */
export function matchShortcut(
  event: ShortcutKeyEvent,
  context: ShortcutContext,
): ShortcutAction | null {
  if (event.repeat || event.isComposing || event.defaultPrevented) return null
  for (const definition of shortcuts as readonly ShortcutDefinition[]) {
    if (!definition.scopes.includes(context.scope)) continue
    if (definition.action === 'close' && context.helpHint) continue
    if (definition.outsideEditing && context.editingText) continue
    if (
      definition.singleLineOnly &&
      (context.multiline || context.activatingControl)
    )
      continue
    if (
      definition.bindings.some(
        (binding) =>
          event.key.toLowerCase() === binding.key.toLowerCase() &&
          event.ctrlKey === Boolean(binding.ctrl) &&
          event.altKey === Boolean(binding.alt) &&
          !event.metaKey &&
          event.shiftKey === Boolean(binding.shift),
      )
    ) {
      return definition.action as ShortcutAction
    }
  }
  return null
}
