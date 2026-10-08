export interface AutostartStatus {
  supported: boolean
  openAtLogin: boolean
}

export interface SetAutostartInput {
  openAtLogin: boolean
}

export function startsHidden(args: readonly string[]): boolean {
  return args.includes('--hidden')
}
