import fs, { createReadStream, createWriteStream } from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { createGunzip } from "node:zlib"
import { pipeline } from "node:stream/promises"
import { requireBin, which } from "@marekanite/host-bin"

export type DesktopInput = "asar" | "asar.gz" | "dmg" | "exe"

export function detectDesktopInput(filePath: string): DesktopInput {
  const n = path.basename(filePath).toLowerCase()
  if (n.endsWith(".exe")) return "exe"
  if (n.endsWith(".dmg")) return "dmg"
  if (n.endsWith(".asar.gz") || (n.endsWith(".gz") && n.includes("asar"))) {
    return "asar.gz"
  }
  if (n.endsWith(".asar")) return "asar"
  throw new Error(
    "That file doesn’t look like a desktop Obsidian. Use .asar, .asar.gz, .dmg, or .exe",
  )
}

function run7z(args: string[]): void {
  const seven = requireBin("7z", {
    hint: "install p7zip (Arch) or p7zip-full (Debian)",
  })
  try {
    execFileSync(seven, args, { stdio: "pipe", maxBuffer: 32 * 1024 * 1024 })
  } catch(e) {
    const err = e as { stderr?: Buffer; message?: string }
    const extra = err.stderr?.toString() || err.message || ""
    throw new Error(`7z failed: ${extra.slice(0, 400)}`, { cause: e })
  }
}

function walkFiles(dir: string): string[] {
  const out: string[] = []
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()!
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, ent.name)
      if (ent.isDirectory()) stack.push(full)
      else out.push(full)
    }
  }
  return out
}

/** Prefer the real client asar (tens of MB), never the tiny Electron app.asar. */
export function pickObsidianAsar(dir: string): string {
  const hits = walkFiles(dir).filter(
    (p) => path.basename(p).toLowerCase() === "obsidian.asar",
  )
  if (!hits.length) {
    throw new Error("Could not find obsidian.asar inside that file")
  }
  hits.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)
  const chosen = hits[0]!
  if (fs.statSync(chosen).size < 1_000_000) {
    throw new Error("obsidian.asar inside that file is too small — extract failed")
  }
  return chosen
}

async function gunzipTo(src: string, dest: string): Promise<void> {
  await pipeline(createReadStream(src), createGunzip(), createWriteStream(dest))
}

/**
 * Pull the real desktop client asar out of an asar / asar.gz / dmg / NSIS exe.
 */
export async function extractDesktopAsar(
  inputPath: string,
  destDir: string,
  onLog?: (line: string) => void,
): Promise<string> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`file not found: ${inputPath}`)
  }
  fs.mkdirSync(destDir, { recursive: true })
  const kind = detectDesktopInput(inputPath)
  const outAsar = path.join(destDir, "obsidian.asar")

  if (kind === "asar") {
    onLog?.("input is already an asar")
    fs.copyFileSync(inputPath, outAsar)
    return outAsar
  }

  if (kind === "asar.gz") {
    onLog?.("gunzip asar.gz…")
    await gunzipTo(inputPath, outAsar)
    return outAsar
  }

  if (!which("7z")) {
    throw new Error(
      "7z is not installed. Install p7zip (Arch) or p7zip-full (Debian) to open a DMG or EXE.",
    )
  }

  const work = fs.mkdtempSync(path.join(destDir, ".extract-"))
  try {
    if (kind === "dmg") {
      onLog?.("opening DMG with 7z…")
      run7z(["e", "-y", `-o${work}`, inputPath, "-ir!obsidian.asar"])
    } else {
      onLog?.("opening Windows installer with 7z…")
      run7z(["e", "-y", `-o${work}`, inputPath, "$PLUGINSDIR/app-64.7z"])
      const inner = walkFiles(work).find((p) => p.endsWith("app-64.7z"))
      if (!inner) {
        throw new Error("That EXE has no app-64.7z (64-bit Obsidian payload)")
      }
      onLog?.("opening app-64.7z…")
      run7z(["e", "-y", `-o${work}`, inner, "resources/obsidian.asar"])
    }
    const found = pickObsidianAsar(work)
    fs.copyFileSync(found, outAsar)
    onLog?.(`extracted ${path.basename(outAsar)} (${(fs.statSync(outAsar).size / 1e6).toFixed(1)} MB)`)
    return outAsar
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}
