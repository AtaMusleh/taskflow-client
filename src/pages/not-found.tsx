import { Link } from "react-router"

import { useDocumentTitle } from "@/lib/use-document-title"

export default function NotFoundPage() {
  useDocumentTitle("Page not found")

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        That page doesn’t exist or has moved.
      </p>
      <Link to="/projects" className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40 text-sm underline underline-offset-4">
        Back to projects
      </Link>
    </div>
  )
}
