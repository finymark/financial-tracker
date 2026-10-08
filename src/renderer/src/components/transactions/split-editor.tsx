import type { Account } from '../../../../shared/accounts'
import type { Category } from '../../../../shared/categories'
import type { Tag } from '../../../../shared/tags'
import { parseAmountExpression } from '../../../../shared/amount-expression'
import { X } from 'lucide-react'
import { createFormatters, type Language, type MessageKey } from '../../i18n'
import { AmountInput } from '../amount-input'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { NativeSelect } from '../ui/native-select'
import { splitLine, tagKey, type TransactionForm } from './transaction-form'
import type { RefObject } from 'react'

interface SplitEditorProps {
  form: TransactionForm
  setForm(form: TransactionForm): void
  selectedAccount?: Account
  drawerCategories: Category[]
  tags: Tag[]
  busy: boolean
  language: Language
  t(key: MessageKey): string
  autofillProtectedRef: RefObject<{ category: boolean; tags: boolean }>
}

export function SplitEditor({
  form,
  setForm,
  selectedAccount,
  drawerCategories,
  tags,
  busy,
  language,
  t,
  autofillProtectedRef,
}: SplitEditorProps) {
  function addSplitTag(key: string) {
    if (!form.splitLines) return
    const line = form.splitLines.find((candidate) => candidate.key === key)
    if (!line?.pendingTagName.trim()) return
    const name = line.pendingTagName.trim()
    setForm({
      ...form,
      splitLines: form.splitLines.map((candidate) =>
        candidate.key === key
          ? {
              ...candidate,
              tagNames: candidate.tagNames.some(
                (tag) => tagKey(tag) === tagKey(name),
              )
                ? candidate.tagNames
                : [...candidate.tagNames, name],
              pendingTagName: '',
            }
          : candidate,
      ),
    })
  }

  const splitRemaining = (() => {
    if (!form.splitLines || !selectedAccount) return null
    try {
      const total = parseAmountExpression(
        form.amount,
        selectedAccount.currency,
        'transactions.error.amount',
      )
      const used = form.splitLines.reduce(
        (sum, line) =>
          sum +
          parseAmountExpression(
            line.amount,
            selectedAccount.currency,
            'transactions.error.amount',
          ),
        0,
      )
      return total - used
    } catch {
      return null
    }
  })()
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!form.splitLines ? (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              autofillProtectedRef.current = {
                category: true,
                tags: true,
              }
              setForm({
                ...form,
                splitLines: [
                  splitLine({
                    categoryId: form.categoryId,
                    note: form.note,
                    tagNames: form.tagNames,
                    pendingTagName: form.pendingTagName,
                  }),
                  splitLine(),
                ],
              })
            }}
          >
            {t('splits.split')}
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                autofillProtectedRef.current = {
                  category: true,
                  tags: true,
                }
                const first = form.splitLines![0]
                setForm({
                  ...form,
                  categoryId: first.categoryId,
                  note: first.note,
                  tagNames: first.tagNames,
                  pendingTagName: first.pendingTagName,
                  splitLines: null,
                })
              }}
            >
              {t('splits.unsplit')}
            </Button>
            <span
              className={`text-sm font-medium ${splitRemaining === 0 ? '' : 'text-error'}`}
              role="status"
            >
              {t('splits.remaining')}:{' '}
              {splitRemaining === null || !selectedAccount
                ? '—'
                : createFormatters(language).money(
                    splitRemaining,
                    selectedAccount.currency,
                  )}
            </span>
          </>
        )}
      </div>
      {form.splitLines && (
        <div className="space-y-3">
          <datalist id="transaction-tags">
            {tags.map((tag) => (
              <option key={tag.id} value={tag.name} />
            ))}
          </datalist>
          {form.splitLines.map((line, lineIndex) => (
            <section key={line.key} className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {t('splits.part')} {lineIndex + 1}
                </h3>
                <Button
                  variant="ghost"
                  disabled={busy || form.splitLines!.length <= 1}
                  onClick={() =>
                    setForm({
                      ...form,
                      splitLines: form.splitLines!.filter(
                        (candidate) => candidate.key !== line.key,
                      ),
                    })
                  }
                >
                  {t('splits.remove')}
                </Button>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor={`split-amount-${line.key}`}
                  className="text-sm font-medium"
                >
                  {t('transactions.amount')}
                </label>
                <AmountInput
                  id={`split-amount-${line.key}`}
                  value={line.amount}
                  currency={selectedAccount?.currency ?? 'HUF'}
                  language={language}
                  t={t}
                  errorKey="transactions.error.amount"
                  hintKey="transactions.amountHint"
                  disabled={busy}
                  onChange={(amount) =>
                    setForm({
                      ...form,
                      splitLines: form.splitLines!.map((candidate) =>
                        candidate.key === line.key
                          ? { ...candidate, amount }
                          : candidate,
                      ),
                    })
                  }
                />
              </div>
              <label className="block space-y-1 text-sm font-medium">
                {t('transactions.category')}
                <NativeSelect
                  value={line.categoryId}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      splitLines: form.splitLines!.map((candidate) =>
                        candidate.key === line.key
                          ? {
                              ...candidate,
                              categoryId: event.target.value,
                            }
                          : candidate,
                      ),
                    })
                  }
                >
                  <option value="">{t('transactions.noCategory')}</option>
                  {drawerCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentId ? `— ${category.name}` : category.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <div className="space-y-1">
                <label
                  htmlFor={`split-tag-${line.key}`}
                  className="text-sm font-medium"
                >
                  {t('tags.title')}
                </label>
                <div className="flex gap-2">
                  <Input
                    id={`split-tag-${line.key}`}
                    data-native-enter
                    list="transaction-tags"
                    value={line.pendingTagName}
                    maxLength={100}
                    disabled={busy}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        splitLines: form.splitLines!.map((candidate) =>
                          candidate.key === line.key
                            ? {
                                ...candidate,
                                pendingTagName: event.target.value,
                              }
                            : candidate,
                        ),
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addSplitTag(line.key)
                      }
                    }}
                  />
                  <Button
                    disabled={busy || !line.pendingTagName.trim()}
                    onClick={() => addSplitTag(line.key)}
                  >
                    {t('tags.add')}
                  </Button>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {line.tagNames.map((name, tagIndex) => (
                    <li
                      key={`${name}-${tagIndex}`}
                      className="inline-flex items-center rounded-md bg-muted px-2 text-sm"
                    >
                      {name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={busy}
                        aria-label={`${t('tags.remove')}: ${name}`}
                        onClick={() =>
                          setForm({
                            ...form,
                            splitLines: form.splitLines!.map((candidate) =>
                              candidate.key === line.key
                                ? {
                                    ...candidate,
                                    tagNames: candidate.tagNames.filter(
                                      (_, index) => index !== tagIndex,
                                    ),
                                  }
                                : candidate,
                            ),
                          })
                        }
                      >
                        <X aria-hidden="true" className="size-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
              <label className="block space-y-1 text-sm font-medium">
                {t('transactions.note')}
                <textarea
                  className="min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={line.note}
                  maxLength={1000}
                  disabled={busy}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      splitLines: form.splitLines!.map((candidate) =>
                        candidate.key === line.key
                          ? {
                              ...candidate,
                              note: event.target.value,
                            }
                          : candidate,
                      ),
                    })
                  }
                />
              </label>
            </section>
          ))}
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              setForm({
                ...form,
                splitLines: [...form.splitLines!, splitLine()],
              })
            }
          >
            {t('splits.addPart')}
          </Button>
        </div>
      )}
    </>
  )
}
