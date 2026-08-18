/**
 * List / download stock Obsidian desktop asar.gz + Android APK from
 * github.com/obsidianmd/obsidian-releases.
 */
import fs, { createReadStream, createWriteStream } from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { createGunzip } from "node:zlib"
import { pipeline } from "node:stream/promises"
import { extractDesktopAsar } from "@marekanite/client-patch"
import type { Config } from "./config.js"

const REPO = "obsidianmd/obsidian-releases"
const API = `https://api.github.com/repos/${REPO}/releases`
const LIST_TTL_MS = 60 * 60 * 1000 // 1h

export type ReleaseAssetInfo = {
  name: string;
  size: number;
  downloadUrl: string;
}

export type ClientPlatform = "linux" | "macos" | "windows" | "android"

export type ReleaseInfo = {
  version: string;
  tag: string;
  publishedAt: string | null;
  asar: ReleaseAssetInfo | null;
  dmg: ReleaseAssetInfo | null;
  exe: ReleaseAssetInfo | null;
  apk: ReleaseAssetInfo | null;
}

type GhAsset = {
  name: string;
  size: number;
  browser_download_url: string;
}

type GhRelease = {
  tag_name: string;
  name: string | null;
  published_at: string | null;
  assets: GhAsset[];
}

let listCache: { at: number; releases: ReleaseInfo[] } | null = null

function stockRoot(config: Config): string {
  return path.join(path.dirname(config.databasePath), "stock-cache")
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "marekanite",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return h
}

function versionFromTag(tag: string): string {
  return tag.replace(/^v/i, "")
}

function toInfo(a: GhAsset): ReleaseAssetInfo {
  return { name: a.name, size: a.size, downloadUrl: a.browser_download_url }
}

function pickAssets(version: string, assets: GhAsset[]): {
  asar: ReleaseAssetInfo | null;
  dmg: ReleaseAssetInfo | null;
  exe: ReleaseAssetInfo | null;
  apk: ReleaseAssetInfo | null;
} {
  let asar: ReleaseAssetInfo | null = null
  let dmg: ReleaseAssetInfo | null = null
  let exe: ReleaseAssetInfo | null = null
  let apk: ReleaseAssetInfo | null = null
  for (const a of assets) {
    const n = a.name
    if (n === `obsidian-${version}.asar.gz` || (n.endsWith(".asar.gz") && n.includes(version))) {
      asar = toInfo(a)
    }
    if (n === `Obsidian-${version}.dmg`) dmg = toInfo(a)
    if (n === `Obsidian-${version}.exe`) exe = toInfo(a)
    if (
      n === `Obsidian-${version}.apk` ||
      (n.endsWith(".apk") && n.includes(version) && !n.includes("arm"))
    ) {
      apk = toInfo(a)
    }
  }
  return { asar, dmg, exe, apk }
}

export function assetForPlatform(
  rel: ReleaseInfo,
  platform: ClientPlatform,
): ReleaseAssetInfo | null {
  if (platform === "linux") return rel.asar
  if (platform === "macos") return rel.dmg
  if (platform === "windows") return rel.exe
  return rel.apk
}

export async function listReleases(
  opts: { force?: boolean; perPage?: number } = {},
): Promise<ReleaseInfo[]> {
  if (
    !opts.force &&
    listCache &&
    Date.now() - listCache.at < LIST_TTL_MS
  ) {
    return listCache.releases
  }

  const perPage = opts.perPage ?? 20
  const res = await fetch(`${API}?per_page=${perPage}`, {
    headers: ghHeaders(),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`GitHub releases HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as GhRelease[]
  const releases: ReleaseInfo[] = []
  for (const r of data) {
    const version = versionFromTag(r.tag_name)
    const picked = pickAssets(version, r.assets)
    if (!picked.asar && !picked.apk && !picked.dmg && !picked.exe) continue
    releases.push({
      version,
      tag: r.tag_name,
      publishedAt: r.published_at,
      ...picked,
    })
  }
  listCache = { at: Date.now(), releases }
  return releases
}

export function invalidateReleaseListCache() {
  listCache = null
}

/** Fetch one tagged release (not just the latest page). Used by e2e. */
export async function fetchReleaseByVersion(version: string): Promise<ReleaseInfo> {
  const ver = version.replace(/^v/i, "")
  const tags = [ver, `v${ver}`]
  let lastErr = ""
  for (const tag of tags) {
    const res = await fetch(`${API}/tags/${encodeURIComponent(tag)}`, {
      headers: ghHeaders(),
    })
    if (res.status === 404) continue
    if (!res.ok) {
      lastErr = `GitHub release ${tag} HTTP ${res.status}`
      continue
    }
    const r = (await res.json()) as GhRelease
    const v = versionFromTag(r.tag_name)
    const picked = pickAssets(v, r.assets)
    return {
      version: v,
      tag: r.tag_name,
      publishedAt: r.published_at,
      ...picked,
    }
  }
  throw new Error(lastErr || `release not found: ${version}`)
}

function sha256File(filePath: string): string {
  const hash = createHash("sha256")
  const buf = fs.readFileSync(filePath)
  hash.update(buf)
  return hash.digest("hex")
}

function readHashDb(config: Config): Record<string, string> {
  const p = path.join(stockRoot(config), "hashes.json")
  if (!fs.existsSync(p)) return {}
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, string>
  } catch {
    return {}
  }
}

function writeHashDb(config: Config, db: Record<string, string>) {
  const root = stockRoot(config)
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(path.join(root, "hashes.json"), JSON.stringify(db, null, 2))
}

async function downloadToFile(
  url: string,
  dest: string,
  onLog?: (line: string) => void,
): Promise<void> {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const res = await fetch(url, {
    headers: { "User-Agent": "marekanite" },
    redirect: "follow",
  })
  if (!res.ok || !res.body) {
    throw new Error(`download failed HTTP ${res.status}: ${url}`)
  }
  const total = Number(res.headers.get("content-length") || 0)
  onLog?.(
    total
      ? `downloading ${path.basename(dest)} (${(total / 1e6).toFixed(1)} MB)…`
      : `downloading ${path.basename(dest)}…`,
  )

  const tmp = dest + ".part"
  const reader = res.body.getReader()
  const file = fs.openSync(tmp, "w")
  let received = 0
  let lastLog = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      fs.writeSync(file, value)
      received += value.byteLength
      if (total && received - lastLog > 2_000_000) {
        lastLog = received
        onLog?.(
          `  … ${(received / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`,
        )
      }
    }
  } finally {
    fs.closeSync(file)
  }
  fs.renameSync(tmp, dest)
  onLog?.(`saved ${path.basename(dest)} (${(received / 1e6).toFixed(1)} MB)`)
}

async function gunzipFile(
  gzPath: string,
  outPath: string,
  onLog?: (line: string) => void,
): Promise<void> {
  onLog?.(`gunzip ${path.basename(gzPath)} → ${path.basename(outPath)}`)
  await pipeline(createReadStream(gzPath), createGunzip(), createWriteStream(outPath))
}

export type EnsureStockResult = {
  version: string;
  platform: ClientPlatform;
  path: string;
  sha256: string;
  cacheHit: boolean;
}

function normalizePlatform(
  kind: ClientPlatform | "desktop",
): ClientPlatform {
  return kind === "desktop" ? "linux" : kind
}

/**
 * Ensure stock installer / asar / apk is on disk, then return a path
 * ready to patch (extracted asar or apk).
 */
export async function ensureStockArtifact(
  config: Config,
  version: string,
  kind: ClientPlatform | "desktop",
  onLog?: (line: string) => void,
): Promise<EnsureStockResult> {
  const platform = normalizePlatform(kind)
  const listed = await listReleases()
  let rel = listed.find(
    (r) => r.version === version || r.tag === version || r.tag === `v${version}`,
  )
  if (!rel) {
    rel = await fetchReleaseByVersion(version)
  }
  const ver = rel.version
  const dir = path.join(stockRoot(config), ver)
  fs.mkdirSync(dir, { recursive: true })
  const hashes = readHashDb(config)
  const asset = assetForPlatform(rel, platform)
  if (!asset) {
    throw new Error(`no ${platform} file on GitHub for ${ver}`)
  }

  const stockPath = path.join(dir, asset.name)
  const hashKey = `${ver}:${platform}:${asset.name}`
  let cacheHit = false
  if (fs.existsSync(stockPath) && hashes[hashKey]) {
    const h = sha256File(stockPath)
    if (h === hashes[hashKey]) {
      cacheHit = true
      onLog?.(`cache hit ${asset.name} (${h.slice(0, 12)}…)`)
    } else {
      onLog?.("cache hash mismatch — re-downloading")
    }
  }
  if (!cacheHit) {
    await downloadToFile(asset.downloadUrl, stockPath, onLog)
    const h = sha256File(stockPath)
    hashes[hashKey] = h
    writeHashDb(config, hashes)
    onLog?.(`sha256 ${h}`)
  }

  if (platform === "android") {
    return {
      version: ver,
      platform,
      path: stockPath,
      sha256: hashes[hashKey] ?? sha256File(stockPath),
      cacheHit,
    }
  }

  const asarPath = path.join(dir, `obsidian-${ver}-${platform}.asar`)
  if (!fs.existsSync(asarPath) || !cacheHit) {
    if (platform === "linux") {
      onLog?.(`gunzip ${path.basename(stockPath)}`)
      await gunzipFile(stockPath, asarPath, onLog)
    } else {
      await extractDesktopAsar(stockPath, dir, onLog)
      const extracted = path.join(dir, "obsidian.asar")
      fs.copyFileSync(extracted, asarPath)
      try {
        fs.unlinkSync(extracted)
      } catch {
        /* ignore */
      }
    }
  } else {
    onLog?.(`using cached ${path.basename(asarPath)}`)
  }

  return {
    version: ver,
    platform,
    path: asarPath,
    sha256: hashes[hashKey] ?? sha256File(stockPath),
    cacheHit,
  }
}

export function stockCacheStatus(
  config: Config,
  releases: ReleaseInfo[],
): Array<
  ReleaseInfo & {
    asarCached?: boolean;
    dmgCached?: boolean;
    exeCached?: boolean;
    apkCached?: boolean;
  }
> {
  return releases.map((r) => {
    const dir = path.join(stockRoot(config), r.version)
    return {
      ...r,
      asarCached: !!(r.asar && fs.existsSync(path.join(dir, r.asar.name))),
      dmgCached: !!(r.dmg && fs.existsSync(path.join(dir, r.dmg.name))),
      exeCached: !!(r.exe && fs.existsSync(path.join(dir, r.exe.name))),
      apkCached: !!(r.apk && fs.existsSync(path.join(dir, r.apk.name))),
    }
  })
}
