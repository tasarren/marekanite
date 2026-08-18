import { defineStore } from "pinia"
import { ref } from "vue"
import { adminFetch, getAdminToken, setAdminToken } from "../api/client"
import { useHostStore } from "./host"

export type AdminAuthMode = "unknown" | "none" | "token"

export const useAdminStore = defineStore("admin", () => {
  const ready = ref(false)
  const authMode = ref<AdminAuthMode>("unknown")
  const unlocked = ref(false)
  const error = ref("")
  const busy = ref(false)

  async function bootstrap(): Promise<void> {
    if (ready.value) return
    error.value = ""
    try {
      const stored = getAdminToken()
      const res = stored
        ? await adminFetch("/admin/session")
        : await fetch("/admin/session")
      const body = (await res.json()) as { auth?: string; ok?: boolean }
      if (body.auth === "none") {
        authMode.value = "none"
        unlocked.value = true
        useHostStore().connect()
        return
      }
      authMode.value = "token"
      unlocked.value = body.ok === true
      if (!body.ok) setAdminToken(null)
      else useHostStore().connect()
    } catch {
      authMode.value = "token"
      unlocked.value = false
      error.value = "Could not reach the sync server."
    } finally {
      ready.value = true
    }
  }

  async function unlock(token: string): Promise<boolean> {
    error.value = ""
    busy.value = true
    const trimmed = token.trim()
    try {
      setAdminToken(trimmed)
      const res = await adminFetch("/admin/session")
      const body = (await res.json()) as { auth?: string; ok?: boolean }
      if (body.auth === "none") {
        authMode.value = "none"
        unlocked.value = true
        setAdminToken(null)
        useHostStore().connect()
        return true
      }
      if (!body.ok) {
        setAdminToken(null)
        unlocked.value = false
        error.value = "That token was rejected."
        return false
      }
      authMode.value = "token"
      unlocked.value = true
      useHostStore().connect()
      return true
    } catch {
      setAdminToken(null)
      unlocked.value = false
      error.value = "Could not reach the server."
      return false
    } finally {
      busy.value = false
    }
  }

  function lock(): void {
    setAdminToken(null)
    unlocked.value = authMode.value === "none"
    if (!unlocked.value) useHostStore().disconnect()
  }

  return { ready, authMode, unlocked, error, busy, bootstrap, unlock, lock }
})
