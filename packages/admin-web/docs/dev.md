# Frontend Development & Vite Guide

This document details developing, proxying, and building the `@marekanite/admin-web` Vue single-page application.

---

## 💻 Running Development Servers

### Integrated Workspace Mode (Recommended)

Run API backend and Vite dev server concurrently from the monorepo root:

```bash
pnpm dev
```

- **Vue Admin Interface**: `http://127.0.0.1:5173`
- **Hono API & WebSocket Server**: `http://127.0.0.1:8787`

Vite proxies `/admin/*` API calls directly to `:8787` in development mode.

### Standalone Frontend Mode

If `@marekanite/sync-server` is already running:

```bash
pnpm admin
```

---

## 🔑 Administrative Token & Lock Screen

1. **Session Gate Check**: On app initialization, Vue Router queries `GET /admin/session`.
2. **Open Mode (`auth: "none"`)**: Router bypasses the unlock view and routes directly to `/` or requested view.
3. **Protected Mode (`auth: "token"`)**: Triggered when `MAREKANITE_ADMIN_TOKEN` is set on the server. Navigating to any
   route automatically redirects to `/unlock`.
4. **Token Persistence**: The unlock secret is stored in browser `sessionStorage` and attached to outgoing requests as
   `Authorization: Bearer <token>`.

---

## 🚀 Production Build Output

Compile production assets into `packages/admin-web/dist`:

```bash
pnpm --filter @marekanite/admin-web build
```

When `@marekanite/sync-server` runs with `NODE_ENV=production`, Hono mounts this static `dist` directory at root (`/`).
Docker Compose handles this build step automatically.

