import type { Server as HttpServer } from "node:http"
import { WebSocketServer, type WebSocket } from "ws"
import type { Db } from "./db.js"
import { DEFAULT_PER_FILE_MAX, PIECE_SIZE } from "@marekanite/sync-protocol"
import type { Config } from "./config.js"
import { getUserByToken } from "./auth.js"
import {
  assertVaultAccess,
  getVault,
  verifyKeyhash,
} from "./vaults.js"
import {
  getBlob,
  getRevision,
  historyForPath,
  historyItem,
  insertRevision,
  listDeleted,
  maxRevisionUid,
  purgeVaultData,
  revisionToPush,
  revisionsAfter,
  vaultByteSize,
} from "./revisions.js"

type Session = {
  ws: WebSocket;
  userId: number;
  vaultUid: string;
  device: string;
  authed: boolean;
  /** Collecting binary pieces for an in-flight push. */
  pendingPush: {
    meta: {
      path: string;
      relatedpath: string | null;
      extension: string | null;
      hash: string | null;
      ctime: number;
      mtime: number;
      folder: boolean;
      deleted: boolean;
      size: number;
      pieces: number;
    };
    buffers: Buffer[];
    received: number;
  } | null;
}

const vaultRooms = new Map<string, Set<WebSocket>>()

function joinRoom(vaultUid: string, ws: WebSocket) {
  let set = vaultRooms.get(vaultUid)
  if (!set) {
    set = new Set()
    vaultRooms.set(vaultUid, set)
  }
  set.add(ws)
}

function leaveRoom(vaultUid: string | undefined, ws: WebSocket) {
  if (!vaultUid) return
  const set = vaultRooms.get(vaultUid)
  if (!set) return
  set.delete(ws)
  if (set.size === 0) vaultRooms.delete(vaultUid)
}

function sendJson(ws: WebSocket, obj: unknown) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(obj))
  }
}

function broadcastPush(vaultUid: string, except: WebSocket, payload: unknown) {
  const set = vaultRooms.get(vaultUid)
  if (!set) return
  const data = JSON.stringify(payload)
  for (const peer of set) {
    if (peer !== except && peer.readyState === peer.OPEN) {
      peer.send(data)
    }
  }
}

function sendBinaryPieces(ws: WebSocket, buf: Buffer) {
  if (buf.byteLength === 0) return
  const pieces = Math.ceil(buf.byteLength / PIECE_SIZE)
  for (let i = 0; i < pieces; i++) {
    const start = i * PIECE_SIZE
    const end = Math.min(buf.byteLength, start + PIECE_SIZE)
    ws.send(buf.subarray(start, end))
  }
}

export function createWsServer(
  db: Db,
  config: Config,
  httpServer: HttpServer,
): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer })

  wss.on("connection", (ws, req) => {
    console.log(`[ws] connection from ${req.socket.remoteAddress ?? "?"}`)
    const session: Session = {
      ws,
      userId: -1,
      vaultUid: "",
      device: "",
      authed: false,
      pendingPush: null,
    }

    ws.on("close", () => {
      console.log(
        `[ws] closed vault=${session.vaultUid || "-"} user=${session.userId}`,
      )
      leaveRoom(session.vaultUid || undefined, ws)
    })

    ws.on("error", (err) => {
      console.error("[ws] error", err)
    })

    ws.on("message", (data, isBinary) => {
      try {
        if (isBinary) {
          console.log(`[ws] binary ${Buffer.byteLength(data as Buffer)} bytes`)
          handleBinary(db, config, session, Buffer.from(data as Buffer))
          return
        }
        const text = data.toString()
        const msg = JSON.parse(text) as Record<string, unknown>
        console.log(`[ws] op=${String(msg.op ?? "?")}`)
        handleJson(db, config, session, msg)
      } catch(err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error("[ws] message error", message)
        if (!session.authed) {
          sendJson(ws, { res: "err", msg: message })
          ws.close()
        } else {
          sendJson(ws, { err: message })
        }
      }
    })
  })

  return wss
}

function handleJson(
  db: Db,
  config: Config,
  session: Session,
  msg: Record<string, unknown>,
) {
  const op = msg.op

  if (op === "ping") {
    sendJson(session.ws, { op: "pong" })
    return
  }

  if (!session.authed) {
    if (op !== "init") {
      sendJson(session.ws, { res: "err", msg: "Expected init" })
      session.ws.close()
      return
    }
    handleInit(db, config, session, msg)
    return
  }

  switch (op) {
    case "push":
      handlePushMeta(db, config, session, msg)
      break
    case "pull":
      handlePull(db, session, msg)
      break
    case "history":
      handleHistory(db, session, msg)
      break
    case "deleted":
      handleDeleted(db, session)
      break
    case "restore":
      handleRestore(db, session, msg)
      break
    case "purge":
      handlePurge(db, session)
      break
    case "size":
      handleSize(db, config, session)
      break
    case "usernames":
      handleUsernames(db, session)
      break
    default:
      sendJson(session.ws, { err: `Unknown op: ${String(op)}` })
  }
}

function handleInit(
  db: Db,
  config: Config,
  session: Session,
  msg: Record<string, unknown>,
) {
  const token = String(msg.token ?? "")
  const vaultUid = String(msg.id ?? "")
  const keyhash = String(msg.keyhash ?? "")
  const version = Number(msg.version ?? 0)
  const device = String(msg.device ?? "")

  const user = getUserByToken(db, token)
  if (!user) {
    sendJson(session.ws, { res: "err", msg: "Not logged in" })
    session.ws.close()
    return
  }

  const vault = getVault(db, vaultUid)
  if (!vault) {
    sendJson(session.ws, { res: "err", msg: "Vault not found" })
    session.ws.close()
    return
  }

  try {
    assertVaultAccess(db, vault, user)
    verifyKeyhash(vault, keyhash)
  } catch(err) {
    const message = err instanceof Error ? err.message : "Auth failed"
    sendJson(session.ws, { res: "err", msg: message })
    session.ws.close()
    return
  }

  session.authed = true
  session.userId = user.id
  session.vaultUid = vault.uid
  session.device = device
  joinRoom(vault.uid, session.ws)

  sendJson(session.ws, {
    res: "ok",
    perFileMax: config.perFileMax || DEFAULT_PER_FILE_MAX,
    userId: user.id,
  })

  // Replay revisions after client's watermark
  const after = Number.isFinite(version) ? version : 0
  const rows = revisionsAfter(db, vault.uid, after)
  for (const r of rows) {
    sendJson(session.ws, revisionToPush(r, device))
  }

  const maxUid = maxRevisionUid(db, vault.uid)
  sendJson(session.ws, { op: "ready", version: maxUid })
}

function handlePushMeta(
  db: Db,
  config: Config,
  session: Session,
  msg: Record<string, unknown>,
) {
  const folder = Boolean(msg.folder)
  const deleted = Boolean(msg.deleted)
  const size = Number(msg.size ?? 0)
  const pieces = Number(msg.pieces ?? 0)
  const path = String(msg.path ?? "")
  const relatedpath =
    msg.relatedpath === null || msg.relatedpath === undefined
      ? null
      : String(msg.relatedpath)
  const extension =
    msg.extension === undefined || msg.extension === null
      ? null
      : String(msg.extension)
  const hash =
    msg.hash === undefined || msg.hash === null || msg.hash === ""
      ? null
      : String(msg.hash)
  const ctime = Number(msg.ctime ?? 0)
  const mtime = Number(msg.mtime ?? 0)

  // Folder / delete / rename-only: no body pieces
  if (folder || deleted || size === 0 || pieces === 0) {
    const rev = insertRevision(db, {
      vaultUid: session.vaultUid,
      path,
      relatedpath,
      extension,
      hash: hash ?? "",
      ctime,
      mtime,
      folder,
      deleted,
      size: 0,
      device: session.device,
      userId: session.userId,
      ciphertext: null,
    })
    const payload = revisionToPush(rev, session.device)
    sendJson(session.ws, { res: "ok", uid: rev.uid })
    broadcastPush(session.vaultUid, session.ws, payload)
    // Also notify the pushing client via onServerPush path? Client ignores self via justPushed.
    // Official server still sends push to others; pusher tracks justPushed locally.
    return
  }

  if (size > (config.perFileMax || DEFAULT_PER_FILE_MAX)) {
    sendJson(session.ws, { err: "File too large" })
    return
  }

  // Client expects non-ok to start streaming pieces. Empty object / missing res works.
  session.pendingPush = {
    meta: {
      path,
      relatedpath,
      extension,
      hash,
      ctime,
      mtime,
      folder,
      deleted,
      size,
      pieces,
    },
    buffers: [],
    received: 0,
  }
  sendJson(session.ws, { res: "continue", pieces })
}

function handleBinary(
  db: Db,
  _config: Config,
  session: Session,
  chunk: Buffer,
) {
  const pending = session.pendingPush
  if (!pending) {
    sendJson(session.ws, { err: "Unexpected binary" })
    return
  }

  pending.buffers.push(chunk)
  pending.received += 1
  sendJson(session.ws, { res: "ok" })

  if (pending.received < pending.meta.pieces) {
    return
  }

  const ciphertext = Buffer.concat(pending.buffers)
  session.pendingPush = null

  const rev = insertRevision(db, {
    vaultUid: session.vaultUid,
    path: pending.meta.path,
    relatedpath: pending.meta.relatedpath,
    extension: pending.meta.extension,
    hash: pending.meta.hash ?? "",
    ctime: pending.meta.ctime,
    mtime: pending.meta.mtime,
    folder: pending.meta.folder,
    deleted: pending.meta.deleted,
    size: pending.meta.size,
    device: session.device,
    userId: session.userId,
    ciphertext,
  })

  broadcastPush(session.vaultUid, session.ws, revisionToPush(rev, session.device))
}

function handlePull(db: Db, session: Session, msg: Record<string, unknown>) {
  const uid = Number(msg.uid)
  const rev = getRevision(db, uid)
  if (!rev || rev.vault_uid !== session.vaultUid) {
    sendJson(session.ws, { err: "Not found" })
    return
  }
  if (rev.deleted) {
    sendJson(session.ws, { deleted: true })
    return
  }
  const blob = getBlob(db, uid) ?? Buffer.alloc(0)
  const pieces = blob.byteLength === 0 ? 0 : Math.ceil(blob.byteLength / PIECE_SIZE)
  sendJson(session.ws, { size: blob.byteLength, pieces })
  sendBinaryPieces(session.ws, blob)
}

function handleHistory(
  db: Db,
  session: Session,
  msg: Record<string, unknown>,
) {
  const path = String(msg.path ?? "")
  const last = msg.last !== undefined ? Number(msg.last) : undefined
  const rows = historyForPath(db, session.vaultUid, path, last)
  sendJson(session.ws, { items: rows.map(historyItem) })
}

function handleDeleted(db: Db, session: Session) {
  const rows = listDeleted(db, session.vaultUid)
  sendJson(session.ws, {
    items: rows.map((r) => ({
      uid: r.uid,
      path: r.path,
      ts: r.mtime || r.created_at,
      folder: !!r.folder,
      size: r.size,
      device: r.device ?? "",
      deleted: true,
    })),
  })
}

function handleRestore(db: Db, session: Session, msg: Record<string, unknown>) {
  const uid = Number(msg.uid)
  const old = getRevision(db, uid)
  if (!old || old.vault_uid !== session.vaultUid) {
    sendJson(session.ws, { err: "Not found" })
    return
  }
  const blob = getBlob(db, uid)
  const rev = insertRevision(db, {
    vaultUid: session.vaultUid,
    path: old.path,
    relatedpath: old.relatedpath,
    extension: old.extension,
    hash: old.hash,
    ctime: old.ctime,
    mtime: Date.now(),
    folder: !!old.folder,
    deleted: false,
    size: old.size,
    device: session.device,
    userId: session.userId,
    ciphertext: blob,
  })
  const payload = revisionToPush(rev, session.device)
  sendJson(session.ws, { res: "ok", uid: rev.uid })
  broadcastPush(session.vaultUid, session.ws, payload)
}

function handlePurge(db: Db, session: Session) {
  purgeVaultData(db, session.vaultUid)
  sendJson(session.ws, { res: "ok" })
}

function handleSize(db: Db, config: Config, session: Session) {
  const size = vaultByteSize(db, session.vaultUid)
  sendJson(session.ws, {
    size,
    limit: config.storageLimitBytes,
    vault_size: size,
  })
}

function handleUsernames(db: Db, session: Session) {
  const rows = db
    .prepare(
      `SELECT DISTINCT u.id, u.name, u.email FROM users u
       INNER JOIN revisions r ON r.user_id = u.id
       WHERE r.vault_uid = ?
       UNION
       SELECT id, name, email FROM users WHERE id = ?`,
    )
    .all(session.vaultUid, session.userId) as { id: number; name: string; email: string }[]

  const map: Record<string, string> = {}
  for (const r of rows) {
    map[String(r.id)] = r.name || r.email
  }
  sendJson(session.ws, { users: map })
}
