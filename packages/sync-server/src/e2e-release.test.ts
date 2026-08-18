import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { serve } from "@hono/node-server"
import { patchAndroidApk, patchDesktopAsar } from "@marekanite/client-patch"
import { makeTestVaultSecrets } from "@marekanite/crypto-compat"
import { createApiClient, SyncWsClient } from "@marekanite/sync-client"
import type { Config } from "./config.js"
import { openDatabase } from "./db.js"
import { ensureStockArtifact } from "./github-releases.js"
import { createHttpApp } from "./http-app.js"
import { createWsServer } from "./ws-server.js"

const VERSION = process.env.E2E_OBSIDIAN_VERSION ?? "1.13.4"
const STOCK_CHARCODE = "String.fromCharCode(97,112,105)"
const STOCK_API = "https://api.obsidian.md"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const cacheRoot =
  process.env.MAREKANITE_STOCK_CACHE ??
  path.join(repoRoot, ".cache/obsidian-releases")

const require = createRequire(import.meta.url)
const asar = require("@electron/asar") as {
  extractAll: (archive: string, dest: string) => void;
}

function e2eConfig(httpPort: number, _wsPort: number): Config {
  return {
    publicApiBase: `http://127.0.0.1:${httpPort}`,
    publicSyncHost: `127.0.0.1:${httpPort}`,
    listenHttpHost: "127.0.0.1",
    listenHttpPort: httpPort,
    listenWsHost: "127.0.0.1",
    listenWsPort: httpPort,
    databasePath: path.join(cacheRoot, "e2e.db"),
    storageLimitBytes: 1_000_000_000,
    perFileMax: 208_666_624,
    adminToken: "e2e-admin-token",
    adminTokenSource: "env",
  }
}

function assertRewritten(code: string, apiBase: string, label: string) {
  expect(code, `${label} must contain API base`).toContain(apiBase)
  expect(code, `${label} must drop stock char-code API`).not.toContain(
    STOCK_CHARCODE,
  )
  expect(code, `${label} must drop stock API URL`).not.toContain(STOCK_API)
}

describe(`official ${VERSION} client + protocol`, () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "marekanite-e2e-"))
  const httpPort = 19000 + Math.floor(Math.random() * 1000)
  const wsPort = httpPort
  const config = e2eConfig(httpPort, wsPort)
  const apiBase = config.publicApiBase

  let closeHttp: (() => void) | undefined
  let wss: ReturnType<typeof createWsServer> | undefined

  beforeAll(async() => {
    fs.mkdirSync(cacheRoot, { recursive: true })
    const db = openDatabase(path.join(work, "live.db"))
    const live: Config = { ...config, databasePath: path.join(work, "live.db") }
    const app = createHttpApp(db, live)
    const server = serve({
      fetch: app.fetch,
      hostname: "127.0.0.1",
      port: httpPort,
    })
    closeHttp = () => {
      (server as { close?: () => void }).close?.()
    }
    wss = createWsServer(db, live, server as import("node:http").Server)
    await new Promise((r) => setTimeout(r, 80))
  })

  afterAll(() => {
    wss?.close()
    closeHttp?.()
    fs.rmSync(work, { recursive: true, force: true })
  })

  it("patches the official desktop asar", async() => {
    const stock = await ensureStockArtifact(config, VERSION, "desktop", (l) => {
      console.log(`[e2e desktop] ${l}`)
    })
    const out = path.join(work, "obsidian.patched.asar")
    await patchDesktopAsar(stock.path, out, { apiBase })
    const extractDir = path.join(work, "desktop-extract")
    asar.extractAll(out, extractDir)
    for (const name of ["app.js", "starter.js"]) {
      const p = path.join(extractDir, name)
      expect(fs.existsSync(p), `${name} in patched asar`).toBe(true)
      assertRewritten(fs.readFileSync(p, "utf8"), apiBase, name)
    }
    const main = fs.readFileSync(path.join(extractDir, "main.js"), "utf8")
    expect(main).toContain("allowRunningInsecureContent")
    expect(main).toMatch(/updateDisabled\s*=\s*!0|updateDisabled=!0/)
  })

  it("patches the official Android APK (unsigned)", async() => {
    const stock = await ensureStockArtifact(config, VERSION, "android", (l) => {
      console.log(`[e2e android] ${l}`)
    })
    const out = path.join(work, "obsidian.patched.apk")
    await patchAndroidApk(stock.path, out, { apiBase, skipSign: true })
    const extractDir = path.join(work, "android-extract")
    fs.mkdirSync(extractDir, { recursive: true })
    execFileSync("unzip", ["-qo", out, "assets/public/*", "-d", extractDir], {
      stdio: "pipe",
    })
    const publicDir = path.join(extractDir, "assets/public")
    const appJs = path.join(publicDir, "app.js")
    expect(fs.existsSync(appJs), "assets/public/app.js").toBe(true)
    assertRewritten(fs.readFileSync(appJs, "utf8"), apiBase, "apk app.js")
    const starter = path.join(publicDir, "starter.js")
    if (fs.existsSync(starter)) {
      assertRewritten(fs.readFileSync(starter, "utf8"), apiBase, "apk starter.js")
    }
  })

  it("signup → vault → WS push/pull on a fresh DB", async() => {
    const api = createApiClient(apiBase)
    const email = `e2e${Date.now()}@example.com`
    const auth = await api.post<{ token: string }>("/user/signup", {
      email,
      password: "hunter2",
      name: "E2E",
    })
    const secrets = makeTestVaultSecrets("vault-pass")
    const vault = await api.post<{ id: string }>("/vault/create", {
      token: auth.token,
      name: "E2E",
      keyhash: secrets.keyhash,
      salt: secrets.salt,
      encryption_version: secrets.encryption_version,
    })

    const client = new SyncWsClient()
    await client.connect(`ws://127.0.0.1:${wsPort}`)
    await client.init({
      token: auth.token,
      id: vault.id,
      keyhash: secrets.keyhash,
      encryption_version: secrets.encryption_version,
    })
    const payload = Buffer.from("e2e ciphertext blob")
    await client.pushFile("notes/a.md", payload, "hash-e2e")

    const client2 = new SyncWsClient()
    await client2.connect(`ws://127.0.0.1:${wsPort}`)
    await client2.init({
      token: auth.token,
      id: vault.id,
      keyhash: secrets.keyhash,
      version: 0,
      initial: true,
    })
    await new Promise((r) => setTimeout(r, 120))
    expect(client2.pushes.length).toBeGreaterThanOrEqual(1)
    const uid = Number(client2.pushes[client2.pushes.length - 1]!.uid)
    const pulled = await client2.pull(uid)
    expect(pulled?.toString()).toBe(payload.toString())
    client.close()
    client2.close()
  })
})
