import { Link } from "react-router"

/** Placeholder — the real form lands with the auth pages. */
export default function RegisterPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <Link to="/login" className="text-sm underline underline-offset-4">
        Already have an account? Sign in
      </Link>
    </div>
  )
}
