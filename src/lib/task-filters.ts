import {
  endOfDay,
  endOfWeek,
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns"

import { TASK_PRIORITIES, type Task, type TaskPriority } from "@/types"

export type DueDateFilter = "overdue" | "today" | "week" | "none"

export const DUE_DATE_FILTERS: readonly DueDateFilter[] = [
  "overdue",
  "today",
  "week",
  "none",
]

export const DUE_DATE_FILTER_LABELS: Record<DueDateFilter, string> = {
  overdue: "Overdue",
  today: "Due today",
  week: "Due this week",
  none: "No due date",
}

export interface TaskFilters {
  /** Empty means "any priority" rather than "no priorities". */
  priorities: TaskPriority[]
  due: DueDateFilter | null
  search: string
}

export const EMPTY_FILTERS: TaskFilters = {
  priorities: [],
  due: null,
  search: "",
}

/** Counts filter *groups* in use, which is what the mobile badge shows. */
export function countActiveFilters(filters: TaskFilters): number {
  let count = 0
  if (filters.priorities.length > 0) count += 1
  if (filters.due !== null) count += 1
  if (filters.search.trim().length > 0) count += 1
  return count
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return countActiveFilters(filters) > 0
}

function matchesDueDate(task: Task, due: DueDateFilter, now: Date): boolean {
  if (due === "none") return task.dueDate === null
  if (task.dueDate === null) return false

  const dueDate = parseISO(task.dueDate)

  switch (due) {
    case "overdue":
      // Same rule the card badge uses: a task is not late until its day is
      // over, and a finished task is never late.
      return task.status !== "DONE" && endOfDay(dueDate) < now
    case "today":
      return isToday(dueDate)
    case "week":
      // Today through the end of the current week, so "this week" never
      // excludes something due in the next hour.
      return isWithinInterval(dueDate, {
        start: startOfDay(now),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      })
  }
}

function matchesSearch(task: Task, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (needle.length === 0) return true
  if (task.title.toLowerCase().includes(needle)) return true
  return task.description?.toLowerCase().includes(needle) ?? false
}

/**
 * Pure, so the board can filter without another request and the result is
 * trivially checkable. `now` is injectable to keep date rules testable.
 */
export function filterTasks(
  tasks: Task[],
  filters: TaskFilters,
  now: Date = new Date(),
): Task[] {
  return tasks.filter((task) => {
    if (
      filters.priorities.length > 0 &&
      !filters.priorities.includes(task.priority)
    ) {
      return false
    }
    if (filters.due !== null && !matchesDueDate(task, filters.due, now)) {
      return false
    }
    return matchesSearch(task, filters.search)
  })
}

/* -------------------------------------------------------------------------- */
/* URL serialisation                                                          */
/* -------------------------------------------------------------------------- */

const PRIORITY_PARAM = "priority"
const DUE_PARAM = "due"
const SEARCH_PARAM = "q"

function isTaskPriority(value: string): value is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value)
}

function isDueDateFilter(value: string): value is DueDateFilter {
  return (DUE_DATE_FILTERS as readonly string[]).includes(value)
}

/** Unknown or malformed values are dropped rather than throwing on a bad URL. */
export function parseFilters(params: URLSearchParams): TaskFilters {
  const priorities = (params.get(PRIORITY_PARAM) ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(isTaskPriority)

  const due = params.get(DUE_PARAM)

  return {
    // De-duplicate so `?priority=HIGH,HIGH` can't skew anything downstream.
    priorities: [...new Set(priorities)],
    due: due !== null && isDueDateFilter(due) ? due : null,
    search: params.get(SEARCH_PARAM) ?? "",
  }
}

/**
 * Writes filters onto a copy of the existing params, so unrelated query string
 * entries survive. Inactive filters are removed rather than left empty, which
 * keeps a cleared board's URL clean enough to share.
 */
export function applyFiltersToParams(
  params: URLSearchParams,
  filters: TaskFilters,
): URLSearchParams {
  const next = new URLSearchParams(params)

  if (filters.priorities.length > 0) {
    next.set(PRIORITY_PARAM, filters.priorities.join(","))
  } else {
    next.delete(PRIORITY_PARAM)
  }

  if (filters.due !== null) {
    next.set(DUE_PARAM, filters.due)
  } else {
    next.delete(DUE_PARAM)
  }

  if (filters.search.trim().length > 0) {
    next.set(SEARCH_PARAM, filters.search)
  } else {
    next.delete(SEARCH_PARAM)
  }

  return next
}
