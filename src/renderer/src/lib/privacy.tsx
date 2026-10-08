import { createContext, useContext, type ReactNode } from 'react'
import type { Currency } from '../../../shared/accounts'
import { createFormatters, translate, type Language } from '../i18n'
import { createPrivacyFormatters } from './privacy-format'

const PrivacyContext = createContext({
  privacyMode: false,
  language: 'en' as Language,
})

export function PrivacyProvider({
  privacyMode,
  language,
  children,
}: {
  privacyMode: boolean
  language: Language
  children: ReactNode
}) {
  return (
    <PrivacyContext value={{ privacyMode, language }}>
      {children}
    </PrivacyContext>
  )
}

export function usePrivacy() {
  return useContext(PrivacyContext)
}

/** All non-editable monetary values use this component, including derived ratios. */
export function Amount({ children }: { children: ReactNode }) {
  const { privacyMode, language } = usePrivacy()
  return (
    <span data-amount="">
      <span
        className={privacyMode ? 'private-amount' : undefined}
        aria-hidden={privacyMode || undefined}
      >
        {children}
      </span>
      {privacyMode && (
        <span className="sr-only">
          {translate(language, 'privacy.hiddenAmount')}
        </span>
      )}
    </span>
  )
}

/** One renderer path: blurred DOM amounts, redacted strings for SVG/attributes. */
export function useAmountFormatters(language: Language) {
  const { privacyMode } = usePrivacy()
  const format = createFormatters(language)
  return {
    ...createPrivacyFormatters(language, privacyMode),
    amount: (minor: number, currency: Currency) => (
      <Amount>{format.money(minor, currency)}</Amount>
    ),
    amountText: (value: string) => <Amount>{value}</Amount>,
  }
}
