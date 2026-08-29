import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router"
import { z } from "zod"

import { AuthLayout } from "@/components/auth-layout"
import type { FromLocationState } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { getApiErrorCode, getApiErrorMessage, isApiError } from "@/lib/api"
import { useDocumentTitle } from "@/lib/use-document-title"

/**
 * Sign-in deliberately does not restate the password rules — length or
 * character requirements here would only help someone probing the form.
 */
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  useDocumentTitle("Sign in")

  const { login, user, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Where to land after signing in: the route ProtectedRoute guarded, or the
  // `next` param from the axios interceptor's hard redirect on a dead session.
  const state = location.state as FromLocationState | null
  const from = state?.from ?? searchParams.get("next") ?? "/projects"

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  // Already signed in (e.g. arrived via the Back button) — skip the form.
  if (!isLoading && user !== null) {
    return <Navigate to={from} replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    clearErrors("root")
    try {
      await login(values)
      await navigate(from, { replace: true })
    } catch (error) {
      const status = isApiError(error) ? error.response?.status : undefined

      if (getApiErrorCode(error) === "INVALID_CREDENTIALS") {
        // Form-level, not field-level: the API won't say which half was wrong,
        // and pinning it to one input would imply the other was accepted.
        setError("root", { message: "Incorrect email or password" })
      } else if (status === 429) {
        setError("root", {
          message: "Too many attempts, try again in a few minutes.",
        })
      } else {
        setError("root", { message: getApiErrorMessage(error) })
      }
    }
  })

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back. Enter your details to continue."
      footer={
        <>
          Don&rsquo;t have an account?{" "}
          <Link
            to="/register"
            className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40 font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            autoFocus
            aria-invalid={errors.email !== undefined}
            aria-describedby={errors.email !== undefined ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email !== undefined && (
            <p id="email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password !== undefined}
            aria-describedby={
              errors.password !== undefined ? "password-error" : undefined
            }
            {...register("password")}
          />
          {errors.password !== undefined && (
            <p id="password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        {errors.root !== undefined && (
          <p
            role="alert"
            className="rounded-3xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {errors.root.message}
          </p>
        )}

        <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  )
}
