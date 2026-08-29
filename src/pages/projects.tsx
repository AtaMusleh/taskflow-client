import { useState } from "react"
import { FolderOpenIcon, PlusIcon } from "lucide-react"

import { ProjectDialog } from "@/components/project-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useProjects } from "@/lib/queries"

/**
 * The index of the authenticated app. No project is selected here, so this is
 * always an empty state — which one depends on whether the user has any
 * projects to pick from.
 */
export default function ProjectsPage() {
  const { data: projects, isPending, isError } = useProjects()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  if (isPending) {
    return (
      <EmptyStateShell>
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-4 w-48 rounded-full" />
        <Skeleton className="h-3 w-64 rounded-full" />
      </EmptyStateShell>
    )
  }

  if (isError) {
    return (
      <EmptyStateShell>
        <h1 className="font-heading text-base font-medium">
          Could not load your projects
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
      </EmptyStateShell>
    )
  }

  const hasProjects = projects.length > 0

  return (
    <>
      <EmptyStateShell>
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <FolderOpenIcon
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        <h1 className="font-heading text-base font-medium">
          {hasProjects ? "No project selected" : "Create your first project"}
        </h1>

        <p className="max-w-sm text-sm text-muted-foreground">
          {hasProjects
            ? "Pick a project from the sidebar to see its tasks."
            : "Projects hold your tasks. Make one to get started."}
        </p>

        {!hasProjects && (
          <Button
            className="mt-2"
            onClick={() => {
              setIsCreateOpen(true)
            }}
          >
            <PlusIcon />
            New project
          </Button>
        )}
      </EmptyStateShell>

      <ProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  )
}

/** Keeps the loading, error, and ready states on identical geometry. */
function EmptyStateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 px-6 text-center">
      {children}
    </div>
  )
}
