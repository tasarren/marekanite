# Local Development & Contributor Guide

This guide covers setting up the Marekanite pnpm monorepo for local development, building workspace packages, running
development servers, and executing test suites.

---

## 🛠️ System Prerequisites

- **Node.js**: Version **24.0.0+** required
- **pnpm**: Version **11.17.0** required (managed via Corepack)
- **Host Tools**: `zip`, `unzip`, `curl`, `wget`, `ca-certificates`, `7z` (`p7zip-full`), OpenJDK 17+, `apksigner`,
  `zipalign`, `adb`

See the [Host Dependencies Table](../README.md#host-dependencies) for complete installation commands on Debian/Ubuntu
and Arch Linux.

---

## 💻 Workspace Bootstrapping & Running

1. **Install Monorepo Dependencies**:
   ```bash
   pnpm install
   ```

2. **Build Shared Dependency Packages**:
   Build protocol schemas and patch tools before starting development servers:
   ```bash
   pnpm --filter @marekanite/sync-protocol build
   pnpm --filter @marekanite/client-patch build
   ```

3. **Start Development Servers**:
   ```bash
   pnpm dev
   ```
   This concurrent script launches:
    - **Backend API & WebSocket Server** ([`@marekanite/sync-server`](../packages/sync-server/README.md)):
      `http://127.0.0.1:8787`
    - **Admin UI Console** ([`@marekanite/admin-web`](../packages/admin-web/README.md)): `http://127.0.0.1:5173`
    - **Local SQLite Database**: Auto-created at `data/sync.db`

> [!TIP]
> **Vite Standalone Mode**: If the Hono server is already running, launch Vite alone using `pnpm admin`.

---

## 🔑 Initial Account Creation

1. Open `http://127.0.0.1:5173` in your browser.
2. Navigate to **Accounts** → create a vault user (email & password), or register directly via the patched app start
   screen (`POST /user/signup`).
3. Log in inside your patched client application.

---

## 🔧 Patching Client Assets for Local Dev

Because desktop Electron apps execute within custom web origins (`app://`), local HTTP targets (`http://127.0.0.1:8787`)
require enabling `allowRunningInsecureContent`.

Run the CLI with `--profile dev`:

```bash
pnpm patch:desktop -- --profile dev \
  --asar ./obsidian.asar \
  --out ./artifacts/patched/obsidian.dev.asar
```

> [!WARNING]
> Bring your own legally acquired `.asar` package. Do not commit `.asar` or `.apk` binaries to Git.

### Verifying Local Patching

1. Quit the client application completely.
2. Launch the client with your patched `.asar` file.
3. Open DevTools (Ctrl+Shift+I / Cmd+Option+I) → Network tab: verify network calls target
   `http://127.0.0.1:8787/user/signin` rather than external cloud APIs.

---

## 🧪 Test Suites & Quality Assurance

Run verification commands prior to submitting pull requests or making releases:

| Command            | Suite Scope & Function                                                                                    |
|:-------------------|:----------------------------------------------------------------------------------------------------------|
| `pnpm typecheck`   | Runs `tsc` and `vue-tsc` across all 6 workspace packages                                                  |
| `pnpm test`        | Runs fast Vitest unit tests for HTTP routes, WS protocol framing, and patch logic                         |
| `pnpm test:e2e`    | Runs end-to-end integration tests using pinned client binaries (caches under `.cache/obsidian-releases/`) |
| `pnpm test:compat` | Scans official release versions against the needle rewriter suite (`docs/compatibility.md`)               |

```bash
# Pin E2E client version explicitly if needed:
E2E_OBSIDIAN_VERSION=1.13.4 pnpm test:e2e
```

