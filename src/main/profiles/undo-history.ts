import type Database from 'better-sqlite3'

/**
 * Declares one command's aggregate boundary to the undo mechanism.
 *
 * Future command families plug in here by capturing their affected aggregate
 * before and after the write and by defining how to restore the before-image.
 * Capture, execute, and restore all run inside the supplied SQLite transaction;
 * the history itself deliberately knows nothing about tables or domain shapes.
 */
export interface UndoableCommand<BeforeImage, AfterImage, Result> {
  captureBefore(): BeforeImage
  execute(): Result
  captureAfter(result: Result, before: BeforeImage): AfterImage
  restoreBefore(before: BeforeImage, after: AfterImage): void
}

interface UndoEntry {
  restore(): void
}

export class UndoHistory {
  readonly #entries: UndoEntry[] = []

  execute<BeforeImage, AfterImage, Result>(
    database: Database.Database,
    command: UndoableCommand<BeforeImage, AfterImage, Result>,
  ): Result {
    const completed = database.transaction(() => {
      const before = command.captureBefore()
      const result = command.execute()
      const after = command.captureAfter(result, before)
      return { before, result, after }
    })()
    this.#entries.push({
      restore: () => command.restoreBefore(completed.before, completed.after),
    })
    return completed.result
  }

  undoLast(database: Database.Database): boolean {
    const entry = this.#entries.at(-1)
    if (!entry) return false
    database.transaction(() => entry.restore())()
    this.#entries.pop()
    return true
  }

  clear(): void {
    this.#entries.length = 0
  }
}
