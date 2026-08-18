# Application Views & Patch Wizard Reference

The Vue single-page application uses Vue Router (`src/router/index.ts`) for navigation.

---

## 🗺️ Application Route Table

| URL Route   | View Component | Function & Overview                                                                     |
|:------------|:---------------|:----------------------------------------------------------------------------------------|
| `/`         | `Home`         | Navigation landing hub (Quick actions: Patch wizard, User account roster, App sign in). |
| `/unlock`   | `Unlock`       | Secret token password prompt shown when `MAREKANITE_ADMIN_TOKEN` is configured.         |
| `/accounts` | `Accounts`     | User roster management. Create, edit, disable, or delete vault user accounts.           |
| `/patch`    | `Patch`        | Guided 4-step wizard for building patched desktop `.asar` and Android `.apk` binaries.  |
| `/login`    | `Login`        | Auth check view for testing vault credentials against the self-hosted server.           |
| `/register` | `Register`     | In-app user registration form view.                                                     |

---

## 🧙‍♂️ The 4-Step Client Patch Wizard

Navigating to `/patch` launches an interactive workflow:

1. **Step 1: Device Selection** — Choose target platform: Desktop (`.asar`) or Mobile Android (`.apk`).
2. **Step 2: Binary Acquisition** — Download a pinned official release directly via host cache, or drag-and-drop a local
   file you own.
3. **Step 3: Server Endpoint Configuration** — Pre-filled with host server IP/domain (`PUBLIC_API_BASE`).
4. **Step 4: Patch & Deploy Execution** — Triggers patch job stream, provides artifact download link, and offers
   optional direct Android installation.

### Mobile Installation Deployment Options

- **USB WebUSB (`@yume-chan/adb`)**: Directly flash plugged-in Android devices from Chromium-based desktop browsers (
  Chrome/Edge) over WebUSB.
- **Server Wi-Fi ADB**: Initiates `adb pair`, `adb connect`, and `adb install` directly from the host server.

---

## 🔗 Related Documentation

- [Client Patching Guide](../../../docs/patch-client.md) — Manual installation steps
- [Admin API Reference](../../sync-server/docs/admin-api.md) — Backend patch endpoints

