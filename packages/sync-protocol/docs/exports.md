# Protocol Package Exports Reference

The `@marekanite/sync-protocol` package entry point (`src/index.ts`) re-exports constants, REST schemas, and WebSocket
operation definitions.

---

## 📦 Module Breakdown

| Export Category        | Source File        | Key Exported Symbols & Constants                                                                                                                                                                  |
|:-----------------------|:-------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Protocol Constants** | `src/constants.ts` | `PIECE_SIZE` (`2097152` / 2 MiB), `DEFAULT_PER_FILE_MAX` (`208666624`), `DEFAULT_STORAGE_LIMIT_BYTES` (`10 GiB`), `SUPPORTED_ENCRYPTION_VERSIONS` (`[0, 2, 3]`), idle/heartbeat timeout constants |
| **REST Schemas**       | `src/rest.ts`      | Zod schemas for signup/signin (`SignInBodySchema`, `SignUpBodySchema`), vault list/create/access (`CreateVaultBodySchema`, `AccessVaultBodySchema`), generic error payloads (`ApiErrorSchema`)    |
| **WebSocket Schemas**  | `src/ws.ts`        | Zod schemas for WebSocket JSON message frames (`WsInitSchema`, `WsPingSchema`, `WsPushSchema`, `WsPullSchema`, `WsReadySchema`)                                                                   |

---

## 💻 Usage Example

```ts
import {
  PIECE_SIZE,
  SignInBodySchema,
  WsInitSchema
} from "@marekanite/sync-protocol";

// Validate incoming REST payload
const authPayload = SignInBodySchema.parse(req.body);

// Access protocol constants
console.log(`Max binary piece size: ${PIECE_SIZE} bytes`);
```

---

## 🔗 Related Documentation

- [Full Protocol Specification](../../../docs/protocol.md) — Wire format, REST routes, and WebSocket message frames

