import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { PlusIcon } from "lucide-react"

import { columnDroppableId } from "@/components/board/droppable-id"
import { TaskCard } from "@/components/board/task-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TASK_STATUS_LABELS, type Task, type TaskStatus } from "@/types"

interface ColumnProps {
  status: TaskStatus
  tasks: Task[]
  /** True while a card is hovering anywhere over this column. */
  isOver: boolean
  onAddTask: (status: TaskStatus) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (task: Task) => void
}

export function Column({
  status,
  tasks,
  isOver,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: columnDroppableId(status) })

  return (
    <section
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-4xl bg-muted/40 transition-colors md:w-auto md:flex-1",
        isOver && "bg-muted",
      )}
      aria-label={TASK_STATUS_LABELS[status]}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h2 className="text-sm font-medium">{TASK_STATUS_LABELS[status]}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={() => {
            onAddTask(status)
          }}
        >
          <PlusIcon />
          <span className="sr-only">
            Add task to {TASK_STATUS_LABELS[status]}
          </span>
        </Button>
      </header>

      {/* The droppable is the scroll body, so the whole column accepts a drop,
          not just the cards in it. */}
      <div
        ref={setNodeRef}
        className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0"
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-3xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground transition-colors",
              isOver && "border-foreground/20 text-foreground",
            )}
          >
            {isOver ? "Drop here" : "No tasks"}
          </div>
        )}
      </div>
    </section>
  )
}
