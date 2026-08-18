import { describe, expect, it } from "vitest"
import { AdbCli } from "./adb-cli.js"
import { probeHostTools } from "./host-tools.js"

describe("probeHostTools", () => {
  it("returns adb plus the packer tools", async() => {
    const tools = await probeHostTools(new AdbCli())
    const ids = tools.map((t) => t.id)
    expect(ids).toEqual([
      "adb",
      "zipalign",
      "apksigner",
      "keytool",
      "7z",
      "zip",
      "unzip",
    ])
    const zip = tools.find((t) => t.id === "zip")
    const unzip = tools.find((t) => t.id === "unzip")
    expect(zip?.available).toBe(true)
    expect(unzip?.available).toBe(true)
  })
})
