import { describe, it, beforeAll, afterAll, expect } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { openDatabase } from "./db.js"
import { createHttpApp } from "./http-app.js"
import type { Config } from "./config.js"

const config: Config = {
  publicApiBase: "http://127.0.0.1:8787",
  publicSyncHost: "127.0.0.1:3003",
  listenHttpHost: "127.0.0.1",
  listenHttpPort: 8787,
  listenWsHost: "127.0.0.1",
  listenWsPort: 3003,
  databasePath: "",
  storageLimitBytes: 1_000_000_000,
  perFileMax: 208_666_624,
  adminToken: "test-admin-token",
  adminTokenSource: "env",
}

describe("HTTP auth + vaults", () => {
  let dbPath = ""
  let app: ReturnType<typeof createHttpApp>

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `obs-sync-test-${Date.now()}.db`)
    const db = openDatabase(dbPath)
    app = createHttpApp(db, { ...config, databasePath: dbPath })
  })

  afterAll(() => {
    try {
      fs.unlinkSync(dbPath)
    } catch {
      /* ignore */
    }
  })

  async function post(p: string, body: unknown) {
    const res = await app.request(p, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.json() as Promise<Record<string, unknown>>
  }

  it("returns a solvable PoW challenge for in-app signup", async() => {
    const { createHash } = await import("node:crypto")
    const pow = await post("/user/pow-challenge", {})
    expect(pow.algorithm).toBe("SHA-256")
    expect(pow.maxNumber).toBe(0)
    expect(typeof pow.salt).toBe("string")
    expect(typeof pow.challenge).toBe("string")
    expect(pow.expiration as number).toBeGreaterThan(Date.now())
    const hex = createHash("sha256")
      .update(`${pow.salt}:0`, "utf8")
      .digest("hex")
    expect(pow.challenge).toBe(hex)
  })

  it("signs up and lists empty vaults", async() => {
    const auth = await post("/user/signup", {
      email: "a@example.com",
      password: "secret",
      name: "Alice",
    })
    expect(auth.token).toBeTruthy()
    expect(auth.email).toBe("a@example.com")

    const list = await post("/vault/list", {
      token: auth.token,
      supported_encryption_version: 3,
    })
    expect(Array.isArray(list.vaults)).toBe(true)
    expect((list.vaults as unknown[]).length).toBe(0)
    expect(list.limit as number).toBeGreaterThan(0)
  })

  it("creates vault and verifies keyhash", async() => {
    const auth = await post("/user/signin", {
      email: "a@example.com",
      password: "secret",
    })
    const created = await post("/vault/create", {
      token: auth.token,
      name: "Notes",
      keyhash: "abc123",
      salt: "saltsalt",
      region: "local",
      encryption_version: 3,
    })
    expect(created.name).toBe("Notes")
    expect(created.host).toBe("127.0.0.1:3003")
    expect(created.id).toBeTruthy()

    expect(created.size).toBe(0)
    expect(typeof created.region).toBe("string")

    const ok = await post("/vault/access", {
      token: auth.token,
      vault_uid: created.id,
      keyhash: "abc123",
      encryption_version: 3,
    })
    expect(ok.ok).toBe(true)

    const bad = await post("/vault/access", {
      token: auth.token,
      vault_uid: created.id,
      keyhash: "wrong",
      encryption_version: 3,
    })
    expect(bad.error).toBe("Incorrect password")

    const sub = await post("/subscription/list", { token: auth.token })
    expect(sub.sync).toBe(true)
    expect(sub.limit as number).toBeGreaterThan(0)

    const list = await post("/vault/list", {
      token: auth.token,
      supported_encryption_version: 3,
    })
    const first = (list.vaults as { size: number; id: string }[])[0]
    expect(first).toBeTruthy()
    expect(typeof first!.size).toBe("number")
    expect(Number.isNaN(first!.size)).toBe(false)
  })

  it("rejects admin routes without a token", async() => {
    const session = await app.request("/admin/session")
    expect(session.status).toBe(200)
    expect(await session.json()).toEqual({ auth: "token", ok: false })

    const res = await app.request("/admin/releases")
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe("Admin token required")
  })

  it("accepts admin routes with a bearer token", async() => {
    const res = await app.request("/admin/session", {
      headers: { Authorization: "Bearer test-admin-token" },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { auth?: string; ok?: boolean }
    expect(body.auth).toBe("token")
    expect(body.ok).toBe(true)
  })
})

describe("HTTP admin open mode", () => {
  let dbPath = ""
  let app: ReturnType<typeof createHttpApp>

  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `obs-sync-open-${Date.now()}.db`)
    const db = openDatabase(dbPath)
    app = createHttpApp(db, {
      ...config,
      databasePath: dbPath,
      adminToken: null,
      adminTokenSource: "none",
    })
  })

  afterAll(() => {
    try {
      fs.unlinkSync(dbPath)
    } catch {
      /* ignore */
    }
  })

  it("skips unlock when no admin token is configured", async() => {
    const session = await app.request("/admin/session")
    expect(session.status).toBe(200)
    expect(await session.json()).toEqual({ auth: "none", ok: true })

    const users = await app.request("/admin/users")
    expect(users.status).toBe(200)
  })

  it("lists and creates people on the server", async() => {
    const empty = await app.request("/admin/users")
    expect(empty.status).toBe(200)
    expect(((await empty.json()) as { users: unknown[] }).users).toEqual([])

    const created = await app.request("/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "sam@example.com",
        password: "secret",
        name: "Sam",
      }),
    })
    expect(created.status).toBe(200)
    const person = (await created.json()) as { email: string; name: string }
    expect(person.email).toBe("sam@example.com")
    expect(person.name).toBe("Sam")

    const listed = await app.request("/admin/users")
    const users = ((await listed.json()) as { users: { email: string; id: number }[] })
      .users
    expect(users.map((u) => u.email)).toContain("sam@example.com")
    const sam = users.find((u) => u.email === "sam@example.com")!

    const off = await app.request(`/admin/users/${sam.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: true }),
    })
    expect(off.status).toBe(200)
    const denied = await app.request("/user/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "sam@example.com", password: "secret" }),
    })
    const deniedBody = (await denied.json()) as { error?: string }
    expect(deniedBody.error).toBe("This account is turned off")

    const gone = await app.request(`/admin/users/${sam.id}`, { method: "DELETE" })
    expect(gone.status).toBe(200)
    const after = await app.request("/admin/users")
    const left = ((await after.json()) as { users: { email: string }[] }).users
    expect(left.map((u) => u.email)).not.toContain("sam@example.com")
  })

  it("rejects a junk wireless inspect address", async() => {
    const res = await app.request("/admin/adb/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: "ok; rm -rf /", port: "5555" }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toMatch(/address/i)
  })

  it("rejects a junk wireless pair address", async() => {
    const res = await app.request("/admin/adb/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "ok; rm -rf /",
        port: "5555",
        code: "123456",
      }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toMatch(/address/i)
  })
})
