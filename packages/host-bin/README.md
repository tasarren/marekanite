# `@marekanite/host-bin`

Tiny Node helper for locating host binaries. Shared by `@marekanite/client-patch` (`zip`, `unzip`, `7z`, `zipalign`, …)
and `@marekanite/sync-server` (`adb`).

```ts
import { requireBin, which } from "@marekanite/host-bin"

which("adb") // string | null
requireBin("adb", { path: process.env.ADB_PATH, hint: "install platform-tools" })
```
