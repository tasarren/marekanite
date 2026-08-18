/**
 * Client-compatible crypto helpers for tests.
 * Mirrors Obsidian 1.13 scrypt key derivation (password + salt → 32-byte key).
 * Full AES-SIV path encoding is not required for server tests (server is blind).
 */
import { createHash, randomBytes, scryptSync } from "node:crypto"

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

/** scrypt(password, salt) → 32-byte key (matches FC() on desktop). */
export function deriveVaultKey(password: string, salt: string): Buffer {
  const pw = Buffer.from(password.normalize("NFKC"), "utf8")
  const sa = Buffer.from(salt.normalize("NFKC"), "utf8")
  return scryptSync(pw, sa, 32, SCRYPT)
}

/** Encryption version 0 keyhash ≈ hex(SHA-256(key)). */
export function keyHashV0(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex")
}

/**
 * For local tests we store whatever the "client" would send as keyhash.
 * Official v2/v3 use HKDF; tests can use keyHashV0 as a stand-in when
 * the server only equality-checks the string.
 */
export function makeTestVaultSecrets(password: string): {
  salt: string;
  keyhash: string;
  encryption_version: number;
  key: Buffer;
} {
  const salt = randomBytes(16).toString("hex")
  const key = deriveVaultKey(password, salt)
  return {
    salt,
    keyhash: keyHashV0(key),
    encryption_version: 3,
    key,
  }
}

export function randomSalt(): string {
  return randomBytes(16).toString("hex")
}
