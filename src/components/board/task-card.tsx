import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { endOfDay, format, isPast, parseISO } from "date-fns"
import {
  CalendarIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isOptimisticId } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { TASK_PRIORITY_LABELS, type Task, type TaskPriority } from "@/types"

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  HIGH: "bg-rose-500/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
}

interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

/** The draggable card in a column. */
export function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  // A card created optimistically has no server id yet, so it cannot be moved
  // or edited until the real one arrives.
  const isPending = isOptimisticId(task.id)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isPending })

  return (
    <TaskCardView
      task={task}
      onEdit={onEdit}
      onDelete={onDelete}
      showActions={!isPending}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        // Cards fade in as they arrive — on load, on create, and when a filter
        // stops hiding them.
        "animate-in fade-in slide-in-from-bottom-1 duration-200",
        "focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
        // The original stays in place at low opacity as a gap marker while the
        // DragOverlay copy follows the cursor.
        isDragging && "opacity-40",
        isPending && "animate-pulse opacity-60",
      )}
      {...attributes}
      {...listeners}
    />
  )
}

/** The same card inside a DragOverlay: no sortable wiring, lifted shadow. */
export function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <TaskCardView
      task={task}
      className="cursor-grabbing shadow-lg ring-foreground/10"
      showActions={false}
    />
  )
}

interface TaskCardViewProps extends React.ComponentProps<"div"> {
  task: Task
  onEdit?: (task: Task) => void
  onDelete?: (task: Task) => void
  showActions?: boolean
}

function TaskCardView({
  task,
  onEdit,
  onDelete,
  showActions = true,
  className,
  ...props
}: TaskCardViewProps) {
  const dueDate = task.dueDate !== null ? parseISO(task.dueDate) : null
  // A task due today is not late until the day is over, and a finished task is
  // never late.
  const isOverdue =
    dueDate !== null && task.status !== "DONE" && isPast(endOfDay(dueDate))

  return (
    <div
      className={cn(
        "group/card flex touch-none flex-col gap-2 rounded-3xl bg-card p-3 text-left shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10",
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm leading-snug font-medium">{task.title}</p>

        {showActions && onEdit !== undefined && onDelete !== undefined && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="-mt-0.5 -mr-1 shrink-0 opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                // Keep the pointer sensor from claiming this gesture as a drag.
                onPointerDown={(event) => {
                  event.stopPropagation()
                }}
              >
                <MoreHorizontalIcon />
                <span className="sr-only">Actions for {task.title}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  onEdit(task)
                }}
              >
                <PencilIcon />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  onDelete(task)
                }}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {task.description !== null && task.description.length > 0 && (
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Badge
          className={cn("rounded-full px-2 py-0.5 text-[11px]", PRIORITY_STYLES[task.priority])}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>

        {dueDate !== null && (
          <span
            className={cn(
              "flex items-center gap-1 text-[11px] text-muted-foreground",
              isOverdue && "text-destructive",
            )}
          >
            <CalendarIcon className="size-3" aria-hidden="true" />
            <time dateTime={task.dueDate ?? undefined}>
              {format(dueDate, "MMM d")}
            </time>
            {isOverdue && <span className="sr-only">(overdue)</span>}
          </span>
        )}
      </div>
    </div>
  )
}
