# Client Compatibility & Needle Matching

Marekanite rewrites client app JavaScript bundles dynamically using **code structure needles** rather than hardcoded
client version checks. As long as official releases preserve these internal code patterns in minified source, Marekanite
can patch and redirect them to your self-hosted server.

---

## 🔍 How Needle Matching Works

The client patcher (`@marekanite/client-patch`) inspects minified JavaScript assets (`app.js` and `starter.js` inside
Electron `.asar` bundles or Android `.apk` assets) for three core integration gates:

| Patch Gate                   | Target Code Pattern / Needle                                                                                                                             | Rewriter Transformation                                                                                                           |
|:-----------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------|
| **API Base URL**             | `"https://"+[String.fromCharCode(97,112,105),"obsidian","md"].join(".")`                                                                                 | Replaced with configured `PUBLIC_API_BASE` endpoint (e.g. `http://127.0.0.1:8787` or `https://sync.example.com`).                 |
| **WebSocket Host Allowlist** | `!<fn>.call(<host>,".obsidian.md")&&"127.0.0.1"!==<host>`                                                                                                | Rewritten to permit your self-hosted domain or IP origin while maintaining standard host validations.                             |
| **Sync `getHost` Override**  | `X.prototype.getHost=function(){var e=this.host\|\|"127.0.0.1:3003";return e.startsWith("127.0.0.1")\|\|e.startsWith("localhost")?"ws://"+e:"wss://"+e}` | Replaced to direct Sync WebSocket traffic (`3003` + `ws`) to your self-hosted server, choosing `wss://` for secure HTTPS origins. |

> [!IMPORTANT]
> **Publish Feature Isolation**: In releases 1.10.x through 1.12.x, a secondary `getHost` targeted Publish (
`127.0.0.1:3002`). The rewriter explicitly keys on **`3003` + `ws`** to ensure third-party Publish services remain
> unmodified.

---

## 🧪 Compatibility Verification Suite

Maintainers can automatically test compatibility across release versions using:

```bash
pnpm test:compat
```

This suite downloads and validates client assets stored under `.cache/obsidian-releases/` against the needle rewriter
suite.

---

## 📋 Tested Client Version Matrix

Last verified: **2026-08-18**. Baseline pinned release: **1.13.4** (compatibility verified through 1.13.7 down to
1.5.8).

| Version    | Desktop `.asar` | Android `.apk` | Notes                      |
|:-----------|:---------------:|:--------------:|:---------------------------|
| **1.13.7** |   ✅ Verified    |   ✅ Verified   | Tested baseline release    |
| **1.13.6** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.13.4** |   ✅ Verified    |   ✅ Verified   | Pinned baseline            |
| **1.12.7** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.12.4** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.11.7** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.11.5** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.11.4** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.10.6** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.10.3** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.9.14** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.9.12** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.9.10** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.8.10** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.8.9**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.8.7**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.8.4**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.8.3**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.7.7**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.7.6**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.7.5**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.7.4**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.6.7**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.6.5**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.6.3**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.6.2**  |   ✅ Verified    |   ✅ Verified   |                            |
| **1.5.12** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.5.11** |   ✅ Verified    |   ✅ Verified   |                            |
| **1.5.8**  |   ✅ Verified    |   ✅ Verified   | Legacy compatible baseline |


