import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { requireBin, which } from "./index.js"

const prev = {
  PATH: process.env.PATH,
  ANDROID_HOME: process.env.ANDROID_HOME,
  ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT,
}

afterEach(() => {
  process.env.PATH = prev.PATH
  if (prev.ANDROID_HOME === undefined) delete process.env.ANDROID_HOME
  else process.env.ANDROID_HOME = prev.ANDROID_HOME
  if (prev.ANDROID_SDK_ROOT === undefined) delete process.env.ANDROID_SDK_ROOT
  else process.env.ANDROID_SDK_ROOT = prev.ANDROID_SDK_ROOT
})

function writeExec(dir: string, name: string): string {
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, name)
  fs.writeFileSync(file, "#!/bin/sh\nexit 0\n", { mode: 0o755 })
  fs.chmodSync(file, 0o755)
  return file
}

describe("which", () => {
  it("finds sh", () => {
    const p = which("sh")
    expect(p).toBeTruthy()
    expect(p).toMatch(/sh$/)
  })

  it("returns null for a missing binary", () => {
    expect(which("marekanite-definitely-not-installed")).toBeNull()
  })

  it("walks PATH", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "host-bin-path-"))
    const fake = writeExec(dir, "marekanite-fakebin")
    process.env.PATH = `${dir}${path.delimiter}${process.env.PATH ?? ""}`
    expect(which("marekanite-fakebin")).toBe(fake)
  })

  it("finds adb under ANDROID_HOME when PATH misses it", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "host-bin-sdk-"))
    const fake = writeExec(path.join(home, "platform-tools"), "adb")
    process.env.PATH = "/no/such/path"
    process.env.ANDROID_HOME = home
    delete process.env.ANDROID_SDK_ROOT
    expect(which("adb")).toBe(fake)
  })
})

describe("requireBin", () => {
  it("returns an override path that exists", () => {
    const sh = which("sh")
    expect(sh).toBeTruthy()
    expect(requireBin("sh", { path: sh! })).toBe(sh)
  })

  it("falls back to PATH when the override is dead", () => {
    const sh = which("sh")
    expect(sh).toBeTruthy()
    expect(requireBin("sh", { path: "/no/such/sh" })).toBe(sh)
  })

  it("throws when override and PATH both miss", () => {
    expect(() =>
      requireBin("marekanite-definitely-not-installed", {
        path: "/no/such/adb",
        hint: "install platform-tools",
      }),
    ).toThrow(/not found at \/no\/such\/adb or on PATH.*platform-tools/)
  })

  it("throws when PATH has no such binary", () => {
    expect(() => requireBin("marekanite-definitely-not-installed")).toThrow(
      /not found on PATH/,
    )
  })
})
