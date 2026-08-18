import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { serveStatic } from "@hono/node-server/serve-static"
import type { Db } from "./db.js"
import { createAdminRoutes } from "./admin-routes.js"
import {
  SignInBodySchema,
  SignUpBodySchema,
  TokenBodySchema,
  VaultAccessBodySchema,
  VaultCreateBodySchema,
  VaultListBodySchema,
  VaultRegionsBodySchema,
  VaultRenameBodySchema,
  VaultShareInviteBodySchema,
  VaultShareRemoveBodySchema,
  VaultUidBodySchema,
} from "@marekanite/sync-protocol"
import {
  ApiError,
  AuthError,
  hashPassword,
  newToken,
  requireUser,
  verifyPassword,
} from "./auth.js"
import type { Config } from "./config.js"
import {
  assertVaultAccess,
  createVault,
  deleteVault,
  getVault,
  inviteShare,
  listOwnedVaults,
  listSharedVaults,
  listShares,
  removeShare,
  renameVault,
  vaultToClientWithSize,
  verifyKeyhash,
} from "./vaults.js"

/** Trivial PoW the stock client can solve in one iteration (maxNumber: 0). */
export function createLocalPowChallenge(now = Date.now()) {
  const salt = "local"
  const solution = 0
  const challenge = createHash("sha256")
    .update(`${salt}:${solution}`, "utf8")
    .digest("hex")
  return {
    algorithm: "SHA-256" as const,
    salt,
    challenge,
    maxNumber: 0,
    signature: "local",
    expiration: now + 3_600_000,
  }
}

function withLiveHost<T extends { host: string }>(
  row: T,
  config: Config,
): T {
  return { ...row, host: config.publicSyncHost }
}

type Vars = { db: Db; config: Config }

export function createHttpApp(db: Db, config: Config) {
  const app = new Hono<{ Variables: Vars }>()

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["POST", "OPTIONS", "GET", "PATCH", "DELETE"],
      allowHeaders: ["Content-Type", "User-Agent", "*"],
    }),
  )

  app.use("*", async(c, next) => {
    const started = Date.now()
    c.set("db", db)
    c.set("config", config)
    await next()
    const ms = Date.now() - started
    console.log(
      `[http] ${c.req.method} ${c.req.path} → ${c.res.status} (${ms}ms)`,
    )
  })

  app.onError((err, c) => {
    if (err instanceof AuthError || err instanceof ApiError) {
      return c.json({ error: err.message }, 200)
    }
    console.error(err)
    return c.json({ error: err.message || "Internal error" }, 500)
  })

  app.get("/health", (c) => c.json({ ok: true }))

  // --- Auth ---

  app.post("/user/signup", async(c) => {
    const body = SignUpBodySchema.parse(await c.req.json())
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
      .get(body.email)
    if (existing) throw new ApiError("Email already registered")

    const token = newToken()
    const created_at = Date.now()
    const password_hash = hashPassword(body.password)
    const info = db
      .prepare(
        `INSERT INTO users (email, password_hash, name, license, token, created_at)
         VALUES (?, ?, ?, 'sync', ?, ?)`,
      )
      .run(body.email, password_hash, body.name, token, created_at)

    return c.json({
      token,
      email: body.email,
      name: body.name,
      license: "sync",
      id: Number(info.lastInsertRowid),
    })
  })

  app.post("/user/signin", async(c) => {
    const body = SignInBodySchema.parse(await c.req.json())
    const user = db
      .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
      .get(body.email) as
      | {
        id: number;
        password_hash: string;
        email: string;
        name: string;
        license: string;
        disabled: number;
      }
      | undefined
    if (!user || !verifyPassword(body.password, user.password_hash)) {
      throw new ApiError("Invalid email or password")
    }
    if (user.disabled) throw new ApiError("This account is turned off")
    const token = newToken()
    db.prepare("UPDATE users SET token = ? WHERE id = ?").run(token, user.id)
    return c.json({
      token,
      email: user.email,
      name: user.name,
      license: user.license || "sync",
    })
  })

  app.post("/user/signout", async(c) => {
    const body = TokenBodySchema.parse(await c.req.json())
    db.prepare("UPDATE users SET token = NULL WHERE token = ?").run(body.token)
    return c.json({})
  })

  app.post("/user/info", async(c) => {
    const body = TokenBodySchema.parse(await c.req.json())
    const user = requireUser(db, body.token)
    return c.json({
      email: user.email,
      name: user.name,
      license: user.license,
    })
  })

  app.post("/user/authtoken", async(c) => {
    const body = TokenBodySchema.parse(await c.req.json())
    const user = requireUser(db, body.token)
    return c.json({
      token: user.token,
      email: user.email,
      name: user.name,
      license: user.license,
    })
  })

  app.post("/user/pow-challenge", async(c) => {
    // Stock client solves SHA-256(salt+":"+n) === challenge for n in 0..maxNumber.
    return c.json(createLocalPowChallenge())
  })

  app.post("/user/forgetpass", async(c) => c.json({}))
  app.post("/user/resendconfirmation", async(c) => c.json({}))

  app.post("/subscription/list", async(c) => {
    const body = TokenBodySchema.parse(await c.req.json())
    requireUser(db, body.token)
    // Client checks top-level `sync` before Connect (not items[]).
    return c.json({
      sync: true,
      publish: false,
      limit: config.storageLimitBytes,
      items: [{ type: "sync", status: "active", limit: config.storageLimitBytes }],
    })
  })

  app.post("/subscription/sync/signup-mobile", async(c) => {
    const body = TokenBodySchema.parse(await c.req.json())
    requireUser(db, body.token)
    return c.json({ ok: true })
  })

  app.post("/subscription/business", async(c) => c.json({ ok: true }))

  // --- Vaults ---

  app.post("/vault/regions", async(c) => {
    const body = VaultRegionsBodySchema.parse(await c.req.json())
    requireUser(db, body.token)
    return c.json({
      regions: [{ id: "local", name: "Local", host: config.publicSyncHost }],
    })
  })

  app.post("/vault/list", async(c) => {
    const body = VaultListBodySchema.parse(await c.req.json())
    const user = requireUser(db, body.token)
    const vaults = listOwnedVaults(db, user.id).map((v) =>
      withLiveHost(vaultToClientWithSize(db, v), config),
    )
    const shared = listSharedVaults(db, user).map((v) =>
      withLiveHost(vaultToClientWithSize(db, v), config),
    )
    return c.json({
      limit: config.storageLimitBytes,
      vaults,
      shared,
    })
  })

  app.post("/vault/create", async(c) => {
    const body = VaultCreateBodySchema.parse(await c.req.json())
    const user = requireUser(db, body.token)
    const vault = createVault(db, user, {
      name: body.name,
      keyhash: body.keyhash,
      salt: body.salt,
      region: body.region,
      encryption_version: body.encryption_version,
      host: config.publicSyncHost,
    })
    return c.json(withLiveHost(vaultToClientWithSize(db, vault), config))
  })

  app.post("/vault/access", async(c) => {
    const body = VaultAccessBodySchema.parse(await c.req.json())
    const user = requireUser(db, body.token)
    const vault = getVault(db, body.vault_uid)
    if (!vault) throw new ApiError("Vault not found")
    assertVaultAccess(db, vault, user)
    verifyKeyhash(vault, body.keyhash)
    return c.json({ ok: true, host: config.publicSyncHost })
  })

  app.post("/vault/rename", async(c) => {
    const body = VaultRenameBodySchema.parse(await c.req.json())
    const user = requireUser(db, body.token)
    const vault = getVault(db, body.vault_uid)
    if (!vault) throw new ApiError("Vault not found")
    if (vault.owner_id !== user.id) throw new ApiError("Permission denied")
    renameVault(db, vault, body.name)
    return c.json({ ok: true })
  })

  app.post("/vault/delete", async(c) => {
    const body = VaultUidBodySchema.parse(await c.req.json())
    const user = requireUser(db, body.token)
    const vault = getVault(db, body.vault_uid)
    if (!vault) throw new ApiError("Vault not found")
    if (vault.owner_id !== user.id) throw new ApiError("Permission denied")
    deleteVault(db, vault)
    return c.json({ ok: true })
  })

  app.post("/vault/migrate", async(c) => {
    const raw = await c.req.json()
    const body = {
      token: String(raw.token ?? ""),
      vault_uid: String(raw.vault_uid ?? ""),
      keyhash: String(raw.keyhash ?? ""),
      salt: String(raw.salt ?? ""),
      region: raw.region !== undefined ? String(raw.region) : undefined,
      encryption_version: Number(raw.encryption_version ?? 3),
    }
    const user = requireUser(db, body.token)
    const vault = getVault(db, body.vault_uid)
    if (!vault) throw new ApiError("Vault not found")
    if (vault.owner_id !== user.id) throw new ApiError("Permission denied")
    db.prepare(
      `UPDATE vaults SET keyhash = ?, salt = ?, encryption_version = ?, host = ?, region = ?
       WHERE uid = ?`,
    ).run(
      body.keyhash,
      body.salt,
      body.encryption_version,
      config.publicSyncHost,
      body.region ?? vault.region,
      vault.uid,
    )
    return c.json(
      withLiveHost(vaultToClientWithSize(db, getVault(db, vault.uid)!), config),
    )
  })

  app.post("/vault/share/list", async(c) => {
    const body = VaultUidBodySchema.parse(await c.req.json())
    const user = requireUser(db, body.token)
    const vault = getVault(db, body.vault_uid)
    if (!vault) throw new ApiError("Vault not found")
    assertVaultAccess(db, vault, user)
    const shares = listShares(db, vault.uid).map((s) => ({
      uid: s.uid,
      email: s.email,
      name: s.email,
    }))
    return c.json({ shares })
  })

  app.post("/vault/share/invite", async(c) => {
    const body = VaultShareInviteBodySchema.parse(await c.req.json())
    const user = requireUser(db, body.token)
    const vault = getVault(db, body.vault_uid)
    if (!vault) throw new ApiError("Vault not found")
    if (vault.owner_id !== user.id) throw new ApiError("Permission denied")
    const share = inviteShare(db, vault.uid, body.email)
    return c.json({ uid: share.uid, email: share.email })
  })

  app.post("/vault/share/remove", async(c) => {
    const body = VaultShareRemoveBodySchema.parse(await c.req.json())
    const user = requireUser(db, body.token)
    const vault = getVault(db, body.vault_uid)
    if (!vault) throw new ApiError("Vault not found")
    if (vault.owner_id !== user.id) throw new ApiError("Permission denied")
    removeShare(db, vault.uid, body.share_uid)
    return c.json({ ok: true })
  })

  // Admin: patch jobs + SPA
  app.route("/admin", createAdminRoutes(config, db))

  const adminDist =
    process.env.NODE_ENV === "production" ? resolveAdminWebDist() : null
  if (adminDist) {
    app.use(
      "/*",
      serveStatic({
        root: adminDist,
        rewriteRequestPath: (p) => (p === "/" ? "/index.html" : p),
      }),
    )
    // SPA history fallback
    app.get("*", async(c) => {
      const index = path.join(adminDist, "index.html")
      if (fs.existsSync(index)) {
        return c.html(fs.readFileSync(index, "utf8"))
      }
      return c.text("admin-web not built", 404)
    })
  } else {
    app.get("/", (c) =>
      c.html(
        `<!doctype html><html><body style="font-family:system-ui;padding:2rem">
        <h1>Marekanite API</h1>
        <p>Protocol is up. Open the admin UI at <a href="http://127.0.0.1:5173">http://127.0.0.1:5173</a> (<code>pnpm dev</code>).</p>
        <p><a href="/health">/health</a></p>
        </body></html>`,
      ),
    )
  }

  return app
}

function resolveAdminWebDist(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url))
  // packages/sync-server/src → packages/admin-web/dist
  const candidate = path.resolve(here, "../../admin-web/dist")
  if (fs.existsSync(path.join(candidate, "index.html"))) return candidate
  return null
}
