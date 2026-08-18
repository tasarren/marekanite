# Patcher CLI & Library Interface Reference

The CLI interface for `@marekanite/client-patch` is defined in `src/cli.ts`. Arguments are passed after `--` so `pnpm`
forwards flags directly to the binary executor.

---

## 🛠️ Command Usage Examples

```bash
# Patch Desktop Electron ASAR Bundle (Local Dev HTTP Profile)
pnpm patch:desktop -- --profile dev --asar ./obsidian.asar --out ./artifacts/patched/obsidian.dev.asar

# Patch Desktop ASAR for Production HTTPS with Domain Suffix
pnpm patch:desktop -- --profile homelab \
  --api-base https://sync.example.com \
  --extra-ws-suffix .example.com \
  --asar ./obsidian.asar \
  --out ./artifacts/patched/obsidian.homelab.asar

# Patch Android APK Package
pnpm patch:android -- --profile dev --apk ./base.apk --out ./artifacts/patched/obsidian.dev.apk
```

---

## 📋 Command Line Flag Reference

| Flag Option         | Default Value                                     | Description & Purpose                                                                           |
|:--------------------|:--------------------------------------------------|:------------------------------------------------------------------------------------------------|
| `--profile`         | `dev`                                             | Profile label used in patch logs (does not select a config file).                               |
| `--api-base`        | `http://127.0.0.1:8787`                           | Target REST API and WebSocket origin URL for server connections.                                |
| `--extra-ws-suffix` | Unset                                             | Optional additional wildcard host domain suffix (`*.suffix`) for WebSocket allowlist rewriting. |
| `--asar`            | `./obsidian.asar`                                 | Input desktop Electron `.asar` package path.                                                    |
| `--apk`             | `./artifacts/android/md.obsidian-1.13.4-base.apk` | Input Android `.apk` package path.                                                              |
| `--out`             | *(Required)*                                      | Output destination path for the patched binary artifact.                                        |

---

## 📦 Programmatic Library Exports

For server patch jobs and automated tests, `@marekanite/client-patch` exports the following functions from
`src/index.ts`:

- **Binary Patcher Functions**: `patchDesktopAsar(opts)`, `patchAndroidApk(opts)`
- **AST / Code Rewriter Functions**: `patchClientJs(code, opts)`, `patchClientTree(...)`, `patchMainJs(...)`,
  `patchSignupUx(...)`, `patchAppJs(...)`, `patchWsAllowlist(...)`
- **Android Signing Functions**: `signApk(...)`, `ensureDebugKeystore(...)`, `resolveKeystorePath(...)`,
  `keystoreEnvOptions(...)`

---

## 🔗 Related Documentation

- [Host Tooling Dependencies](host-tools.md) — System binaries (`7z`, `apksigner`, `zipalign`)
- [Client Patching Guide](../../../docs/patch-client.md) — Full manual deployment walkthrough

