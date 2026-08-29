import { useState } from "react"
import { ChevronDownIcon, ListFilterIcon, SearchIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DUE_DATE_FILTERS,
  DUE_DATE_FILTER_LABELS,
  type DueDateFilter,
  type TaskFilters,
} from "@/lib/task-filters"
import { cn } from "@/lib/utils"
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, type TaskPriority } from "@/types"

const ANY_DUE_DATE = "any"

interface FilterBarProps {
  filters: TaskFilters
  updateFilters: (patch: Partial<TaskFilters>) => void
  clearFilters: () => void
  activeCount: number
  /** How many tasks the current filters are hiding. */
  hiddenCount: number
}

export function FilterBar({
  filters,
  updateFilters,
  clearFilters,
  activeCount,
  hiddenCount,
}: FilterBarProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const hiddenLabel =
    hiddenCount > 0
      ? `${String(hiddenCount)} ${hiddenCount === 1 ? "task" : "tasks"} hidden`
      : null

  return (
    <div className="flex items-center gap-2 px-4 pb-3">
      {/* Inline from md up. */}
      <div className="hidden flex-1 items-center gap-2 md:flex">
        <FilterControls filters={filters} updateFilters={updateFilters} />
      </div>

      {/* Below md the same controls live in a sheet. */}
      <div className="flex flex-1 items-center gap-2 md:hidden">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <ListFilterIcon />
              Filters
              {activeCount > 0 && (
                <Badge className="ml-1 size-4 justify-center rounded-full p-0 text-[10px] tabular-nums">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="gap-0">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 p-4">
              <FilterControls
                filters={filters}
                updateFilters={updateFilters}
                stacked
              />
              {activeCount > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    clearFilters()
                    setIsSheetOpen(false)
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {hiddenLabel !== null && (
        <p
          className="shrink-0 text-xs text-muted-foreground tabular-nums"
          // Filtering happens as you type, so announce the result politely
          // rather than leaving screen reader users to guess.
          role="status"
          aria-live="polite"
        >
          {hiddenLabel}
        </p>
      )}

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="hidden shrink-0 md:inline-flex"
          onClick={clearFilters}
        >
          <XIcon />
          Clear filters
        </Button>
      )}
    </div>
  )
}

interface FilterControlsProps {
  filters: TaskFilters
  updateFilters: (patch: Partial<TaskFilters>) => void
  /** Full-width, labelled layout for the mobile sheet. */
  stacked?: boolean
}

function FilterControls({
  filters,
  updateFilters,
  stacked = false,
}: FilterControlsProps) {
  const togglePriority = (priority: TaskPriority) => {
    const next = filters.priorities.includes(priority)
      ? filters.priorities.filter((item) => item !== priority)
      : [...filters.priorities, priority]
    updateFilters({ priorities: next })
  }

  const priorityLabel =
    filters.priorities.length === 0
      ? "Priority"
      : filters.priorities
          .map((priority) => TASK_PRIORITY_LABELS[priority])
          .join(", ")

  const dueLabel =
    filters.due === null ? "Due date" : DUE_DATE_FILTER_LABELS[filters.due]

  return (
    <div
      className={cn(
        stacked ? "flex flex-col gap-4" : "flex flex-1 items-center gap-2",
      )}
    >
      <div className={cn("flex flex-col gap-2", !stacked && "max-w-xs flex-1")}>
        {stacked && <Label htmlFor="task-search">Search</Label>}
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="task-search"
            type="search"
            value={filters.search}
            placeholder="Search tasks"
            aria-label="Search tasks by title and description"
            className="pl-9"
            onChange={(event) => {
              updateFilters({ search: event.target.value })
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {stacked && <Label>Priority</Label>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size={stacked ? "default" : "sm"}
              className={cn(
                "justify-between font-normal",
                stacked ? "w-full" : "max-w-48",
                filters.priorities.length > 0 && "font-medium",
              )}
            >
              <span className="truncate">{priorityLabel}</span>
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {TASK_PRIORITIES.map((priority) => (
              <DropdownMenuCheckboxItem
                key={priority}
                checked={filters.priorities.includes(priority)}
                // Keep the menu open: picking several priorities is the point
                // of a multi-select.
                onSelect={(event) => {
                  event.preventDefault()
                }}
                onCheckedChange={() => {
                  togglePriority(priority)
                }}
              >
                {TASK_PRIORITY_LABELS[priority]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-2">
        {stacked && <Label>Due date</Label>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size={stacked ? "default" : "sm"}
              className={cn(
                "justify-between font-normal",
                stacked ? "w-full" : "max-w-44",
                filters.due !== null && "font-medium",
              )}
            >
              <span className="truncate">{dueLabel}</span>
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={filters.due ?? ANY_DUE_DATE}
              onValueChange={(value) => {
                updateFilters({
                  due: value === ANY_DUE_DATE ? null : (value as DueDateFilter),
                })
              }}
            >
              <DropdownMenuRadioItem value={ANY_DUE_DATE}>
                Any date
              </DropdownMenuRadioItem>
              {DUE_DATE_FILTERS.map((due) => (
                <DropdownMenuRadioItem key={due} value={due}>
                  {DUE_DATE_FILTER_LABELS[due]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
