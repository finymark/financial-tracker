export const resolvedThemes = ['light', 'dark'] as const
export type ResolvedTheme = (typeof resolvedThemes)[number]

export const TITLE_BAR_HEIGHT = 36

export const TITLE_BAR_COLORS = {
  light: { color: '#f1f6f4', symbolColor: '#263d36' },
  dark: { color: '#1b2a27', symbolColor: '#edf4f1' },
} as const satisfies Record<
  ResolvedTheme,
  { color: string; symbolColor: string }
>

export function titleBarOverlay(theme: ResolvedTheme): {
  color: string
  symbolColor: string
  height: number
} {
  return { ...TITLE_BAR_COLORS[theme], height: TITLE_BAR_HEIGHT }
}
