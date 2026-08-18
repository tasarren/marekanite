import fs from "node:fs"
import { execFileSync } from "node:child_process"
import { requireBin } from "@marekanite/host-bin"

/** Rebuild an extracted APK tree. .arsc and .so must stay Stored (Android R+). */
export function packApkFromDir(dir: string, outApk: string): void {
  if (fs.existsSync(outApk)) fs.unlinkSync(outApk)
  const zip = requireBin("zip", { hint: "install zip" })
  execFileSync(zip, ["-qr", "-X", "-n", ".arsc:.so", outApk, "."], {
    cwd: dir,
    stdio: "pipe",
  })
}
