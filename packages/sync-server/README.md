# `@marekanite/sync-server`

The core synchronization backend server for Marekanite. Built with [Hono](https://hono.dev/)
and [SQLite](https://sqlite.org/), it implements both the Sync REST API and WebSocket protocol engine, alongside
administrative user management and client patch job orchestration APIs.

---

## ⚡ Key Capabilities

- **Sync Protocol Engine**: Reimplements REST endpoints (`/user/*`, `/vault/*`) and WebSocket sync handlers compatible
  with baseline client release **1.13.4**.
- **Ciphertext Storage**: SQLite-backed zero-knowledge storage for user credentials and encrypted vault blobs.
- **Admin Server & APIs**: Mounts `/admin/*` routes for user management, client patch execution, release caching, and
  wireless Android `adb` deployment.
- **Embedded Web Console Hosting**: Serves the compiled [`@marekanite/admin-web`](../admin-web/README.md) SPA at root (
  `/`) in production mode (`NODE_ENV=production`).

---

## 🛠️ Package Command Reference

| Action                | Monorepo Command                                  | Package Direct Command |
|:----------------------|:--------------------------------------------------|:-----------------------|
| **Development Watch** | `pnpm --filter @marekanite/sync-server dev`       | `pnpm dev`             |
| **Build Server**      | `pnpm --filter @marekanite/sync-server build`     | `pnpm build`           |
| **Start Production**  | `pnpm --filter @marekanite/sync-server start`     | `pnpm start`           |
| **Typecheck Source**  | `pnpm --filter @marekanite/sync-server typecheck` | `pnpm typecheck`       |

---

## 📚 Related Documentation

- [Server Execution Guide](docs/run.md) — Running in dev vs production modes
- [Environment Configuration Reference](docs/env.md) — Port binds, paths, limits, and tokens
- [Admin API Reference](docs/admin-api.md) — `/admin` endpoint specifications
- [Local Development](../../docs/local-dev.md) — Monorepo setup guide
- [Docker Installation](../../docs/install.md) — Docker Compose container setup
- [Security Model](../../docs/security.md) — Storage mechanics and perimeter safety
- [Protocol Specification](../../docs/protocol.md) — Complete REST/WS wire format

