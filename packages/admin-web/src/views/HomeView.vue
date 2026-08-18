<script setup lang="ts">
import { onMounted, ref } from "vue"
import { RouterLink } from "vue-router"
import { apiHealth } from "../api/client"
import { useAuthStore } from "../stores/auth"
import { useHostStore } from "../stores/host"
import OCard from "../components/ui/OCard.vue"

const auth = useAuthStore()
const host = useHostStore()
const healthy = ref<boolean | null>(null)

onMounted(async() => {
  healthy.value = await apiHealth()
})
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-normal">
        What do you need?
      </h1>
      <p class="mt-1 max-w-xl text-muted">
        Point your Obsidian apps at this server, then add the people who should
        sync here.
      </p>
      <p v-if="healthy === false" class="mt-3 text-sm text-error">
        Can’t reach the server. Is it running?
      </p>
    </div>

    <OCard>
      <h2 class="font-medium text-normal">This machine</h2>
      <p class="mt-1 text-sm text-muted">
        Tools the server needs to patch apps and install over Wi-Fi.
      </p>
      <p v-if="host.streamError" class="mt-2 text-sm text-error">
        {{ host.streamError }}
      </p>
      <ul v-if="host.tools.length" class="mt-3 space-y-2 text-sm">
        <li
          v-for="tool in host.tools"
          :key="tool.id"
          class="flex flex-wrap items-baseline justify-between gap-2"
        >
          <span class="text-normal">{{ tool.label }}</span>
          <span
            class="text-xs"
            :class="tool.available ? 'text-success' : 'text-muted'"
          >
            {{ tool.available ? (tool.detail || "ok") : (tool.detail || "missing") }}
          </span>
        </li>
      </ul>
      <p v-else-if="!host.streamError" class="mt-3 text-sm text-muted">
        Waiting for status…
      </p>
    </OCard>

    <div class="grid gap-4 sm:grid-cols-2">
      <RouterLink to="/patch" class="block">
        <OCard class="h-full transition hover:border-accent/40">
          <h2 class="font-medium text-normal">Patch an app</h2>
          <p class="mt-1 text-sm text-muted">
            Make the desktop or phone app talk to your server instead of
            Obsidian’s.
          </p>
        </OCard>
      </RouterLink>
      <RouterLink to="/accounts" class="block">
        <OCard class="h-full transition hover:border-accent/40">
          <h2 class="font-medium text-normal">People on this server</h2>
          <p class="mt-1 text-sm text-muted">
            See who has an account and add someone new.
          </p>
        </OCard>
      </RouterLink>
      <RouterLink v-if="!auth.email" to="/login" class="block">
        <OCard class="h-full transition hover:border-accent/40">
          <h2 class="font-medium text-normal">Sign in</h2>
          <p class="mt-1 text-sm text-muted">
            Use the same email and password as in the patched app.
          </p>
        </OCard>
      </RouterLink>
      <RouterLink v-if="!auth.email" to="/register" class="block">
        <OCard class="h-full transition hover:border-accent/40">
          <h2 class="font-medium text-normal">Create an account</h2>
          <p class="mt-1 text-sm text-muted">
            Make a login you can use in the patched app.
          </p>
        </OCard>
      </RouterLink>
    </div>
  </div>
</template>
