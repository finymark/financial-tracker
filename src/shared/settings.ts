export const languages = ['hu', 'en', 'de'] as const
export type Language = (typeof languages)[number]

export const themeModes = ['light', 'dark', 'system'] as const
export type ThemeMode = (typeof themeModes)[number]

export const baseCurrencies = ['HUF', 'CHF'] as const
export type BaseCurrency = (typeof baseCurrencies)[number]

export interface ProfileSettings {
  language: Language
  theme: ThemeMode
  baseCurrency: BaseCurrency
}

export type ProfileSettingsChanges = Partial<ProfileSettings>

export const DEFAULT_PROFILE_SETTINGS: Readonly<ProfileSettings> = {
  language: 'en',
  theme: 'system',
  baseCurrency: 'HUF',
}
