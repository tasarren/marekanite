import { defineStore } from "pinia"
import { ref, watch } from "vue"

export type ThemeMode = "dark" | "light"

const STORAGE_KEY = "marekanite_theme"

function applyDom(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.remove("theme-dark", "theme-light")
  root.classList.add(mode === "light" ? "theme-light" : "theme-dark")
  root.dataset.theme = mode
}

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === "light" || v === "dark") return v
  } catch {
    /* ignore */
  }
  return "dark"
}

export const useThemeStore = defineStore("theme", () => {
  const mode = ref<ThemeMode>(readStored())

  function setMode(next: ThemeMode) {
    mode.value = next
    applyDom(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  function toggle() {
    setMode(mode.value === "dark" ? "light" : "dark")
  }

  function init() {
    applyDom(mode.value)
  }

  watch(mode, (m) => { applyDom(m) })

  return { mode, setMode, toggle, init }
})
