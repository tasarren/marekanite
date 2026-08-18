# Test Client API & Usage Reference

This guide provides code examples for using `@marekanite/sync-client` in automated integration test suites.

---

## 🌐 REST API Helper (`createApiClient`)

```ts
import { createApiClient } from "@marekanite/sync-client";

// Initialize REST client against server target
const api = createApiClient("http://127.0.0.1:8787");

// Execute authentication request
const auth = await api.post("/user/signin", {
  email: "user@example.com",
  password: "securepassword"
});

console.log("Session token:", auth.token);
```

---

## ⚡ WebSocket Client (`SyncWsClient`)

`SyncWsClient` (located in `src/ws-client.ts`) implements the full-duplex protocol framing lifecycle:

| Class Method                        | Description & Technical Role                                                         |
|:------------------------------------|:-------------------------------------------------------------------------------------|
| `connect(url)`                      | Establishes WebSocket connection (`ws://` or `wss://`).                              |
| `init({ token, id, keyhash, ... })` | Transmits `init` payload and waits for server `res: "ok"` and `ready` notifications. |
| `pushFile(path, ciphertext, hash?)` | Transmits JSON metadata and streams raw binary payload frames (`PIECE_SIZE` chunks). |
| `pull(uid)`                         | Requests download of a specific file revision UID.                                   |

### WebSocket Test Flow Example

```ts
import { SyncWsClient } from "@marekanite/sync-client";
import { makeTestVaultSecrets } from "@marekanite/crypto-compat";

const wsClient = new SyncWsClient();
await wsClient.connect("ws://127.0.0.1:8787");

// Send handshake init
await wsClient.init({
  token: auth.token,
  id: "vault_id_123",
  keyhash: secrets.keyhash,
  version: 0,
  initial: true,
  device: "Integration-Test-Runner",
  encryption_version: 3
});

// Push encrypted test blob
await wsClient.pushFile("encrypted/path/blob", Buffer.from("ciphertext_data"));
```

---

## 🔗 Related Documentation

- [Full Protocol Specification](../../../docs/protocol.md) — Complete REST/WS wire format
- [Cryptographic Keys Reference](../../crypto-compat/docs/keys.md) — Test key derivation helpers

