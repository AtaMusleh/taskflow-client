import type { ReactNode } from "react"
import { Navigate, Outlet, useLocation } from "react-router"

import { useAuth } from "@/contexts/auth-context"
import { Loader2Icon } from "lucide-react"

/** Location state carried to /login so it can send the user back afterwards. */
export interface FromLocationState {
  from?: string
}

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  // The session is still being restored — deciding now would bounce a signed-in
  // user to /login on every hard refresh.
  if (isLoading) {
    return (
      <div
        className="flex min-h-svh items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading your session…</span>
      </div>
    )
  }

  if (user === null) {
    // `replace` keeps the guarded URL out of history, so Back from /login does
    // not bounce through this redirect again.
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" replace state={{ from } satisfies FromLocationState} />
  }

  return children ?? <Outlet />
}
