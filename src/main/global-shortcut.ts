import type { GlobalShortcut } from 'electron'
import type { ShortcutStatus } from '../shared/desktop'
import { normaliseAccelerator } from '../shared/accelerator'

interface ShortcutSettings {
  getQuickAddAccelerator(): string
  setQuickAddAccelerator(accelerator: string): void
}

type GlobalShortcutAdapter = Pick<GlobalShortcut, 'register' | 'unregister'>

export class QuickAddShortcut {
  readonly #globalShortcut: GlobalShortcutAdapter
  readonly #settings: ShortcutSettings
  readonly #openQuickAdd: () => void
  #accelerator: string
  #registered = false
  #failureAccelerator: string | null = null

  constructor(
    globalShortcut: GlobalShortcutAdapter,
    settings: ShortcutSettings,
    openQuickAdd: () => void,
  ) {
    this.#globalShortcut = globalShortcut
    this.#settings = settings
    this.#openQuickAdd = openQuickAdd
    this.#accelerator = normaliseAccelerator(settings.getQuickAddAccelerator())
  }

  start(): ShortcutStatus {
    if (!this.#registered) this.#registerCurrent()
    return this.status()
  }

  status(): ShortcutStatus {
    return {
      accelerator: this.#accelerator,
      registered: this.#registered,
      failureAccelerator: this.#failureAccelerator,
    }
  }

  set(value: string): ShortcutStatus {
    const next = normaliseAccelerator(value)
    if (next === this.#accelerator) {
      if (!this.#registered) this.#registerCurrent()
      else this.#failureAccelerator = null
      return this.status()
    }
    let registered = false
    try {
      registered = this.#globalShortcut.register(next, this.#openQuickAdd)
    } catch {
      registered = false
    }
    if (!registered) {
      this.#failureAccelerator = next
      return this.status()
    }
    try {
      this.#settings.setQuickAddAccelerator(next)
    } catch (error) {
      this.#globalShortcut.unregister(next)
      throw error
    }
    if (this.#registered) this.#globalShortcut.unregister(this.#accelerator)
    this.#accelerator = next
    this.#registered = true
    this.#failureAccelerator = null
    return this.status()
  }

  dispose(): void {
    if (this.#registered) this.#globalShortcut.unregister(this.#accelerator)
    this.#registered = false
  }

  #registerCurrent(): void {
    try {
      this.#registered = this.#globalShortcut.register(
        this.#accelerator,
        this.#openQuickAdd,
      )
    } catch {
      this.#registered = false
    }
    this.#failureAccelerator = this.#registered ? null : this.#accelerator
  }
}
