import { useState, type Ref } from 'react'
import type { Currency } from '../../../shared/accounts'
import {
  MAX_AMOUNT_EXPRESSION_LENGTH,
  parseAmountExpression,
} from '../../../shared/amount-expression'
import { type Language, type MessageKey } from '../i18n'
import { useAmountFormatters, usePrivacy } from '../lib/privacy'
import { Input } from './ui/input'

interface AmountInputProps {
  ref?: Ref<HTMLInputElement>
  id: string
  value: string
  onChange(value: string): void
  currency: Currency
  language: Language
  t(key: MessageKey): string
  errorKey: MessageKey
  hintKey: MessageKey
  allowNegative?: boolean
  allowZero?: boolean
  disabled?: boolean
  required?: boolean
  placeholder?: string
}

export function AmountInput({
  ref,
  id,
  value,
  onChange,
  currency,
  language,
  t,
  errorKey,
  hintKey,
  allowNegative,
  allowZero,
  disabled,
  required = true,
  placeholder = '0.00',
}: AmountInputProps) {
  const { privacyMode } = usePrivacy()
  const format = useAmountFormatters(language)
  const [focused, setFocused] = useState(false)
  const [evaluated, setEvaluated] = useState<{
    input: string
    currency: Currency
    minor: number | null
  } | null>(null)
  const preview =
    evaluated?.input === value && evaluated.currency === currency
      ? evaluated
      : null

  function evaluate() {
    if (!required && value.trim() === '') {
      setEvaluated(null)
      return
    }
    let minor: number | null = null
    try {
      minor = parseAmountExpression(value, currency, errorKey, {
        allowNegative,
        allowZero,
      })
    } catch {
      // The parser's error is shown beside the field, without saving anything.
    }
    setEvaluated({ input: value, currency, minor })
  }

  return (
    <>
      <Input
        ref={ref}
        id={id}
        inputMode="decimal"
        data-amount-input=""
        type={!privacyMode || focused ? 'text' : 'password'}
        autoComplete="off"
        className={privacyMode && !focused ? 'private-amount' : undefined}
        onFocus={() => setFocused(true)}
        value={value}
        placeholder={placeholder}
        maxLength={MAX_AMOUNT_EXPRESSION_LENGTH}
        required={required}
        disabled={disabled}
        aria-describedby={`${id}-hint ${id}-result`}
        aria-invalid={preview?.minor === null || undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          setFocused(false)
          evaluate()
        }}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.nativeEvent.isComposing &&
            !event.defaultPrevented
          ) {
            event.preventDefault()
            evaluate()
          }
        }}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {t(hintKey)}
      </p>
      <p
        id={`${id}-result`}
        role={preview?.minor === null ? 'alert' : 'status'}
        className={
          preview?.minor === null
            ? 'text-sm text-error'
            : 'text-sm font-medium tabular-nums'
        }
      >
        {preview &&
          (preview.minor === null ? (
            t(errorKey)
          ) : (
            <>
              {t('amount.result')}: {format.amount(preview.minor, currency)}
            </>
          ))}
      </p>
    </>
  )
}
