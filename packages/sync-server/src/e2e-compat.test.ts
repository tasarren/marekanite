import { afterAll, describe, expect, it } from "vitest"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  COMPAT_API_BASE,
  probePatched,
  probeStock,
  verdict,
  patchAndroidApk,
  patchDesktopAsar,
} from "@marekanite/client-patch"
import type { Config } from "./config.js"
import { ensureStockArtifact, listReleases } from "./github-releases.js"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const cacheRoot =
  process.env.MAREKANITE_STOCK_CACHE ??
  path.join(repoRoot, ".cache/obsidian-releases")

const require = createRequire(import.meta.url)
const asar = require("@electron/asar") as {
  extractAll: (archive: string, dest: string) => void;
}

type Row = {
  version: string;
  desktop: "ok" | "partial" | "unsupported" | "skip";
  android: "ok" | "partial" | "unsupported" | "skip";
  notes: string[];
}

function sha256(p: string): string {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex")
}

function readJs(dir: string, name: string): string | undefined {
  const p = path.join(dir, name)
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : undefined
}

function dummyConfig(): Config {
  return {
    publicApiBase: COMPAT_API_BASE,
    publicSyncHost: "192.0.2.10:8787",
    listenHttpHost: "127.0.0.1",
    listenHttpPort: 8787,
    listenWsHost: "127.0.0.1",
    listenWsPort: 8787,
    databasePath: path.join(cacheRoot, "compat.db"),
    storageLimitBytes: 1,
    perFileMax: 1,
    adminToken: null,
    adminTokenSource: "none",
  }
}

function writeReports(rows: Row[]) {
  const checked = new Date().toISOString().slice(0, 10)
  const json = {
    checked,
    apiBase: COMPAT_API_BASE,
    note: "Desktop column is official asar.gz (same JS as Mac/Windows). Refresh with pnpm test:compat.",
    rows,
  }
  const jsonText = `${JSON.stringify(json, null, 2)}\n`
  fs.writeFileSync(path.join(repoRoot, "docs/compatibility.json"), jsonText)
  fs.mkdirSync(path.join(repoRoot, "packages/admin-web/public"), { recursive: true })
  fs.writeFileSync(
    path.join(repoRoot, "packages/admin-web/public/compatibility.json"),
    jsonText,
  )

  const lines = [
    "# Client compatibility",
    "",
    `Last checked **${checked}**. Refresh: \`pnpm test:compat\` (uses \`.cache/obsidian-releases/\`).`,
    "",
    "Desktop is the official `asar.gz` — that **is** the JS inside the Mac `.dmg` and Windows `.exe`.",
    "The rewriter matches **needles** in the minified JS, not version numbers. A new official release is supported if those needles are still there.",
    "",
    "| Version | Desktop asar | Android apk | Notes |",
    "|---|---|---|---|",
  ]
  for (const r of rows) {
    const notes = r.notes.join("; ").replace(/\|/g, "/")
    lines.push(`| ${r.version} | ${r.desktop} | ${r.android} | ${notes} |`)
  }
  lines.push("")
  fs.writeFileSync(path.join(repoRoot, "docs/compatibility.md"), `${lines.join("\n")}\n`)
}

describe("last 30 official releases", () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "marekanite-compat-"))
  const config = dummyConfig()
  const rows: Row[] = []

  afterAll(() => {
    writeReports(rows)
    fs.rmSync(work, { recursive: true, force: true })
  })

  it("probes asar.gz + apk for each release", async() => {
    const releases = await listReleases({ perPage: 30 })
    expect(releases.length).toBeGreaterThan(0)

    for (const rel of releases) {
      const row: Row = {
        version: rel.version,
        desktop: "skip",
        android: "skip",
        notes: [],
      }

      if (rel.asar) {
        try {
          const stock = await ensureStockArtifact(
            config,
            rel.version,
            "linux",
            (l) => console.log(`[compat ${rel.version} desktop] ${l}`),
          )
          const extractDir = path.join(work, `${rel.version}-desk`)
          asar.extractAll(stock.path, extractDir)
          const stockFiles = {
            appJs: readJs(extractDir, "app.js"),
            starterJs: readJs(extractDir, "starter.js"),
            mainJs: readJs(extractDir, "main.js"),
          }
          const stockP = probeStock(stockFiles, "desktop")
          const out1 = path.join(work, `${rel.version}-a.asar`)
          const out2 = path.join(work, `${rel.version}-b.asar`)
          await patchDesktopAsar(stock.path, out1, { apiBase: COMPAT_API_BASE })
          await patchDesktopAsar(stock.path, out2, { apiBase: COMPAT_API_BASE })
          const patchedDir = path.join(work, `${rel.version}-desk-p`)
          asar.extractAll(out1, patchedDir)
          const patched = probePatched(
            {
              appJs: readJs(patchedDir, "app.js"),
              starterJs: readJs(patchedDir, "starter.js"),
              mainJs: readJs(patchedDir, "main.js"),
            },
            COMPAT_API_BASE,
            "desktop",
          )
          if (sha256(out1) !== sha256(out2)) {
            patched.ok = false
            patched.failed.push("not idempotent")
          }
          row.desktop = verdict({ stock: stockP, patched })
          if (stockP.missing.length) {
            row.notes.push(`desktop stock missing ${stockP.missing.join(",")}`)
          }
          if (patched.failed.length) {
            row.notes.push(`desktop ${patched.failed.join(",")}`)
          }
        } catch(e) {
          row.desktop = "unsupported"
          row.notes.push(
            `desktop error: ${e instanceof Error ? e.message : String(e)}`,
          )
        }
      }

      if (rel.apk) {
        try {
          const stock = await ensureStockArtifact(
            config,
            rel.version,
            "android",
            (l) => console.log(`[compat ${rel.version} android] ${l}`),
          )
          const extractDir = path.join(work, `${rel.version}-apk`)
          fs.mkdirSync(extractDir, { recursive: true })
          execFileSync("unzip", ["-qo", stock.path, "assets/public/*", "-d", extractDir], {
            stdio: "pipe",
          })
          const pub = path.join(extractDir, "assets/public")
          const stockFiles = {
            appJs: readJs(pub, "app.js"),
            starterJs: readJs(pub, "starter.js"),
          }
          const stockP = probeStock(stockFiles, "android")
          const out1 = path.join(work, `${rel.version}-a.apk`)
          const out2 = path.join(work, `${rel.version}-b.apk`)
          await patchAndroidApk(stock.path, out1, {
            apiBase: COMPAT_API_BASE,
            skipSign: true,
          })
          await patchAndroidApk(stock.path, out2, {
            apiBase: COMPAT_API_BASE,
            skipSign: true,
          })
          const patchedDir = path.join(work, `${rel.version}-apk-p`)
          fs.mkdirSync(patchedDir, { recursive: true })
          execFileSync("unzip", ["-qo", out1, "assets/public/*", "-d", patchedDir], {
            stdio: "pipe",
          })
          const pp = path.join(patchedDir, "assets/public")
          const patched = probePatched(
            { appJs: readJs(pp, "app.js"), starterJs: readJs(pp, "starter.js") },
            COMPAT_API_BASE,
            "android",
          )
          const js1 = path.join(work, `${rel.version}-apk-p2`)
          fs.mkdirSync(js1, { recursive: true })
          execFileSync("unzip", ["-qo", out2, "assets/public/app.js", "-d", js1], {
            stdio: "pipe",
          })
          const a = readJs(pp, "app.js") ?? ""
          const b = readJs(path.join(js1, "assets/public"), "app.js") ?? ""
          if (a !== b) {
            patched.ok = false
            patched.failed.push("not idempotent")
          }
          row.android = verdict({ stock: stockP, patched })
          if (stockP.missing.length) {
            row.notes.push(`android stock missing ${stockP.missing.join(",")}`)
          }
          if (patched.failed.length) {
            row.notes.push(`android ${patched.failed.join(",")}`)
          }
        } catch(e) {
          row.android = "unsupported"
          row.notes.push(
            `android error: ${e instanceof Error ? e.message : String(e)}`,
          )
        }
      }

      rows.push(row)
      writeReports(rows)
    }

    const withDesk = rows.filter((r) => r.desktop !== "skip")
    const withApk = rows.filter((r) => r.android !== "skip")
    expect(withDesk[0]?.desktop, `newest desktop ${withDesk[0]?.version}`).toBe(
      "ok",
    )
    expect(withApk[0]?.android, `newest android ${withApk[0]?.version}`).toBe(
      "ok",
    )
  })
})
