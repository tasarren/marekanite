import { timingSafeEqual } from "node:crypto"

export type AdminTokenSource = "env" | "none"

export type ResolvedAdminToken = {
  token: string | null;
  source: AdminTokenSource;
}

/** Only `MAREKANITE_ADMIN_TOKEN`. Empty means admin UI is open (no unlock). */
export function resolveAdminToken(
  envToken = process.env.MAREKANITE_ADMIN_TOKEN,
): ResolvedAdminToken {
  const fromEnv = envToken?.trim() ?? ""
  if (fromEnv.length > 0) {
    return { token: fromEnv, source: "env" }
  }
  return { token: null, source: "none" }
}

export function tokensEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    const dummy = Buffer.alloc(b.length)
    timingSafeEqual(dummy, b)
    return false
  }
  return timingSafeEqual(a, b)
}

export function extractAdminToken(c: {
  req: {
    header: (name: string) => string | undefined;
    query: (name: string) => string | undefined;
    method: string;
  };
}): string | undefined {
  const header = c.req.header("authorization")
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim())
    if (match?.[1]) return match[1].trim()
  }
  const named = c.req.header("x-admin-token")
  if (named?.trim()) return named.trim()
  if (c.req.method === "GET") {
    const q = c.req.query("access_token")
    if (q?.trim()) return q.trim()
  }
  return undefined
}
