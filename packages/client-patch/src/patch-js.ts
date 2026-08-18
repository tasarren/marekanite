/**
 * Obsidian Sync client rewrites for minified JS inside asar / APK.
 *
 * Stock API base appears in BOTH app.js and starter.js:
 *   "https://"+[String.fromCharCode(97,112,105),"obsidian","md"].join(".")
 *
 * Login from the vault chooser uses starter.js — patching only app.js is a bug.
 *
 * Renderer origin is secure app://obsidian.md; HTTP localhost needs
 * allowRunningInsecureContent in main.js (see patchMainJs).
 */

import fs from "node:fs"
import path from "node:path"

export type PatchOptions = {
  /** Full API origin, e.g. http://127.0.0.1:8787 */
  apiBase: string;
  /** Extra WS hostname suffix, e.g. ".example.com" */
  extraWsSuffix?: string | undefined;
}

const API_EXPR =
  "\"https://\"+[String.fromCharCode(97,112,105),\"obsidian\",\"md\"].join(\".\")"

/**
 * Patch API base (+ optional WS allowlist) in one JS bundle.
 * Returns null if file has nothing relevant to change.
 */
export function patchClientJs(
  source: string,
  opts: PatchOptions,
  label = "bundle",
): { code: string; changes: string[] } | null {
  let code = source
  const changes: string[] = []
  const apiBase = opts.apiBase.replace(/\/$/, "")
  const apiLiteral = JSON.stringify(apiBase)

  // 1) Stock obfuscated construction
  if (code.includes(API_EXPR)) {
    code = code.split(API_EXPR).join(apiLiteral)
    changes.push(`${label}: API base → ${apiBase}`)
  }

  // 2) Already a plain https://api.obsidian.md string
  if (code.includes("https://api.obsidian.md")) {
    code = code.split("https://api.obsidian.md").join(apiBase)
    changes.push(`${label}: API base (literal) → ${apiBase}`)
  }

  // 3) fetch,<id>="https://…" pattern (app.js uses Jw, starter.js uses M, etc.)
  //    Only retarget if this file is an account client (/user/signin present).
  if (code.includes("/user/signin")) {
    const re = /(=fetch,)([A-Za-z_$][\w$]*)="(https?:\/\/[^"]+)"/g
    code = code.replace(re, (full, prefix: string, id: string, url: string) => {
      if (url === apiBase) return full
      changes.push(`${label}: API base (fetch,${id}) ${url} → ${apiBase}`)
      return `${prefix}${id}=${apiLiteral}`
    })
    // also: var X=fetch,Y="url"
    const re2 = /(,fetch,)([A-Za-z_$][\w$]*)="(https?:\/\/[^"]+)"/g
    code = code.replace(re2, (full, prefix: string, id: string, url: string) => {
      if (url === apiBase) return full
      changes.push(`${label}: API base (,fetch,${id}) ${url} → ${apiBase}`)
      return `${prefix}${id}=${apiLiteral}`
    })
  }

  let url: URL
  try {
    url = new URL(apiBase)
  } catch {
    url = new URL("http://127.0.0.1:8787")
  }
  const beforeWs = code
  code = patchWsGate(code, url, opts.extraWsSuffix)
  if (code !== beforeWs) {
    changes.push(
      `${label}: Sync WS ${url.protocol === "https:" ? "wss" : "ws"}://${url.host} (allow ${url.hostname})`,
    )
  }

  return changes.length ? { code, changes } : null
}

/** @deprecated use patchClientJs */
export function patchAppJs(
  source: string,
  opts: PatchOptions,
): { code: string; changes: string[] } {
  const r = patchClientJs(source, opts, "app.js")
  if (!r) {
    throw new Error("Could not find API base in bundle")
  }
  return r
}

const ALLOW_RE =
  /!([A-Za-z_$][\w$]*)\.call\(([A-Za-z_$][\w$]*),"\.obsidian\.md"\)&&"127\.0\.0\.1"!==\2(?:&&!\1\.call\(\2,"[^"]+"\))*(?:&&"[^"]+"!==\2)*/g

/** Sync only (port 3003 + ws). Do not touch Publish getHost (3002 + http). */
const STOCK_SYNC_GET_HOST_RE =
  /([A-Za-z_$][\w$]*)\.prototype\.getHost=function\(\)\{var e=this\.host\|\|"127\.0\.0\.1:3003";return e\.startsWith\("127\.0\.0\.1"\)\|\|e\.startsWith\("localhost"\)\?"ws:\/\/"\+e:"wss:\/\/"\+e\}/g

const PATCHED_SYNC_GET_HOST_RE =
  /([A-Za-z_$][\w$]*)\.prototype\.getHost=function\(\)\{return"wss?:\/\/[^"]+"\}/g

/** Rewrite stock Sync allowlist + getHost from the public API origin. */
export function patchWsGate(
  source: string,
  apiUrl: URL,
  extraSuffix?: string,
): string {
  const wsScheme = apiUrl.protocol === "https:" ? "wss" : "ws"
  const defaultHost = apiUrl.host
  const extraHosts = [apiUrl.hostname].filter((h) => h && h !== "127.0.0.1")

  let code = source.replace(ALLOW_RE, (_m, endsWithFn: string, hostVar: string) => {
    let out = `!${endsWithFn}.call(${hostVar},".obsidian.md")&&"127.0.0.1"!==${hostVar}`
    if (extraSuffix) {
      const suffix = extraSuffix.startsWith(".")
        ? extraSuffix
        : `.${extraSuffix}`
      out += `&&!${endsWithFn}.call(${hostVar},${JSON.stringify(suffix)})`
    }
    for (const h of extraHosts) {
      out += `&&${JSON.stringify(h)}!==${hostVar}`
    }
    return out
  })

  const patchedBody = `{return${JSON.stringify(`${wsScheme}://${defaultHost}`)}}`
  STOCK_SYNC_GET_HOST_RE.lastIndex = 0
  PATCHED_SYNC_GET_HOST_RE.lastIndex = 0
  code = code.replace(STOCK_SYNC_GET_HOST_RE, (_m, id: string) => `${id}.prototype.getHost=function()${patchedBody}`)
  code = code.replace(PATCHED_SYNC_GET_HOST_RE, (_m, id: string) => `${id}.prototype.getHost=function()${patchedBody}`)
  return code
}

/** @deprecated use patchWsGate */
export function patchWsAllowlist(source: string, extraSuffix: string): string {
  return patchWsGate(source, new URL("http://127.0.0.1:8787"), extraSuffix)
}

/**
 * Stock Account / Sync "Sign up" opens the cloud website.
 * Extend Bee (login modal) with openAsSignup + doSignup (name field, PoW, rk),
 * and rewire cloud Sign up buttons to `new Bee(app).openAsSignup()`.
 * Mobile start screen already uses goTo(fE) → vE; left alone.
 */
export function patchSignupUx(source: string, label = "bundle"): {
  code: string;
  changes: string[];
} | null {
  const cloudOpen =
    "td.isIosApp&&Df?Df.open({url:\"https://obsidian.md/auth#signup\"}):window.open(\"https://obsidian.md/auth#signup\")"
  if (
    !source.includes(cloudOpen) &&
    !source.includes("obsidian.md/auth#signup") &&
    !source.includes("Bee=function")
  ) {
    return null
  }

  let code = source
  const changes: string[] = []

  // Inject Bee.prototype.openAsSignup / doSignup before class close `t}(dw)` after login method.
  const beeClose = "t.prototype.login=function(){return y(this,void 0,void 0,(function(){var e,t,n,i,r,o,a,s,l;return b(this,(function(c){switch(c.label){case 0:if(t=(e=this).emailEl,n=e.passwordEl,i=e.mfaEl,this.errorEl.hide(),r=t.value,o=n.value,a=i.value,\"\"===r)return this.showError(Ree.messageEmptyEmail()),[2];if(-1===r.indexOf(\"@\"))return this.showError(Ree.messageInvalidEmail()),[2];if(\"\"===o)return this.showError(Ree.messageEmptyPassword()),[2];if(\"\"!==a&&!/^\\d{6}$/.test(a))return this.showError(Ree.mfaWrongFormat()),[2];this.loadingEl.show(),this.contentEl.hide(),c.label=1;case 1:return c.trys.push([1,3,,4]),[4,Ok.login(r,o,a)];case 2:return c.sent(),this.close(),[3,4];case 3:return(s=c.sent())instanceof tk?(l=s.error).contains(\"2FA code is incorrect\")?this.showError(Ree.mfaVerificationFailed()):l.contains(\"2FA code\")?(this.emailSectionEl.hide(),this.passwordSectionEl.hide(),this.mfaSectionEl.show()):this.showError(l):this.showError(Ree.messageLoginFailed()),this.loadingEl.hide(),this.contentEl.show(),[3,4];case 4:return[2]}}))}))},t}(dw)"

  const beeMethods =
    "t.prototype.login=function(){return y(this,void 0,void 0,(function(){var e,t,n,i,r,o,a,s,l;return b(this,(function(c){switch(c.label){case 0:if(t=(e=this).emailEl,n=e.passwordEl,i=e.mfaEl,this.errorEl.hide(),r=t.value,o=n.value,a=i.value,\"\"===r)return this.showError(Ree.messageEmptyEmail()),[2];if(-1===r.indexOf(\"@\"))return this.showError(Ree.messageInvalidEmail()),[2];if(\"\"===o)return this.showError(Ree.messageEmptyPassword()),[2];if(\"\"!==a&&!/^\\d{6}$/.test(a))return this.showError(Ree.mfaWrongFormat()),[2];this.loadingEl.show(),this.contentEl.hide(),c.label=1;case 1:return c.trys.push([1,3,,4]),[4,Ok.login(r,o,a)];case 2:return c.sent(),this.close(),[3,4];case 3:return(s=c.sent())instanceof tk?(l=s.error).contains(\"2FA code is incorrect\")?this.showError(Ree.mfaVerificationFailed()):l.contains(\"2FA code\")?(this.emailSectionEl.hide(),this.passwordSectionEl.hide(),this.mfaSectionEl.show()):this.showError(l):this.showError(Ree.messageLoginFailed()),this.loadingEl.hide(),this.contentEl.show(),[3,4];case 4:return[2]}}))}))}," +
    /* openAsSignup — Obsidian-styled modal form */
    "t.prototype.openAsSignup=function(){var e=this;this.isSignup=!0;try{this.titleEl.setText(Ree.labelSignUp?Ree.labelSignUp():\"Sign up\")}catch(t){this.titleEl.setText(\"Sign up\")}if(!this.nameEl){this.nameSectionEl=this.contentEl.createEl(\"p\",\"form-field\",(function(t){t.createEl(\"label\",{cls:\"input-label\",text:md.setting&&md.setting.account&&md.setting.account.labelName?md.setting.account.labelName():\"Name\"}),e.nameEl=t.createEl(\"input\",{type:\"text\",attr:{autocomplete:\"name\"}})}));this.passwordSectionEl&&this.nameSectionEl&&this.contentEl.insertBefore(this.nameSectionEl,this.passwordSectionEl)}else this.nameSectionEl&&this.nameSectionEl.show&&this.nameSectionEl.show();this.mfaSectionEl&&this.mfaSectionEl.hide&&this.mfaSectionEl.hide();var t=this.buttonContainerEl.querySelector(\"button.mod-cta\");t&&(t.textContent=Ree.labelSignUp?Ree.labelSignUp():\"Sign up\",t.onclick=this.doSignup.bind(this));var n=this.buttonContainerEl.querySelector(\"a.mod-secondary\");n&&(n.style.display=\"none\");return this.open(),this}," +
    "t.prototype.doSignup=function(){var e=this,t=this.emailEl.value,n=this.passwordEl.value,i=this.nameEl&&this.nameEl.value||\"\";if(this.errorEl.hide(),\"\"===t)return this.showError(Ree.messageEmptyEmail());if(-1===t.indexOf(\"@\"))return this.showError(Ree.messageInvalidEmail());if(\"\"===n)return this.showError(Ree.messageEmptyPassword());i=i||t.split(\"@\")[0]||\"User\",this.loadingEl.show(),this.contentEl.hide(),this._pow=this._pow||new KC,this._pow.get().then((function(r){return rk(t,n,i,\"buy_sync\",r)})).then((function(t){t&&t.token&&(Ok.token=t.token,Ok.email=t.email,Ok.name=t.name,Ok.license=t.license,Ok.save()),e.close(),new xw(\"Account created — signed in\")})).catch((function(t){e.showError(t&&t.error||t&&t.message||\"Sign up failed\"),e.loadingEl.hide(),e.contentEl.show()}))},t}(dw)"

  if (code.includes(beeClose) && !code.includes("openAsSignup=function")) {
    code = code.split(beeClose).join(beeMethods)
    changes.push(`${label}: Bee modal openAsSignup + doSignup`)
  } else if (code.includes("/*obs-local-signup-modal*/")) {
    changes.push(`${label}: Bee signup modal already present`)
  } else if (code.includes("Bee=function") && !code.includes("openAsSignup=function")) {
    // Looser inject: after first `t}(dw)` that follows Bee.login — mark and try shorter anchor
    const shortClose = "this.showError(Ree.messageLoginFailed()),this.loadingEl.hide(),this.contentEl.show(),[3,4];case 4:return[2]}}))}))},t}(dw)"
    const shortInject =
      "this.showError(Ree.messageLoginFailed()),this.loadingEl.hide(),this.contentEl.show(),[3,4];case 4:return[2]}}))}))},/*obs-local-signup-modal*/t.prototype.openAsSignup=function(){var e=this;this.isSignup=!0;try{this.titleEl.setText(Ree.labelSignUp?Ree.labelSignUp():\"Sign up\")}catch(t){this.titleEl.setText(\"Sign up\")}if(!this.nameEl){this.nameSectionEl=this.contentEl.createEl(\"p\",\"form-field\",(function(t){t.createEl(\"label\",{cls:\"input-label\",text:\"Name\"}),e.nameEl=t.createEl(\"input\",{type:\"text\"})})),this.passwordSectionEl&&this.nameSectionEl&&this.contentEl.insertBefore(this.nameSectionEl,this.passwordSectionEl)}var t=this.buttonContainerEl.querySelector(\"button.mod-cta\");t&&(t.textContent=\"Sign up\",t.onclick=this.doSignup.bind(this));var n=this.buttonContainerEl.querySelector(\"a.mod-secondary\");n&&(n.style.display=\"none\");return this.open(),this},t.prototype.doSignup=function(){var e=this,t=this.emailEl.value,n=this.passwordEl.value,i=this.nameEl&&this.nameEl.value||\"\";if(this.errorEl.hide(),!t||!n)return this.showError(\"Email and password required\");i=i||t.split(\"@\")[0]||\"User\",this.loadingEl.show(),this.contentEl.hide(),this._pow=this._pow||new KC,this._pow.get().then((function(r){return rk(t,n,i,\"buy_sync\",r)})).then((function(t){t&&t.token&&(Ok.token=t.token,Ok.email=t.email,Ok.name=t.name,Ok.license=t.license,Ok.save()),e.close(),new xw(\"Account created — signed in\")})).catch((function(t){e.showError(t&&t.error||t&&t.message||\"Sign up failed\"),e.loadingEl.hide(),e.contentEl.show()}))},t}(dw)"
    if (code.includes(shortClose)) {
      code = code.split(shortClose).join(shortInject)
      changes.push(`${label}: Bee modal openAsSignup + doSignup (short anchor)`)
    }
  }

  // Account settings: Sign up button shadows outer e — fix to use e.app + openAsSignup
  const accountSignUp =
    ".addButton((function(e){return e.setButtonText(Ree.labelSignUp()).onClick((function(){" +
    cloudOpen +
    "}))}))"
  const accountSignUpFixed =
    ".addButton((function(t){return t.setButtonText(Ree.labelSignUp()).onClick((function(){new Bee(e.app).openAsSignup()}))}))"
  if (code.includes(accountSignUp)) {
    const count = code.split(accountSignUp).length - 1
    code = code.split(accountSignUp).join(accountSignUpFixed)
    changes.push(`${label}: Account Sign up → Bee.openAsSignup (${count})`)
  }

  // Sync require-login: buttonSignUp cloud open
  const syncSignUp =
    "t.createEl(\"button\",{cls:\"mod-cta\",text:xte.buttonSignUp()},(function(e){e.addEventListener(\"click\",(function(){" +
    cloudOpen +
    "}))}))"
  const syncSignUpFixed =
    "t.createEl(\"button\",{cls:\"mod-cta\",text:xte.buttonSignUp()},(function(t){t.addEventListener(\"click\",(function(){new Bee(e.app).openAsSignup()}))}))"
  if (code.includes(syncSignUp)) {
    const count = code.split(syncSignUp).length - 1
    code = code.split(syncSignUp).join(syncSignUpFixed)
    changes.push(`${label}: Sync Sign up → Bee.openAsSignup (${count})`)
  }

  // Any remaining cloud open ternaries
  if (code.includes(cloudOpen)) {
    const n = code.split(cloudOpen).length - 1
    // Without app ref — best-effort: still open Bee if window.app exists
    code = code
      .split(cloudOpen)
      .join(
        "(function(){var a=window.app;a?new Bee(a).openAsSignup():new xw(\"Open Settings → Account to sign up\")})()",
      )
    changes.push(`${label}: remaining cloud Sign up → Bee (${n})`)
  } else if (code.includes("https://obsidian.md/auth#signup")) {
    code = code
      .split("https://obsidian.md/auth#signup")
      .join("about:blank#local-signup")
    changes.push(`${label}: neutralized auth#signup URL (fallback)`)
  }

  return changes.length ? { code, changes } : null
}

/**
 * Allow mixed content from app:// to http://localhost, and force auto-updates off
 * so stock asars are not downloaded over our patches.
 */
export function patchMainJs(source: string): { code: string; changes: string[] } {
  const changes: string[] = []
  let code = source

  if (!code.includes("allowRunningInsecureContent")) {
    const needle = "webPreferences:{"
    if (!code.includes(needle)) {
      throw new Error("Could not find webPreferences in main.js")
    }
    const count = code.split(needle).length - 1
    code = code.split(needle).join("webPreferences:{allowRunningInsecureContent:!0,")
    changes.push(
      `main.js: allowRunningInsecureContent on ${count} BrowserWindow webPreferences`,
    )
  } else {
    changes.push("main.js already allows insecure content")
  }

  // Force D.updateDisabled = true right after config load so the shell updater stays off.
  // Stock: D=ne("obsidian");(!D||typeof D!="object")&&(D={});
  const loadNeedle = "D=ne(\"obsidian\");(!D||typeof D!=\"object\")&&(D={});"
  if (code.includes(loadNeedle) && !code.includes("/*obs-local-no-update*/")) {
    code = code.split(loadNeedle).join(
      "D=ne(\"obsidian\");(!D||typeof D!=\"object\")&&(D={});/*obs-local-no-update*/D.updateDisabled=!0;",
    )
    changes.push("main.js: force updateDisabled=true after config load")
  } else if (code.includes("/*obs-local-no-update*/")) {
    changes.push("main.js: updates already forced off")
  } else if (!code.includes("updateDisabled=!0") && code.includes("updateDisabled")) {
    // Fallback: always take the disable branch
    const cond = "(at||D.updateDisabled)"
    if (code.includes(cond)) {
      code = code.split(cond).join("(true)")
      changes.push("main.js: always take Updates disabled branch")
    }
  }

  return { code, changes }
}

/** Walk a directory tree; return all .js files. */
export function listJsFiles(root: string): string[] {
  const out: string[] = []
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()!
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".git") continue
        stack.push(full)
      } else if (ent.name.endsWith(".js")) {
        out.push(full)
      }
    }
  }
  return out
}

/**
 * Patch every relevant JS file under a client root (extracted asar or APK assets).
 */
export function patchClientTree(root: string, opts: PatchOptions): string[] {
  const allChanges: string[] = []
  const files = listJsFiles(root)
  let apiFiles = 0

  for (const file of files) {
    const rel = path.relative(root, file)
    let source = fs.readFileSync(file, "utf8")
    let dirty = false

    if (rel === "main.js" || rel.endsWith(`${path.sep}main.js`)) {
      try {
        const main = patchMainJs(source)
        if (main.code !== source) {
          source = main.code
          dirty = true
        }
        allChanges.push(...main.changes)
      } catch {
        /* not electron main */
      }
    }

    const signup = patchSignupUx(source, rel)
    if (signup) {
      source = signup.code
      dirty = true
      allChanges.push(...signup.changes)
    }

    const patched = patchClientJs(source, opts, rel)
    if (patched) {
      apiFiles += 1
      source = patched.code
      dirty = true
      allChanges.push(...patched.changes)
    }

    if (dirty) {
      fs.writeFileSync(file, source)
    }
  }

  if (apiFiles === 0) {
    throw new Error(
      `No API client bundles found under ${root} (expected app.js and starter.js)`,
    )
  }

  allChanges.push(`Patched ${apiFiles} API client bundle(s)`)
  return allChanges
}
