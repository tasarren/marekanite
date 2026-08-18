import fs from "node:fs"
import path from "node:path"
import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import type { Config } from "./config.js"
import type { Db } from "./db.js"
import { hashPassword } from "./auth.js"
import {
  createFromReleaseJob,
  createPatchJob,
  getJob,
  jobPublicView,
} from "./patch-jobs.js"
import {
  invalidateReleaseListCache,
  listReleases,
  stockCacheStatus,
} from "./github-releases.js"
import { parseClientPlatform } from "@marekanite/client-patch"
import { extractAdminToken, tokensEqual } from "./admin-token.js"
import { AdbCli, AdbCliError } from "./adb-cli.js"
import { probeHostTools } from "./host-tools.js"

const MAX_UPLOAD = 400 * 1024 * 1024 // 400 MB (Windows EXE is ~330 MB)

export function createAdminRoutes(config: Config, db: Db) {
  const app = new Hono()
  const adb = config.adbPath ? new AdbCli(config.adbPath) : new AdbCli()

  app.get("/session", (c) => {
    if (!config.adminToken) {
      return c.json({ auth: "none" as const, ok: true })
    }
    const provided = extractAdminToken(c)
    const ok = !!provided && tokensEqual(provided, config.adminToken)
    return c.json({ auth: "token" as const, ok })
  })

  app.use("*", async(c, next) => {
    if (c.req.path === "/session" || c.req.path.endsWith("/session")) {
      return next()
    }
    if (!config.adminToken) {
      return next()
    }
    const provided = extractAdminToken(c)
    if (!provided || !tokensEqual(provided, config.adminToken)) {
      return c.json({ error: "Admin token required" }, 401)
    }
    return next()
  })

  app.get("/users", (c) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.created_at, u.disabled,
                (SELECT COUNT(*) FROM vaults v WHERE v.owner_id = u.id) AS vaults
         FROM users u
         ORDER BY u.created_at DESC`,
      )
      .all() as Array<{
      id: number;
      email: string;
      name: string;
      created_at: number;
      disabled: number;
      vaults: number;
    }>
    return c.json({
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.created_at,
        disabled: !!u.disabled,
        vaults: Number(u.vaults),
      })),
    })
  })

  app.post("/users", async(c) => {
    let body: { email?: string; password?: string; name?: string }
    try {
      body = (await c.req.json())
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    const email = body.email?.trim().toLowerCase() ?? ""
    const password = body.password ?? ""
    const name = body.name?.trim() || email.split("@")[0] || "User"
    if (!email.includes("@") || password.length < 1) {
      return c.json({ error: "Need an email and a password" }, 400)
    }
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email)
    if (existing) return c.json({ error: "That email is already on this server" }, 409)
    const result = db
      .prepare(
        "INSERT INTO users (email, password_hash, name, license, created_at) VALUES (?, ?, ?, 'sync', ?)",
      )
      .run(email, hashPassword(password), name, Date.now())
    return c.json({
      id: Number(result.lastInsertRowid),
      email,
      name,
      vaults: 0,
      disabled: false,
    })
  })

  app.patch("/users/:id", async(c) => {
    const id = Number(c.req.param("id"))
    if (!Number.isInteger(id) || id < 1) {
      return c.json({ error: "Unknown person" }, 404)
    }
    const row = db
      .prepare("SELECT id, email FROM users WHERE id = ?")
      .get(id) as { id: number; email: string } | undefined
    if (!row) return c.json({ error: "Unknown person" }, 404)

    let body: {
      email?: string;
      name?: string;
      password?: string;
      disabled?: boolean;
    }
    try {
      body = (await c.req.json())
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }

    if (typeof body.name === "string") {
      const name = body.name.trim()
      if (name) db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, id)
    }
    if (typeof body.email === "string") {
      const email = body.email.trim().toLowerCase()
      if (!email.includes("@")) {
        return c.json({ error: "That email doesn’t look right" }, 400)
      }
      const clash = db
        .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
        .get(email, id)
      if (clash) return c.json({ error: "That email is already on this server" }, 409)
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, id)
    }
    if (typeof body.password === "string" && body.password.length > 0) {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
        hashPassword(body.password),
        id,
      )
    }
    if (typeof body.disabled === "boolean") {
      db.prepare("UPDATE users SET disabled = ?, token = NULL WHERE id = ?").run(
        body.disabled ? 1 : 0,
        id,
      )
    }

    const updated = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.created_at, u.disabled,
                (SELECT COUNT(*) FROM vaults v WHERE v.owner_id = u.id) AS vaults
         FROM users u WHERE u.id = ?`,
      )
      .get(id) as {
      id: number;
      email: string;
      name: string;
      created_at: number;
      disabled: number;
      vaults: number;
    }
    return c.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      createdAt: updated.created_at,
      disabled: !!updated.disabled,
      vaults: Number(updated.vaults),
    })
  })

  app.delete("/users/:id", (c) => {
    const id = Number(c.req.param("id"))
    if (!Number.isInteger(id) || id < 1) {
      return c.json({ error: "Unknown person" }, 404)
    }
    const info = db.prepare("DELETE FROM users WHERE id = ?").run(id)
    if (!info.changes) return c.json({ error: "Unknown person" }, 404)
    return c.json({ ok: true })
  })

  app.get("/events", (c) => {
    return streamSSE(c, async(stream) => {
      const writeTools = async() => {
        const tools = await probeHostTools(adb)
        await stream.writeSSE({
          event: "tools",
          data: JSON.stringify({ tools }),
        })
      }
      await writeTools()
      const iv = setInterval(() => {
        void writeTools()
        void stream.writeSSE({ event: "ping", data: "{}" })
      }, 15_000)
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(iv)
          resolve()
        })
      })
    })
  })

  app.post("/adb/pair", async(c) => {
    let body: { host?: string; port?: string | number; code?: string }
    try {
      body = (await c.req.json())
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    try {
      const result = await adb.pair(body.host ?? "", body.port ?? "", body.code ?? "")
      return c.json(result)
    } catch(e) {
      const status = e instanceof AdbCliError ? 400 : 500
      return c.json({ error: e instanceof Error ? e.message : String(e) }, status)
    }
  })

  app.post("/adb/connect", async(c) => {
    let body: { host?: string; port?: string | number }
    try {
      body = (await c.req.json())
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    try {
      return c.json(await adb.connect(body.host ?? "", body.port ?? ""))
    } catch(e) {
      const status = e instanceof AdbCliError ? 400 : 500
      return c.json({ error: e instanceof Error ? e.message : String(e) }, status)
    }
  })

  app.post("/adb/inspect", async(c) => {
    let body: { host?: string; port?: string | number; serial?: string }
    try {
      body = (await c.req.json())
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    const serial =
      body.serial?.trim() ||
      (body.host != null && body.port != null
        ? `${body.host}:${body.port}`
        : "")
    try {
      return c.json(await adb.inspect(serial))
    } catch(e) {
      const status = e instanceof AdbCliError ? 400 : 500
      return c.json({ error: e instanceof Error ? e.message : String(e) }, status)
    }
  })

  app.post("/adb/install", async(c) => {
    let body: {
      jobId?: string;
      serial?: string;
      uninstall?: boolean;
      uninstallFirst?: boolean;
    }
    try {
      body = (await c.req.json())
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    const job = body.jobId ? getJob(body.jobId) : undefined
    if (!job || job.kind !== "android" || job.status !== "done" || !job.outputPath) {
      return c.json({ error: "Patch the Android app first" }, 409)
    }
    try {
      const result = await adb.install({
        serial: body.serial ?? "",
        apkPath: job.outputPath,
        uninstall: body.uninstall === true || body.uninstallFirst === true,
      })
      return c.json({
        ok: true,
        output: result.output,
        profile: result.profile,
        sdk: result.sdk,
      })
    } catch(e) {
      const status = e instanceof AdbCliError ? 400 : 500
      return c.json({ error: e instanceof Error ? e.message : String(e) }, status)
    }
  })

  app.get("/releases", async(c) => {
    try {
      const force = c.req.query("refresh") === "1"
      if (force) invalidateReleaseListCache()
      const releases = await listReleases({ force })
      return c.json({ releases: stockCacheStatus(config, releases) })
    } catch(err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : String(err),
        },
        502,
      )
    }
  })

  app.post("/releases/refresh", async(c) => {
    invalidateReleaseListCache()
    try {
      const releases = await listReleases({ force: true })
      return c.json({ releases: stockCacheStatus(config, releases) })
    } catch(err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : String(err),
        },
        502,
      )
    }
  })

  app.post("/patch/from-release", async(c) => {
    let body: {
      version?: string;
      platform?: string;
      kind?: string;
      apiBase?: string;
      extraWsSuffix?: string;
    }
    try {
      body = (await c.req.json())
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }
    const version = body.version?.trim()
    const platform = parseClientPlatform(body.platform ?? body.kind)
    if (!version || !platform) {
      return c.json(
        {
          error:
            "Body must include version and platform (linux|macos|windows|android)",
        },
        400,
      )
    }
    const apiBase =
      typeof body.apiBase === "string" && body.apiBase
        ? body.apiBase
        : config.publicApiBase
    const extraWsSuffix =
      typeof body.extraWsSuffix === "string" && body.extraWsSuffix
        ? body.extraWsSuffix
        : undefined

    const job = createFromReleaseJob(config, {
      version,
      platform,
      apiBase,
      extraWsSuffix,
    })
    return c.json({ jobId: job.id, status: job.status })
  })

  app.post("/patch/desktop", async(c) => {
    return handleUpload(c, config, "desktop")
  })
  app.post("/patch/android", async(c) => {
    return handleUpload(c, config, "android")
  })

  app.get("/patch/:jobId", (c) => {
    const job = getJob(c.req.param("jobId"))
    if (!job) return c.json({ error: "Job not found" }, 404)
    return c.json(jobPublicView(job))
  })

  app.get("/patch/:jobId/events", (c) => {
    const job = getJob(c.req.param("jobId"))
    if (!job) return c.json({ error: "Job not found" }, 404)

    return streamSSE(c, async(stream) => {
      for (const line of job.logs) {
        await stream.writeSSE({ data: JSON.stringify({ line }) })
      }
      if (job.status === "done" || job.status === "error") {
        await stream.writeSSE({
          data: JSON.stringify({ status: job.status, error: job.error }),
        })
        return
      }

      await new Promise<void>((resolve) => {
        const onLine = (line: string) => {
          void stream.writeSSE({ data: JSON.stringify({ line }) })
        }
        job.listeners.add(onLine)
        const iv = setInterval(() => {
          if (job.status === "done" || job.status === "error") {
            clearInterval(iv)
            job.listeners.delete(onLine)
            void stream
              .writeSSE({
                data: JSON.stringify({ status: job.status, error: job.error }),
              })
              .then(() => { resolve() })
          }
        }, 200)
        stream.onAbort(() => {
          clearInterval(iv)
          job.listeners.delete(onLine)
          resolve()
        })
      })
    })
  })

  app.get("/patch/:jobId/download", (c) => {
    const job = getJob(c.req.param("jobId"))
    if (!job) return c.json({ error: "Job not found" }, 404)
    if (job.status !== "done" || !job.outputPath || !fs.existsSync(job.outputPath)) {
      return c.json({ error: "Artifact not ready" }, 409)
    }
    const buf = fs.readFileSync(job.outputPath)
    const name = job.downloadName ?? path.basename(job.outputPath)
    return new Response(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(buf.byteLength),
      },
    })
  })

  return app
}

async function handleUpload(
  c: {
    req: {
      parseBody: () => Promise<
        Record<string, string | File | (string | File)[]>
      >;
    };
    json: (body: unknown, status?: number) => Response;
  },
  config: Config,
  fallback: "desktop" | "android",
) {
  const body = await c.req.parseBody()
  const file = body["file"]
  if (!(file instanceof File)) {
    return c.json({ error: "Missing file field" }, 400)
  }
  if (file.size > MAX_UPLOAD) {
    return c.json({ error: `File too large (max ${MAX_UPLOAD} bytes)` }, 400)
  }

  const apiBase =
    typeof body["apiBase"] === "string" && body["apiBase"]
      ? body["apiBase"]
      : config.publicApiBase
  const extraWsSuffix =
    typeof body["extraWsSuffix"] === "string" && body["extraWsSuffix"]
      ? body["extraWsSuffix"]
      : undefined
  const platform =
    parseClientPlatform(body["platform"]) ??
    (fallback === "android" ? "android" : "linux")

  const uploadDir = path.join(path.dirname(config.databasePath), "patch-uploads")
  fs.mkdirSync(uploadDir, { recursive: true })
  const uploadPath = path.join(
    uploadDir,
    `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`,
  )
  const ab = await file.arrayBuffer()
  fs.writeFileSync(uploadPath, Buffer.from(ab))

  const job = createPatchJob(config, platform, uploadPath, {
    apiBase,
    extraWsSuffix,
    originalName: file.name,
  })

  return c.json({ jobId: job.id, status: job.status })
}
