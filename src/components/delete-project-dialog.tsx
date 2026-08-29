import { Loader2Icon } from "lucide-react"
import { useMatch, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDeleteProject } from "@/lib/queries"
import type { Project } from "@/types"

interface DeleteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Null when nothing is queued for deletion. Held by the parent rather than
   * cleared on close so the name stays put through the exit animation.
   */
  project: Project | null
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  project,
}: DeleteProjectDialogProps) {
  const deleteProject = useDeleteProject()
  const navigate = useNavigate()
  const match = useMatch("/projects/:id")

  const onConfirm = async () => {
    if (project === null) return

    // Capture this before the mutation: the route is what the user is looking
    // at right now, and only that case warrants navigating away.
    const wasViewingThisProject = match?.params.id === project.id

    try {
      await deleteProject.mutateAsync(project)
      onOpenChange(false)
      if (wasViewingThisProject) {
        await navigate("/projects", { replace: true })
      }
    } catch {
      // Toasted by the mutation; leave the dialog open so retry is one click.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {project?.name ?? "project"}?</DialogTitle>
          <DialogDescription>
            Every task in this project is deleted along with it. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false)
            }}
            disabled={deleteProject.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              void onConfirm()
            }}
            disabled={deleteProject.isPending}
          >
            {deleteProject.isPending && (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            )}
            Delete project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
