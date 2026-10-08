import { describe, expect, test } from 'vitest'
import {
  firstMatchingCategorisationRule,
  ruleTextKey,
  type CategorisationRuleMatch,
  type CategorisationRuleDraft,
} from './rules'

const draft: CategorisationRuleDraft = {
  accountId: 'account-1',
  kind: 'expense',
  totalMinor: 12_300,
  currency: 'HUF',
  canonicalPayeeId: 'payee-1',
  canonicalPayeeName: 'Café Central',
  note: 'Árvíztűrő monthly lunch',
}

function rule(
  overrides: Partial<CategorisationRuleMatch> = {},
): CategorisationRuleMatch {
  return {
    id: 'rule-1',
    enabled: true,
    sortOrder: 0,
    payeeId: null,
    textContains: null,
    accountId: null,
    minAmountMinor: null,
    maxAmountMinor: null,
    amountCurrency: null,
    actionPayeeId: null,
    categoryId: 'category-1',
    categoryKind: 'expense',
    tagIds: [],
    ...overrides,
  }
}

describe('categorisation rule matching', () => {
  test('matches all supplied conditions with folded note text and currency-specific inclusive amounts', () => {
    const matching = rule({
      payeeId: 'payee-1',
      textContains: 'ARVIZTURO',
      accountId: 'account-1',
      minAmountMinor: 12_300,
      maxAmountMinor: 12_300,
      amountCurrency: 'HUF',
    })
    expect(firstMatchingCategorisationRule([matching], draft)).toBe(matching)
    expect(ruleTextKey('  KÁVÉZÓ  ')).toBe('kavezo')

    for (const nonMatch of [
      rule({ payeeId: 'payee-2' }),
      rule({ textContains: 'dinner' }),
      rule({ accountId: 'account-2' }),
      rule({ minAmountMinor: 12_301, amountCurrency: 'HUF' }),
      rule({ maxAmountMinor: 12_299, amountCurrency: 'HUF' }),
      rule({ minAmountMinor: 1, amountCurrency: 'CHF' }),
      rule({ categoryKind: 'income' }),
      rule({ enabled: false }),
      rule(),
    ]) {
      expect(firstMatchingCategorisationRule([nonMatch], draft)).toBeNull()
    }
  })

  test('note contains does not inspect the payee name', () => {
    expect(
      firstMatchingCategorisationRule([rule({ textContains: 'cafe' })], draft),
    ).toBeNull()
  })

  test('accepts account-only and amount-only conditions', () => {
    expect(
      firstMatchingCategorisationRule(
        [rule({ accountId: 'account-1' })],
        draft,
      ),
    ).not.toBeNull()
    expect(
      firstMatchingCategorisationRule(
        [rule({ minAmountMinor: 12_000, amountCurrency: 'HUF' })],
        draft,
      ),
    ).not.toBeNull()
  })

  test('returns the first matching enabled rule in supplied priority order', () => {
    const first = rule({ id: 'first', sortOrder: 0, textContains: 'monthly' })
    const second = rule({ id: 'second', sortOrder: 1, payeeId: 'payee-1' })
    expect(firstMatchingCategorisationRule([first, second], draft)).toBe(first)
    expect(firstMatchingCategorisationRule([second, first], draft)).toBe(second)
  })

  test('amount conditions do not match until the draft has a valid amount', () => {
    expect(
      firstMatchingCategorisationRule(
        [rule({ minAmountMinor: 1, amountCurrency: 'HUF' })],
        {
          ...draft,
          totalMinor: null,
        },
      ),
    ).toBeNull()
  })
})
