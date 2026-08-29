import type { TaskStatus } from "@/types"

/**
 * Droppable ids are namespaced so a drop on empty column space is
 * distinguishable from a drop on a card, whose id is the task's own.
 *
 * Kept out of column.tsx so that file exports only its component and fast
 * refresh keeps working on it.
 */
const COLUMN_ID_PREFIX = "column:"

export function columnDroppableId(status: TaskStatus): string {
  return `${COLUMN_ID_PREFIX}${status}`
}

export function parseColumnDroppableId(id: string): TaskStatus | null {
  if (!id.startsWith(COLUMN_ID_PREFIX)) return null
  const status = id.slice(COLUMN_ID_PREFIX.length)
  return status === "TODO" || status === "IN_PROGRESS" || status === "DONE"
    ? status
    : null
}
