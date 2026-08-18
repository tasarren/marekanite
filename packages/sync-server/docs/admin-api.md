# Admin API Reference

The administrative API routes are mounted at `/admin` on the Hono server. These endpoints are consumed by the Vue web
console ([`@marekanite/admin-web`](../../admin-web/README.md)) to manage user accounts, trigger patch jobs, inspect host
releases, and perform wireless Android installation.

---

## 🔒 Authentication & Session Access

| Endpoint Path               | Authentication Requirement                                             | Behavior & Description                                                                                              |
|:----------------------------|:-----------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------|
| `GET /health` *(Public)*    | None                                                                   | Healthcheck endpoint (`{ "ok": true }`).                                                                            |
| `GET /admin/session`        | None                                                                   | Queries admin auth configuration (`{ "auth": "none" \| "token", "ok": true }`). SPA uses this to prompt for unlock. |
| All other `/admin/*` routes | Bearer token if `MAREKANITE_ADMIN_TOKEN` is set; open access if unset. | Requires `Authorization: Bearer <token>` or `X-Admin-Token` header matching configured secret.                      |

> [!WARNING]
> Do not expose `/admin/*` routes to the public internet without proper network isolation. See
> the [Security Overview](../../../docs/security.md).

---

## 👤 User Account Management Endpoints

| Method   | Path               | Request Body                              | Description & Notes                                                                                              |
|:---------|:-------------------|:------------------------------------------|:-----------------------------------------------------------------------------------------------------------------|
| `GET`    | `/admin/users`     | None                                      | Returns user roster (`{ users: [{ id, email, name, createdAt, disabled, vaults }] }`). Excludes password hashes. |
| `POST`   | `/admin/users`     | `{ email, password, name? }`              | Creates a new user account (returns HTTP 409 if email exists).                                                   |
| `PATCH`  | `/admin/users/:id` | `{ email?, name?, password?, disabled? }` | Updates user details. Disabling an account invalidates active session tokens.                                    |
| `DELETE` | `/admin/users/:id` | None                                      | Deletes user account and cascades removal of associated vaults.                                                  |

---

## 📲 Wireless Android ADB Endpoints

Requires `adb` installed on host (`PATH` or `ADB_PATH`). See [Host Dependencies](../../../README.md#host-dependencies).

| Method | Path                 | Request Payload                  | Description                                                         |
|:-------|:---------------------|:---------------------------------|:--------------------------------------------------------------------|
| `GET`  | `/admin/adb/status`  | None                             | Checks host ADB availability (`{ available, version }`).            |
| `POST` | `/admin/adb/pair`    | `{ host, port, code }`           | Pairs with Android device using 6-digit wireless code.              |
| `POST` | `/admin/adb/connect` | `{ host, port }`                 | Connects to Android device over Wireless Debugging port.            |
| `POST` | `/admin/adb/inspect` | `{ serial }` or `{ host, port }` | Inspects device details (`{ sdk, release, installed, installer }`). |
| `POST` | `/admin/adb/install` | `{ jobId, serial, uninstall? }`  | Installs completed patch job APK binary directly to device.         |

---

## 📦 Releases & Patch Job Operations

| Method | Path                           | Description & Payload Notes                                                              |
|:-------|:-------------------------------|:-----------------------------------------------------------------------------------------|
| `GET`  | `/admin/releases`              | Lists official GitHub client releases and local cache status (`?refresh=1` busts cache). |
| `POST` | `/admin/releases/refresh`      | Force refreshes GitHub releases cache.                                                   |
| `POST` | `/admin/patch/from-release`    | Downloads a specific pinned official client release and executes patcher.                |
| `POST` | `/admin/patch/desktop`         | Multipart upload of desktop `.asar` bundle to trigger patch job.                         |
| `POST` | `/admin/patch/android`         | Multipart upload of Android `.apk` package to trigger patch job.                         |
| `GET`  | `/admin/patch/:jobId`          | Queries status of ongoing or completed patch job.                                        |
| `GET`  | `/admin/patch/:jobId/events`   | Server-Sent Events (SSE) log stream for real-time patch progress.                        |
| `GET`  | `/admin/patch/:jobId/download` | Downloads completed patched `.asar` or `.apk` artifact binary.                           |

> [!NOTE]
> Multipart file uploads have an upper file size cap of 120 MB. For step-by-step guidance, see
> the [Patching Guide](../../../docs/patch-client.md).

