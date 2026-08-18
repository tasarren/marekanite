# `@marekanite/sync-client`

Automated integration test client for the Marekanite REST API and WebSocket synchronization protocol. This package is
used internally by backend integration tests (`ws-flow`, E2E suites) to validate live server protocol compliance.

---

## ⚡ Key Capabilities

- **`createApiClient(baseUrl)`**: Programmatic HTTP helper for sending JSON `POST` requests to `/user/*` and `/vault/*`
  endpoints.
- **`SyncWsClient`**: Programmatic WebSocket client for connecting, initiating vault handshakes (`init`), pushing
  ciphertext binary frames (`pushFile`), and fetching revision blobs (`pull`).
- **Integration Test Execution**: Serves as the reference protocol test driver to verify server state transitions.

---

## 🛠️ Package Command Reference

| Action               | Monorepo Command                                  | Package Direct Command |
|:---------------------|:--------------------------------------------------|:-----------------------|
| **Build Package**    | `pnpm --filter @marekanite/sync-client build`     | `pnpm build`           |
| **Typecheck Source** | `pnpm --filter @marekanite/sync-client typecheck` | `pnpm typecheck`       |

---

## 📚 Related Documentation

- [Test Client Usage Guide](docs/usage.md) — Code examples for HTTP & WebSocket clients
- [Protocol Specification](../../docs/protocol.md) — Reimplemented wire format spec
- [`@marekanite/crypto-compat`](../crypto-compat/README.md) — Test key derivation helpers

