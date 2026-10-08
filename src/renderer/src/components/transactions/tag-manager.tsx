import { useState } from 'react'
import type { Tag } from '../../../../shared/tags'
import type { MessageKey } from '../../i18n'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { HelpHint } from '../ui/help-hint'
import type { RunCommand } from './transaction-form'

interface TagManagerProps {
  revision: number
  tags: Tag[]
  busy: boolean
  loading: boolean
  t(key: MessageKey): string
  run: RunCommand
  onDeleted(id: string): void
}

export function TagManager({
  revision,
  tags,
  busy,
  loading,
  t,
  run,
  onDeleted,
}: TagManagerProps) {
  const [renamingTag, setRenamingTag] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null)
  const [previousRevision, setPreviousRevision] = useState(revision)
  if (revision !== previousRevision) {
    setPreviousRevision(revision)
    setRenamingTag(null)
    setDeletingTag(null)
  }
  return (
    <details className="space-y-3 rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {t('tags.manage')}
      </summary>
      <div className="flex items-center gap-1 text-sm font-medium">
        {t('tags.title')}
        <HelpHint
          t={t}
          topicKey="tags.title"
          textKey="help.transactions.tags"
        />
      </div>
      {tags.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('tags.empty')}</p>
      )}
      <ul className="space-y-2">
        {tags.map((tag) => (
          <li
            key={tag.id}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <span className="mr-auto">{tag.name}</span>
            <Button
              variant="ghost"
              disabled={busy || loading}
              onClick={() => {
                setRenamingTag({ id: tag.id, name: tag.name })
                setDeletingTag(null)
              }}
            >
              {t('tags.rename')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy || loading}
              onClick={() => {
                setDeletingTag(tag)
                setRenamingTag(null)
              }}
            >
              {t('tags.delete')}
            </Button>
          </li>
        ))}
      </ul>
      {renamingTag && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void run(() => window.app.tags.rename(renamingTag), true)
          }}
        >
          <label className="space-y-1 text-sm">
            {t('tags.name')}
            <Input
              value={renamingTag.name}
              maxLength={100}
              required
              disabled={busy}
              onChange={(event) =>
                setRenamingTag({ ...renamingTag, name: event.target.value })
              }
            />
          </label>
          <Button type="submit" disabled={busy}>
            {t('tags.save')}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setRenamingTag(null)}
          >
            {t('transactions.cancel')}
          </Button>
        </form>
      )}
      {deletingTag && (
        <section role="alert" className="space-y-2 rounded-md bg-muted p-3">
          <p className="text-sm">
            {t('tags.deleteConfirmation')} <strong>{deletingTag.name}</strong>
          </p>
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await window.app.tags.delete({ id: deletingTag.id })
                  onDeleted(deletingTag.id)
                }, true)
              }
            >
              {t('tags.delete')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDeletingTag(null)}
            >
              {t('transactions.cancel')}
            </Button>
          </div>
        </section>
      )}
    </details>
  )
}
