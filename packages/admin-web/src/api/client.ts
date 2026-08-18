/** Same-origin when served from Hono; Vite proxies in dev. */

export const ADMIN_TOKEN_KEY = "marekanite_admin_token"

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

export function adminHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  const token = getAdminToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  return headers
}

export function adminUrl(path: string): string {
  const token = getAdminToken()
  if (!token) return path
  const url = new URL(path, window.location.origin)
  url.searchParams.set("access_token", token)
  return `${url.pathname}${url.search}`
}

export async function adminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(path, { ...init, headers: adminHeaders(init.headers) })
}

export async function apiPost<T = Record<string, unknown>>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as Record<string, unknown>
  if ("error" in json) {
    throw new Error(String(json.error))
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return json as T
}

export async function apiHealth(): Promise<boolean> {
  try {
    const res = await fetch("/health")
    const j = (await res.json()) as { ok?: boolean }
    return !!j.ok
  } catch {
    return false
  }
}
