import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, Navigate, useNavigate } from "react-router"
import { z } from "zod"

import { AuthLayout } from "@/components/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { getApiErrorCode, getApiErrorMessage, isApiError } from "@/lib/api"

/** Mirrors the API's own rules so the round trip only ever fails on state. */
const registerSchema = z
  .object({
    name: z.string().trim().max(80, "Name must be 80 characters or fewer"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type RegisterValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { register: registerUser, user, isLoading } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  })

  if (!isLoading && user !== null) {
    return <Navigate to="/projects" replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    clearErrors("root")
    try {
      // Registration returns tokens, so the user is signed in already — there
      // is no second trip through /auth/login.
      await registerUser({
        email: values.email,
        password: values.password,
        name: values.name.length > 0 ? values.name : undefined,
      })
      await navigate("/projects", { replace: true })
    } catch (error) {
      const status = isApiError(error) ? error.response?.status : undefined

      if (getApiErrorCode(error) === "EMAIL_TAKEN") {
        setError(
          "email",
          { message: "That email is already registered" },
          { shouldFocus: true },
        )
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
      title="Create your account"
      description="Start organising your work in a couple of minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">
            Name
            <span className="font-normal text-muted-foreground">Optional</span>
          </Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            autoFocus
            aria-invalid={errors.name !== undefined}
            aria-describedby={errors.name !== undefined ? "name-error" : undefined}
            {...register("name")}
          />
          {errors.name !== undefined && (
            <p id="name-error" className="text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
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
            autoComplete="new-password"
            aria-invalid={errors.password !== undefined}
            aria-describedby={
              errors.password !== undefined ? "password-error" : "password-hint"
            }
            {...register("password")}
          />
          {errors.password !== undefined ? (
            <p id="password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword !== undefined}
            aria-describedby={
              errors.confirmPassword !== undefined ? "confirm-error" : undefined
            }
            {...register("confirmPassword")}
          />
          {errors.confirmPassword !== undefined && (
            <p id="confirm-error" className="text-xs text-destructive">
              {errors.confirmPassword.message}
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
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  )
}
