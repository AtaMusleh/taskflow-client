import { useParams } from "react-router"

/** Placeholder — the real board lands next. */
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Project</h1>
      <p className="text-sm text-muted-foreground font-mono">{id}</p>
    </div>
  )
}
