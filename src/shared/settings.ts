export const languages = ['hu', 'en', 'de'] as const
export type Language = (typeof languages)[number]

export const themeModes = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof themeModes)[number]

export const baseCurrencies = ['HUF', 'CHF'] as const
export type BaseCurrency = (typeof baseCurrencies)[number]
export type WatchedFolderStatus = 'watching' | 'unavailable'

export interface ProfileSettings {
  language: Language
  theme: ThemeMode
  privacyMode: boolean
  baseCurrency: BaseCurrency
  watchedFolder: string | null
}

export type ProfileSettingsChanges = Partial<ProfileSettings>

// Keep these defaults aligned with the profile-settings schema migration.
export const DEFAULT_PROFILE_SETTINGS: Readonly<ProfileSettings> = {
  privacyMode: false,
  language: 'en',
  theme: 'system',
  baseCurrency: 'HUF',
  watchedFolder: null,
}
