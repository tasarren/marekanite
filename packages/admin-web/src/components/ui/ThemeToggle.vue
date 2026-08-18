<script setup lang="ts">
import { useThemeStore } from "../../stores/theme"

const theme = useThemeStore()
</script>

<template>
  <div
    class="inline-flex items-center rounded-[var(--radius-m)] border border-border bg-secondary p-0.5 text-xs"
    role="group"
    aria-label="Theme"
  >
    <button
      type="button"
      class="rounded-[var(--radius-s)] px-2 py-1 transition"
      :class="
        theme.mode === 'dark'
          ? 'bg-accent text-on-accent'
          : 'text-muted hover:text-normal'
      "
      @click="theme.setMode('dark')"
    >
      Dark
    </button>
    <button
      type="button"
      class="rounded-[var(--radius-s)] px-2 py-1 transition"
      :class="
        theme.mode === 'light'
          ? 'bg-accent text-on-accent'
          : 'text-muted hover:text-normal'
      "
      @click="theme.setMode('light')"
    >
      Light
    </button>
  </div>
</template>
