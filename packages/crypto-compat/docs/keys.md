# Cryptographic Key Derivation Reference

This document details exported test key derivation functions from `@marekanite/crypto-compat` (`src/index.ts`).

---

## 📋 Exported Test Utilities

| Exported Function                | Operational Description & Parameters                                                                                                        |
|:---------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------|
| `deriveVaultKey(password, salt)` | Normalizes inputs via Unicode NFKC, then derives a 32-byte key using `scryptSync` with `N=32768`, `r=8`, `p=1`, `maxmem=67108864` (64 MiB). |
| `keyHashV0(key)`                 | Computes `hex(SHA-256(key))` matching encryption version 0 key hash format.                                                                 |
| `makeTestVaultSecrets(password)` | Generates a 16-byte random hex salt, derives key, and returns `{ salt, keyhash, encryption_version: 3, key }`.                              |
| `randomSalt()`                   | Returns a 16-byte random hexadecimal salt string.                                                                                           |

---

## 🔒 Production Backend Independence

> [!IMPORTANT]
> The production Marekanite server never receives vault passwords or unencrypted master keys. It stores ciphertext blobs
> and equality-checks the opaque `keyhash` string transmitted by clients during `/vault/access` and WebSocket `init`
> handshakes.

