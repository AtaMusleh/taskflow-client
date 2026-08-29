import { useState } from "react"
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { NavLink } from "react-router"

import { DeleteProjectDialog } from "@/components/delete-project-dialog"
import { ProjectDialog } from "@/components/project-dialog"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useProjects } from "@/lib/queries"
import { cn } from "@/lib/utils"
import type { Project, ProjectWithTaskCount } from "@/types"

interface ProjectListProps {
  /** Icon-only rail: dots without labels, names moved into tooltips. */
  collapsed?: boolean
  /** Lets the mobile sheet close itself when a project is opened. */
  onNavigate?: () => void
}

export function ProjectList({ collapsed = false, onNavigate }: ProjectListProps) {
  const { data: projects, isPending, isError, refetch } = useProjects()

  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const openRename = (project: Project) => {
    setProjectToEdit(project)
    setIsEditOpen(true)
  }

  const openDelete = (project: Project) => {
    setProjectToDelete(project)
    setIsDeleteOpen(true)
  }

  if (isPending) {
    return <ProjectListSkeleton collapsed={collapsed} />
  }

  if (isError) {
    return collapsed ? null : (
      <div className="px-2 py-3">
        <p className="text-xs text-muted-foreground">
          Could not load projects.
        </p>
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0"
          onClick={() => {
            void refetch()
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (projects.length === 0) {
    return collapsed ? null : (
      <p className="px-2 py-3 text-xs text-muted-foreground">No projects yet.</p>
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-0.5">
        {projects.map((project) => (
          <li key={project.id}>
            <ProjectListItem
              project={project}
              collapsed={collapsed}
              onNavigate={onNavigate}
              onRename={() => {
                openRename(project)
              }}
              onDelete={() => {
                openDelete(project)
              }}
            />
          </li>
        ))}
      </ul>

      <ProjectDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        project={projectToEdit ?? undefined}
      />
      <DeleteProjectDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        project={projectToDelete}
      />
    </>
  )
}

interface ProjectListItemProps {
  project: ProjectWithTaskCount
  collapsed: boolean
  onNavigate?: () => void
  onRename: () => void
  onDelete: () => void
}

function ProjectListItem({
  project,
  collapsed,
  onNavigate,
  onRename,
  onDelete,
}: ProjectListItemProps) {
  const dot = (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: project.color }}
      aria-hidden="true"
    />
  )

  const link = (
    <NavLink
      to={`/projects/${project.id}`}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex h-8 items-center gap-2 rounded-3xl text-sm outline-none transition-colors",
          "focus-visible:ring-3 focus-visible:ring-ring/30",
          collapsed ? "justify-center px-0" : "px-2",
          isActive
            ? "bg-secondary font-medium text-secondary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
    >
      {dot}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{project.name}</span>
          {/* Hidden on hover so the actions button can take its place without
              the row changing width. */}
          <span className="text-xs tabular-nums text-muted-foreground group-hover/item:invisible group-focus-within/item:invisible">
            {project.taskCount}
          </span>
        </>
      )}
    </NavLink>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group/item relative">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">
                {project.name}
                <span className="ml-2 text-muted-foreground tabular-nums">
                  {project.taskCount}
                </span>
              </TooltipContent>
            </Tooltip>
          ) : (
            link
          )}

          {/* Sibling of the link, not a child: a button inside an anchor is
              invalid markup and swallows the link's own activation. */}
          {!collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1 right-1 hidden group-hover/item:flex group-focus-within/item:flex data-[state=open]:flex"
                >
                  <MoreHorizontalIcon />
                  <span className="sr-only">Actions for {project.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onRename}>
                  <PencilIcon />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onSelect={onRename}>
          <PencilIcon />
          Rename
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2Icon />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** Same row height and rhythm as the real list, so nothing shifts on load. */
function ProjectListSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex flex-col gap-0.5" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className={cn(
            "flex h-8 items-center gap-2 rounded-3xl",
            collapsed ? "justify-center px-0" : "px-2",
          )}
        >
          <Skeleton className="size-2 shrink-0 rounded-full" />
          {!collapsed && <Skeleton className="h-3 flex-1 rounded-full" />}
        </div>
      ))}
    </div>
  )
}
