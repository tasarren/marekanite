import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { requireBin } from "@marekanite/host-bin"
import {
  ANDROID_PACKAGE,
  buildInspect,
  profileForSdk,
  type DeviceInspect,
} from "@marekanite/client-patch/android-install"

const execFileAsync = promisify(execFile)
const TIMEOUT_MS = 45_000

export class AdbCliError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdbCliError"
  }
}

const HOST_RE = /^(?:[A-Za-z0-9.-]+|\[[0-9a-fA-F:]+])$/

export function parseHostPort(host: string, port: string | number): string {
  const h = host.trim()
  const p = typeof port === "number" ? port : Number(port.trim())
  if (!HOST_RE.test(h) || h.includes("..")) {
    throw new AdbCliError("That address doesn’t look like a host")
  }
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    throw new AdbCliError("Port must be between 1 and 65535")
  }
  return `${h}:${p}`
}

export function parsePairingCode(code: string): string {
  const digits = code.trim()
  if (!/^\d{6}$/.test(digits)) {
    throw new AdbCliError("Pairing code must be six digits")
  }
  return digits
}

function splitSerial(serial: string): [string, string] {
  const s = serial.trim()
  const idx = s.lastIndexOf(":")
  if (idx <= 0) throw new AdbCliError("Need host:port")
  return [s.slice(0, idx), s.slice(idx + 1)]
}

/**
 * Host adb CLI.
 *
 * Binary resolution is delayed until first use so `status()` can report
 * unavailable instead of the constructor throwing.
 */
export type AdbStatus = {
  available: boolean
  path: string | null
  version: string | null
  error: string | null
}

export class AdbCli {
  private resolved: string | undefined
  private readonly overridePath?: string

  constructor(overridePath?: string) {
    this.overridePath = overridePath?.trim() || undefined
  }

  /** Resolve adb. Only a successful path is cached. */
  private bin(): string {
    if (this.resolved) return this.resolved
    try {
      this.resolved = requireBin("adb", {
        path: this.overridePath,
        hint: "Install Android platform-tools or configure ADB_PATH",
      })
      return this.resolved
    } catch(e) {
      throw new AdbCliError(
        e instanceof Error
          ? e.message
          : "adb isn’t installed on this machine. Install Android platform-tools or configure ADB_PATH.",
      )
    }
  }

  private async run(args: string[]): Promise<{ stdout: string; stderr: string }> {
    const bin = this.bin()

    try {
      return await execFileAsync(bin, args, {
        timeout: TIMEOUT_MS,
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
      })
    } catch(e) {
      const err = e as {
        stdout?: string
        stderr?: string
        message?: string
        code?: string | number
        killed?: boolean
        signal?: NodeJS.Signals
      }

      if (err.code === "ENOENT") {
        this.resolved = undefined
        throw new AdbCliError(
          "adb isn’t installed on this machine. Install Android platform-tools or configure ADB_PATH.",
        )
      }

      if (err.killed) {
        throw new AdbCliError(
          `adb timed out after ${TIMEOUT_MS / 1000} seconds`,
        )
      }

      const text = [
        err.stderr?.trim(),
        err.stdout?.trim(),
        err.message?.trim(),
      ]
        .filter(Boolean)
        .join("\n")

      throw new AdbCliError(text || "adb failed")
    }
  }

  private async runSoft(args: string[]): Promise<string> {
    try {
      const { stdout, stderr } = await this.run(args)
      return `${stdout} ${stderr}`.trim()
    } catch(e) {
      if (e instanceof AdbCliError) return e.message
      throw e
    }
  }

  async status(): Promise<AdbStatus> {
    try {
      const bin = this.bin()
      const { stdout } = await this.run(["version"])
      const line = stdout.split("\n")[0]?.trim() ?? ""
      return {
        available: true,
        path: bin,
        version: line || "adb",
        error: null,
      }
    } catch(e) {
      const error = e instanceof Error ? e.message : String(e)
      return {
        available: false,
        path: this.resolved ?? null,
        version: null,
        error,
      }
    }
  }

  async pair(host: string, port: string | number, code: string) {
    const target = parseHostPort(host, port)
    const pin = parsePairingCode(code)

    const { stdout, stderr } = await this.run([
      "pair",
      target,
      pin,
    ])

    return {
      ok: true,
      output: `${stdout}${stderr}`.trim(),
    }
  }

  async connect(host: string, port: string | number) {
    const target = parseHostPort(host, port)

    const { stdout, stderr } = await this.run([
      "connect",
      target,
    ])

    const output = `${stdout}${stderr}`.trim()

    if (
      /failed|unable|error/i.test(output) &&
            !/connected/i.test(output)
    ) {
      throw new AdbCliError(output || "Could not connect")
    }

    return {
      ok: true,
      serial: target,
      output,
    }
  }

  async inspect(
    serialRaw: string,
    packageName = ANDROID_PACKAGE,
  ): Promise<DeviceInspect> {
    const serial = parseHostPort(...splitSerial(serialRaw))

    const [sdkStdout, releaseStdout, pmPathStdout, installerStdout] = await Promise.all([
      this.runSoft(["-s", serial, "shell", "getprop", "ro.build.version.sdk"]),
      this.runSoft(["-s", serial, "shell", "getprop", "ro.build.version.release"]),
      this.runSoft(["-s", serial, "shell", "pm", "path", packageName]),
      this.runSoft(["-s", serial, "shell", "pm", "list", "packages", "-i", packageName]),
    ])

    return buildInspect({
      packageName,
      sdkStdout,
      releaseStdout,
      pmPathStdout,
      installerStdout,
    })
  }

  async uninstall(
    serialRaw: string,
    packageName = ANDROID_PACKAGE,
  ): Promise<{ output: string }> {
    const serial = parseHostPort(...splitSerial(serialRaw))
    const { stdout, stderr } = await this.run([
      "-s",
      serial,
      "uninstall",
      packageName,
    ])
    return { output: `${stdout}${stderr}`.trim() }
  }

  async install(opts: {
    serial: string
    apkPath: string
    uninstall?: boolean
    packageName?: string
    sdk?: number | null
  }): Promise<{
    output: string
    profile: string
    sdk: number | null
  }> {
    const serial = parseHostPort(...splitSerial(opts.serial))
    const pkg = opts.packageName ?? ANDROID_PACKAGE
    const lines: string[] = []
    const shouldUninstall = opts.uninstall === true

    let sdk = opts.sdk ?? null

    if (sdk == null) {
      try {
        const info = await this.inspect(serial, pkg)
        sdk = info.sdk
      } catch {
        sdk = null
      }
    }

    const profile = profileForSdk(sdk ?? 1)

    lines.push(
      `Android API ${sdk ?? "?"} profile=${profile.id}`,
    )

    if (shouldUninstall) {
      try {
        const u = await this.run([
          "-s",
          serial,
          "uninstall",
          pkg,
        ])

        lines.push(`${u.stdout}${u.stderr}`.trim())
      } catch(e) {
        lines.push(
          e instanceof Error
            ? e.message
            : String(e),
        )
      }
    }

    const inst = await this.run([
      "-s",
      serial,
      ...profile.adbInstallArgs,
      opts.apkPath,
    ])

    const installText =
      `${inst.stdout}${inst.stderr}`.trim()

    lines.push(installText)

    const output = lines
      .filter(Boolean)
      .join("\n")

    if (
      /Failure|Error/i.test(installText) &&
            !/Success/i.test(installText)
    ) {
      throw new AdbCliError(output)
    }

    return {
      output,
      profile: profile.id,
      sdk,
    }
  }
}
