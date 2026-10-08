import type Database from 'better-sqlite3'
import type { Attachment, StagedAttachment } from '../../shared/attachments'
import {
  getAttachment,
  insertAttachment,
  removeAttachment,
  restoreAttachment,
} from './profile-attachments'
import type { UndoableCommand } from './undo-history'

export function attachAttachmentUndoableCommand(
  database: Database.Database,
  transactionId: string,
  attachment: StagedAttachment,
  directory: string,
  clock: () => Date,
): UndoableCommand<null, Attachment, Attachment> {
  return {
    captureBefore: () => null,
    execute: () =>
      insertAttachment(database, transactionId, attachment, directory, clock),
    captureAfter: (result) => result,
    restoreBefore: (_before, after) => removeAttachment(database, after.id),
  }
}

export function removeAttachmentUndoableCommand(
  database: Database.Database,
  id: string,
): UndoableCommand<Attachment, null, void> {
  return {
    captureBefore: () => getAttachment(database, id),
    execute: () => removeAttachment(database, id),
    captureAfter: () => null,
    restoreBefore: (before) => restoreAttachment(database, before),
  }
}
