# `@marekanite/admin-web`

The administrative web console for Marekanite. Built with Vue 3, Vite, Pinia, Vue Router, and Tailwind CSS, it provides
a dashboard for user account administration, client patching, release management, and direct Android device deployment.

---

## ⚡ Key Capabilities

- **User & Account Roster**: Interface to create, modify, disable, or delete vault user accounts.
- **Client Patch Wizard**: Guided 4-step wizard (Device Selection → Target File Download/Upload → Server Base Config →
  Binary Patch & Install).
- **Mobile Device Deployment**: WebUSB direct browser installation (`@yume-chan/adb`) and server-managed Wi-Fi `adb`
  pairing/installation.
- **Production Asset Output**: Builds static web assets (`dist/`) served by `@marekanite/sync-server` in production.

---

## 🛠️ Package Command Reference

| Action                        | Monorepo Command                                | Package Direct Command |
|:------------------------------|:------------------------------------------------|:-----------------------|
| **Development Server (Vite)** | `pnpm --filter @marekanite/admin-web dev`       | `pnpm dev`             |
| **Build Static Assets**       | `pnpm --filter @marekanite/admin-web build`     | `pnpm build`           |
| **Preview Built Assets**      | `pnpm --filter @marekanite/admin-web preview`   | `pnpm preview`         |
| **Typecheck Vue Source**      | `pnpm --filter @marekanite/admin-web typecheck` | `pnpm typecheck`       |

---

## 📚 Related Documentation

- [Frontend Development Guide](docs/dev.md) — Vite setup and API proxying
- [Application Pages & Routes](docs/pages.md) — View descriptions and patch wizard workflow
- [Client Patching Walkthrough](../../docs/patch-client.md) — Binary deployment instructions
- [Server Admin API Reference](../sync-server/docs/admin-api.md) — `/admin` backend endpoints

