import { useState } from "react"
import { Link, Navigate, useParams } from "react-router"

import { Board } from "@/components/board/board"
import { DeleteTaskDialog } from "@/components/board/delete-task-dialog"
import { TaskDialog } from "@/components/board/task-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProject, useTasks } from "@/lib/queries"
import { TASK_STATUSES, type Task, type TaskStatus } from "@/types"

/**
 * Route entry. Everything downstream is derived from the URL, and the board is
 * keyed by id so switching projects remounts it — no dialog, no half-edited
 * task, and no drag state carries over from the project you just left.
 */
export default function ProjectPageRoute() {
  const { id } = useParams<{ id: string }>()

  if (id === undefined) {
    return <Navigate to="/projects" replace />
  }

  return <ProjectPage key={id} projectId={id} />
}

function ProjectPage({ projectId }: { projectId: string }) {
  const projectQuery = useProject(projectId)
  const tasksQuery = useTasks(projectId)

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [createStatus, setCreateStatus] = useState<TaskStatus>("TODO")
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const openCreate = (status: TaskStatus) => {
    setTaskToEdit(null)
    setCreateStatus(status)
    setIsTaskDialogOpen(true)
  }

  const openEdit = (task: Task) => {
    setTaskToEdit(task)
    setIsTaskDialogOpen(true)
  }

  const openDelete = (task: Task) => {
    setTaskToDelete(task)
    setIsDeleteOpen(true)
  }

  if (projectQuery.isError) {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-heading text-base font-medium">
          Project not found
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been deleted, or you may not have access to it.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    )
  }

  if (projectQuery.isPending || tasksQuery.isPending) {
    return <BoardSkeleton />
  }

  // Handled before reading `data`: in the error state there is none.
  if (tasksQuery.isError) {
    return (
      <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-heading text-base font-medium">
          Could not load tasks
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
      </div>
    )
  }

  const tasks = tasksQuery.data
  const doneCount = tasks.filter((task) => task.status === "DONE").length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-1 px-4 pt-5 pb-4">
        <h1 className="truncate font-heading text-xl font-medium tracking-tight">
          {projectQuery.data.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tasks.length === 1 ? "1 task" : `${String(tasks.length)} tasks`}
          {tasks.length > 0 && ` · ${String(doneCount)} done`}
        </p>
      </header>

      <div className="min-h-0 flex-1">
        <Board
          tasks={tasks}
          onAddTask={openCreate}
          onEditTask={openEdit}
          onDeleteTask={openDelete}
        />
      </div>

      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        projectId={projectId}
        task={taskToEdit ?? undefined}
        defaultStatus={createStatus}
      />
      <DeleteTaskDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        task={taskToDelete}
      />
    </div>
  )
}

/** Mirrors the loaded layout — same header block, same three columns. */
function BoardSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-hidden="true">
      <header className="flex flex-col gap-2 px-4 pt-5 pb-4">
        <Skeleton className="h-6 w-48 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-full" />
      </header>

      <div className="flex h-full gap-3 overflow-x-auto px-4 pb-4 md:gap-4 md:overflow-x-visible">
        {TASK_STATUSES.map((status, columnIndex) => (
          <div
            key={status}
            className="flex w-72 shrink-0 flex-col rounded-4xl bg-muted/40 md:w-auto md:flex-1"
          >
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <div className="flex flex-col gap-2 p-2 pt-0">
              {Array.from({ length: 3 - columnIndex }, (_, cardIndex) => (
                <Skeleton key={cardIndex} className="h-20 rounded-3xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
