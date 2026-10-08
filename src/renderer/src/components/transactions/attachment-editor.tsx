import { ExternalLink, FileImage, FileText, Paperclip, X } from 'lucide-react'
import type {
  Attachment,
  StagedAttachment,
} from '../../../../shared/attachments'
import type { MessageKey } from '../../i18n'
import { HelpHint } from '../ui/help-hint'
import { Button } from '../ui/button'

type DisplayAttachment = Attachment | StagedAttachment

interface AttachmentEditorProps {
  attachments: DisplayAttachment[]
  busy: boolean
  t(key: MessageKey): string
  onAdd(paths: string[]): void
  onError(error: unknown): void
  onRemove(attachment: DisplayAttachment): void
  onOpen(attachment: DisplayAttachment): void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentEditor({
  attachments,
  busy,
  t,
  onAdd,
  onError,
  onRemove,
  onOpen,
}: AttachmentEditorProps) {
  return (
    <section className="space-y-3" aria-labelledby="attachments-title">
      <div className="flex items-center justify-between gap-2">
        <h3
          id="attachments-title"
          className="flex items-center gap-1 text-sm font-medium"
        >
          {t('attachments.title')}
          <HelpHint
            t={t}
            topicKey="attachments.title"
            textKey="help.transactions.attachments"
          />
        </h3>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            void window.app.attachments.pick().then(onAdd).catch(onError)
          }}
        >
          <Paperclip aria-hidden="true" />
          {t('attachments.add')}
        </Button>
      </div>
      <div
        data-transaction-attachment-drop-zone
        className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground"
        onDragEnter={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (busy) return
          onAdd(
            [...event.dataTransfer.files]
              .map((file) => window.app.files.path(file))
              .filter(Boolean),
          )
        }}
      >
        {t('attachments.drop')}
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('attachments.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((attachment, index) => (
            <li
              key={
                'id' in attachment
                  ? attachment.id
                  : `${attachment.storedName}-${index}`
              }
              className="flex items-center gap-2 rounded-md border p-2 text-sm"
            >
              {attachment.mediaType === 'application/pdf' ? (
                <FileText aria-hidden="true" />
              ) : (
                <FileImage aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {attachment.originalFileName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatSize(attachment.byteSize)} · {attachment.mediaType}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={`${t('attachments.open')}: ${attachment.originalFileName}`}
                onClick={() => onOpen(attachment)}
              >
                <ExternalLink aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={`${t('attachments.remove')}: ${attachment.originalFileName}`}
                onClick={() => onRemove(attachment)}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
