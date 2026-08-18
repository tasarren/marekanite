<script setup lang="ts">
import { storeToRefs } from "pinia"
import { computed, onMounted, ref, watch } from "vue"
import FileDropZone from "../components/FileDropZone.vue"
import LogConsole from "../components/LogConsole.vue"
import OButton from "../components/ui/OButton.vue"
import OCallout from "../components/ui/OCallout.vue"
import OCard from "../components/ui/OCard.vue"
import OInput from "../components/ui/OInput.vue"
import { adminFetch, adminUrl } from "../api/client"
import InstallConfirmModal from "../components/InstallConfirmModal.vue"
import type { DeviceInspect } from "@marekanite/client-patch/android-install"
import { replaceGuide, type ClientPlatform } from "@marekanite/client-patch/replace-guide"
import { useHostStore } from "../stores/host"
import {
  closeWebUsbAdb,
  connectWebUsbAdb,
  getWebUsbStatus,
  inspectWebUsbDevice,
  installOnWebUsbSession,
  type WebAdbSession,
} from "../lib/webadb-install"

type Kind = "desktop" | "android"
type DesktopOs = "linux" | "macos" | "windows"
type Source = "release" | "upload"

type ReleaseAsset = { name: string; size: number }
type ReleaseRow = {
  version: string;
  tag: string;
  publishedAt: string | null;
  asar: ReleaseAsset | null;
  dmg: ReleaseAsset | null;
  exe: ReleaseAsset | null;
  apk: ReleaseAsset | null;
  asarCached?: boolean;
  dmgCached?: boolean;
  exeCached?: boolean;
  apkCached?: boolean;
}

const kind = ref<Kind>("desktop")
const desktopOs = ref<DesktopOs>("linux")
const platform = computed<ClientPlatform>(() =>
  kind.value === "android" ? "android" : desktopOs.value,
)
const source = ref<Source>("release")
const step = ref(1)
const steps = [
  { n: 1, label: "Device" },
  { n: 2, label: "File" },
  { n: 3, label: "Server" },
  { n: 4, label: "Patch" },
] as const

function defaultApiBase() {
  if (typeof window === "undefined") return "http://127.0.0.1:8787"
  if (window.location.port === "5173") return "http://127.0.0.1:8787"
  return window.location.origin
}

const apiBase = ref(defaultApiBase())

const file = ref<File | null>(null)
const logs = ref<string[]>([])
const busy = ref(false)
const installing = ref(false)
const jobId = ref<string | null>(null)
const ready = ref(false)
const error = ref("")
const installModal = ref(false)
const inspectInfo = ref<DeviceInspect | null>(null)
const pendingInstall = ref<"usb" | "wifi" | null>(null)
let usbSession: WebAdbSession | null = null

const releases = ref<ReleaseRow[]>([])
const selectedVersion = ref("")
const releasesLoading = ref(false)
const releasesError = ref("")
const compat = ref<{
  checked?: string;
  rows?: Array<{
    version: string;
    desktop: string;
    android: string;
  }>;
} | null>(null)

const accept = computed(() => {
  if (platform.value === "android") {
    return ".apk,application/vnd.android.package-archive"
  }
  if (platform.value === "macos") return ".dmg,.asar,.gz"
  if (platform.value === "windows") return ".exe,.asar,.gz"
  return ".asar,.gz,application/octet-stream"
})

const dropLabel = computed(() => {
  if (platform.value === "android") return "Drop the stock Android APK here"
  if (platform.value === "macos") return "Drop Obsidian.dmg here (or an .asar)"
  if (platform.value === "windows") return "Drop Obsidian.exe here (or an .asar)"
  return "Drop stock obsidian.asar here"
})

const haveItHint = computed(() => {
  if (platform.value === "android") return "Drop an APK"
  if (platform.value === "macos") return "Drop a DMG"
  if (platform.value === "windows") return "Drop an EXE"
  return "Drop an asar"
})

function assetFor(r: ReleaseRow): ReleaseAsset | null {
  if (platform.value === "linux") return r.asar
  if (platform.value === "macos") return r.dmg
  if (platform.value === "windows") return r.exe
  return r.apk
}

function assetCached(r: ReleaseRow): boolean {
  if (platform.value === "linux") return !!r.asarCached
  if (platform.value === "macos") return !!r.dmgCached
  if (platform.value === "windows") return !!r.exeCached
  return !!r.apkCached
}

const listedReleases = computed(() =>
  releases.value.filter((r) => !!assetFor(r)),
)

const selectedRelease = computed(() =>
  listedReleases.value.find((r) => r.version === selectedVersion.value),
)

const canPatchRelease = computed(() => !!selectedRelease.value && !!assetFor(selectedRelease.value!))

const guide = computed(() => replaceGuide(platform.value))

watch(platform, () => {
  file.value = null
  if (!listedReleases.value.some((r) => r.version === selectedVersion.value)) {
    selectedVersion.value = listedReleases.value[0]?.version ?? ""
  }
})

const webUsb = computed(() => getWebUsbStatus())

const canWebAdb = computed(
  () =>
    kind.value === "android" &&
    ready.value &&
    !!jobId.value &&
    webUsb.value.ok,
)

const host = useHostStore()
const { adb } = storeToRefs(host)
const wifiHost = ref("")
const wifiPairPort = ref("")
const wifiPairCode = ref("")
const wifiConnectPort = ref("")
const wifiSerial = ref("")
const wifiBusy = ref(false)

async function wifiPair() {
  wifiBusy.value = true
  error.value = ""
  try {
    const res = await adminFetch("/admin/adb/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: wifiHost.value,
        port: wifiPairPort.value,
        code: wifiPairCode.value,
      }),
    })
    const json = (await res.json()) as { error?: string; output?: string }
    if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
    pushLog(json.output || "Paired.")
    wifiPairCode.value = ""
  } catch(e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    wifiBusy.value = false
  }
}

async function wifiConnect() {
  wifiBusy.value = true
  error.value = ""
  try {
    const res = await adminFetch("/admin/adb/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: wifiHost.value,
        port: wifiConnectPort.value,
      }),
    })
    const json = (await res.json()) as {
      error?: string;
      output?: string;
      serial?: string;
    }
    if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
    wifiSerial.value = json.serial || `${wifiHost.value}:${wifiConnectPort.value}`
    pushLog(json.output || `Connected to ${wifiSerial.value}`)
  } catch(e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    wifiBusy.value = false
  }
}

async function wifiInspect(): Promise<DeviceInspect> {
  const res = await adminFetch("/admin/adb/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serial: wifiSerial.value }),
  })
  const json = (await res.json()) as DeviceInspect & { error?: string }
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
  pushLog(
    `Android ${json.release ?? "?"} / API ${json.sdk ?? "?"} · ${
      json.installed ? "Obsidian is installed" : "Obsidian is not installed"
    }`,
  )
  return json
}

async function wifiDoInstall(uninstall: boolean) {
  if (!jobId.value || !wifiSerial.value) return
  const res = await adminFetch("/admin/adb/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: jobId.value,
      serial: wifiSerial.value,
      uninstall,
    }),
  })
  const json = (await res.json()) as { error?: string; output?: string }
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`)
  pushLog(json.output || "Installed.")
}

async function wifiInstall() {
  if (!jobId.value || !wifiSerial.value) return
  wifiBusy.value = true
  error.value = ""
  try {
    const info = await wifiInspect()
    inspectInfo.value = info
    if (info.installed) {
      pendingInstall.value = "wifi"
      installModal.value = true
      return
    }
    await wifiDoInstall(false)
  } catch(e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    wifiBusy.value = false
  }
}

function applyDevProfile() {
  apiBase.value = "http://127.0.0.1:8787"
}

function onSelect(f: File) {
  file.value = f
  ready.value = false
  jobId.value = null
}

function pushLog(line: string) {
  logs.value = [...logs.value, line]
}

async function loadReleases(force = false) {
  releasesLoading.value = true
  releasesError.value = ""
  try {
    const url = force ? "/admin/releases?refresh=1" : "/admin/releases"
    const res = await adminFetch(url)
    const json = (await res.json()) as {
      releases?: ReleaseRow[];
      error?: string;
    }
    if (!res.ok || json.error) {
      throw new Error(json.error || `HTTP ${res.status}`)
    }
    releases.value = json.releases ?? []
    if (
      !selectedVersion.value ||
      !listedReleases.value.some((r) => r.version === selectedVersion.value)
    ) {
      selectedVersion.value = listedReleases.value[0]?.version ?? ""
    }
  } catch(e) {
    releasesError.value = e instanceof Error ? e.message : String(e)
  } finally {
    releasesLoading.value = false
  }
}

function compatMark(version: string): string {
  const row = compat.value?.rows?.find((r) => r.version === version)
  if (!row) return ""
  const v = platform.value === "android" ? row.android : row.desktop
  if (v === "ok") return "ok"
  if (v === "partial") return "partial"
  if (v === "unsupported") return "no"
  return ""
}

onMounted(() => {
  void loadReleases()
  void fetch("/compatibility.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      compat.value = j
    })
    .catch(() => {
      /* list is optional */
    })
})

async function runPatch() {
  error.value = ""
  ready.value = false
  logs.value = []
  busy.value = true
  jobId.value = null

  try {
    if (source.value === "release") {
      if (!selectedVersion.value) throw new Error("Pick a release version")
      if (!canPatchRelease.value) {
        throw new Error("This release has no file for that system")
      }
      pushLog(
        `from GitHub release ${selectedVersion.value} (${platform.value})…`,
      )
      const res = await adminFetch("/admin/patch/from-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: selectedVersion.value,
          platform: platform.value,
          kind: kind.value,
          apiBase: apiBase.value.trim(),
        }),
      })
      const json = (await res.json()) as { jobId?: string; error?: string }
      if (!res.ok || json.error || !json.jobId) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      jobId.value = json.jobId
      pushLog(`job ${json.jobId} created`)
      await streamEvents(json.jobId)
    } else {
      if (!file.value) throw new Error("Choose a file first")
      const fd = new FormData()
      fd.append("file", file.value)
      fd.append("apiBase", apiBase.value.trim())
      fd.append("platform", platform.value)

      pushLog(`uploading ${file.value.name}…`)
      const res = await adminFetch(`/admin/patch/${kind.value}`, {
        method: "POST",
        body: fd,
      })
      const json = (await res.json()) as { jobId?: string; error?: string }
      if (!res.ok || json.error || !json.jobId) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      jobId.value = json.jobId
      pushLog(`job ${json.jobId} created`)
      await streamEvents(json.jobId)
    }
  } catch(e) {
    error.value = e instanceof Error ? e.message : String(e)
    pushLog(`error: ${error.value}`)
  } finally {
    busy.value = false
  }
}

function streamEvents(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const es = new EventSource(adminUrl(`/admin/patch/${id}/events`))
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          line?: string;
          status?: string;
          error?: string;
        }
        if (data.line) pushLog(data.line)
        if (data.status === "done") {
          ready.value = true
          pushLog("ready for download")
          es.close()
          resolve()
        }
        if (data.status === "error") {
          es.close()
          reject(new Error(data.error || "patch failed"))
        }
      } catch {
        /* ignore */
      }
    }
    es.onerror = () => {
      es.close()
      void pollUntilDone(id).then(resolve).catch(reject)
    }
  })
}

async function pollUntilDone(id: string) {
  for (let i = 0; i < 300; i++) {
    const res = await adminFetch(`/admin/patch/${id}`)
    const j = (await res.json()) as {
      status: string;
      logs: string[];
      error?: string;
    }
    logs.value = j.logs ?? logs.value
    if (j.status === "done") {
      ready.value = true
      return
    }
    if (j.status === "error") throw new Error(j.error || "patch failed")
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error("timed out waiting for patch job")
}

async function download() {
  if (!jobId.value) return
  const res = await adminFetch(`/admin/patch/${jobId.value}/download`)
  if (!res.ok) {
    error.value = `Download failed: HTTP ${res.status}`
    return
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download =
    kind.value === "android" ? "obsidian.patched.apk" : "obsidian.patched.asar"
  a.click()
  URL.revokeObjectURL(url)
}

async function installWebAdb() {
  if (!jobId.value) return
  installing.value = true
  error.value = ""
  try {
    await closeWebUsbAdb(usbSession)
    usbSession = await connectWebUsbAdb(pushLog)
    const info = await inspectWebUsbDevice(usbSession, pushLog)
    inspectInfo.value = info
    if (info.installed) {
      pendingInstall.value = "usb"
      installModal.value = true
      return
    }
    await finishUsbInstall(false)
  } catch(e) {
    error.value = e instanceof Error ? e.message : String(e)
    pushLog(`WebADB error: ${error.value}`)
    await closeWebUsbAdb(usbSession)
    usbSession = null
  } finally {
    installing.value = false
  }
}

async function finishUsbInstall(uninstall: boolean) {
  if (!jobId.value) return
  installing.value = true
  error.value = ""
  try {
    if (!usbSession) usbSession = await connectWebUsbAdb(pushLog)
    await installOnWebUsbSession(
      usbSession,
      `/admin/patch/${jobId.value}/download`,
      pushLog,
      { uninstall, sdk: inspectInfo.value?.sdk },
    )
  } catch(e) {
    error.value = e instanceof Error ? e.message : String(e)
    pushLog(`WebADB error: ${error.value}`)
  } finally {
    await closeWebUsbAdb(usbSession)
    usbSession = null
    installing.value = false
  }
}

async function cancelInstallModal() {
  installModal.value = false
  pendingInstall.value = null
  await closeWebUsbAdb(usbSession)
  usbSession = null
}

async function confirmRemoveAndInstall() {
  const kindPending = pendingInstall.value
  installModal.value = false
  pendingInstall.value = null
  if (kindPending === "wifi") {
    wifiBusy.value = true
    error.value = ""
    try {
      await wifiDoInstall(true)
    } catch(e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      wifiBusy.value = false
    }
    return
  }
  if (kindPending === "usb") {
    await finishUsbInstall(true)
  }
}

function fmtMb(n: number | undefined) {
  if (!n) return ""
  return `${(n / 1e6).toFixed(1)} MB`
}

function goTo(n: number) {
  if (n < 1 || n > 4) return
  if (n > step.value && n > 1 && source.value === "upload" && !file.value && n >= 3) {
    return
  }
  step.value = n
}

const canAdvance = computed(() => {
  if (step.value === 2 && source.value === "upload") return !!file.value
  if (step.value === 2 && source.value === "release") return canPatchRelease.value
  if (step.value === 3) return !!apiBase.value.trim()
  return true
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-normal">Patch an app</h1>
      <p class="mt-1 text-sm text-muted">
        We’ll take a copy of Obsidian you already have and point it at this
        server.
      </p>
    </div>

    <nav class="wizard-rail" aria-label="Steps">
      <button
        v-for="s in steps"
        :key="s.n"
        type="button"
        class="wizard-rail-item"
        :class="{
          'wizard-rail-item-current': step === s.n,
          'wizard-rail-item-done': step > s.n,
        }"
        @click="goTo(s.n)"
      >
        <span class="wizard-dot">{{ s.n }}</span>
        <span class="wizard-rail-label hidden sm:inline">{{ s.label }}</span>
      </button>
    </nav>

    <OCard class="space-y-5 p-5">
      <template v-if="step === 1">
        <h2 class="text-lg font-medium text-normal">Which app?</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            class="o-choice"
            :class="{ 'o-choice-active': kind === 'desktop' }"
            @click="kind = 'desktop'"
          >
            <span class="font-medium text-normal">Computer</span>
            <span class="text-sm text-muted">Windows, Mac, or Linux</span>
          </button>
          <button
            type="button"
            class="o-choice"
            :class="{ 'o-choice-active': kind === 'android' }"
            @click="kind = 'android'"
          >
            <span class="font-medium text-normal">Phone</span>
            <span class="text-sm text-muted">Android</span>
          </button>
        </div>
        <div v-if="kind === 'desktop'" class="grid gap-3 sm:grid-cols-3">
          <button
            v-for="os in (['linux', 'macos', 'windows'] as const)"
            :key="os"
            type="button"
            class="o-choice"
            :class="{ 'o-choice-active': desktopOs === os }"
            @click="desktopOs = os"
          >
            <span class="font-medium text-normal">
              {{ os === "macos" ? "Mac" : os === "windows" ? "Windows" : "Linux" }}
            </span>
            <span class="text-sm text-muted">
              {{
                os === "macos"
                  ? "Obsidian.dmg"
                  : os === "windows"
                    ? "Obsidian.exe"
                    : "asar file"
              }}
            </span>
          </button>
        </div>
      </template>

      <template v-else-if="step === 2">
        <h2 class="text-lg font-medium text-normal">Where is the file?</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            class="o-choice"
            :class="{ 'o-choice-active': source === 'release' }"
            @click="source = 'release'"
          >
            <span class="font-medium text-normal">Download it here</span>
            <span class="text-sm text-muted">From Obsidian’s GitHub releases</span>
          </button>
          <button
            type="button"
            class="o-choice"
            :class="{ 'o-choice-active': source === 'upload' }"
            @click="source = 'upload'"
          >
            <span class="font-medium text-normal">I already have it</span>
            <span class="text-sm text-muted">{{ haveItHint }}</span>
          </button>
        </div>

        <div v-if="source === 'release'" class="space-y-3">
          <label class="block space-y-1.5 text-sm">
            <span class="text-muted">Version</span>
            <select
              v-model="selectedVersion"
              class="o-input"
              :disabled="releasesLoading || !releases.length"
            >
              <option v-for="r in listedReleases" :key="r.tag" :value="r.version">
                {{ r.version }}
                <template v-if="assetFor(r)">
                  — {{ fmtMb(assetFor(r)!.size) }}
                  {{ assetCached(r) ? "· saved" : "" }}
                  {{ compatMark(r.version) ? `· ${compatMark(r.version)}` : "" }}
                </template>
              </option>
            </select>
          </label>
          <button
            type="button"
            class="text-sm text-accent hover:underline"
            :disabled="releasesLoading"
            @click="loadReleases(true)"
          >
            {{ releasesLoading ? "Loading…" : "Refresh the list" }}
          </button>
          <OCallout v-if="releasesError" kind="error">{{ releasesError }}</OCallout>
        </div>
        <FileDropZone
          v-else
          :accept="accept"
          :label="dropLabel"
          @select="onSelect"
        />
      </template>

      <template v-else-if="step === 3">
        <h2 class="text-lg font-medium text-normal">Where should it connect?</h2>
        <p class="text-sm text-muted">
          Login and Sync both use this address. Use an IP or name the phone can
          reach — not 127.0.0.1 if the vault is on another device.
        </p>
        <label class="block space-y-1.5 text-sm">
          <span class="text-muted">Server address</span>
          <OInput v-model="apiBase" />
        </label>
        <button
          type="button"
          class="text-sm text-accent hover:underline"
          @click="applyDevProfile"
        >
          Use this computer (127.0.0.1)
        </button>
      </template>

      <template v-else>
        <h2 class="text-lg font-medium text-normal">Ready to patch</h2>
        <p class="text-sm text-muted">{{ guide.summary }}</p>
        <div class="flex flex-wrap items-center gap-3">
          <OButton
            variant="cta"
            type="button"
            :disabled="
              busy || installing || (source === 'upload' ? !file : !canPatchRelease)
            "
            @click="runPatch"
          >
            {{ busy ? "Working…" : "Patch" }}
          </OButton>
          <OButton variant="default" type="button" :disabled="!ready" @click="download">
            Download
          </OButton>
          <template v-if="kind === 'android' && ready">
            <OButton
              variant="cta"
              type="button"
              :disabled="!canWebAdb || installing || busy"
              @click="installWebAdb"
            >
              {{ installing ? "Installing…" : "Install on this phone" }}
            </OButton>
          </template>
        </div>
        <OCallout
          v-if="kind === 'android' && ready && !webUsb.ok"
          kind="error"
        >
          <p class="font-medium">USB from this browser won’t work here.</p>
          <p class="mt-1 text-sm">
            Use Chrome or Edge, plug the phone in, and open this page as
            https, localhost, or 127.0.0.1. Or install over Wi-Fi below.
          </p>
        </OCallout>

        <div
          v-if="kind === 'android' && ready"
          class="space-y-3 border-t border-border pt-4"
        >
          <h3 class="font-medium text-normal">Or install over Wi-Fi</h3>
          <p v-if="adb && !adb.available" class="text-sm text-muted">
            Wireless install needs <code>adb</code> on this server.
            <span v-if="adb.detail">{{ adb.detail }}</span>
            <span v-if="adb.path" class="block text-faint">{{ adb.path }}</span>
          </p>
          <template v-else>
            <p class="text-sm text-muted">
              On the phone: Developer options → Wireless debugging. Pair with a
              code first (that port is not the same as the connect port).
              <span v-if="adb?.detail" class="text-faint">{{ adb.detail }}</span>
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block space-y-1.5 text-sm">
                <span class="text-muted">Phone address</span>
                <OInput v-model="wifiHost" placeholder="192.168.1.20" />
              </label>
              <label class="block space-y-1.5 text-sm">
                <span class="text-muted">Pairing port</span>
                <OInput v-model="wifiPairPort" placeholder="37123" />
              </label>
              <label class="block space-y-1.5 text-sm">
                <span class="text-muted">Pairing code</span>
                <OInput
                  v-model="wifiPairCode"
                  type="password"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                />
              </label>
              <label class="block space-y-1.5 text-sm">
                <span class="text-muted">Connect port</span>
                <OInput v-model="wifiConnectPort" placeholder="5555" />
              </label>
            </div>
            <div class="flex flex-wrap gap-2">
              <OButton
                type="button"
                :disabled="wifiBusy || !wifiHost || !wifiPairPort || !wifiPairCode"
                @click="wifiPair"
              >
                Pair
              </OButton>
              <OButton
                type="button"
                :disabled="wifiBusy || !wifiHost || !wifiConnectPort"
                @click="wifiConnect"
              >
                Connect
              </OButton>
              <OButton
                variant="cta"
                type="button"
                :disabled="wifiBusy || !wifiSerial || !jobId"
                @click="wifiInstall"
              >
                {{ wifiBusy ? "Working…" : "Install over Wi-Fi" }}
              </OButton>
            </div>
          </template>
        </div>

        <OCallout v-if="ready" kind="info">
          <p class="font-medium">After you download {{ guide.downloadName }}</p>
          <ol class="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li v-for="(s, i) in guide.steps" :key="i">{{ s }}</li>
          </ol>
        </OCallout>
        <OCallout v-if="error" kind="error">{{ error }}</OCallout>
        <LogConsole v-if="logs.length" :lines="logs" />
      </template>
    </OCard>

    <InstallConfirmModal
      v-if="installModal && inspectInfo"
      :release="inspectInfo.release"
      :sdk="inspectInfo.sdk"
      :busy="installing || wifiBusy"
      @cancel="cancelInstallModal"
      @confirm="confirmRemoveAndInstall"
    />

    <div class="flex justify-between">
      <OButton
        variant="ghost"
        type="button"
        :disabled="step === 1"
        @click="goTo(step - 1)"
      >
        Back
      </OButton>
      <OButton
        v-if="step < 4"
        variant="cta"
        type="button"
        :disabled="!canAdvance"
        @click="goTo(step + 1)"
      >
        Next
      </OButton>
    </div>
  </div>
</template>
