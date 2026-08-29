/**
 * Token persistence.
 *
 * Trade-off: tokens live in localStorage. That is simpler than the safer
 * alternative — keeping the refresh token in an httpOnly, SameSite cookie set
 * by the API and holding only the access token in memory — because it needs no
 * cookie/CORS coordination with the server and survives a page reload for free.
 * The cost is XSS exposure: any script that runs on this origin can read both
 * tokens and impersonate the user until they expire. Keep third-party scripts
 * out and never render untrusted HTML.
 */

const ACCESS_TOKEN_KEY = "taskflow.accessToken"
const REFRESH_TOKEN_KEY = "taskflow.refreshToken"

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

/** localStorage throws in private-mode Safari and when storage is blocked. */
function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeKey(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* Storage unavailable — the session simply won't survive a reload. */
  }
}

function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* Nothing to do. */
  }
}

export function getAccessToken(): string | null {
  return readKey(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return readKey(REFRESH_TOKEN_KEY)
}

export function setTokens({ accessToken, refreshToken }: AuthTokens): void {
  writeKey(ACCESS_TOKEN_KEY, accessToken)
  writeKey(REFRESH_TOKEN_KEY, refreshToken)
}

export function setAccessToken(accessToken: string): void {
  writeKey(ACCESS_TOKEN_KEY, accessToken)
}

export function clearTokens(): void {
  removeKey(ACCESS_TOKEN_KEY)
  removeKey(REFRESH_TOKEN_KEY)
}

export function hasSession(): boolean {
  return getAccessToken() !== null
}
