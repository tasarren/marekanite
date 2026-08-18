import { serve } from "@hono/node-server"
import { loadConfig } from "./config.js"
import { openDatabase } from "./db.js"
import { createHttpApp } from "./http-app.js"
import { createWsServer } from "./ws-server.js"

const config = loadConfig()
const db = openDatabase(config.databasePath)
const app = createHttpApp(db, config)

const httpServer = serve(
  {
    fetch: app.fetch,
    hostname: config.listenHttpHost,
    port: config.listenHttpPort,
  },
  (info) => {
    console.log(
      `[sync-server] HTTP ${config.publicApiBase} (listen ${info.address}:${info.port})`,
    )
  },
)

const wss = createWsServer(
  db,
  config,
  httpServer as import("node:http").Server,
)
console.log(
  `[sync-server] WS  ${config.publicApiBase} (same port, public host ${config.publicSyncHost})`,
)
console.log(`[sync-server] DB  ${config.databasePath}`)

if (!config.adminToken) {
  if (config.adminTokenSource === "env") {
    console.log("[sync-server] Using an Admin token is more secure (MAREKANITE_ADMIN_TOKEN)")
  } else {
    console.log("[sync-server] Admin UI is open (no MAREKANITE_ADMIN_TOKEN)")
  }
}

function shutdown() {
  console.log("[sync-server] shutting down…")
  wss.close()
  httpServer.close()
  db.close()
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
