import type { Db, ShareRow, UserRow, VaultRow  } from "./db.js"
import { ApiError, newShareUid, newVaultUid } from "./auth.js"

/** Client list UI: Dd(e.size) + moment(e.created) + e.region — size must be a number. */
export function vaultToClient(v: VaultRow, sizeBytes = 0) {
  return {
    id: v.uid,
    name: v.name,
    salt: v.salt,
    host: v.host,
    encryption_version: v.encryption_version,
    region: v.region || "local",
    created: v.created_at,
    size: sizeBytes,
  }
}

export function vaultByteSizeForVault(db: Db, vaultUid: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(LENGTH(b.ciphertext)), 0) AS s
       FROM blobs b
       INNER JOIN revisions r ON r.uid = b.revision_uid
       WHERE r.vault_uid = ?`,
    )
    .get(vaultUid) as { s: number }
  return Number(row.s) || 0
}

export function vaultToClientWithSize(db: Db, v: VaultRow) {
  return vaultToClient(v, vaultByteSizeForVault(db, v.uid))
}

export function listOwnedVaults(db: Db, userId: number): VaultRow[] {
  return db
    .prepare("SELECT * FROM vaults WHERE owner_id = ? ORDER BY created_at ASC")
    .all(userId) as VaultRow[]
}

export function listSharedVaults(db: Db, user: UserRow): VaultRow[] {
  return db
    .prepare(
      `SELECT v.* FROM vaults v
       INNER JOIN vault_shares s ON s.vault_uid = v.uid
       WHERE s.email = ? COLLATE NOCASE OR s.user_id = ?
       ORDER BY v.created_at ASC`,
    )
    .all(user.email, user.id) as VaultRow[]
}

export function getVault(db: Db, uid: string): VaultRow | undefined {
  return db.prepare("SELECT * FROM vaults WHERE uid = ?").get(uid) as VaultRow | undefined
}

export function assertVaultAccess(db: Db, vault: VaultRow, user: UserRow): void {
  if (vault.owner_id === user.id) return
  const share = db
    .prepare(
      `SELECT 1 FROM vault_shares
       WHERE vault_uid = ? AND (email = ? COLLATE NOCASE OR user_id = ?)
       LIMIT 1`,
    )
    .get(vault.uid, user.email, user.id)
  if (!share) throw new ApiError("Vault not found")
}

export function createVault(
  db: Db,
  user: UserRow,
  input: {
    name: string;
    keyhash: string;
    salt: string;
    region?: string;
    encryption_version: number;
    host: string;
  },
): VaultRow {
  const uid = newVaultUid()
  const created_at = Date.now()
  db.prepare(
    `INSERT INTO vaults (uid, owner_id, name, keyhash, salt, host, region, encryption_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    uid,
    user.id,
    input.name,
    input.keyhash,
    input.salt,
    input.host,
    input.region ?? "local",
    input.encryption_version,
    created_at,
  )
  return getVault(db, uid)!
}

export function renameVault(db: Db, vault: VaultRow, name: string): void {
  db.prepare("UPDATE vaults SET name = ? WHERE uid = ?").run(name, vault.uid)
}

export function deleteVault(db: Db, vault: VaultRow): void {
  db.prepare("DELETE FROM vaults WHERE uid = ?").run(vault.uid)
}

export function verifyKeyhash(vault: VaultRow, keyhash: string): void {
  if (vault.keyhash !== keyhash) {
    throw new ApiError("Incorrect password")
  }
}

export function listShares(db: Db, vaultUid: string): ShareRow[] {
  return db
    .prepare("SELECT * FROM vault_shares WHERE vault_uid = ? ORDER BY created_at ASC")
    .all(vaultUid) as ShareRow[]
}

export function inviteShare(
  db: Db,
  vaultUid: string,
  email: string,
): ShareRow {
  const existing = db
    .prepare("SELECT * FROM vault_shares WHERE vault_uid = ? AND email = ? COLLATE NOCASE")
    .get(vaultUid, email) as ShareRow | undefined
  if (existing) return existing

  const target = db
    .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
    .get(email) as { id: number } | undefined

  const uid = newShareUid()
  const created_at = Date.now()
  db.prepare(
    `INSERT INTO vault_shares (uid, vault_uid, email, user_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(uid, vaultUid, email, target?.id ?? null, created_at)

  return db.prepare("SELECT * FROM vault_shares WHERE uid = ?").get(uid) as ShareRow
}

export function removeShare(db: Db, vaultUid: string, shareUid: string): void {
  const r = db
    .prepare("DELETE FROM vault_shares WHERE uid = ? AND vault_uid = ?")
    .run(shareUid, vaultUid)
  if (r.changes === 0) throw new ApiError("Share not found")
}
