import type { Db, RevisionRow  } from "./db.js"

export type PushInput = {
  vaultUid: string;
  path: string;
  relatedpath: string | null;
  extension: string | null;
  hash: string | null;
  ctime: number;
  mtime: number;
  folder: boolean;
  deleted: boolean;
  size: number;
  device: string | null;
  userId: number;
  ciphertext?: Buffer | null;
}

export function insertRevision(db: Db, input: PushInput): RevisionRow {
  const created_at = Date.now()
  const result = db
    .prepare(
      `INSERT INTO revisions
        (vault_uid, path, relatedpath, extension, hash, ctime, mtime, folder, deleted, size, device, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.vaultUid,
      input.path,
      input.relatedpath,
      input.extension,
      input.hash,
      input.ctime,
      input.mtime,
      input.folder ? 1 : 0,
      input.deleted ? 1 : 0,
      input.size,
      input.device,
      input.userId,
      created_at,
    )

  const uid = Number(result.lastInsertRowid)
  if (input.ciphertext && input.ciphertext.byteLength > 0) {
    db.prepare("INSERT INTO blobs (revision_uid, ciphertext) VALUES (?, ?)").run(
      uid,
      input.ciphertext,
    )
  }

  return getRevision(db, uid)!
}

export function getRevision(db: Db, uid: number): RevisionRow | undefined {
  return db.prepare("SELECT * FROM revisions WHERE uid = ?").get(uid) as RevisionRow | undefined
}

export function getBlob(db: Db, revisionUid: number): Buffer | null {
  const row = db
    .prepare("SELECT ciphertext FROM blobs WHERE revision_uid = ?")
    .get(revisionUid) as { ciphertext: Buffer } | undefined
  return row?.ciphertext ?? null
}

export function revisionsAfter(
  db: Db,
  vaultUid: string,
  afterUid: number,
): RevisionRow[] {
  return db
    .prepare(
      "SELECT * FROM revisions WHERE vault_uid = ? AND uid > ? ORDER BY uid ASC",
    )
    .all(vaultUid, afterUid) as RevisionRow[]
}

export function maxRevisionUid(db: Db, vaultUid: string): number {
  const row = db
    .prepare("SELECT COALESCE(MAX(uid), 0) AS m FROM revisions WHERE vault_uid = ?")
    .get(vaultUid) as { m: number }
  return row.m
}

export function historyForPath(
  db: Db,
  vaultUid: string,
  path: string,
  last?: number,
): RevisionRow[] {
  if (last && last > 0) {
    return db
      .prepare(
        "SELECT * FROM revisions WHERE vault_uid = ? AND path = ? ORDER BY uid DESC LIMIT ?",
      )
      .all(vaultUid, path, last) as RevisionRow[]
  }
  return db
    .prepare("SELECT * FROM revisions WHERE vault_uid = ? AND path = ? ORDER BY uid DESC")
    .all(vaultUid, path) as RevisionRow[]
}

/** Latest revision per path that is deleted (and not superseded by a non-deleted later rev). */
export function listDeleted(db: Db, vaultUid: string): RevisionRow[] {
  return db
    .prepare(
      `SELECT r.* FROM revisions r
       INNER JOIN (
         SELECT path, MAX(uid) AS max_uid FROM revisions WHERE vault_uid = ? GROUP BY path
       ) latest ON latest.max_uid = r.uid
       WHERE r.vault_uid = ? AND r.deleted = 1
       ORDER BY r.uid DESC`,
    )
    .all(vaultUid, vaultUid) as RevisionRow[]
}

export function vaultByteSize(db: Db, vaultUid: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(LENGTH(b.ciphertext)), 0) AS s
       FROM blobs b
       INNER JOIN revisions r ON r.uid = b.revision_uid
       WHERE r.vault_uid = ?`,
    )
    .get(vaultUid) as { s: number }
  return row.s
}

export function purgeVaultData(db: Db, vaultUid: string): void {
  db.prepare(
    "DELETE FROM blobs WHERE revision_uid IN (SELECT uid FROM revisions WHERE vault_uid = ?)",
  ).run(vaultUid)
  db.prepare("DELETE FROM revisions WHERE vault_uid = ?").run(vaultUid)
}

export function revisionToPush(r: RevisionRow, deviceFallback?: string | null) {
  return {
    op: "push" as const,
    uid: r.uid,
    path: r.path,
    hash: r.hash ?? "",
    ctime: r.ctime,
    mtime: r.mtime,
    size: r.size,
    folder: !!r.folder,
    deleted: !!r.deleted,
    device: r.device ?? deviceFallback ?? undefined,
    user: r.user_id,
  }
}

export function historyItem(r: RevisionRow) {
  return {
    uid: r.uid,
    path: r.path,
    relatedpath: r.relatedpath ?? "",
    ts: r.mtime || r.created_at,
    folder: !!r.folder,
    deleted: !!r.deleted,
    size: r.size,
    device: r.device ?? "",
  }
}
