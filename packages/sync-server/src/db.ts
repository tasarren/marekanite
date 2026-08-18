import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export type Db = DatabaseSync

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  license: string;
  token: string | null;
  created_at: number;
  disabled: number;
}

export type VaultRow = {
  uid: string;
  owner_id: number;
  name: string;
  keyhash: string;
  salt: string;
  host: string;
  region: string;
  encryption_version: number;
  created_at: number;
}

export type ShareRow = {
  uid: string;
  vault_uid: string;
  email: string;
  user_id: number | null;
  created_at: number;
}

export type RevisionRow = {
  uid: number;
  vault_uid: string;
  path: string;
  relatedpath: string | null;
  extension: string | null;
  hash: string | null;
  ctime: number;
  mtime: number;
  folder: number;
  deleted: number;
  size: number;
  device: string | null;
  user_id: number;
  created_at: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  license TEXT NOT NULL DEFAULT 'sync',
  token TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vaults (
  uid TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keyhash TEXT NOT NULL,
  salt TEXT NOT NULL,
  host TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'local',
  encryption_version INTEGER NOT NULL DEFAULT 3,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_shares (
  uid TEXT PRIMARY KEY,
  vault_uid TEXT NOT NULL REFERENCES vaults(uid) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS revisions (
  uid INTEGER PRIMARY KEY AUTOINCREMENT,
  vault_uid TEXT NOT NULL REFERENCES vaults(uid) ON DELETE CASCADE,
  path TEXT NOT NULL,
  relatedpath TEXT,
  extension TEXT,
  hash TEXT,
  ctime INTEGER NOT NULL DEFAULT 0,
  mtime INTEGER NOT NULL DEFAULT 0,
  folder INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  device TEXT,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blobs (
  revision_uid INTEGER PRIMARY KEY REFERENCES revisions(uid) ON DELETE CASCADE,
  ciphertext BLOB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revisions_vault_uid ON revisions(vault_uid, uid);
CREATE INDEX IF NOT EXISTS idx_revisions_vault_path ON revisions(vault_uid, path);
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
`

export function openDatabase(databasePath: string): DatabaseSync {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath)
  db.exec("PRAGMA journal_mode = WAL;")
  db.exec("PRAGMA foreign_keys = ON;")
  db.exec(SCHEMA)
  migrateUsers(db)
  return db
}

function migrateUsers(db: DatabaseSync) {
  const cols = db.prepare("PRAGMA table_info(users)").all() as Array<{
    name: string;
  }>
  if (!cols.some((c) => c.name === "disabled")) {
    db.exec(
      "ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0",
    )
  }
}
