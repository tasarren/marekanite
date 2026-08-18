# `@marekanite/sync-protocol`

Shared TypeScript interfaces, protocol constants, and Zod validation schemas for Marekanite REST endpoints and WebSocket
synchronization frames (baseline client version **1.13.4**).

---

## 📦 What It Contains

- **Protocol Constants**: Default storage limits (`10 GiB`), max file size payload caps (`208,666,624 bytes`), WebSocket
  piece chunk sizes (`2 MiB`), and supported encryption versions (`[0, 2, 3]`).
- **REST Schemas**: Zod validation schemas for `/user/*` authentication and `/vault/*` management endpoints.
- **WebSocket Framing Schemas**: Zod schemas for JSON operations (`init`, `push`, `pull`, `ready`, `ping`).
- **Zero I/O Dependencies**: Pure runtime validation and type definitions imported by both server and client workspace
  packages.

---

## 🛠️ Package Scripts

| Script Task          | Monorepo Command                                    | Package Direct Command |
|:---------------------|:----------------------------------------------------|:-----------------------|
| **Build Package**    | `pnpm --filter @marekanite/sync-protocol build`     | `pnpm build`           |
| **Typecheck Source** | `pnpm --filter @marekanite/sync-protocol typecheck` | `pnpm typecheck`       |

> [!TIP]
> Always build `@marekanite/sync-protocol` first when bootstrapping a clean environment, as `@marekanite/sync-server`
> and `@marekanite/client-patch` depend on its compiled output.

---

## 📚 Related Documentation

- [Exported API & Schemas Reference](docs/exports.md) — Detailed breakdown of exports
- [Full Protocol Specification](../../docs/protocol.md) — Complete REST & WebSocket wire spec

