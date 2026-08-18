# Host System Tooling Requirements

The `@marekanite/client-patch` package shells out to system binaries installed on your host system environment. The
required binaries must be present on `PATH`.

---

## 🛠️ System Binaries Matrix

| Binary Utility           | Target Operating System | When Required           | Purpose & Technical Function                                                                |
|:-------------------------|:------------------------|:------------------------|:--------------------------------------------------------------------------------------------|
| **`7z`** (`p7zip-full`)  | macOS / Windows / Linux | Desktop ASAR extraction | Unpacks `.asar` bundles from `.dmg` image volumes or `.exe` installer archives.             |
| **`zip`**, **`unzip`**   | Linux / macOS / Windows | Android APK patch       | Extracts and repacks `.apk` archives while keeping `.arsc` and `.so` binaries uncompressed. |
| **`java`** (OpenJDK 17+) | Linux / macOS / Windows | Android signing         | Required runtime for executing `apksigner`.                                                 |
| **`apksigner`**          | Linux / macOS / Windows | Android signing         | Cryptographically signs the output APK using v2/v3 signatures.                              |
| **`zipalign`**           | Linux / macOS / Windows | Android alignment       | Performs 4-byte uncompressed alignment required for Android 11+ app execution.              |

> [!NOTE]
> **Desktop-Only Patching**: If you only patch desktop `.asar` archives, Java and Android SDK build-tools (`apksigner`,
`zipalign`) are not required.

> [!IMPORTANT]
> `adb` is used for wireless installation via [`@marekanite/sync-server`](../../sync-server/docs/admin-api.md) rather
> than directly by `@marekanite/client-patch`.

---

## 📚 Installation Guides

See the [Host System Dependencies Section](../../../README.md#host-dependencies) in the main README for exact package
manager commands (`apt-get`, `pacman`).

