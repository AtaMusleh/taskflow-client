import { useEffect, useRef } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { api, getApiErrorMessage, isApiError } from "@/lib/api"
import type {
  CreateProjectRequest,
  CreateTaskRequest,
  MoveTaskRequest,
  Project,
  ProjectResponse,
  ProjectWithTaskCount,
  ProjectsResponse,
  Task,
  TaskResponse,
  TaskStatus,
  TasksResponse,
  UpdateProjectRequest,
  UpdateTaskRequest,
} from "@/types"

/**
 * The single source of truth for cache keys. Every hook below reads from this
 * object, so a key can never drift from the invalidation that targets it.
 *
 * Keys are hierarchical and prefix-invalidation is deliberate: invalidating
 * `projects.all` catches the list and every detail query in one call.
 */
export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    list: () => [...queryKeys.projects.all, "list"] as const,
    detail: (id: string) => [...queryKeys.projects.all, "detail", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    byProject: (projectId: string) =>
      [...queryKeys.tasks.all, "project", projectId] as const,
  },
} as const

/* -------------------------------------------------------------------------- */
/* Error reporting                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Whether running the exact same request again could plausibly succeed.
 *
 * A network failure or a 5xx is worth retrying. A 4xx is not: the request
 * itself is the problem, and a Retry button that always fails is worse than no
 * button at all. 429 is the exception — it is a "not yet", not a "never".
 */
function isRetryableError(error: unknown): boolean {
  if (!isApiError(error)) return false
  const status = error.response?.status
  if (status === undefined) return true
  return status === 429 || status >= 500
}

/**
 * `useMutation` with a uniform error toast, and a Retry action that re-runs the
 * mutation with the same variables where that makes sense.
 *
 * The ref exists because the toast needs to call the very mutation it is being
 * configured by; it is written in an effect rather than during render so the
 * render stays free of side effects.
 */
function useMutationWithErrorToast<TData, TVariables, TContext>(
  fallbackMessage: string,
  options: UseMutationOptions<TData, Error, TVariables, TContext>,
): UseMutationResult<TData, Error, TVariables, TContext> {
  const mutationRef = useRef<UseMutationResult<
    TData,
    Error,
    TVariables,
    TContext
  > | null>(null)

  const mutation = useMutation<TData, Error, TVariables, TContext>({
    ...options,
    onError: (error, variables, onMutateResult, mutationContext) => {
      // Per-mutation handling first: that is where rollbacks live.
      options.onError?.(error, variables, onMutateResult, mutationContext)

      toast.error(
        getApiErrorMessage(error, fallbackMessage),
        isRetryableError(error)
          ? {
              action: {
                label: "Retry",
                onClick: () => {
                  mutationRef.current?.mutate(variables)
                },
              },
            }
          : undefined,
      )
    },
  })

  useEffect(() => {
    mutationRef.current = mutation
  })

  return mutation
}

/* -------------------------------------------------------------------------- */
/* Project queries                                                            */
/* -------------------------------------------------------------------------- */

export function useProjects(): UseQueryResult<ProjectWithTaskCount[], Error> {
  return useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<ProjectsResponse>("/projects", { signal })
      return data.projects
    },
  })
}

/**
 * `id` is optional so callers can pass a route param straight through; the
 * query stays idle until one exists.
 */
export function useProject(
  id: string | undefined,
): UseQueryResult<Project, Error> {
  return useQuery({
    queryKey: queryKeys.projects.detail(id ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<ProjectResponse>(`/projects/${id}`, {
        signal,
      })
      return data.project
    },
    enabled: id !== undefined && id.length > 0,
  })
}

/* -------------------------------------------------------------------------- */
/* Project mutations                                                          */
/* -------------------------------------------------------------------------- */

export function useCreateProject(): UseMutationResult<
  Project,
  Error,
  CreateProjectRequest
> {
  const queryClient = useQueryClient()

  return useMutationWithErrorToast("Could not create that project.", {
    mutationFn: async (input: CreateProjectRequest) => {
      const { data } = await api.post<ProjectResponse>("/projects", input)
      return data.project
    },
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success(`Created “${project.name}”`)
    },
  })
}

export interface UpdateProjectVariables {
  id: string
  input: UpdateProjectRequest
}

export function useUpdateProject(): UseMutationResult<
  Project,
  Error,
  UpdateProjectVariables
> {
  const queryClient = useQueryClient()

  return useMutationWithErrorToast("Could not save that project.", {
    mutationFn: async ({ id, input }: UpdateProjectVariables) => {
      const { data } = await api.patch<ProjectResponse>(
        `/projects/${id}`,
        input,
      )
      return data.project
    },
    onSuccess: (project) => {
      // Seed the detail cache with the response so the open project updates
      // without waiting for the refetch the invalidation triggers.
      queryClient.setQueryData(queryKeys.projects.detail(project.id), project)
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success(`Renamed to “${project.name}”`)
    },
  })
}

export function useDeleteProject(): UseMutationResult<void, Error, Project> {
  const queryClient = useQueryClient()

  return useMutationWithErrorToast("Could not delete that project.", {
    // Takes the whole project rather than an id so the toast can name it.
    mutationFn: async (project: Project) => {
      await api.delete(`/projects/${project.id}`)
    },
    onSuccess: (_result, project) => {
      queryClient.removeQueries({
        queryKey: queryKeys.projects.detail(project.id),
      })
      // The API cascades the delete to tasks, so drop their cache entry too
      // rather than leaving rows that point at a project that no longer exists.
      queryClient.removeQueries({
        queryKey: queryKeys.tasks.byProject(project.id),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success(`Deleted “${project.name}”`)
    },
  })
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Ids of tasks that exist only in the cache, awaiting the server's real one.
 * The board uses this to keep a pending card from being dragged — a move
 * addressed to an id the API has never seen would fail.
 */
const OPTIMISTIC_ID_PREFIX = "optimistic-"

export function isOptimisticId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_ID_PREFIX)
}

/** Shared by every mutation that rewrites a project's task list. */
interface TaskListContext {
  previousTasks: Task[] | undefined
}

function endOfColumnPosition(
  tasks: Task[] | undefined,
  status: TaskStatus,
): number {
  const positions = (tasks ?? [])
    .filter((task) => task.status === status)
    .map((task) => task.position)
  return positions.length === 0 ? 0 : Math.max(...positions) + 1
}

export function useTasks(
  projectId: string | undefined,
): UseQueryResult<Task[], Error> {
  return useQuery({
    queryKey: queryKeys.tasks.byProject(projectId ?? ""),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<TasksResponse>(
        `/projects/${projectId}/tasks`,
        { signal },
      )
      return data.tasks
    },
    enabled: projectId !== undefined && projectId.length > 0,
  })
}

export interface CreateTaskVariables {
  projectId: string
  input: CreateTaskRequest
}

export function useCreateTask(): UseMutationResult<
  Task,
  Error,
  CreateTaskVariables,
  TaskListContext
> {
  const queryClient = useQueryClient()

  return useMutationWithErrorToast<Task, CreateTaskVariables, TaskListContext>(
    "Could not create that task.",
    {
      mutationFn: async ({ projectId, input }) => {
        const { data } = await api.post<TaskResponse>(
          `/projects/${projectId}/tasks`,
          input,
        )
        return data.task
      },

      onMutate: async ({ projectId, input }) => {
        const queryKey = queryKeys.tasks.byProject(projectId)
        await queryClient.cancelQueries({ queryKey })

        const previousTasks = queryClient.getQueryData<Task[]>(queryKey)
        const status = input.status ?? "TODO"
        const timestamp = new Date().toISOString()

        // A stand-in card so the column fills immediately. Everything the API
        // would decide (id, position, timestamps) is provisional and replaced
        // by the refetch in onSettled.
        const optimisticTask: Task = {
          id: `${OPTIMISTIC_ID_PREFIX}${crypto.randomUUID()}`,
          title: input.title,
          description: input.description ?? null,
          status,
          priority: input.priority ?? "MEDIUM",
          dueDate: input.dueDate ?? null,
          projectId,
          assigneeId: input.assigneeId ?? null,
          position: endOfColumnPosition(previousTasks, status),
          createdAt: timestamp,
          updatedAt: timestamp,
        }

        queryClient.setQueryData<Task[]>(queryKey, [
          ...(previousTasks ?? []),
          optimisticTask,
        ])

        return { previousTasks }
      },

      onError: (_error, { projectId }, context) => {
        if (context?.previousTasks !== undefined) {
          queryClient.setQueryData(
            queryKeys.tasks.byProject(projectId),
            context.previousTasks,
          )
        }
      },

      onSettled: (_data, _error, { projectId }) => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tasks.byProject(projectId),
        })
        // The sidebar shows a task count per project, so it is stale now too.
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      },
    },
  )
}

export interface UpdateTaskVariables {
  taskId: string
  projectId: string
  input: UpdateTaskRequest
}

export function useUpdateTask(): UseMutationResult<
  Task,
  Error,
  UpdateTaskVariables
> {
  const queryClient = useQueryClient()

  return useMutationWithErrorToast("Could not save that task.", {
    mutationFn: async ({ taskId, input }: UpdateTaskVariables) => {
      const { data } = await api.patch<TaskResponse>(`/tasks/${taskId}`, input)
      return data.task
    },
    onSuccess: (task) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.byProject(task.projectId),
      })
    },
  })
}

export function useDeleteTask(): UseMutationResult<
  void,
  Error,
  Task,
  TaskListContext
> {
  const queryClient = useQueryClient()

  return useMutationWithErrorToast<void, Task, TaskListContext>(
    "Could not delete that task.",
    {
      mutationFn: async (task) => {
        await api.delete(`/tasks/${task.id}`)
      },

      onMutate: async (task) => {
        const queryKey = queryKeys.tasks.byProject(task.projectId)
        await queryClient.cancelQueries({ queryKey })

        const previousTasks = queryClient.getQueryData<Task[]>(queryKey)
        if (previousTasks !== undefined) {
          queryClient.setQueryData<Task[]>(
            queryKey,
            previousTasks.filter((item) => item.id !== task.id),
          )
        }

        return { previousTasks }
      },

      onError: (_error, task, context) => {
        if (context?.previousTasks !== undefined) {
          queryClient.setQueryData(
            queryKeys.tasks.byProject(task.projectId),
            context.previousTasks,
          )
        }
      },

      onSuccess: () => {
        toast.success("Task deleted")
      },

      onSettled: (_data, _error, task) => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tasks.byProject(task.projectId),
        })
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      },
    },
  )
}

export interface MoveTaskVariables extends MoveTaskRequest {
  task: Task
}

/**
 * Places a card optimistically between its new neighbours.
 *
 * The server owns the real position; this only needs to sort correctly against
 * the neighbours until `onSettled` replaces it, so a midpoint (or a step past
 * the end) is enough. Fractions are fine — the value is thrown away.
 */
function optimisticPosition(
  before: Task | undefined,
  after: Task | undefined,
): number {
  if (before !== undefined && after !== undefined) {
    return (before.position + after.position) / 2
  }
  if (before !== undefined) return before.position + 1
  if (after !== undefined) return after.position - 1
  return 0
}

export function useMoveTask(): UseMutationResult<
  Task,
  Error,
  MoveTaskVariables,
  TaskListContext
> {
  const queryClient = useQueryClient()

  return useMutationWithErrorToast<Task, MoveTaskVariables, TaskListContext>(
    "Could not move that task.",
    {
      mutationFn: async ({ task, status, beforeId, afterId }) => {
        const { data } = await api.patch<TaskResponse>(
          `/tasks/${task.id}/move`,
          {
            status,
            beforeId,
            afterId,
          } satisfies MoveTaskRequest,
        )
        return data.task
      },

      onMutate: async ({ task, status, beforeId, afterId }) => {
        const queryKey = queryKeys.tasks.byProject(task.projectId)

        // Stop any in-flight fetch from resolving after this and clobbering the
        // optimistic state with a list that predates the move.
        await queryClient.cancelQueries({ queryKey })

        const previousTasks = queryClient.getQueryData<Task[]>(queryKey)

        if (previousTasks !== undefined) {
          const before = previousTasks.find((item) => item.id === beforeId)
          const after = previousTasks.find((item) => item.id === afterId)
          const position = optimisticPosition(before, after)

          queryClient.setQueryData<Task[]>(
            queryKey,
            previousTasks.map((item) =>
              item.id === task.id ? { ...item, status, position } : item,
            ),
          )
        }

        return { previousTasks }
      },

      onError: (_error, { task }, context) => {
        if (context?.previousTasks !== undefined) {
          queryClient.setQueryData(
            queryKeys.tasks.byProject(task.projectId),
            context.previousTasks,
          )
        }
      },

      // Whether it succeeded or rolled back, the server decides the final order.
      onSettled: (_data, _error, { task }) => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tasks.byProject(task.projectId),
        })
      },
    },
  )
}
