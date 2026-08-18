export const COMPAT_API_BASE = "http://192.0.2.10:8787"

export type ContractId =
  | "api-charcode"
  | "api-literal"
  | "ws-allow"
  | "ws-gethost"
  | "main-insecure"

export type ProbeFiles = {
  appJs?: string;
  starterJs?: string;
  mainJs?: string;
}

export type StockProbe = {
  found: ContractId[];
  missing: ContractId[];
}

export type PatchProbe = {
  ok: boolean;
  failed: string[];
}

const CHARCODE = "String.fromCharCode(97,112,105)"
const API_LITERAL = "https://api.obsidian.md"

export function probeStock(files: ProbeFiles, kind: "desktop" | "android"): StockProbe {
  const found: ContractId[] = []
  const required: ContractId[] = ["api-charcode", "ws-allow", "ws-gethost"]
  if (kind === "desktop") required.push("main-insecure")

  const app = files.appJs ?? ""
  const starter = files.starterJs ?? ""
  const main = files.mainJs ?? ""

  const appHasApi = app.includes(CHARCODE) || app.includes(API_LITERAL)
  const starterHasApi =
    !files.starterJs || starter.includes(CHARCODE) || starter.includes(API_LITERAL)
  if (appHasApi && starterHasApi) found.push("api-charcode")
  if (app.includes(API_LITERAL) || starter.includes(API_LITERAL)) {
    found.push("api-literal")
  }
  if (app.includes(".obsidian.md") && app.includes("\"127.0.0.1\"")) {
    found.push("ws-allow")
  }
  if (app.includes("prototype.getHost=function") && app.includes("127.0.0.1:3003")) {
    found.push("ws-gethost")
  }
  if (kind === "desktop" && main.includes("webPreferences:{")) {
    found.push("main-insecure")
  }

  const missing = required.filter((id) => !found.includes(id))
  return { found, missing }
}

export function probePatched(
  files: ProbeFiles,
  apiBase: string,
  kind: "desktop" | "android",
): PatchProbe {
  const failed: string[] = []
  const base = apiBase.replace(/\/$/, "")
  let hostname = "192.0.2.10"
  let ws = "ws://192.0.2.10:8787"
  try {
    const u = new URL(base)
    hostname = u.hostname
    ws = `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}`
  } catch {
    /* keep docs IP */
  }

  const app = files.appJs ?? ""
  const starter = files.starterJs ?? ""
  const main = files.mainJs ?? ""

  if (!app.includes(base)) failed.push("app.js missing apiBase")
  if (starter.includes("/user/signin") && !starter.includes(base)) {
    failed.push("starter.js missing apiBase")
  }
  if (app.includes(CHARCODE) || starter.includes(CHARCODE)) {
    failed.push("stock char-code API still present")
  }
  const getHostFns = [
    ...app.matchAll(/[A-Za-z_$][\w$]*\.prototype\.getHost=function\(\)\{[^}]+\}/g),
  ].map((m) => m[0])
  const syncGetHost =
    getHostFns.find((fn) => fn.includes("3003") || /return"wss?:\/\//.test(fn)) ?? ""
  if (syncGetHost) {
    if (!syncGetHost.includes(`return"${ws}"`)) {
      failed.push(`getHost is not ${ws}`)
    }
    if (syncGetHost.includes("this.host")) {
      failed.push("getHost still reads this.host")
    }
  }
  if (hostname !== "127.0.0.1" && app.includes(".obsidian.md") && !app.includes(`"${hostname}"`)) {
    failed.push(`allowlist missing ${hostname}`)
  }
  if (kind === "desktop" && main.includes("webPreferences:{") && !main.includes("allowRunningInsecureContent")) {
    failed.push("main.js missing allowRunningInsecureContent")
  }

  return { ok: failed.length === 0, failed }
}

export function verdict(opts: {
  stock: StockProbe;
  patched: PatchProbe;
}): "ok" | "partial" | "unsupported" {
  if (opts.patched.ok) return "ok"
  const apiFailed = opts.patched.failed.some(
    (f) => f.includes("apiBase") || f.includes("char-code"),
  )
  if (apiFailed) return "unsupported"
  return "partial"
}
