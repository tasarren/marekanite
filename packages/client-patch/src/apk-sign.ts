/**
 * Align + sign an APK with apksigner (debug or user keystore).
 */
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { requireBin } from "@marekanite/host-bin"

export type ApkSignOptions = {
  /** Final signed APK path */
  outputPath: string;
  /** Keystore path; created if missing when allowGenerate is true */
  keystorePath: string;
  keystorePass?: string | undefined;
  keyAlias?: string | undefined;
  keyPass?: string | undefined;
  /** Generate debug keystore if missing (default true) */
  allowGenerate?: boolean;
  onLog?: ((line: string) => void) | undefined;
}

const DEFAULT_STORE_PASS = "obsidianlocal"
const DEFAULT_KEY_ALIAS = "marekanite"
const DEFAULT_KEY_PASS = "obsidianlocal"

function log(opts: ApkSignOptions, line: string) {
  opts.onLog?.(line)
}

const ANDROID_SDK_HINT = "install Android build-tools / OpenJDK for APK signing"

export function ensureDebugKeystore(
  keystorePath: string,
  opts: {
    storePass?: string;
    keyAlias?: string;
    keyPass?: string;
    onLog?: ((line: string) => void) | undefined;
  } = {},
): void {
  if (fs.existsSync(keystorePath)) return
  const keytool = requireBin("keytool", { hint: ANDROID_SDK_HINT })
  fs.mkdirSync(path.dirname(keystorePath), { recursive: true })
  const storePass = opts.storePass ?? DEFAULT_STORE_PASS
  const keyAlias = opts.keyAlias ?? DEFAULT_KEY_ALIAS
  const keyPass = opts.keyPass ?? DEFAULT_KEY_PASS
  opts.onLog?.(
    `generating debug keystore → ${keystorePath} (alias ${keyAlias})`,
  )
  execFileSync(
    keytool,
    [
      "-genkeypair",
      "-v",
      "-keystore",
      keystorePath,
      "-storepass",
      storePass,
      "-keypass",
      keyPass,
      "-alias",
      keyAlias,
      "-keyalg",
      "RSA",
      "-keysize",
      "2048",
      "-validity",
      "10000",
      "-dname",
      "CN=ObsidianLocalDebug,O=ObsidianLocal,C=US",
    ],
    { stdio: "pipe" },
  )
}

/**
 * zipalign + apksigner sign + verify. Writes signed APK to opts.outputPath.
 */
export function signApk(unsignedApk: string, opts: ApkSignOptions): void {
  if (!fs.existsSync(unsignedApk)) {
    throw new Error(`unsigned apk not found: ${unsignedApk}`)
  }
  const zipalign = requireBin("zipalign", { hint: ANDROID_SDK_HINT })
  const apksigner = requireBin("apksigner", { hint: ANDROID_SDK_HINT })

  const storePass = opts.keystorePass ?? DEFAULT_STORE_PASS
  const keyAlias = opts.keyAlias ?? DEFAULT_KEY_ALIAS
  const keyPass = opts.keyPass ?? DEFAULT_KEY_PASS
  const allowGenerate = opts.allowGenerate !== false

  if (!fs.existsSync(opts.keystorePath)) {
    if (!allowGenerate) {
      throw new Error(`keystore not found: ${opts.keystorePath}`)
    }
    ensureDebugKeystore(opts.keystorePath, {
      storePass,
      keyAlias,
      keyPass,
      onLog: opts.onLog,
    })
  }

  fs.mkdirSync(path.dirname(opts.outputPath), { recursive: true })
  const aligned = opts.outputPath.replace(/\.apk$/i, "") + ".aligned.apk"
  if (fs.existsSync(aligned)) fs.unlinkSync(aligned)
  if (fs.existsSync(opts.outputPath)) fs.unlinkSync(opts.outputPath)

  log(opts, `zipalign → ${path.basename(aligned)}`)
  execFileSync(zipalign, ["-p", "-f", "4", unsignedApk, aligned], {
    stdio: "pipe",
  })

  log(opts, `apksigner sign → ${path.basename(opts.outputPath)}`)
  execFileSync(
    apksigner,
    [
      "sign",
      "--ks",
      opts.keystorePath,
      "--ks-pass",
      `pass:${storePass}`,
      "--ks-key-alias",
      keyAlias,
      "--key-pass",
      `pass:${keyPass}`,
      "--out",
      opts.outputPath,
      aligned,
    ],
    { stdio: "pipe" },
  )

  log(opts, "apksigner verify…")
  execFileSync(apksigner, ["verify", "--verbose", opts.outputPath], {
    stdio: "pipe",
  })
  log(opts, "zipalign -c…")
  execFileSync(zipalign, ["-c", "-p", "4", opts.outputPath], {
    stdio: "pipe",
  })
  log(opts, "apk signed, verified, and aligned")

  try {
    fs.unlinkSync(aligned)
  } catch {
    /* ignore */
  }
}

/** Resolve keystore path from env or default under dataDir. */
export function resolveKeystorePath(dataDir: string): string {
  const fromEnv = process.env["APK_KEYSTORE_PATH"]
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.resolve(process.cwd(), fromEnv)
  }
  return path.join(dataDir, "apk-signing", "debug.keystore")
}

export function keystoreEnvOptions(): {
  keystorePass?: string | undefined;
  keyAlias?: string | undefined;
  keyPass?: string | undefined;
} {
  return {
    keystorePass: process.env["APK_KEYSTORE_PASS"] || undefined,
    keyAlias: process.env["APK_KEY_ALIAS"] || undefined,
    keyPass: process.env["APK_KEY_PASS"] || undefined,
  }
}
