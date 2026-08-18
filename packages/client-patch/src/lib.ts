import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import { requireBin } from "@marekanite/host-bin"
import { packApkFromDir } from "./apk-pack.js"
import { patchClientTree } from "./patch-js.js"
import {
  keystoreEnvOptions,
  resolveKeystorePath,
  signApk,
} from "./apk-sign.js"

const require = createRequire(import.meta.url)

export type PatchJobOptions = {
  apiBase: string;
  extraWsSuffix?: string | undefined;
  onLog?: ((line: string) => void) | undefined;
  /**
   * Directory used to store/auto-generate the APK debug keystore.
   * Defaults to dirname(outputPath)/../apk-signing or env APK_KEYSTORE_PATH.
   */
  keystoreDir?: string;
  /** Skip signing (tests only). Default false — Android output is signed. */
  skipSign?: boolean;
}

function log(opts: PatchJobOptions, line: string) {
  opts.onLog?.(line)
}

export async function patchDesktopAsar(
  inputPath: string,
  outputPath: string,
  opts: PatchJobOptions,
): Promise<{ changes: string[] }> {
  const asar = require("@electron/asar") as {
    extractAll: (archive: string, dest: string) => void;
    createPackage: (src: string, dest: string) => Promise<void>;
  }

  if (!fs.existsSync(inputPath)) {
    throw new Error(`asar not found: ${inputPath}`)
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const tmp = fs.mkdtempSync(path.join(path.dirname(outputPath), ".asar-patch-"))

  try {
    log(opts, `extracting ${path.basename(inputPath)}…`)
    asar.extractAll(inputPath, tmp)
    log(opts, "running client rewrites (app.js, starter.js, main.js, …)")

    const changes = patchClientTree(tmp, {
      apiBase: opts.apiBase,
      extraWsSuffix: opts.extraWsSuffix,
    })
    for (const c of changes) log(opts, c)

    log(opts, `packing → ${path.basename(outputPath)}`)
    await asar.createPackage(tmp, outputPath)
    log(opts, "desktop patch complete")
    if (opts.apiBase.startsWith("http://")) {
      log(
        opts,
        "note: http:// API needs allowRunningInsecureContent (patched in main.js)",
      )
    }
    return { changes }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

export async function patchAndroidApk(
  inputPath: string,
  outputPath: string,
  opts: PatchJobOptions,
): Promise<{ changes: string[]; unsignedPath: string; signedPath: string }> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`apk not found: ${inputPath}`)
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  const tmp = fs.mkdtempSync(path.join(path.dirname(outputPath), ".apk-patch-"))

  try {
    log(opts, `unzipping ${path.basename(inputPath)}…`)
    const unzip = requireBin("unzip", { hint: "install unzip" })
    execFileSync(unzip, ["-qo", inputPath, "-d", tmp], { stdio: "pipe" })

    const publicDir = path.join(tmp, "assets/public")
    if (!fs.existsSync(publicDir)) {
      throw new Error("assets/public not found in APK")
    }

    log(opts, "running client rewrites under assets/public…")
    const changes = patchClientTree(publicDir, {
      apiBase: opts.apiBase,
      extraWsSuffix: opts.extraWsSuffix,
    })
    for (const c of changes) log(opts, c)

    const unsigned = outputPath.endsWith(".apk")
      ? outputPath.replace(/\.apk$/, ".unsigned.apk")
      : `${outputPath}.unsigned.apk`
    if (fs.existsSync(unsigned)) fs.unlinkSync(unsigned)

    log(opts, `zipping → ${path.basename(unsigned)} (store .arsc/.so)`)
    packApkFromDir(tmp, unsigned)

    if (opts.skipSign) {
      fs.copyFileSync(unsigned, outputPath)
      log(opts, "android patch complete (unsigned; skipSign=true)")
      return { changes, unsignedPath: unsigned, signedPath: outputPath }
    }

    // dataDir: parent of patch-jobs (…/data) when job writes under data/patch-jobs/<id>/
    const dataDir =
      opts.keystoreDir ?? path.dirname(path.dirname(outputPath))
    const keystorePath = process.env["APK_KEYSTORE_PATH"]
      ? resolveKeystorePath(dataDir)
      : path.join(dataDir, "apk-signing", "debug.keystore")

    const envOpts = keystoreEnvOptions()
    signApk(unsigned, {
      outputPath,
      keystorePath,
      ...envOpts,
      onLog: opts.onLog,
    })
    log(opts, `android patch complete (signed) → ${path.basename(outputPath)}`)
    return { changes, unsignedPath: unsigned, signedPath: outputPath }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}
