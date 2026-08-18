# Solution Comparison — Marekanite vs Alternatives

When choosing a synchronization strategy for your Markdown knowledge base, different solutions offer distinct trade-offs
between native user interface integration, server ownership, encryption models, and maintenance requirements.

---

## 📊 Solution Feature Matrix

| Feature / Attribute       | Marekanite                                    | Community Plugin (e.g. LiveSync) | Official Cloud Sync            | File Sync (Git / Syncthing)   |
|:--------------------------|:----------------------------------------------|:---------------------------------|:-------------------------------|:------------------------------|
| **Client Application**    | Patched desktop `.asar` / Android `.apk`      | Stock client + plugin            | Stock official client          | Stock client + external app   |
| **Backend Server**        | Self-hosted Marekanite server (Hono + SQLite) | Self-hosted CouchDB              | Vendor cloud infrastructure    | Custom Git remote or P2P node |
| **Native Sync UI**        | ✅ Built-in native core Sync UI                | ❌ Plugin-specific UI settings    | ✅ Built-in native core Sync UI | ❌ None (external status)      |
| **End-to-End Encryption** | ✅ Client-side zero-knowledge AES/scrypt       | ✅ Client-side plugin crypto      | ✅ End-to-end encrypted         | ⚠️ Depends on transport       |
| **Maintenance / Support** | Unofficial; requires binary patching          | Community plugin ecosystem       | Fully supported paid service   | Community / self-managed      |
| **Server Infrastructure** | Docker / Node.js self-hosted                  | CouchDB / Cloudant               | Managed cloud service          | Git host / Syncthing mesh     |

---

## 💡 Choosing the Right Solution

- **Choose Official Hosted Sync** if you want a zero-maintenance, fully supported commercial product that directly funds
  client development.
- **Choose Community Plugins (such as Self-Hosted LiveSync)** if you prefer using unmodified official client builds and
  operating strictly within standard plugin APIs.
- **Choose File-Based Tools (Git / Syncthing)** if you prefer simple file-system level replication without operating an
  active sync backend server.
- **Choose Marekanite** if you want to run a **self-hosted server on your own hardware** while using the **native client
  Sync UI**, and you are comfortable with local client patching for your personal devices.

