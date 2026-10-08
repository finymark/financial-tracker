import { createFormatters, type Language } from '../i18n'
import type { Currency } from '../../../shared/accounts'

/** String-only amounts (chart ticks/tooltips and titles) must not expose digits. */
export function createPrivacyFormatters(
  language: Language,
  privacyMode: boolean,
) {
  const format = createFormatters(language)
  const privateText = (value: string) => (privacyMode ? '•••' : value)
  return {
    ...format,
    money: (minor: number, currency: Currency) =>
      privateText(format.money(minor, currency)),
    privateText,
  }
}
