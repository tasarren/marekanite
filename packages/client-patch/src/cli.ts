#!/usr/bin/env node
import path from "node:path"
import { patchAndroidApk, patchDesktopAsar } from "./lib.js"

type Args = {
  cmd: "desktop" | "android";
  profile: string;
  apiBase: string;
  extraWsSuffix?: string | undefined;
  asar?: string | undefined;
  apk?: string | undefined;
  out: string;
}

function usage(): never {
  console.log(`Usage:
  pnpm patch:desktop -- --profile dev --asar ./obsidian.asar --out ./artifacts/patched/obsidian.dev.asar
  pnpm patch:desktop -- --profile homelab --api-base https://api.sync.example.com --extra-ws-suffix .example.com --asar ./obsidian.asar --out ./artifacts/patched/obsidian.homelab.asar
  pnpm patch:android -- --profile dev --apk ./artifacts/android/md.obsidian-1.13.4-base.apk --out ./artifacts/patched/obsidian.dev.apk

Patches EVERY JS file that embeds the account API client (app.js AND starter.js).
`)
  process.exit(1)
}

function parseArgs(argv: string[]): Args {
  const filtered = argv.filter((a) => a !== "--")
  const cmd = filtered[0]
  if (cmd !== "desktop" && cmd !== "android") usage()

  let profile = "dev"
  let apiBase = "http://127.0.0.1:8787"
  let extraWsSuffix: string | undefined
  let asar: string | undefined
  let apk: string | undefined
  let out = ""

  for (let i = 1; i < filtered.length; i++) {
    const a = filtered[i]!
    const next = () => {
      const v = filtered[++i]
      if (!v) usage()
      return v
    }
    if (a === "--profile") profile = next()
    else if (a === "--api-base") apiBase = next()
    else if (a === "--extra-ws-suffix") extraWsSuffix = next()
    else if (a === "--asar") asar = next()
    else if (a === "--apk") apk = next()
    else if (a === "--out") out = next()
    else usage()
  }

  if (!out) usage()
  return { cmd, profile, apiBase, extraWsSuffix, asar, apk, out }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const onLog = (line: string) => { console.log(line.startsWith(" -") ? line : ` - ${line}`) }

  if (args.cmd === "desktop") {
    const asarPath = path.resolve(args.asar ?? "./obsidian.asar")
    const outPath = path.resolve(args.out)
    await patchDesktopAsar(asarPath, outPath, {
      apiBase: args.apiBase,
      extraWsSuffix: args.extraWsSuffix,
      onLog,
    })
    console.log("Patched desktop asar:", outPath)
  } else {
    const apkPath = path.resolve(
      args.apk ?? "./artifacts/android/md.obsidian-1.13.4-base.apk",
    )
    const outPath = path.resolve(args.out)
    const { signedPath, unsignedPath } = await patchAndroidApk(apkPath, outPath, {
      apiBase: args.apiBase,
      extraWsSuffix: args.extraWsSuffix,
      onLog,
    })
    console.log("Wrote signed APK:", signedPath)
    console.log("(unsigned intermediate:", unsignedPath + ")")
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
