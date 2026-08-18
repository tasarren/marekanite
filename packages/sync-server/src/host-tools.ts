import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { which } from "@marekanite/host-bin"
import type { AdbCli } from "./adb-cli.js"

const execFileAsync = promisify(execFile)

export type HostToolNeed = "android-wifi" | "android-apk" | "desktop-dmg-exe"

export type HostTool = {
  id: "adb" | "zipalign" | "apksigner" | "keytool" | "7z" | "zip" | "unzip"
  label: string
  need: HostToolNeed
  available: boolean
  path: string | null
  detail: string | null
}

const OTHER: Array<{
  id: Exclude<HostTool["id"], "adb">
  label: string
  need: HostToolNeed
  bin: string
  versionArgs?: string[]
}> = [
  {
    id: "zipalign",
    label: "Align a patched APK",
    need: "android-apk",
    bin: "zipalign",
  },
  {
    id: "apksigner",
    label: "Sign a patched APK",
    need: "android-apk",
    bin: "apksigner",
    versionArgs: ["--version"],
  },
  {
    id: "keytool",
    label: "Make a debug keystore",
    need: "android-apk",
    bin: "keytool",
  },
  {
    id: "7z",
    label: "Open a Mac or Windows installer",
    need: "desktop-dmg-exe",
    bin: "7z",
  },
  {
    id: "zip",
    label: "Pack a patched APK",
    need: "android-apk",
    bin: "zip",
  },
  {
    id: "unzip",
    label: "Unpack a stock APK",
    need: "android-apk",
    bin: "unzip",
  },
]

async function probeNamed(spec: (typeof OTHER)[number]): Promise<HostTool> {
  const found = which(spec.bin)
  if (!found) {
    return {
      id: spec.id,
      label: spec.label,
      need: spec.need,
      available: false,
      path: null,
      detail: "Not on PATH",
    }
  }
  let detail = found
  if (spec.versionArgs) {
    try {
      const { stdout, stderr } = await execFileAsync(found, spec.versionArgs, {
        timeout: 5_000,
        encoding: "utf8",
      })
      const line = `${stdout}\n${stderr}`.split("\n").map((s) => s.trim()).find(Boolean)
      if (line) detail = line
    } catch {
      /* path is enough */
    }
  }
  return {
    id: spec.id,
    label: spec.label,
    need: spec.need,
    available: true,
    path: found,
    detail,
  }
}

export async function probeHostTools(adb: AdbCli): Promise<HostTool[]> {
  const adbStatus = await adb.status()
  const adbRow: HostTool = {
    id: "adb",
    label: "Wireless phone install",
    need: "android-wifi",
    available: adbStatus.available,
    path: adbStatus.path,
    detail: adbStatus.available
      ? (adbStatus.version ?? adbStatus.path)
      : (adbStatus.error ?? "adb not found"),
  }
  const rest = await Promise.all(OTHER.map(probeNamed))
  return [adbRow, ...rest]
}
