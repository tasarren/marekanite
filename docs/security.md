# Security Model & Threat Boundaries

This document details the security model, encryption mechanisms, perimeter considerations, and administrative access
controls of Marekanite.

---

## 🔐 Zero-Knowledge Encryption Model

Marekanite enforces zero-knowledge client-side encryption. The server acts strictly as an encrypted blob storage and
synchronization engine:

- **What the Server Stores**:
    - Account credentials (email, scrypt-hashed user passwords, active session tokens).
    - Vault metadata records (`keyhash`, salt, vault display name).
    - Encrypted file bodies (binary ciphertext) and opaque encrypted relative file paths.
- **What the Server NEVER Receives or Sees**:
    - Vault encryption master keys or user vault passwords.
    - Plaintext markdown note contents or unencrypted file attachment data.
    - Unencrypted folder structures or file path strings.

---

## ⚠️ Security Boundaries & Assumptions

Marekanite is designed as a **self-hosted homelab service** for personal or household use rather than a public
multi-tenant SaaS provider.

| Security Aspect                 | Default Operational Behavior                                                        | Recommended Operational Guidance                                                                                                 |
|:--------------------------------|:------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------|
| **Network Exposure**            | Listens on configured `HTTP_PORT` (default `8787`).                                 | Restrict access to local LAN, VPN, or private overlay networks (Tailscale/WireGuard). Do not expose to public internet directly. |
| **Admin Authentication**        | Open access if `MAREKANITE_ADMIN_TOKEN` is unset.                                   | Set `MAREKANITE_ADMIN_TOKEN` to require a long random secret bearer token for `/admin` routes.                                   |
| **In-App Account Registration** | `POST /user/signup` is enabled with local PoW challenge stub (`maxNumber: 0`).      | Disable public access at the network perimeter or firewall level if registration should be restricted to admin panel creation.   |
| **CORS Policy**                 | Permits `Access-Control-Allow-Origin: *` to support desktop web origins (`app://`). | Utilize reverse proxy origin filtering when deploying to web clients.                                                            |

---

## 🔑 Administrative Control & Secret Tokens

To secure the admin dashboard (`/admin`), set `MAREKANITE_ADMIN_TOKEN` in your environment:

```bash
MAREKANITE_ADMIN_TOKEN=4f8b92e10a7c63d59e8b2a1f04123456
```

When set, all `/admin/*` management routes require a valid `Authorization: Bearer <token>` header (or `X-Admin-Token`).
The admin web interface stores this token in browser `sessionStorage` upon successful unlock.

---

## 🐛 Vulnerability Reporting

If you discover a potential security vulnerability within Marekanite, please report it privately via GitHub Security
Advisories or by contacting the project maintainers directly. Do not file public issues for authentication bypasses or
zero-day security reports.

