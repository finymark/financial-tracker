import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import {
  categoryKinds,
  type Category,
  type CategoryKind,
} from '../../../shared/categories'
import type { MessageKey } from '../i18n'
import { Button } from './ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Input } from './ui/input'
import { NativeSelect } from './ui/native-select'

const errorKeys = [
  'categories.error.name',
  'categories.error.kind',
  'categories.error.notFound',
  'categories.error.parent',
  'categories.error.order',
  'categories.error.children',
  'categories.error.replacementRequired',
  'categories.error.replacement',
] as const satisfies readonly MessageKey[]

interface CategorySettingsProps {
  disabled: boolean
  t(key: MessageKey): string
  onBusyChange(busy: boolean): void
  onChanged(): void
}

type Editing = { id: string; kind: 'rename' | 'delete' } | null

export function CategorySettings({
  disabled,
  t,
  onBusyChange,
  onChanged,
}: CategorySettingsProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [parentId, setParentId] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [newName, setNewName] = useState('')
  const [replacementId, setReplacementId] = useState('')
  const locked = disabled || busy || loading
  const categoryName = (category: Category) =>
    category.customName ??
    (category.translationKey ? t(category.translationKey) : category.name)
  const active = (category: Category) =>
    !category.archived &&
    (category.parentId === null ||
      !categories.find((parent) => parent.id === category.parentId)?.archived)

  useEffect(() => {
    let ignore = false
    void window.app.categories
      .list()
      .then((next) => {
        if (!ignore) setCategories(next)
      })
      .catch(() => {
        if (!ignore) setError('categories.error')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  async function run(action: () => Promise<unknown>, offerUndo = true) {
    setBusy(true)
    onBusyChange(true)
    setError(null)
    try {
      await action()
      setCategories(await window.app.categories.list())
      setEditing(null)
      if (offerUndo) onChanged()
    } catch (error) {
      setError(
        errorKeys.find((key) => String(error).includes(key)) ??
          'categories.error',
      )
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  function submitCreate(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      await window.app.categories.create({
        name,
        kind,
        parentId: parentId || null,
      })
      setName('')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('categories.title')}</CardTitle>
        <CardDescription>{t('categories.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-error">{t(error)}</p>
            <Button
              variant="ghost"
              disabled={locked}
              onClick={() => void run(async () => {}, false)}
            >
              {t('categories.refresh')}
            </Button>
          </div>
        )}
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t('categories.loading')}
          </p>
        ) : (
          categoryKinds.map((groupKind) => (
            <section
              key={groupKind}
              className="space-y-3"
              aria-labelledby={`categories-${groupKind}`}
            >
              <h3 id={`categories-${groupKind}`} className="font-semibold">
                {t(`categories.${groupKind}`)}
              </h3>
              <ul className="space-y-2">
                {categories
                  .filter((category) => category.kind === groupKind)
                  .map((category) => {
                    const siblings = categories.filter(
                      (sibling) =>
                        sibling.kind === category.kind &&
                        sibling.parentId === category.parentId,
                    )
                    const position = siblings.findIndex(
                      (sibling) => sibling.id === category.id,
                    )
                    const hasChildren = categories.some(
                      (child) => child.parentId === category.id,
                    )
                    const replacements = categories.filter(
                      (candidate) =>
                        candidate.kind === category.kind &&
                        candidate.id !== category.id &&
                        active(candidate),
                    )
                    return (
                      <li
                        key={category.id}
                        className={`space-y-3 rounded-lg border p-3 ${category.parentId ? 'ml-6' : ''}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words font-medium">
                              {categoryName(category)}
                            </p>
                            {!active(category) && (
                              <p className="text-sm text-muted-foreground">
                                {t('categories.archived')}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={locked || position === 0}
                              title={t('categories.up')}
                              aria-label={`${t('categories.up')}: ${categoryName(category)}`}
                              onClick={() =>
                                void run(() =>
                                  window.app.categories.reorder({
                                    id: category.id,
                                    sortOrder: position - 1,
                                  }),
                                )
                              }
                            >
                              <ArrowUp aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={
                                locked || position === siblings.length - 1
                              }
                              title={t('categories.down')}
                              aria-label={`${t('categories.down')}: ${categoryName(category)}`}
                              onClick={() =>
                                void run(() =>
                                  window.app.categories.reorder({
                                    id: category.id,
                                    sortOrder: position + 1,
                                  }),
                                )
                              }
                            >
                              <ArrowDown aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={locked}
                              onClick={() => {
                                setNewName(categoryName(category))
                                setEditing({ id: category.id, kind: 'rename' })
                              }}
                            >
                              {t('categories.rename')}
                            </Button>
                            {!category.archived ? (
                              <Button
                                variant="ghost"
                                disabled={locked}
                                onClick={() =>
                                  void run(() =>
                                    window.app.categories.archive({
                                      id: category.id,
                                    }),
                                  )
                                }
                              >
                                {t('categories.archive')}
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                disabled={locked}
                                onClick={() =>
                                  void run(() =>
                                    window.app.categories.unarchive({
                                      id: category.id,
                                    }),
                                  )
                                }
                              >
                                {t('categories.unarchive')}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              disabled={locked || hasChildren}
                              onClick={() => {
                                setReplacementId('')
                                setEditing({ id: category.id, kind: 'delete' })
                              }}
                            >
                              {t('categories.delete')}
                            </Button>
                          </div>
                        </div>
                        {hasChildren && (
                          <p className="text-xs text-muted-foreground">
                            {t('categories.error.children')}
                          </p>
                        )}
                        {editing?.id === category.id && (
                          <form
                            className="space-y-3 rounded-lg bg-muted p-3"
                            onSubmit={(event) => {
                              event.preventDefault()
                              void run(() =>
                                editing.kind === 'rename'
                                  ? window.app.categories.rename({
                                      id: category.id,
                                      name: newName,
                                    })
                                  : window.app.categories.delete({
                                      id: category.id,
                                      ...(replacementId
                                        ? { replacementId }
                                        : {}),
                                    }),
                              )
                            }}
                          >
                            {editing.kind === 'rename' ? (
                              <>
                                <label
                                  htmlFor={`rename-category-${category.id}`}
                                  className="text-sm font-medium"
                                >
                                  {t('categories.name')}
                                </label>
                                <Input
                                  id={`rename-category-${category.id}`}
                                  value={newName}
                                  maxLength={100}
                                  required
                                  autoFocus
                                  disabled={locked}
                                  onChange={(event) =>
                                    setNewName(event.target.value)
                                  }
                                />
                              </>
                            ) : (
                              <>
                                <p className="text-sm">
                                  {t('categories.deleteConfirmation')}{' '}
                                  <strong>{categoryName(category)}</strong>
                                </p>
                                <label
                                  htmlFor={`replacement-${category.id}`}
                                  className="text-sm font-medium"
                                >
                                  {t('categories.replacement')}
                                </label>
                                <NativeSelect
                                  id={`replacement-${category.id}`}
                                  value={replacementId}
                                  required={category.hasTransactions}
                                  disabled={locked}
                                  onChange={(event) =>
                                    setReplacementId(event.target.value)
                                  }
                                >
                                  <option value="">
                                    {t(
                                      category.hasTransactions
                                        ? 'categories.chooseReplacement'
                                        : 'categories.noReplacement',
                                    )}
                                  </option>
                                  {replacements.map((candidate) => (
                                    <option
                                      key={candidate.id}
                                      value={candidate.id}
                                    >
                                      {candidate.parentId
                                        ? `${categoryName(categories.find((parent) => parent.id === candidate.parentId)!)} → `
                                        : ''}
                                      {categoryName(candidate)}
                                    </option>
                                  ))}
                                </NativeSelect>
                                {category.hasTransactions && (
                                  <p className="text-sm text-muted-foreground">
                                    {t('categories.error.replacementRequired')}
                                  </p>
                                )}
                              </>
                            )}
                            <div className="flex gap-2">
                              <Button
                                type="submit"
                                disabled={
                                  locked ||
                                  (editing.kind === 'delete' &&
                                    category.hasTransactions &&
                                    !replacementId)
                                }
                              >
                                {t(
                                  editing.kind === 'delete'
                                    ? 'categories.confirmDelete'
                                    : 'categories.save',
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={locked}
                                onClick={() => setEditing(null)}
                              >
                                {t('categories.cancel')}
                              </Button>
                            </div>
                          </form>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </section>
          ))
        )}
        <section
          className="space-y-3 border-t pt-6"
          aria-labelledby="create-category-title"
        >
          <h3 id="create-category-title" className="font-semibold">
            {t('categories.create')}
          </h3>
          <form className="space-y-4" onSubmit={submitCreate}>
            <div className="space-y-2">
              <label htmlFor="category-name" className="text-sm font-medium">
                {t('categories.name')}
              </label>
              <Input
                id="category-name"
                value={name}
                maxLength={100}
                required
                disabled={locked}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="category-kind" className="text-sm font-medium">
                  {t('categories.kind')}
                </label>
                <NativeSelect
                  id="category-kind"
                  value={kind}
                  disabled={locked}
                  onChange={(event) => {
                    const selected = categoryKinds.find(
                      (kind) => kind === event.target.value,
                    )
                    if (selected) {
                      setKind(selected)
                      setParentId('')
                    }
                  }}
                >
                  {categoryKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`categories.${kind}`)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="category-parent"
                  className="text-sm font-medium"
                >
                  {t('categories.parent')}
                </label>
                <NativeSelect
                  id="category-parent"
                  value={parentId}
                  disabled={locked}
                  onChange={(event) => setParentId(event.target.value)}
                >
                  <option value="">{t('categories.main')}</option>
                  {categories
                    .filter(
                      (category) =>
                        category.kind === kind &&
                        category.parentId === null &&
                        active(category),
                    )
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {categoryName(category)}
                      </option>
                    ))}
                </NativeSelect>
              </div>
            </div>
            <Button type="submit" disabled={locked || !name.trim()}>
              {t('categories.create')}
            </Button>
          </form>
        </section>
      </CardContent>
    </Card>
  )
}
