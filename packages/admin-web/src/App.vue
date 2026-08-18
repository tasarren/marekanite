<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router"
import { useAuthStore } from "./stores/auth"
import { useAdminStore } from "./stores/admin"
import ThemeToggle from "./components/ui/ThemeToggle.vue"

const auth = useAuthStore()
const admin = useAdminStore()
const route = useRoute()
const router = useRouter()

function lockConsole() {
  admin.lock()
  void router.replace({ name: "unlock" })
}
</script>

<template>
  <div class="min-h-screen bg-primary text-normal font-[family-name:var(--font-interface)]">
    <header
      class="sticky top-0 z-10 border-b border-border bg-primary/90 backdrop-blur-md"
    >
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <RouterLink
          to="/"
          class="flex items-center gap-2 font-semibold tracking-tight text-accent hover:opacity-90"
        >
          <img
            src="/marekanite-mark.png"
            alt=""
            width="28"
            height="28"
            class="h-7 w-7 object-contain"
          >
          <span>Marekanite</span>
        </RouterLink>
        <nav
          v-if="admin.unlocked && route.name !== 'unlock'"
          class="flex flex-wrap items-center gap-2 text-sm sm:gap-3"
        >
          <RouterLink
            class="rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-normal"
            active-class="!text-normal bg-secondary"
            to="/patch"
          >
            Patch
          </RouterLink>
          <RouterLink
            class="rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-normal"
            active-class="!text-normal bg-secondary"
            to="/accounts"
          >
            Accounts
          </RouterLink>
          <template v-if="auth.email">
            <span class="hidden text-xs text-muted sm:inline">{{ auth.email }}</span>
            <button
              type="button"
              class="rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-normal"
              @click="auth.logout()"
            >
              Log out
            </button>
          </template>
          <template v-else>
            <RouterLink
              class="rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-normal"
              active-class="!text-normal bg-secondary"
              to="/login"
            >
              Sign in
            </RouterLink>
            <RouterLink
              class="rounded-md px-2 py-1 text-muted hover:bg-hover hover:text-normal"
              active-class="!text-normal bg-secondary"
              to="/register"
            >
              Create account
            </RouterLink>
          </template>
          <button
            v-if="admin.authMode === 'token'"
            type="button"
            class="text-xs text-faint hover:text-muted"
            @click="lockConsole"
          >
            Lock
          </button>
          <ThemeToggle />
        </nav>
        <ThemeToggle v-else />
      </div>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-8">
      <RouterView />
    </main>
  </div>
</template>
