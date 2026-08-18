import fs from "node:fs"
import path from "node:path"

export type RequireBinOptions = {
  /** Explicit path (e.g. from config / ADB_PATH). Used as-is when runnable. */
  path?: string | undefined
  /** Extra text appended to the "not found" error. */
  hint?: string | undefined
}

function hintSuffix(hint: string | undefined): string {
  return hint ? ` (${hint})` : ""
}

function isExecutable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK)
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

function envDir(name: string): string | undefined {
  const raw = process.env[name]?.trim()
  return raw || undefined
}

/**
 * Resolve a binary on this process PATH.
 * For `adb`, also tries `$ANDROID_HOME/platform-tools/adb`.
 */
export function which(bin: string): string | null {
  if (bin.includes("/") || bin.includes("\\")) {
    const resolved = path.resolve(bin)
    return isExecutable(resolved) ? resolved : null
  }

  const envPath = process.env.PATH ?? ""
  for (const dir of envPath.split(path.delimiter)) {
    const searchDir = dir || process.cwd()
    const candidate = path.join(searchDir, bin)
    if (isExecutable(candidate)) return candidate
  }

  if (bin === "adb") {
    for (const root of [envDir("ANDROID_HOME"), envDir("ANDROID_SDK_ROOT")]) {
      if (!root) continue
      const candidate = path.join(root, "platform-tools", "adb")
      if (isExecutable(candidate)) return candidate
    }
  }

  return null
}

/** Resolve `bin` or throw. A dead override falls back to PATH. */
export function requireBin(bin: string, opts?: RequireBinOptions): string {
  const override = opts?.path?.trim()
  if (override) {
    const resolved = path.resolve(override)
    if (isExecutable(resolved)) return resolved
  }

  const found = which(bin)
  if (found) return found

  if (override) {
    throw new Error(
      `${bin} not found at ${path.resolve(override)} or on PATH${hintSuffix(opts?.hint)}`,
    )
  }
  throw new Error(`${bin} not found on PATH${hintSuffix(opts?.hint)}`)
}
