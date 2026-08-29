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
  Project,
  ProjectResponse,
  ProjectWithTaskCount,
  ProjectsResponse,
  UpdateProjectRequest,
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
