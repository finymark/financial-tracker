import { useEffect } from 'react'

export const themeModes = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof themeModes)[number]

// Electron's default nativeTheme source is system, so this query follows Windows.
export function useTheme(mode: ThemeMode): void {
  useEffect(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const dark = mode === 'dark' || (mode === 'system' && systemTheme.matches)
      document.documentElement.classList.toggle('dark', dark)
    }

    applyTheme()
    systemTheme.addEventListener('change', applyTheme)
    return () => systemTheme.removeEventListener('change', applyTheme)
  }, [mode])
}
