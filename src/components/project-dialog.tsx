import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, Loader2Icon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useNavigate } from "react-router"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DEFAULT_PROJECT_COLOR,
  PROJECT_COLORS,
} from "@/lib/project-colors"
import { useCreateProject, useUpdateProject } from "@/lib/queries"
import { cn } from "@/lib/utils"
import type { Project } from "@/types"

/** Matches the API's 1-60 character limit on name. */
const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(60, "Name must be 60 characters or fewer"),
  color: z.string(),
})

type ProjectValues = z.infer<typeof projectSchema>

interface ProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The project being edited, or undefined to create a new one. */
  project?: Project
}

/** Serves both create and edit; `project` decides which. */
export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: ProjectDialogProps) {
  const navigate = useNavigate()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()

  const isEditing = project !== undefined
  const isPending = createProject.isPending || updateProject.isPending

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", color: DEFAULT_PROJECT_COLOR },
  })

  const selectedColor = useWatch({ control, name: "color" })

  // Reload the form each time the dialog opens, so a cancelled edit does not
  // leave stale values behind for the next one.
  useEffect(() => {
    if (!open) return
    reset({
      name: project?.name ?? "",
      color: project?.color ?? DEFAULT_PROJECT_COLOR,
    })
  }, [open, project, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEditing) {
        await updateProject.mutateAsync({ id: project.id, input: values })
        onOpenChange(false)
      } else {
        const created = await createProject.mutateAsync(values)
        onOpenChange(false)
        // Drop the user into what they just made.
        await navigate(`/projects/${created.id}`)
      }
    } catch {
      // The mutation's onError already raised a toast; keep the dialog open
      // with the user's input intact so they can retry or amend it.
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Rename project" : "New project"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Change the name or color of this project."
              : "Give your project a name and pick a color."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              type="text"
              placeholder="Marketing site"
              autoFocus
              maxLength={60}
              aria-invalid={errors.name !== undefined}
              aria-describedby={
                errors.name !== undefined ? "project-name-error" : undefined
              }
              {...register("name")}
            />
            {errors.name !== undefined && (
              <p id="project-name-error" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <span
              id="project-color-label"
              className="text-sm leading-none font-medium"
            >
              Color
            </span>
            <div
              role="radiogroup"
              aria-labelledby="project-color-label"
              className="flex flex-wrap gap-2"
            >
              {PROJECT_COLORS.map((color) => {
                const isSelected = selectedColor === color.hex
                return (
                  <button
                    key={color.hex}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={color.name}
                    onClick={() => {
                      setValue("color", color.hex, { shouldDirty: true })
                    }}
                    style={{ backgroundColor: color.hex }}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full outline-none transition",
                      "ring-offset-2 ring-offset-popover focus-visible:ring-3 focus-visible:ring-ring/40",
                      isSelected && "ring-2 ring-foreground",
                    )}
                  >
                    {isSelected && (
                      <CheckIcon
                        className="size-4 text-white drop-shadow-sm"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader2Icon className="animate-spin" aria-hidden="true" />
              )}
              {isEditing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
