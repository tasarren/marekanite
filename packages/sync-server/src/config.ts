import path from "node:path"
import { fileURLToPath } from "node:url"
import { resolveAdminToken } from "./admin-token.js"

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

export function syncHostFromApiBase(apiBase: string): string {
  try {
    return new URL(apiBase).host
  } catch {
    return "127.0.0.1:8787"
  }
}

export type Config = {
  publicApiBase: string;
  publicSyncHost: string;
  listenHttpHost: string;
  listenHttpPort: number;
  listenWsHost: string;
  listenWsPort: number;
  databasePath: string;
  storageLimitBytes: number;
  perFileMax: number;
  adminToken: string | null;
  adminTokenSource: "env" | "none";
  /** Explicit adb binary. When omitted, requireBin("adb") searches PATH. */
  adbPath?: string;
}

function parseListen(
  value: string,
  defaultHost: string,
  defaultPort: number,
): { host: string; port: number } {
  const v = value.trim()
  if (v.includes(":")) {
    const idx = v.lastIndexOf(":")
    const host = v.slice(0, idx) || defaultHost
    const port = Number(v.slice(idx + 1)) || defaultPort
    return { host, port }
  }
  const asPort = Number(v)
  if (Number.isFinite(asPort) && asPort > 0) {
    return { host: defaultHost, port: asPort }
  }
  return { host: defaultHost, port: defaultPort }
}

/** Monorepo root: packages/sync-server/src → ../../.. */
function monorepoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, "../../..")
}

export function loadConfig(): Config {
  const http = parseListen(env("LISTEN_HTTP", "127.0.0.1:8787"), "127.0.0.1", 8787)
  const ws = parseListen(env("LISTEN_WS", "127.0.0.1:3003"), "127.0.0.1", 3003)
  const defaultDb = path.join(monorepoRoot(), "data/sync.db")
  const dbEnv = process.env.DATABASE_PATH
  const databasePath = dbEnv
    ? path.isAbsolute(dbEnv)
      ? dbEnv
      : path.resolve(process.cwd(), dbEnv)
    : defaultDb

  const admin = resolveAdminToken()
  const publicApiBase = env("PUBLIC_API_BASE", "http://127.0.0.1:8787")
  const syncOverride = process.env.PUBLIC_SYNC_HOST?.trim()
  const adbPath = process.env.ADB_PATH?.trim()

  return {
    publicApiBase,
    publicSyncHost: syncOverride || syncHostFromApiBase(publicApiBase),
    listenHttpHost: http.host,
    listenHttpPort: http.port,
    listenWsHost: ws.host,
    listenWsPort: ws.port,
    databasePath,
    storageLimitBytes: envInt("STORAGE_LIMIT_BYTES", 10 * 1024 * 1024 * 1024),
    perFileMax: envInt("PER_FILE_MAX", 208_666_624),
    adminToken: admin.token,
    adminTokenSource: admin.source,
    ...(adbPath ? { adbPath } : {}),
  }
}
