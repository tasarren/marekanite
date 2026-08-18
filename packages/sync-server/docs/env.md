# Server Environment Variable Reference

Configuration parameters are loaded by `loadConfig()` in `src/config.ts`. Environment variables can be provided in your
shell, systemd unit files, or via `.env` in the repository root.

---

## 📋 Configuration Parameters

| Variable Name            | Default Value                  | Purpose & Meaning                                                                                                      |
|:-------------------------|:-------------------------------|:-----------------------------------------------------------------------------------------------------------------------|
| `LISTEN_HTTP`            | `127.0.0.1:8787`               | IP host interface and port for binding REST API, WebSockets, and Admin UI. Can be `port` only (`8787`) or `host:port`. |
| `LISTEN_WS`              | *(Unused)*                     | Kept on Config interface for backwards compatibility; WebSockets share the HTTP listener.                              |
| `PUBLIC_API_BASE`        | `http://127.0.0.1:8787`        | Public REST + WebSocket origin that patched client applications connect to. Must be accessible to remote clients.      |
| `PUBLIC_SYNC_HOST`       | Derived from `PUBLIC_API_BASE` | Optional explicit `host:port` string written to vault metadata records for WebSocket routing.                          |
| `DATABASE_PATH`          | `<repo>/data/sync.db`          | Absolute path or cwd-relative path to the persistent SQLite database file.                                             |
| `STORAGE_LIMIT_BYTES`    | `10737418240` (10 GiB)         | Maximum storage quota allocated per user account.                                                                      |
| `PER_FILE_MAX`           | `208666624` (~200 MiB)         | Maximum single file payload size allowed by the protocol framing layer.                                                |
| `MAREKANITE_ADMIN_TOKEN` | Unset (Open mode)              | Secret bearer token required to access `/admin/*` routes. When unset, admin console access is open.                    |
| `ADB_PATH`               | `adb` on `PATH`                | System binary executable path used for wireless Android pairing, connection, and installation.                         |

---

## 💡 Notes for Operators

- **Public Network Origins**: Ensure `PUBLIC_API_BASE` is set to your reachable IP or domain (e.g.
  `https://sync.example.com`), so mobile phones and laptops can connect over network boundaries.
- **Related Guides**:
    - [Production Deployment](../../../docs/deploy.md)
    - [Docker Installation](../../../docs/install.md)
    - [Host System Dependencies](../../../README.md#host-dependencies)

