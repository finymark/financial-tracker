import { useEffect } from 'react'

import type { ThemeMode } from '../../../shared/settings'
export { themeModes, type ThemeMode } from '../../../shared/settings'

// Electron's default nativeTheme source is system, so this query follows Windows.
export function useTheme(mode: ThemeMode): void {
  useEffect(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const dark = mode === 'dark' || (mode === 'system' && systemTheme.matches)
      document.documentElement.classList.toggle('dark', dark)
      void window.app.windowChrome
        .setTheme(dark ? 'dark' : 'light')
        .catch(() => {
          // The window may be closing while a Windows theme change is delivered.
        })
    }

    applyTheme()
    systemTheme.addEventListener('change', applyTheme)
    return () => systemTheme.removeEventListener('change', applyTheme)
  }, [mode])
}
