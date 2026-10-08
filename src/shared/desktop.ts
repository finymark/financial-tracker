export interface AutostartStatus {
  supported: boolean
  openAtLogin: boolean
}

export interface SetAutostartInput {
  openAtLogin: boolean
}

export interface ShortcutStatus {
  accelerator: string
  registered: boolean
  failureAccelerator: string | null
}

export interface SetQuickAddShortcutInput {
  accelerator: string
}

export function startsHidden(args: readonly string[]): boolean {
  return args.includes('--hidden')
}
