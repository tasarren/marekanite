export type ClientPlatform = "linux" | "macos" | "windows" | "android"

export type ReplaceGuide = {
  downloadName: string;
  summary: string;
  steps: string[];
}

export function parseClientPlatform(raw: unknown): ClientPlatform | null {
  if (raw === "linux" || raw === "macos" || raw === "windows" || raw === "android") {
    return raw
  }
  if (raw === "desktop") return "linux"
  return null
}

/** What to replace after a successful patch. Written for someone who has never seen an asar. */
export function replaceGuide(platform: ClientPlatform): ReplaceGuide {
  if (platform === "android") {
    return {
      downloadName: "obsidian.patched.apk",
      summary: "Install the downloaded APK on the phone (or use Install on this page).",
      steps: [
        "On the phone, uninstall the Play Store Obsidian first if this page asks you to. Your notes in Files / your vault folder stay.",
        "Open the downloaded file (obsidian.patched.apk) on the phone, or tap Install on this page.",
        "If Android warns that the app is from an unknown source, allow it just for this install.",
        "Open the new Obsidian and sign in with the account you created here.",
      ],
    }
  }

  if (platform === "macos") {
    return {
      downloadName: "obsidian.patched.asar",
      summary:
        "You will swap one file inside the Obsidian app. Leave app.asar alone. Only touch obsidian.asar.",
      steps: [
        "Quit Obsidian completely. Click Obsidian in the menu bar at the top of the screen, then Quit Obsidian. Closing the window is not enough.",
        "Open Finder → Applications. Find the Obsidian icon.",
        "Right-click (or Control-click) Obsidian → Show Package Contents. A new window of folders appears. This is normal.",
        "Open the folder named Contents, then the folder named Resources.",
        "In Resources you will see two similar names. Leave app.asar exactly where it is. Find the larger file named obsidian.asar.",
        "Rename obsidian.asar to obsidian.asar.bak (so you can undo this).",
        "Copy the file you downloaded (obsidian.patched.asar) into this same Resources folder.",
        "Rename that copy to exactly obsidian.asar — all lowercase, no extra words.",
        "Open Obsidian from Applications as usual. If macOS says the app is damaged, right-click Obsidian → Open, or run this in Terminal: xattr -cr /Applications/Obsidian.app",
        "Sign in with the account from this server.",
      ],
    }
  }

  if (platform === "windows") {
    return {
      downloadName: "obsidian.patched.asar",
      summary:
        "You will swap one file next to Obsidian.exe. Leave app.asar alone. Only touch obsidian.asar.",
      steps: [
        "Quit Obsidian completely. If a small Obsidian icon is hiding near the clock, right-click it → Quit.",
        "Press the Windows key, type %LOCALAPPDATA%\\Obsidian and press Enter. File Explorer should open the Obsidian folder.",
        "If that folder is empty, look for Obsidian.exe on your desktop or Start menu → right-click → Open file location.",
        "Open the folder named resources (it sits next to Obsidian.exe).",
        "Find the large file named obsidian.asar. Do not touch app.asar.",
        "Rename obsidian.asar to obsidian.asar.bak.",
        "Copy the downloaded file (obsidian.patched.asar) into this resources folder.",
        "Rename that copy to exactly obsidian.asar.",
        "Start Obsidian from the Start menu. Sign in with the account from this server.",
      ],
    }
  }

  return {
    downloadName: "obsidian.patched.asar",
    summary: "Replace the asar file you already use to launch Obsidian.",
    steps: [
      "Quit Obsidian completely.",
      "Find the file you use today (often named obsidian.asar, next to the AppImage or in the folder you unpacked).",
      "Rename that file to obsidian.asar.bak.",
      "Put the downloaded file in the same folder and name it exactly the same as the old one (usually obsidian.asar).",
      "Start Obsidian the same way you always do. Sign in with the account from this server.",
    ],
  }
}
