import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import type { Db, UserRow  } from "./db.js"

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password.normalize("NFKC"), salt, 32, SCRYPT_PARAMS)
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false
  const salt = Buffer.from(parts[1]!, "base64")
  const expected = Buffer.from(parts[2]!, "base64")
  const actual = scryptSync(password.normalize("NFKC"), salt, expected.length, SCRYPT_PARAMS)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export function newToken(): string {
  return randomBytes(32).toString("hex")
}

export function newVaultUid(): string {
  return randomBytes(16).toString("hex")
}

export function newShareUid(): string {
  return randomBytes(12).toString("hex")
}

/** Stable short id for display if needed. */
export function emailHash(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16)
}

export function getUserByToken(db: Db, token: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE token = ?").get(token) as UserRow | undefined
}

export function requireUser(db: Db, token: string | undefined): UserRow {
  if (!token) throw new AuthError("Not logged in")
  const user = getUserByToken(db, token)
  if (!user) throw new AuthError("Not logged in")
  if (user.disabled) throw new AuthError("This account is turned off")
  return user
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthError"
  }
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiError"
  }
}
