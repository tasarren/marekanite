import { describe, it, beforeAll, afterAll, expect } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { serve } from "@hono/node-server"
import { makeTestVaultSecrets } from "@marekanite/crypto-compat"
import { createApiClient, SyncWsClient } from "@marekanite/sync-client"
import { openDatabase } from "./db.js"
import { createHttpApp } from "./http-app.js"
import { createWsServer } from "./ws-server.js"
import type { Config } from "./config.js"

describe("WS push/pull flow", () => {
  let dbPath = ""
  let httpPort = 0
  let wsPort = 0
  let closeHttp: (() => void) | undefined
  let wss: ReturnType<typeof createWsServer>

  beforeAll(async() => {
    dbPath = path.join(os.tmpdir(), `obs-sync-ws-${Date.now()}.db`)
    // ephemeral ports
    httpPort = 18000 + Math.floor(Math.random() * 1000)
    wsPort = httpPort
    const config: Config = {
      publicApiBase: `http://127.0.0.1:${httpPort}`,
      publicSyncHost: `127.0.0.1:${httpPort}`,
      listenHttpHost: "127.0.0.1",
      listenHttpPort: httpPort,
      listenWsHost: "127.0.0.1",
      listenWsPort: httpPort,
      databasePath: dbPath,
      storageLimitBytes: 1_000_000_000,
      perFileMax: 208_666_624,
      adminToken: "test-admin-token",
      adminTokenSource: "env",
    }
    const db = openDatabase(dbPath)
    const app = createHttpApp(db, config)
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: httpPort })
    closeHttp = () => {
      (server as { close?: () => void }).close?.()
    }
    wss = createWsServer(db, config, server as import("node:http").Server)
    await new Promise((r) => setTimeout(r, 100))
  })

  afterAll(() => {
    wss?.close()
    closeHttp?.()
    try {
      fs.unlinkSync(dbPath)
    } catch {
      /* ignore */
    }
  })

  it("signup → vault → push → pull ciphertext", async() => {
    const api = createApiClient(`http://127.0.0.1:${httpPort}`)
    const email = `u${Date.now()}@example.com`
    const auth = await api.post<{ token: string }>("/user/signup", {
      email,
      password: "hunter2",
      name: "User",
    })
    const secrets = makeTestVaultSecrets("vault-pass")
    const vault = await api.post<{ id: string; host: string }>("/vault/create", {
      token: auth.token,
      name: "V",
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

    const payload = Buffer.from("hello encrypted blob")
    await client.pushFile("notes/a.md", payload, "hash1")

    // Find uid from a second connection inventory, or size/history.
    // After push, re-init with version 0 should replay.
    const client2 = new SyncWsClient()
    await client2.connect(`ws://127.0.0.1:${wsPort}`)
    await client2.init({
      token: auth.token,
      id: vault.id,
      keyhash: secrets.keyhash,
      version: 0,
      initial: true,
    })
    await new Promise((r) => setTimeout(r, 100))
    expect(client2.pushes.length).toBeGreaterThanOrEqual(1)
    const last = client2.pushes[client2.pushes.length - 1]!
    const uid = Number(last.uid)
    expect(uid).toBeGreaterThan(0)

    const pulled = await client2.pull(uid)
    expect(pulled).toBeTruthy()
    expect(pulled!.toString()).toBe(payload.toString())

    client.close()
    client2.close()
  })
})
