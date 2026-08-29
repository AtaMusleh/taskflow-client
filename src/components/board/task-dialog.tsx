import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, parseISO } from "date-fns"
import { CalendarIcon, Loader2Icon, XIcon } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCreateTask, useUpdateTask } from "@/lib/queries"
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type CreateTaskRequest,
  type Task,
  type TaskStatus,
} from "@/types"

const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or fewer"),
  description: z.string().trim().max(2000, "Description is too long"),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  dueDate: z.date().nullable(),
})

type TaskValues = z.infer<typeof taskSchema>

/**
 * How the API wants an empty optional field, which differs by direction:
 *
 * - creating: omit the key entirely. `undefined` is dropped by
 *   `JSON.stringify`, so the field never reaches the wire.
 * - editing: send `null`, which the API reads as "clear this field". Omitting
 *   it would instead mean "leave it as it was", so a cleared description would
 *   silently survive the save.
 *
 * Whitespace-only input counts as empty.
 */
function optionalText(
  value: string,
  isEditing: boolean,
): string | null | undefined {
  const trimmed = value.trim()
  if (trimmed.length > 0) return trimmed
  return isEditing ? null : undefined
}

function optionalDate(
  value: Date | null,
  isEditing: boolean,
): string | null | undefined {
  if (value !== null) return format(value, "yyyy-MM-dd")
  return isEditing ? null : undefined
}

interface TaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  /** The task being edited, or undefined to create a new one. */
  task?: Task
  /** Which column the "add" button was pressed in. Create mode only. */
  defaultStatus?: TaskStatus
}

/** Serves both create and edit; `task` decides which. */
export function TaskDialog({
  open,
  onOpenChange,
  projectId,
  task,
  defaultStatus = "TODO",
}: TaskDialogProps) {
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

  const isEditing = task !== undefined
  const isPending = createTask.isPending || updateTask.isPending

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: defaultStatus,
      priority: "MEDIUM",
      dueDate: null,
    },
  })

  useEffect(() => {
    if (!open) return
    reset({
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? defaultStatus,
      priority: task?.priority ?? "MEDIUM",
      dueDate:
        task?.dueDate !== undefined && task.dueDate !== null
          ? parseISO(task.dueDate)
          : null,
    })
  }, [open, task, defaultStatus, reset])

  const onSubmit = handleSubmit(async (values) => {
    const input = {
      title: values.title,
      status: values.status,
      priority: values.priority,
      description: optionalText(values.description, isEditing),
      dueDate: optionalDate(values.dueDate, isEditing),
    } satisfies CreateTaskRequest

    try {
      if (isEditing) {
        await updateTask.mutateAsync({ taskId: task.id, projectId, input })
      } else {
        await createTask.mutateAsync({ projectId, input })
      }
      onOpenChange(false)
    } catch {
      // Toasted by the mutation; keep the dialog open with the input intact.
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details of this task."
              : "Add a task to this project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              autoFocus
              maxLength={200}
              placeholder="Write the launch announcement"
              aria-invalid={errors.title !== undefined}
              aria-describedby={
                errors.title !== undefined ? "task-title-error" : undefined
              }
              {...register("title")}
            />
            {errors.title !== undefined && (
              <p id="task-title-error" className="text-xs text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              rows={3}
              placeholder="Optional details"
              {...register("description")}
            />
            {errors.description !== undefined && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-status">Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {TASK_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {TASK_PRIORITY_LABELS[priority]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="task-due-date">Due date</Label>
            <Controller
              control={control}
              name="dueDate"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="task-due-date"
                        type="button"
                        variant="outline"
                        className="flex-1 justify-start font-normal"
                      >
                        <CalendarIcon data-icon="inline-start" />
                        {field.value !== null
                          ? format(field.value, "PPP")
                          : "No due date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        autoFocus
                        selected={field.value ?? undefined}
                        onSelect={(date) => {
                          field.onChange(date ?? null)
                        }}
                      />
                    </PopoverContent>
                  </Popover>

                  {field.value !== null && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        field.onChange(null)
                      }}
                    >
                      <XIcon />
                      <span className="sr-only">Clear due date</span>
                    </Button>
                  )}
                </div>
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              {isEditing ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
