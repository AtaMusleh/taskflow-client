import { useAuth } from "@/contexts/auth-context"

/** Placeholder — the real project list lands next. */
export default function ProjectsPage() {
  const { user } = useAuth()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as {user?.name ?? "…"}
      </p>
    </div>
  )
}
