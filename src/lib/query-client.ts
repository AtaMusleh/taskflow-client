import { QueryClient } from "@tanstack/react-query"

/**
 * Shared query client. Exported as a module singleton (rather than created in
 * a component) so non-React code — the axios interceptor, the auth context —
 * can clear the cache when a session ends.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tab focus is a poor proxy for stale data and causes request storms.
      refetchOnWindowFocus: false,
      // One retry absorbs a transient network blip; more just delays the error.
      retry: 1,
      staleTime: 30_000,
    },
  },
})
