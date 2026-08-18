# `@marekanite/crypto-compat`

Test-only cryptographic helper package mirroring client key derivation routines (scrypt / SHA-256). Used exclusively in
automated tests (`@marekanite/sync-client` and backend server test suites) to generate valid key hashes.

---

## ⚡ Key Capabilities

- **Vault Key Derivation**: Implements `deriveVaultKey(password, salt)` matching client scrypt parameters (`N=32768`,
  `r=8`, `p=1`, `maxmem=64 MiB`).
- **Test Secrets Generator**: Helper function `makeTestVaultSecrets(password)` to generate test salts and key hashes
  accepted by protocol verification.
- **Zero Production Server Use**: The live Marekanite server operates as a ciphertext-blind backend and does not derive
  client keys in production.

---

## 🛠️ Package Command Reference

| Action               | Monorepo Command                                    | Package Direct Command |
|:---------------------|:----------------------------------------------------|:-----------------------|
| **Build Package**    | `pnpm --filter @marekanite/crypto-compat build`     | `pnpm build`           |
| **Typecheck Source** | `pnpm --filter @marekanite/crypto-compat typecheck` | `pnpm typecheck`       |

---

## 📚 Related Documentation

- [Key Derivation API Reference](docs/keys.md) — Technical parameter specification
- [Protocol Specification](../../docs/protocol.md) — Zero-knowledge encryption spec

