/**
 * Install a patched APK via WebUSB ADB (Chromium only).
 * Lazy-loaded so the admin bundle stays light until needed.
 */

import {
  ANDROID_PACKAGE,
  buildInspect,
  profileForSdk,
  type DeviceInspect,
} from "@marekanite/client-patch/android-install"

export type WebAdbLog = (line: string) => void

const CRED_KEY = "marekanite-adb-private-key-pkcs8"
const REMOTE_APK = "/data/local/tmp/marekanite-patched.apk"

type AdbSessionHandle = {
  subprocess: {
    noneProtocol: { spawnWaitText: (args: string[]) => Promise<string> };
  };
  sync: () => Promise<{
    write: (opts: { filename: string; file: ReadableStream<Uint8Array> }) => Promise<unknown>;
    dispose: () => Promise<void> | void;
  }>;
  close: () => Promise<void>;
}

export type WebAdbSession = { adb: AdbSessionHandle }

export type WebUsbStatus = {
  ok: boolean;
  /** Short UI reason when !ok */
  reason: string;
  /** Extra remediation lines for the callout */
  hints: string[];
  isSecureContext: boolean;
  hasUsb: boolean;
  origin: string;
}

/**
 * WebUSB requires a *secure context*. Chromium treats only https:, localhost,
 * and 127.0.0.1 as secure — **not** plain http://hostname.local.
 */
export function getWebUsbStatus(): WebUsbStatus {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "(unknown)"
  const isSecureContext =
    typeof window !== "undefined" ? window.isSecureContext : false
  const hasUsb =
    typeof navigator !== "undefined" &&
    "usb" in navigator &&
    !!(navigator as Navigator & { usb?: unknown }).usb

  if (hasUsb && isSecureContext) {
    return {
      ok: true,
      reason: "",
      hints: [],
      isSecureContext,
      hasUsb,
      origin,
    }
  }

  const hints: string[] = []
  let reason = "WebUSB is not available in this context."

  if (!isSecureContext) {
    reason =
      "This page is not a secure context, so Chromium hides WebUSB (navigator.usb)."
    hints.push(
      `Current origin: ${origin} (http://*.local is not secure — only https, localhost, or 127.0.0.1 are).`,
    )
    hints.push(
      "Quick fix (Chromium): open chrome://flags/#unsafely-treat-insecure-origin-as-secure → enable → add this origin exactly → Relaunch.",
    )
    hints.push(
      `Example value: ${origin}`,
    )
    hints.push(
      "Or open the admin UI via http://127.0.0.1:8787 / http://localhost:8787 (port-forward if the server is remote).",
    )
    hints.push("Or put HTTPS in front of the server (Traefik/Caddy + LE).")
  } else if (!hasUsb) {
    reason = "Secure context, but navigator.usb is missing."
    hints.push("Use Chrome or Edge (not Firefox/Safari).")
    hints.push("Ensure WebUSB is not disabled by enterprise policy.")
  }

  return { ok: false, reason, hints, isSecureContext, hasUsb, origin }
}

export function webUsbSupported(): boolean {
  return getWebUsbStatus().ok
}

/** Minimal AdbCredentialStore backed by localStorage + WebCrypto. */
async function createCredentialStore(): Promise<{
  generateKey: () => Promise<{ buffer: Uint8Array; name: string }>;
  iterateKeys: () => AsyncGenerator<{ buffer: Uint8Array; name: string }>;
}> {
  async function generateKey() {
    const pair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-1",
      },
      true,
      ["sign", "verify"],
    )
    const pkcs8 = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", pair.privateKey),
    )
    try {
      localStorage.setItem(CRED_KEY, btoa(String.fromCharCode(...pkcs8)))
    } catch {
      /* ignore quota */
    }
    return { buffer: pkcs8, name: "marekanite@web" }
  }

  async function* iterateKeys() {
    try {
      const b64 = localStorage.getItem(CRED_KEY)
      if (b64) {
        const bin = atob(b64)
        const buf = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
        yield { buffer: buf, name: "marekanite@web" }
      }
    } catch {
      /* ignore */
    }
  }

  return { generateKey, iterateKeys }
}

function bufferToStream(buffer: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const chunk = 256 * 1024
      for (let i = 0; i < buffer.byteLength; i += chunk) {
        controller.enqueue(buffer.subarray(i, Math.min(i + chunk, buffer.byteLength)))
      }
      controller.close()
    },
  })
}

async function shell(adb: AdbSessionHandle, args: string[]): Promise<string> {
  try {
    return (await adb.subprocess.noneProtocol.spawnWaitText(args)).trim()
  } catch(e) {
    return e instanceof Error ? e.message : String(e)
  }
}

export async function connectWebUsbAdb(onLog: WebAdbLog): Promise<WebAdbSession> {
  const status = getWebUsbStatus()
  if (!status.ok) {
    throw new Error(
      [status.reason, ...status.hints].filter(Boolean).join(" "),
    )
  }

  onLog("loading WebADB modules…")
  const { Adb, AdbDaemonTransport } = await import("@yume-chan/adb")
  const { AdbDaemonWebUsbDeviceManager } = await import(
    "@yume-chan/adb-daemon-webusb",
  )

  const manager = AdbDaemonWebUsbDeviceManager.BROWSER
  if (!manager) {
    throw new Error("WebUSB ADB manager unavailable in this browser")
  }

  onLog("select USB device (USB debugging must be on)…")
  const device = await manager.requestDevice()
  if (!device) {
    throw new Error("No device selected")
  }
  onLog(`device: ${device.serial || device.name || "android"}`)

  onLog("opening WebUSB connection…")
  const connection = await device.connect()

  onLog("authenticating (accept the RSA prompt on the phone if shown)…")
  const credentialStore = await createCredentialStore()
  const transport = await AdbDaemonTransport.authenticate({
    serial: device.serial,
    connection,
    credentialStore,
  })
  const adb = new Adb(transport)
  onLog("ADB ready")
  return { adb: adb as unknown as AdbSessionHandle }
}

export async function inspectWebUsbDevice(
  session: WebAdbSession,
  onLog: WebAdbLog,
  packageName = ANDROID_PACKAGE,
): Promise<DeviceInspect> {
  const adb = session.adb
  const [sdkStdout, releaseStdout, pmPathStdout, installerStdout] =
    await Promise.all([
      shell(adb, ["getprop", "ro.build.version.sdk"]),
      shell(adb, ["getprop", "ro.build.version.release"]),
      shell(adb, ["pm", "path", packageName]),
      shell(adb, ["pm", "list", "packages", "-i", packageName]),
    ])
  const info = buildInspect({
    packageName,
    sdkStdout,
    releaseStdout,
    pmPathStdout,
    installerStdout,
  })
  onLog(
    `Android ${info.release ?? "?"} / API ${info.sdk ?? "?"} · ${
      info.installed ? "Obsidian is installed" : "Obsidian is not installed"
    }`,
  )
  return info
}

export async function closeWebUsbAdb(session: WebAdbSession | null): Promise<void> {
  if (!session) return
  try {
    await session.adb.close()
  } catch {
    /* ignore */
  }
}

export async function installOnWebUsbSession(
  session: WebAdbSession,
  apkUrl: string,
  onLog: WebAdbLog,
  opts?: { uninstall?: boolean; packageName?: string; sdk?: number | null | undefined },
): Promise<void> {
  const adb = session.adb
  const pkg = opts?.packageName ?? ANDROID_PACKAGE
  const profile = profileForSdk(opts?.sdk && opts.sdk > 0 ? opts.sdk : 1)
  onLog(`install profile=${profile.id}`)

  if (opts?.uninstall) {
    onLog(`pm uninstall ${pkg}…`)
    try {
      const out = await adb.subprocess.noneProtocol.spawnWaitText([
        "pm",
        "uninstall",
        pkg,
      ])
      onLog(out.trim() || "uninstall done")
    } catch(e) {
      onLog(
        `uninstall: ${e instanceof Error ? e.message : String(e)} (continuing)`,
      )
    }
  }

  onLog("fetching APK…")
  const { adminHeaders } = await import("../api/client")
  const res = await fetch(apkUrl, { headers: adminHeaders() })
  if (!res.ok) throw new Error(`APK download failed: HTTP ${res.status}`)
  const buffer = new Uint8Array(await res.arrayBuffer())
  onLog(`APK ${(buffer.byteLength / 1e6).toFixed(1)} MB — pushing to device…`)

  const sync = await adb.sync()
  try {
    await sync.write({
      filename: REMOTE_APK,
      file: bufferToStream(buffer),
    })
  } finally {
    await sync.dispose()
  }
  onLog(`push complete — pm ${profile.pmInstallArgs.join(" ")} …`)

  const installOut = await adb.subprocess.noneProtocol.spawnWaitText([
    "pm",
    ...profile.pmInstallArgs,
    REMOTE_APK,
  ])
  onLog(installOut.trim() || "pm install finished")

  if (/Failure|Error/i.test(installOut)) {
    throw new Error(
      installOut.trim() ||
        "Install failed. Remove the store app first if signatures differ.",
    )
  }

  try {
    await adb.subprocess.noneProtocol.spawnWaitText(["rm", "-f", REMOTE_APK])
  } catch {
    /* ignore cleanup */
  }

  onLog("install complete")
}
