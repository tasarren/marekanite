import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { which } from "@marekanite/host-bin"
import {
  detectDesktopInput,
  extractDesktopAsar,
} from "./desktop-extract.js"

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
)
const originals = path.join(repoRoot, "artifacts/originals")
const dmg = path.join(originals, "Obsidian-1.13.7.dmg")
const exe = path.join(originals, "Obsidian-1.13.7.exe")

describe("detectDesktopInput", () => {
  it("maps extensions", () => {
    expect(detectDesktopInput("x.asar")).toBe("asar")
    expect(detectDesktopInput("obsidian-1.13.7.asar.gz")).toBe("asar.gz")
    expect(detectDesktopInput("Obsidian-1.13.7.dmg")).toBe("dmg")
    expect(detectDesktopInput("Obsidian-1.13.7.exe")).toBe("exe")
  })

  it("rejects junk", () => {
    expect(() => detectDesktopInput("notes.pdf")).toThrow(/asar/i)
  })
})

describe.skipIf(!which("7z") || !fs.existsSync(dmg))("extract DMG", () => {
  it("pulls the large obsidian.asar", async() => {
    const dest = fs.mkdtempSync(path.join(originals, ".t-dmg-"))
    try {
      const asar = await extractDesktopAsar(dmg, dest)
      expect(path.basename(asar)).toBe("obsidian.asar")
      expect(fs.statSync(asar).size).toBeGreaterThan(1_000_000)
    } finally {
      fs.rmSync(dest, { recursive: true, force: true })
    }
  })
})

describe.skipIf(!which("7z") || !fs.existsSync(exe))("extract EXE", () => {
  it("pulls the large obsidian.asar from app-64.7z", async() => {
    const dest = fs.mkdtempSync(path.join(originals, ".t-exe-"))
    try {
      const asar = await extractDesktopAsar(exe, dest)
      expect(fs.statSync(asar).size).toBeGreaterThan(1_000_000)
    } finally {
      fs.rmSync(dest, { recursive: true, force: true })
    }
  })
})
