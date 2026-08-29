import { useMemo, useState } from "react"
import { ListChecksIcon, PlusIcon, SearchXIcon, WifiOffIcon } from "lucide-react"
import { Link, Navigate, useParams } from "react-router"

import { Board } from "@/components/board/board"
import { DeleteTaskDialog } from "@/components/board/delete-task-dialog"
import { FilterBar } from "@/components/board/filter-bar"
import { TaskDialog } from "@/components/board/task-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isApiError } from "@/lib/api"
import { useProject, useTasks } from "@/lib/queries"
import { filterTasks } from "@/lib/task-filters"
import { useDocumentTitle } from "@/lib/use-document-title"
import { useTaskFilters } from "@/lib/use-task-filters"
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
  const { filters, updateFilters, clearFilters, activeCount, isFiltered } =
    useTaskFilters()

  useDocumentTitle(projectQuery.data?.name)

  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [createStatus, setCreateStatus] = useState<TaskStatus>("TODO")
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const allTasks = tasksQuery.data
  // Computed before any early return so the hook order never changes.
  const visibleTasks = useMemo(
    () => (allTasks === undefined ? [] : filterTasks(allTasks, filters)),
    [allTasks, filters],
  )

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
    // A missing project is a dead end; anything else is worth another attempt.
    const status = isApiError(projectQuery.error)
      ? projectQuery.error.response?.status
      : undefined

    if (status === 404 || status === 403) {
      return (
        <CenteredState
          title="Project not found"
          description="It may have been deleted, or you may not have access to it."
        >
          <Button asChild variant="outline" className="mt-2">
            <Link to="/projects">Back to projects</Link>
          </Button>
        </CenteredState>
      )
    }

    return (
      <CenteredState
        icon={<WifiOffIcon className="size-5 text-muted-foreground" />}
        title="Can't reach the server"
        description="The project could not be loaded. Check your connection and try again."
      >
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => {
            void projectQuery.refetch()
          }}
        >
          Try again
        </Button>
      </CenteredState>
    )
  }

  if (projectQuery.isPending || tasksQuery.isPending) {
    return <BoardSkeleton />
  }

  // Handled before reading `data`: in the error state there is none.
  if (tasksQuery.isError) {
    return (
      <CenteredState
        icon={<WifiOffIcon className="size-5 text-muted-foreground" />}
        title="Can't load these tasks"
        description="The board could not be loaded. Check your connection and try again."
      >
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => {
            void tasksQuery.refetch()
          }}
        >
          Try again
        </Button>
      </CenteredState>
    )
  }

  const tasks = tasksQuery.data
  const doneCount = tasks.filter((task) => task.status === "DONE").length
  const hasTasks = tasks.length > 0
  const hasMatches = visibleTasks.length > 0

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex flex-col gap-1 px-4 pt-5 pb-4">
        <h1 className="truncate font-heading text-xl font-medium tracking-tight">
          {projectQuery.data.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tasks.length === 1 ? "1 task" : `${String(tasks.length)} tasks`}
          {hasTasks && ` · ${String(doneCount)} done`}
        </p>
      </header>

      {/* No filters to offer until there is something to filter. */}
      {hasTasks && (
        <FilterBar
          filters={filters}
          updateFilters={updateFilters}
          clearFilters={clearFilters}
          activeCount={activeCount}
          hiddenCount={tasks.length - visibleTasks.length}
        />
      )}

      <div className="min-h-0 min-w-0 flex-1">
        {!hasTasks ? (
          <CenteredState
            icon={<ListChecksIcon className="size-5 text-muted-foreground" />}
            title="No tasks yet"
            description="Add the first one and it will show up on the board."
          >
            <Button
              className="mt-2"
              onClick={() => {
                openCreate("TODO")
              }}
            >
              <PlusIcon />
              New task
            </Button>
          </CenteredState>
        ) : !hasMatches ? (
          <CenteredState
            icon={<SearchXIcon className="size-5 text-muted-foreground" />}
            title="No tasks match these filters"
            description={
              isFiltered
                ? "Try widening the filters, or clear them to see everything."
                : "Nothing to show."
            }
          >
            {isFiltered && (
              <Button variant="outline" className="mt-2" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </CenteredState>
        ) : (
          <Board
            tasks={visibleTasks}
            onAddTask={openCreate}
            onEditTask={openEdit}
            onDeleteTask={openDelete}
          />
        )}
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

interface CenteredStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  children?: React.ReactNode
}

/** One geometry for every empty and error state on this page. */
function CenteredState({
  icon,
  title,
  description,
  children,
}: CenteredStateProps) {
  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-3 px-6 text-center">
      {icon !== undefined && (
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
      )}
      <h2 className="font-heading text-base font-medium">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  )
}

/** Mirrors the loaded layout — same header block, same three columns. */
function BoardSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" aria-hidden="true">
      <header className="flex flex-col gap-2 px-4 pt-5 pb-4">
        <Skeleton className="h-6 w-48 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-full" />
      </header>

      <div className="flex items-center gap-2 px-4 pb-3">
        <Skeleton className="h-8 w-full max-w-xs rounded-3xl" />
        <Skeleton className="hidden h-8 w-28 rounded-3xl md:block" />
        <Skeleton className="hidden h-8 w-28 rounded-3xl md:block" />
      </div>

      <div className="flex h-full min-h-[65svh] gap-3 overflow-x-auto px-4 pb-4 lg:gap-4 lg:overflow-x-visible">
        {TASK_STATUSES.map((status, columnIndex) => (
          <div
            key={status}
            className="flex w-72 shrink-0 flex-col rounded-4xl bg-muted/40 lg:w-auto lg:flex-1"
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
