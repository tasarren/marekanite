# Docker Container Installation Guide

Marekanite is packaged as a lightweight Docker container containing the Hono backend server, SQLite storage manager,
built Vue 3 admin interface, and Android packaging toolchain.

---

## 🛠️ Prerequisites

- **Docker Engine** (version 20.10 or newer)
- **Docker Compose V2** (`docker compose` CLI plugin)

---

## 🚀 Step-by-Step Installation

1. **Clone & Configure Environment Variables**:
   Copy `.env.example` to `.env` and set `PUBLIC_API_BASE` to the host IP or domain reachable by your client devices (
   smartphones, tablets, laptops).
   ```bash
   cp .env.example .env
   ```

2. **Build and Launch Container**:
   ```bash
   docker compose up -d --build
   ```

3. **Access Admin Web Interface**:
   Open your browser at `http://127.0.0.1:8787` (or your configured server IP/domain). Create user accounts and navigate
   to the **Patch** section to generate patched client binaries.

---

## 🔑 Security & Admin Gate Token

Setting `MAREKANITE_ADMIN_TOKEN` enables an authentication lock screen on the Vue admin control panel (`/admin`).

- **Unset (Default)**: Admin console is accessible without password prompt (suitable for loopback local testing).
- **Set (Recommended)**: Admin console requires entering the secret token to unlock.

```bash
MAREKANITE_ADMIN_TOKEN=a_very_long_secure_random_string_here
```

---

## 📋 Environment Configuration Reference

| Environment Variable     | Default Value                  | Description / Purpose                                                       |
|:-------------------------|:-------------------------------|:----------------------------------------------------------------------------|
| `PUBLIC_API_BASE`        | Required in `compose.yaml`     | Public REST + WebSocket origin that patched clients connect to              |
| `PUBLIC_SYNC_HOST`       | Derived from `PUBLIC_API_BASE` | Optional explicit `host:port` override saved on vault metadata records      |
| `HTTP_PORT`              | `8787`                         | Exposed host HTTP port for REST endpoints, WebSockets, and admin UI         |
| `MAREKANITE_ADMIN_TOKEN` | Unset (Open mode)              | Secret bearer token required to unlock administrative panel when configured |
| `STORAGE_LIMIT_BYTES`    | `10737418240` (10 GiB)         | Maximum per-user cumulative storage allowance                               |
| `PER_FILE_MAX`           | `208666624` (~200 MiB)         | Maximum single file payload size supported by protocol framing              |
| `DATABASE_PATH`          | `/data/sync.db`                | SQLite database file location inside container volume                       |

---

## 💾 Container Volume & Management Commands

Persistent state—including the SQLite database, APK signing keys, and temporary patch artifacts—is stored inside the
persistent `sync-data` Docker volume.

```bash
# View live container log stream
docker compose logs -f sync

# Restart the service container
docker compose restart sync

# Stop container while retaining persistent data volume
docker compose down

# Stop container AND wipe persistent database volume
docker compose down -v
```

### Health Check Verification

Verify backend status from the host or within the container:

```bash
curl -fsS http://127.0.0.1:8787/health
# Expected JSON response: { "ok": true }
```

