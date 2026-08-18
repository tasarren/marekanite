# Server Execution Guide (Dev & Production)

This document details starting and running `@marekanite/sync-server` in development and production modes.

---

## 💻 Local Development Mode

In development mode (`NODE_ENV` is not set to `production`), the Hono server operates as an API-only service on
`127.0.0.1:8787` (REST + WebSocket). The frontend SPA is served separately via Vite dev server (`127.0.0.1:5173`).

```bash
# 1. Build workspace dependencies
pnpm --filter @marekanite/sync-protocol build

# 2. Launch sync server in watch mode
pnpm --filter @marekanite/sync-server dev
```

> [!TIP]
> From the repository root, `pnpm dev` automatically launches both `@marekanite/sync-server` and `@marekanite/admin-web`
> concurrently.

---

## 🚀 Production Deployment Mode

In production mode (`NODE_ENV=production`), Hono serves the built single-page application (`packages/admin-web/dist`)
directly at the root (`/`) alongside REST and WebSocket endpoints.

```bash
# 1. Build admin frontend SPA
pnpm --filter @marekanite/admin-web build

# 2. Build sync server TypeScript source
pnpm --filter @marekanite/sync-server build

# 3. Launch production server instance
NODE_ENV=production pnpm --filter @marekanite/sync-server start
```

Docker Compose automates this process out of the box. See the [Docker Installation Guide](../../../docs/install.md).

---

## 🔍 Server Health Check

Verify that the server instance is listening and operational:

```bash
curl -fsS http://127.0.0.1:8787/health
```

Expected JSON output:

```json
{ "ok": true }
```

---

## 🔗 Related Documentation

- [Environment Variable Reference](env.md) — Configuration parameters
- [Admin API Reference](admin-api.md) — `/admin` endpoint specifications
- [Local Development](../../../docs/local-dev.md) — Monorepo setup guide

