import { describe, expect, it } from "vitest"
import {
  buildInspect,
  parseGetpropRelease,
  parseGetpropSdk,
  parseInstallerLine,
  parsePmPath,
  profileForSdk,
} from "./android-install.js"

describe("parseGetpropSdk", () => {
  it("reads API levels", () => {
    expect(parseGetpropSdk("30\n")).toBe(30)
    expect(parseGetpropSdk("  33  ")).toBe(33)
  })

  it("rejects junk", () => {
    expect(parseGetpropSdk("")).toBeNull()
    expect(parseGetpropSdk("unknown")).toBeNull()
  })
})

describe("parseGetpropRelease", () => {
  it("keeps a version string", () => {
    expect(parseGetpropRelease("14\n")).toBe("14")
  })

  it("drops empty/unknown", () => {
    expect(parseGetpropRelease("")).toBeNull()
    expect(parseGetpropRelease("unknown")).toBeNull()
  })
})

describe("parsePmPath", () => {
  it("detects an installed package", () => {
    expect(parsePmPath("package:/data/app/~~x==/md.obsidian-abc/base.apk\n")).toBe(
      true,
    )
  })

  it("is false when missing", () => {
    expect(parsePmPath("")).toBe(false)
    expect(parsePmPath("Error: package not found")).toBe(false)
  })
})

describe("parseInstallerLine", () => {
  it("reads Play Store", () => {
    expect(
      parseInstallerLine("package:md.obsidian  installer=com.android.vending"),
    ).toBe("com.android.vending")
  })

  it("treats null/missing as none", () => {
    expect(parseInstallerLine("package:md.obsidian  installer=null")).toBeNull()
    expect(parseInstallerLine("")).toBeNull()
  })
})

describe("profileForSdk", () => {
  it("uses default for pre-R and R+", () => {
    expect(profileForSdk(28).id).toBe("default")
    expect(profileForSdk(33).id).toBe("default")
  })
})

describe("buildInspect", () => {
  it("assembles a Play Store install on API 34", () => {
    const info = buildInspect({
      sdkStdout: "34",
      releaseStdout: "14",
      pmPathStdout: "package:/data/app/md.obsidian/base.apk",
      installerStdout: "package:md.obsidian  installer=com.android.vending",
    })
    expect(info).toEqual({
      sdk: 34,
      release: "14",
      packageName: "md.obsidian",
      installed: true,
      installer: "com.android.vending",
    })
  })
})
