import { expect, test, vi } from 'vitest'
import { QuickAddShortcut } from './global-shortcut'

function setup(initial = 'Control+Alt+N') {
  const registered = new Set<string>()
  const globalShortcut = {
    register: vi.fn((accelerator: string) => {
      registered.add(accelerator)
      return true
    }),
    unregister: vi.fn((accelerator: string) => registered.delete(accelerator)),
  }
  const settings = {
    value: initial,
    getQuickAddAccelerator() {
      return this.value
    },
    setQuickAddAccelerator(value: string) {
      this.value = value
    },
  }
  return { registered, globalShortcut, settings }
}

test('registers the persisted shortcut and unregisters it on disposal', () => {
  const { registered, globalShortcut, settings } = setup()
  const shortcut = new QuickAddShortcut(globalShortcut, settings, vi.fn())
  expect(shortcut.start()).toEqual({
    accelerator: 'Control+Alt+N',
    registered: true,
    failureAccelerator: null,
  })
  shortcut.dispose()
  expect(registered.size).toBe(0)
  expect(globalShortcut.unregister).toHaveBeenCalledWith('Control+Alt+N')
})

test('keeps the previous working shortcut when replacement registration fails', () => {
  const { registered, globalShortcut, settings } = setup()
  const shortcut = new QuickAddShortcut(globalShortcut, settings, vi.fn())
  shortcut.start()
  globalShortcut.register.mockImplementationOnce(() => false)
  expect(shortcut.set('Control+Shift+K')).toEqual({
    accelerator: 'Control+Alt+N',
    registered: true,
    failureAccelerator: 'Control+Shift+K',
  })
  expect(settings.value).toBe('Control+Alt+N')
  expect(registered).toEqual(new Set(['Control+Alt+N']))
})

test('registers and persists a replacement before releasing the old shortcut', () => {
  const { registered, globalShortcut, settings } = setup()
  const shortcut = new QuickAddShortcut(globalShortcut, settings, vi.fn())
  shortcut.start()
  expect(shortcut.set('Ctrl+Shift+k').accelerator).toBe('Control+Shift+K')
  expect(settings.value).toBe('Control+Shift+K')
  expect(registered).toEqual(new Set(['Control+Shift+K']))
})
