import { Link } from "react-router"

export default function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        That page doesn’t exist or has moved.
      </p>
      <Link to="/projects" className="text-sm underline underline-offset-4">
        Back to projects
      </Link>
    </div>
  )
}
