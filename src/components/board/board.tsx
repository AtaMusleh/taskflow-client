import { useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"

import { Column } from "@/components/board/column"
import { parseColumnDroppableId } from "@/components/board/droppable-id"
import { TaskCardOverlay } from "@/components/board/task-card"
import { useMoveTask } from "@/lib/queries"
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type Task,
  type TaskStatus,
} from "@/types"

type ColumnMap = Record<TaskStatus, Task[]>

function emptyColumns(): ColumnMap {
  return { TODO: [], IN_PROGRESS: [], DONE: [] }
}

/** Server order is `position` within a status; the array order is incidental. */
function groupByStatus(tasks: Task[]): ColumnMap {
  const columns = emptyColumns()
  for (const task of tasks) {
    columns[task.status].push(task)
  }
  for (const status of TASK_STATUSES) {
    columns[status].sort((a, b) => a.position - b.position)
  }
  return columns
}

function findStatusOf(taskId: string, columns: ColumnMap): TaskStatus | null {
  for (const status of TASK_STATUSES) {
    if (columns[status].some((task) => task.id === taskId)) return status
  }
  return null
}

/** A drop target is either a column's own id or a card sitting in one. */
function resolveStatus(overId: string, columns: ColumnMap): TaskStatus | null {
  return parseColumnDroppableId(overId) ?? findStatusOf(overId, columns)
}

/** Read out when a card receives focus, before any drag begins. */
const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "To pick up a task, press Space or Enter. While dragging, use the arrow " +
    "keys to move it within its column or across to another. Press Space or " +
    "Enter again to drop it, or Escape to cancel.",
}

interface BoardProps {
  tasks: Task[]
  onAddTask: (status: TaskStatus) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (task: Task) => void
}

export function Board({
  tasks,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: BoardProps) {
  const moveTask = useMoveTask()

  const serverColumns = useMemo(() => groupByStatus(tasks), [tasks])

  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null)
  /**
   * A working copy held only for the duration of a drag. dnd-kit animates
   * reordering *within* a column on its own, but moving a card to another
   * column needs the card to actually appear there — so that one case is
   * previewed here. Cleared on drop, when the optimistic cache update takes
   * over.
   */
  const [dragColumns, setDragColumns] = useState<ColumnMap | null>(null)

  const columns = dragColumns ?? serverColumns

  const sensors = useSensors(
    // A few pixels of slop, so a click on a card's menu stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Announcements fire mid-drag, so they read the current board from a ref
  // rather than closing over the render that created them.
  const boardRef = useRef({ columns, tasks })
  useEffect(() => {
    boardRef.current = { columns, tasks }
  })

  const announcements = useMemo<Announcements>(() => {
    const titleOf = (id: string): string =>
      boardRef.current.tasks.find((task) => task.id === id)?.title ?? "task"

    const columnOf = (id: string | undefined): string | null => {
      if (id === undefined) return null
      const status = resolveStatus(id, boardRef.current.columns)
      return status === null ? null : TASK_STATUS_LABELS[status]
    }

    const positionIn = (id: string): string => {
      const status = resolveStatus(id, boardRef.current.columns)
      if (status === null) return ""
      const column = boardRef.current.columns[status]
      const index = column.findIndex((task) => task.id === id)
      if (index === -1) return ""
      return ` at position ${String(index + 1)} of ${String(column.length)}`
    }

    return {
      onDragStart: ({ active }) =>
        `Picked up ${titleOf(String(active.id))}.`,
      onDragOver: ({ active, over }) => {
        const column = columnOf(over === null ? undefined : String(over.id))
        if (column === null) return undefined
        return `${titleOf(String(active.id))} is over ${column}.`
      },
      onDragEnd: ({ active, over }) => {
        const activeId = String(active.id)
        const column = columnOf(over === null ? undefined : String(over.id))
        if (column === null) {
          return `${titleOf(activeId)} was dropped outside a column and returned to its place.`
        }
        return `${titleOf(activeId)} was dropped in ${column}${positionIn(activeId)}.`
      },
      onDragCancel: ({ active }) =>
        `Move cancelled. ${titleOf(String(active.id))} returned to where it was.`,
    }
  }, [])

  const resetDrag = () => {
    setActiveTask(null)
    setOverStatus(null)
    setDragColumns(null)
  }

  const onDragStart = (event: DragStartEvent) => {
    const task = tasks.find((item) => item.id === String(event.active.id))
    if (task === undefined) return
    setActiveTask(task)
    setOverStatus(task.status)
    setDragColumns(serverColumns)
  }

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (over === null) return

    const activeId = String(active.id)
    const overId = String(over.id)

    const targetStatus = resolveStatus(overId, columns)
    if (targetStatus === null) return
    setOverStatus(targetStatus)

    const sourceStatus = findStatusOf(activeId, columns)
    if (sourceStatus === null || sourceStatus === targetStatus) return

    const moving = columns[sourceStatus].find((task) => task.id === activeId)
    if (moving === undefined) return

    const overIndex = columns[targetStatus].findIndex(
      (task) => task.id === overId,
    )
    const insertIndex =
      overIndex >= 0 ? overIndex : columns[targetStatus].length

    const nextTarget = [...columns[targetStatus]]
    nextTarget.splice(insertIndex, 0, { ...moving, status: targetStatus })

    setDragColumns({
      ...columns,
      [sourceStatus]: columns[sourceStatus].filter(
        (task) => task.id !== activeId,
      ),
      [targetStatus]: nextTarget,
    })
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const task = activeTask
    const previewColumns = columns

    resetDrag()

    if (task === undefined || task === null || over === null) return

    const overId = String(over.id)
    const targetStatus = resolveStatus(overId, previewColumns)
    if (targetStatus === null) return

    // Neighbours are read from the column without the moved card in it, so the
    // indices describe where it lands rather than where it came from.
    const neighbours = previewColumns[targetStatus].filter(
      (item) => item.id !== task.id,
    )

    let insertIndex: number
    if (overId === task.id) {
      // Hovering its own preview slot: take the slot the preview gave it.
      const previewIndex = previewColumns[targetStatus].findIndex(
        (item) => item.id === task.id,
      )
      insertIndex = previewIndex >= 0 ? previewIndex : neighbours.length
    } else {
      const overIndex = neighbours.findIndex((item) => item.id === overId)
      if (overIndex === -1) {
        // Dropped on the column body rather than a card: append.
        insertIndex = neighbours.length
      } else {
        // Above or below the card under the cursor, by their midpoints.
        const activeRect = active.rect.current.translated
        const isBelow =
          activeRect !== null &&
          activeRect.top + activeRect.height / 2 >
            over.rect.top + over.rect.height / 2
        insertIndex = isBelow ? overIndex + 1 : overIndex
      }
    }

    const before = neighbours[insertIndex - 1]
    const after = neighbours[insertIndex]

    // Compare against server truth, not the preview: dropping a card back where
    // it started should not cost a request.
    const source = serverColumns[task.status]
    const sourceIndex = source.findIndex((item) => item.id === task.id)
    const unchanged =
      targetStatus === task.status &&
      before?.id === source[sourceIndex - 1]?.id &&
      after?.id === source[sourceIndex + 1]?.id
    if (unchanged) return

    moveTask.mutate({
      task,
      status: targetStatus,
      beforeId: before?.id,
      afterId: after?.id,
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={resetDrag}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      {/* Below md the columns keep their width and the row scrolls, so all
          three stay reachable on a 375px screen. */}
      <div className="relative flex h-full min-h-[65svh] snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 lg:snap-none lg:gap-4 lg:overflow-x-visible">
        {TASK_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={columns[status]}
            isOver={activeTask !== null && overStatus === status}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask !== null && <TaskCardOverlay task={activeTask} />}
      </DragOverlay>
    </DndContext>
  )
}
