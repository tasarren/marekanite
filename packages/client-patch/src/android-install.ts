/** Pure Android install helpers — no Node APIs (safe for admin-web). */

export type DeviceInspect = {
  sdk: number | null
  release: string | null
  packageName: string
  installed: boolean
  installer: string | null
}

export type AndroidInstallProfile = {
  id: string
  minSdk: number
  maxSdk: number | null
  /** host adb: after `adb -s SERIAL` */
  adbInstallArgs: string[]
  /** on-device pm (WebUSB) */
  pmInstallArgs: string[]
}

export const ANDROID_PACKAGE = "md.obsidian"

export const ANDROID_INSTALL_PROFILES: AndroidInstallProfile[] = [
  {
    id: "default",
    minSdk: 1,
    maxSdk: null,
    adbInstallArgs: ["install", "-r", "--no-incremental"],
    pmInstallArgs: ["install", "-r"],
  },
]

export function profileForSdk(sdk: number): AndroidInstallProfile {
  const hit = ANDROID_INSTALL_PROFILES.find(
    (p) => sdk >= p.minSdk && (p.maxSdk == null || sdk <= p.maxSdk),
  )
  return hit ?? ANDROID_INSTALL_PROFILES[0]!
}

export function parseGetpropSdk(stdout: string): number | null {
  const n = Number(stdout.trim())
  return Number.isInteger(n) && n > 0 ? n : null
}

export function parseGetpropRelease(stdout: string): string | null {
  const s = stdout.trim()
  return s.length > 0 && s !== "unknown" ? s : null
}

export function parsePmPath(stdout: string): boolean {
  return /^\s*package:/m.test(stdout)
}

export function parseInstallerLine(stdout: string): string | null {
  const m = stdout.match(/installer=(\S+)/)
  const v = m?.[1]
  if (!v || v === "null") return null
  return v
}

export function buildInspect(opts: {
  packageName?: string
  sdkStdout: string
  releaseStdout: string
  pmPathStdout: string
  installerStdout: string
}): DeviceInspect {
  const packageName = opts.packageName ?? ANDROID_PACKAGE
  return {
    sdk: parseGetpropSdk(opts.sdkStdout),
    release: parseGetpropRelease(opts.releaseStdout),
    packageName,
    installed: parsePmPath(opts.pmPathStdout),
    installer: parseInstallerLine(opts.installerStdout),
  }
}
