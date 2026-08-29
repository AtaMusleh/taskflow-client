import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDeleteTask } from "@/lib/queries"
import type { Task } from "@/types"

interface DeleteTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Held by the parent so the title survives the exit animation. */
  task: Task | null
}

export function DeleteTaskDialog({
  open,
  onOpenChange,
  task,
}: DeleteTaskDialogProps) {
  const deleteTask = useDeleteTask()

  const onConfirm = async () => {
    if (task === null) return
    try {
      await deleteTask.mutateAsync(task)
      onOpenChange(false)
    } catch {
      // Toasted by the mutation; leave the dialog open so retry is one click.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this task?</DialogTitle>
          <DialogDescription>
            {task?.title} will be permanently removed. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false)
            }}
            disabled={deleteTask.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              void onConfirm()
            }}
            disabled={deleteTask.isPending}
          >
            {deleteTask.isPending && (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            )}
            Delete task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
