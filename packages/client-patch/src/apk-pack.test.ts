import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { describe, it, expect, afterEach } from "vitest"
import { packApkFromDir } from "./apk-pack.js"

describe("packApkFromDir", () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
  })

  it("stores resources.arsc and .so uncompressed", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "apk-pack-"))
    dirs.push(dir)
    writeFileSync(path.join(dir, "AndroidManifest.xml"), "<manifest/>")
    writeFileSync(path.join(dir, "resources.arsc"), Buffer.alloc(256, 0x41))
    mkdirSync(path.join(dir, "lib/arm64-v8a"), { recursive: true })
    writeFileSync(path.join(dir, "lib/arm64-v8a/libdummy.so"), Buffer.alloc(64, 1))
    mkdirSync(path.join(dir, "assets/public"), { recursive: true })
    writeFileSync(path.join(dir, "assets/public/app.js"), "console.log(1)\n")

    const out = path.join(dir, "out.apk")
    packApkFromDir(dir, out)
    const listing = execFileSync("unzip", ["-v", out], { encoding: "utf8" })
    expect(listing).toMatch(/Stored.*resources\.arsc/)
    expect(listing).toMatch(/Stored.*libdummy\.so/)
    expect(listing).not.toMatch(/Defl:N.*resources\.arsc/)
  })
})
