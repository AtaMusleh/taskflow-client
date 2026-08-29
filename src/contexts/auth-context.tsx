import { createContext, use, useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { api } from "@/lib/api"
import { clearTokens, getAccessToken, setTokens } from "@/lib/auth-storage"
import { queryClient } from "@/lib/query-client"
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  UserResponse,
} from "@/types"

export interface AuthContextValue {
  user: User | null
  /** True until the stored session has been restored (or ruled out) on mount. */
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<User>
  register: (details: RegisterRequest) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // Start loading only if there is a token worth verifying; otherwise the app
  // can render the public routes on the first paint with no flash of spinner.
  const [isLoading, setIsLoading] = useState(() => getAccessToken() !== null)

  useEffect(() => {
    if (getAccessToken() === null) return

    let cancelled = false

    // An expired access token is fine here: the axios interceptor refreshes it
    // and replays this request. Only a failed refresh lands in the catch.
    void api
      .get<UserResponse>("/auth/me")
      .then(({ data }) => {
        if (!cancelled) setUser(data.user)
      })
      .catch(() => {
        clearTokens()
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials: LoginRequest): Promise<User> => {
    const { data } = await api.post<AuthResponse>("/auth/login", credentials)
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (details: RegisterRequest): Promise<User> => {
    const { data } = await api.post<AuthResponse>("/auth/register", details)
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    setUser(data.user)
    return data.user
  }, [])

  // Logout is purely client-side: the API exposes no revocation endpoint, so
  // ending a session means dropping the tokens we hold.
  const logout = useCallback((): void => {
    clearTokens()
    setUser(null)
    // Drop every cached query so the next user never sees stale data.
    queryClient.clear()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook ships with its provider
export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
