import {
  baseCurrencies,
  languages,
  themeModes,
  type ProfileSettingsChanges,
} from '../../shared/settings'

export function parseSettingsChanges(value: unknown): ProfileSettingsChanges {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Settings must be an object')
  }
  const changes: ProfileSettingsChanges = {}
  for (const [key, setting] of Object.entries(value)) {
    switch (key) {
      case 'language': {
        const language = languages.find((item) => item === setting)
        if (!language) throw new TypeError('Invalid profile language')
        changes.language = language
        break
      }
      case 'theme': {
        const theme = themeModes.find((item) => item === setting)
        if (!theme) throw new TypeError('Invalid profile theme')
        changes.theme = theme
        break
      }
      case 'baseCurrency': {
        const baseCurrency = baseCurrencies.find((item) => item === setting)
        if (!baseCurrency) throw new TypeError('Invalid profile base currency')
        changes.baseCurrency = baseCurrency
        break
      }
      default:
        throw new TypeError(`Unknown profile setting: ${key}`)
    }
  }
  return changes
}
