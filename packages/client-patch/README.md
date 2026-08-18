# `@marekanite/client-patch`

The client patching library and CLI engine for Marekanite. It rewrites legally acquired desktop Electron `.asar` bundles
and Android `.apk` packages so client applications connect to self-hosted server endpoints.

---

## ⚡ Key Capabilities

- **Code Needle Rewriter**: Parses and replaces minified API URL constructors and WebSocket host validation allowlists
  in JavaScript bundles (`app.js` and `starter.js`).
- **Desktop ASAR Rewriter**: Unpacks `.asar` archives, modifies origin URLs, sets `allowRunningInsecureContent` (for
  local dev HTTP targets), enforces `updateDisabled: true`, and repacks archives.
- **Android APK Rewriter**: Unpacks APK archives, rewrites embedded web assets (`assets/public/`), preserves
  uncompressed `resources.arsc`/`.so` entries, aligns with `zipalign`, and signs outputs using a debug keystore.
- **CLI & Library Interfaces**: Exposes `marekanite-patch` CLI tool and programmatic module exports for consumption by
  `@marekanite/sync-server` patch jobs.

---

## 🛠️ Package Command Reference

| Command Purpose        | Monorepo Execution Command                                                                               | Package Direct Command                                                                             |
|:-----------------------|:---------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------|
| **Patch Desktop ASAR** | `pnpm patch:desktop -- --profile dev --asar ./obsidian.asar --out ./artifacts/patched/obsidian.dev.asar` | `pnpm desktop -- --profile dev --asar ./obsidian.asar --out ./artifacts/patched/obsidian.dev.asar` |
| **Patch Android APK**  | `pnpm patch:android -- --profile dev --apk ./base.apk --out ./artifacts/patched/obsidian.dev.apk`        | `pnpm android -- --profile dev --apk ./base.apk --out ./artifacts/patched/obsidian.dev.apk`        |
| **Build Package**      | `pnpm --filter @marekanite/client-patch build`                                                           | `pnpm build`                                                                                       |
| **Typecheck Source**   | `pnpm --filter @marekanite/client-patch typecheck`                                                       | `pnpm typecheck`                                                                                   |
| **Run Unit Tests**     | `pnpm test`                                                                                              | `pnpm test`                                                                                        |

---

## 📚 Related Documentation

- [CLI Flag Reference](docs/cli.md) — Command line arguments and library API exports
- [Host Tooling Dependencies](docs/host-tools.md) — Binary requirements (`7z`, `zip`, `apksigner`, `zipalign`)
- [Client Patching Guide](../../docs/patch-client.md) — Walkthrough for deploying patched builds
- [License & Notice](../../NOTICE) — Licensing compliance terms

