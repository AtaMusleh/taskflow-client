import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"

import { queryClient } from "@/lib/query-client"
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/auth-storage"
import type { ApiError, RefreshResponse } from "@/types"

/** Marks a request that has already been replayed after a token refresh. */
interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
})

/**
 * A bare client with no interceptors, used only for the refresh call itself so
 * a 401 from `/auth/refresh` cannot recurse back into the handler below.
 */
const refreshClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
})

/**
 * Endpoints where a 401 is the answer, not a stale-token symptom: bad
 * credentials on login, a rejected refresh token. `/auth/me` is deliberately
 * absent — a 401 there should refresh, which is how a session is restored
 * after the access token expires.
 */
const NO_REFRESH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"]

function isNoRefreshPath(url: string | undefined): boolean {
  const path = (url ?? "").split("?")[0]
  return NO_REFRESH_PATHS.some((endpoint) => path.endsWith(endpoint))
}

/* -------------------------------------------------------------------------- */
/* Request: attach the access token                                           */
/* -------------------------------------------------------------------------- */

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`)
  }
  return config
})

/* -------------------------------------------------------------------------- */
/* Response: single-flight refresh on 401                                     */
/* -------------------------------------------------------------------------- */

/**
 * Holds the in-flight refresh. Concurrent 401s all await this same promise, so
 * ten simultaneous failures produce one call to `/auth/refresh` and ten
 * retries — not ten refreshes racing to rotate the same token.
 */
let refreshPromise: Promise<string> | null = null

async function performRefresh(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    throw new Error("No refresh token available")
  }

  const { data } = await refreshClient.post<RefreshResponse>("/auth/refresh", {
    refreshToken,
  })

  setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  })

  return data.accessToken
}

function refreshSession(): Promise<string> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

/** Refresh failed or was impossible: drop the session and bounce to login. */
function handleSessionExpired(): void {
  clearTokens()
  queryClient.clear()

  const { pathname, search, hash } = window.location
  if (pathname === "/login") return

  // Full navigation (rather than a router push) because this can fire from
  // outside React. The attempted URL rides along as `next` so the login page
  // can send the user back, mirroring what ProtectedRoute does via location state.
  const next = encodeURIComponent(`${pathname}${search}${hash}`)
  window.location.assign(`/login?next=${next}`)
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ApiError>) => {
    const config = error.config as RetriableRequestConfig | undefined

    const shouldRefresh =
      config !== undefined &&
      error.response?.status === 401 &&
      config._retry !== true &&
      !isNoRefreshPath(config.url)

    if (!shouldRefresh || config === undefined) {
      return Promise.reject(error)
    }

    // Retry at most once; a 401 on the replay means the fresh token is no good.
    config._retry = true

    try {
      const accessToken = await refreshSession()
      config.headers = AxiosHeaders.from(config.headers)
      config.headers.set("Authorization", `Bearer ${accessToken}`)
      return await api.request(config)
    } catch {
      handleSessionExpired()
      // Reject with the original 401 so callers see the request that failed.
      return Promise.reject(error)
    }
  },
)

/* -------------------------------------------------------------------------- */
/* Error helpers                                                              */
/* -------------------------------------------------------------------------- */

export function isApiError(error: unknown): error is AxiosError<ApiError> {
  return axios.isAxiosError<ApiError>(error)
}

/** Pulls `error.error.message` out of a failed request, with fallbacks. */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isApiError(error)) {
    const message = error.response?.data?.error?.message
    if (typeof message === "string" && message.length > 0) return message
    if (error.code === AxiosError.ERR_NETWORK) {
      return "Cannot reach the server. Check your connection."
    }
    return error.message || fallback
  }
  if (error instanceof Error && error.message.length > 0) return error.message
  return fallback
}

/** The API's machine-readable error code, when the response carried one. */
export function getApiErrorCode(error: unknown): string | null {
  return isApiError(error) ? (error.response?.data?.error?.code ?? null) : null
}
