import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { api, getApiErrorMessage } from "@/lib/api"
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
/* Queries                                                                    */
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
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export function useCreateProject(): UseMutationResult<
  Project,
  Error,
  CreateProjectRequest
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateProjectRequest) => {
      const { data } = await api.post<ProjectResponse>("/projects", input)
      return data.project
    },
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success(`Created “${project.name}”`)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
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

  return useMutation({
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
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}

export function useDeleteProject(): UseMutationResult<void, Error, Project> {
  const queryClient = useQueryClient()

  return useMutation({
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
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

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
  CreateTaskVariables
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, input }: CreateTaskVariables) => {
      const { data } = await api.post<TaskResponse>(
        `/projects/${projectId}/tasks`,
        input,
      )
      return data.task
    },
    onSuccess: (task) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.byProject(task.projectId),
      })
      // The sidebar shows a task count per project, so it is stale now too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
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

  return useMutation({
    mutationFn: async ({ taskId, input }: UpdateTaskVariables) => {
      const { data } = await api.patch<TaskResponse>(`/tasks/${taskId}`, input)
      return data.task
    },
    onSuccess: (task) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.byProject(task.projectId),
      })
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}

export function useDeleteTask(): UseMutationResult<void, Error, Task> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (task: Task) => {
      await api.delete(`/tasks/${task.id}`)
    },
    onSuccess: (_result, task) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.byProject(task.projectId),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      toast.success("Task deleted")
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })
}

export interface MoveTaskVariables extends MoveTaskRequest {
  task: Task
}

interface MoveTaskContext {
  previousTasks: Task[] | undefined
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
  MoveTaskContext
> {
  const queryClient = useQueryClient()

  return useMutation<Task, Error, MoveTaskVariables, MoveTaskContext>({
    mutationFn: async ({ task, status, beforeId, afterId }) => {
      const { data } = await api.patch<TaskResponse>(`/tasks/${task.id}/move`, {
        status,
        beforeId,
        afterId,
      } satisfies MoveTaskRequest)
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

    onError: (error, { task }, context) => {
      if (context?.previousTasks !== undefined) {
        queryClient.setQueryData(
          queryKeys.tasks.byProject(task.projectId),
          context.previousTasks,
        )
      }
      toast.error(getApiErrorMessage(error, "Could not move that task."))
    },

    // Whether it succeeded or rolled back, the server decides the final order.
    onSettled: (_data, _error, { task }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.byProject(task.projectId),
      })
    },
  })
}
