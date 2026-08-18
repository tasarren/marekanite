import { computed, ref } from "vue"
import { defineStore } from "pinia"
import { adminUrl } from "../api/client"

export type HostToolNeed = "android-wifi" | "android-apk" | "desktop-dmg-exe"

export type HostTool = {
  id: string
  label: string
  need: HostToolNeed
  available: boolean
  path: string | null
  detail: string | null
}

export const useHostStore = defineStore("host", () => {
  const tools = ref<HostTool[]>([])
  const streamError = ref("")
  let es: EventSource | null = null

  const adb = computed(() => tools.value.find((t) => t.id === "adb") ?? null)

  function stopStream(): void {
    es?.close()
    es = null
  }

  function onHidden(): void {
    if (document.hidden) stopStream()
    else connect()
  }

  function connect(): void {
    stopStream()
    streamError.value = ""
    const source = new EventSource(adminUrl("/admin/events"))
    es = source
    source.addEventListener("tools", (ev: MessageEvent<string>) => {
      try {
        const data = JSON.parse(ev.data) as { tools?: HostTool[] }
        tools.value = data.tools ?? []
        streamError.value = ""
      } catch {
        /* ignore a bad frame */
      }
    })
    source.onerror = () => {
      streamError.value = "Lost the status stream."
    }
    document.removeEventListener("visibilitychange", onHidden)
    document.addEventListener("visibilitychange", onHidden)
  }

  function disconnect(): void {
    stopStream()
    document.removeEventListener("visibilitychange", onHidden)
  }

  return { tools, adb, streamError, connect, disconnect }
})
