import { Link, useLocation, useSearchParams } from "react-router"

import type { FromLocationState } from "@/components/protected-route"

/** Placeholder — the real form lands with the auth pages. */
export default function LoginPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Where to send the user after signing in: the route ProtectedRoute guarded,
  // or the `next` param set by the axios interceptor's hard redirect.
  const state = location.state as FromLocationState | null
  const from = state?.from ?? searchParams.get("next") ?? "/projects"

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        Continues to <code className="font-mono">{from}</code>
      </p>
      <Link to="/register" className="text-sm underline underline-offset-4">
        Create an account
      </Link>
    </div>
  )
}
