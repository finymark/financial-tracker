import { useState } from 'react'
import type { Currency } from '../../../shared/accounts'
import {
  MAX_AMOUNT_EXPRESSION_LENGTH,
  parseAmountExpression,
} from '../../../shared/amount-expression'
import { createFormatters, type Language, type MessageKey } from '../i18n'
import { Input } from './ui/input'

interface AmountInputProps {
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
}

export function AmountInput({
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
}: AmountInputProps) {
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
        id={id}
        inputMode="decimal"
        value={value}
        placeholder="0.00"
        maxLength={MAX_AMOUNT_EXPRESSION_LENGTH}
        required
        disabled={disabled}
        aria-describedby={`${id}-hint ${id}-result`}
        aria-invalid={preview?.minor === null || undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={evaluate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
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
          (preview.minor === null
            ? t(errorKey)
            : `${t('amount.result')}: ${createFormatters(language).money(preview.minor, currency)}`)}
      </p>
    </>
  )
}
