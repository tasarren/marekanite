# Client Application Patching Guide

This guide provides step-by-step instructions for rewriting desktop Electron bundles (`obsidian.asar`) and Android
packages (`.apk`) to direct sync traffic to your self-hosted Marekanite server.

---

## 🛠️ CLI Patching Commands

You can patch client files using the web admin interface (`/patch`) or via the command line interface:

```bash
# Patch Desktop ASAR Bundle
pnpm patch:desktop -- --profile dev --asar ./obsidian.asar --out ./artifacts/patched/obsidian.dev.asar

# Patch Android APK Package
pnpm patch:android -- --profile dev --apk ./artifacts/android/base.apk --out ./artifacts/patched/obsidian.dev.apk
```

---

## ⚡ What the Rewriter Changes

- **API Origin Base**: Replaces hardcoded default API string constructors in `app.js` and `starter.js` with your target
  server URL.
- **WebSocket Host Allowlist**: Modifies internal hostname validation functions to authorize self-hosted domain or IP
  connections.
- **Insecure Content Policy**: Sets `allowRunningInsecureContent` when connecting to plain `http://` dev endpoints.
- **Auto-Update Flags**: Disables automatic background update downloads (`updateDisabled: true`) to prevent official
  updates from overwriting local patch modifications.

> [!CAUTION]
> **No Redistribution**: Patched binaries contain modified third-party software and are strictly for personal
> self-hosting. Do not redistribute patched `.asar` or `.apk` files publicly.

---

## 🖥️ Deploying Patched ASAR Files (Desktop)

The patcher outputs a modified archive named **`obsidian.patched.asar`**. You will replace the existing *
*`obsidian.asar`** in your application directory while leaving **`app.asar`** unchanged.

### 🍎 macOS Setup Instructions

1. Quit the application completely (**Obsidian menu → Quit**; closing the window is not sufficient).
2. Open **Finder** → navigate to **Applications**.
3. Right-click the app icon → select **Show Package Contents**.
4. Navigate to **`Contents/Resources`**.
5. Rename existing `obsidian.asar` to `obsidian.asar.bak`.
6. Copy `obsidian.patched.asar` into `Resources` and rename it to `obsidian.asar`.
7. Launch the application. If macOS displays a gatekeeper security notice:
   ```bash
   xattr -cr /Applications/Obsidian.app
   ```

### 🪟 Windows Setup Instructions

1. Quit the application completely (ensure system tray icon is closed).
2. Press `Win + R`, paste `%LOCALAPPDATA%\Obsidian`, and press **Enter**.
3. Open the **`resources`** directory (located beside `Obsidian.exe`).
4. Rename `obsidian.asar` to `obsidian.asar.bak`. Do not touch `app.asar`.
5. Copy `obsidian.patched.asar` into `resources` and rename it to `obsidian.asar`.
6. Launch the application.

### 🐧 Linux Setup Instructions

1. Locate the directory containing `obsidian.asar` (e.g. `/opt/Obsidian/resources/` or `~/.local/share/Obsidian/`).
2. Backup the original file: `mv obsidian.asar obsidian.asar.bak`.
3. Copy `obsidian.patched.asar` into place as `obsidian.asar`.

---

## 📱 Installing Patched APK Files (Android 11+)

Android APK outputs are signed with an automatically generated debug keystore (`data/apk-signing/`) and packaged with
uncompressed `resources.arsc` for Android compatibility.

### Method A: Wireless ADB Installation (Over Wi-Fi)

If `adb` is installed on the host running `sync-server`:

1. Open the Admin Console → **Patch** → Step 4.
2. On your Android device, enable **Developer Options** → **Wireless Debugging**.
3. Click **Pair device with pairing code** on your phone.
4. Input the IP, 6-digit pairing port, and code into the admin UI.
5. Connect via the main Wireless Debugging port and click **Install**.

> [!IMPORTANT]
> Because patched APKs use custom signing keys, existing app store installations must be uninstalled prior to installing
> re-signed builds. Your local vault markdown notes on storage will remain intact.

### Method B: WebUSB Installation (Chrome / Edge)

WebUSB allows direct USB installation from Chromium browsers over HTTPS or loopback (`127.0.0.1` / `localhost`).

1. Connect your Android phone via USB and enable **USB Debugging**.
2. Navigate to `http://127.0.0.1:8787/patch` or your admin URL.
3. Click **Install on this device** and accept the RSA key prompt on your phone screen.

---

## 🔄 Handling Residual Auto-Update Files

If stock server endpoints re-appear after a application restart, check for cached background updates downloaded by
previous builds:

```bash
# List cached background updates on Linux/macOS
ls ~/.config/obsidian/obsidian-*.asar

# Remove cached update archives so patched asar is executed
rm -f ~/.config/obsidian/obsidian-*.asar
```

