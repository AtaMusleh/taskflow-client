/**
 * Types mirroring the TaskFlow API.
 *
 * The API wraps every payload in a named key (`{ project: {...} }`,
 * `{ tasks: [...] }`) rather than returning bare entities, so the response
 * envelopes below are modelled explicitly and used as the axios generics.
 * Timestamps are ISO-8601 strings as serialised by JSON.
 */

/* -------------------------------------------------------------------------- */
/* Entities                                                                   */
/* -------------------------------------------------------------------------- */

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE"

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH"

/** Ordered for rendering selects, columns and filters without re-listing. */
export const TASK_STATUSES: readonly TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"]

export const TASK_PRIORITIES: readonly TaskPriority[] = ["LOW", "MEDIUM", "HIGH"]

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
}

/** Shape returned by the project list endpoint, which joins in a task count. */
export interface ProjectWithTaskCount extends Project {
  taskCount: number
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  projectId: string
  assigneeId: string | null
  /** Sort key within a status column; used for drag-and-drop reordering. */
  position: number
  createdAt: string
  updatedAt: string
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export interface RefreshRequest {
  refreshToken: string
}

/** Refresh may or may not rotate the refresh token, so it is optional here. */
export interface RefreshResponse {
  accessToken: string
  refreshToken?: string
}

/* -------------------------------------------------------------------------- */
/* Request payloads                                                           */
/* -------------------------------------------------------------------------- */

export interface CreateProjectRequest {
  name: string
  description?: string | null
}

export type UpdateProjectRequest = Partial<CreateProjectRequest>

export interface CreateTaskRequest {
  title: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string | null
  assigneeId?: string | null
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  position?: number
}

/* -------------------------------------------------------------------------- */
/* Response envelopes                                                         */
/* -------------------------------------------------------------------------- */

export interface UserResponse {
  user: User
}

export interface ProjectResponse {
  project: Project
}

export interface ProjectsResponse {
  projects: ProjectWithTaskCount[]
}

export interface TaskResponse {
  task: Task
}

export interface TasksResponse {
  tasks: Task[]
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

/** Every non-2xx response body from the API takes this shape. */
export interface ApiError {
  error: {
    code: string
    message: string
    /** Field-level validation info; shape varies by `code`. */
    details?: unknown
  }
}
