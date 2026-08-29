import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"

import {
  EMPTY_FILTERS,
  applyFiltersToParams,
  countActiveFilters,
  parseFilters,
  type TaskFilters,
} from "@/lib/task-filters"

export interface UseTaskFiltersResult {
  filters: TaskFilters
  setFilters: (next: TaskFilters) => void
  /** Patch one key without restating the rest. */
  updateFilters: (patch: Partial<TaskFilters>) => void
  clearFilters: () => void
  activeCount: number
  isFiltered: boolean
}

/**
 * Filter state lives in the URL, so a filtered board survives a refresh and can
 * be pasted to someone else. There is no local mirror of it — the query string
 * is the state.
 */
export function useTaskFilters(): UseTaskFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  const setFilters = useCallback(
    (next: TaskFilters) => {
      // `replace` so typing in the search box doesn't push a history entry per
      // keystroke; Back still leaves the board rather than rewinding letters.
      setSearchParams((current) => applyFiltersToParams(current, next), {
        replace: true,
      })
    },
    [setSearchParams],
  )

  const updateFilters = useCallback(
    (patch: Partial<TaskFilters>) => {
      setSearchParams(
        (current) =>
          applyFiltersToParams(current, {
            ...parseFilters(current),
            ...patch,
          }),
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS)
  }, [setFilters])

  const activeCount = countActiveFilters(filters)

  return {
    filters,
    setFilters,
    updateFilters,
    clearFilters,
    activeCount,
    isFiltered: activeCount > 0,
  }
}
