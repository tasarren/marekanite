<script setup lang="ts">
import { ref } from "vue"
import { useAuthStore } from "../stores/auth"
import OButton from "../components/ui/OButton.vue"
import OCard from "../components/ui/OCard.vue"
import OCallout from "../components/ui/OCallout.vue"
import OInput from "../components/ui/OInput.vue"

const auth = useAuthStore()
const email = ref("")
const password = ref("")
const error = ref("")
const busy = ref(false)

async function submit() {
  error.value = ""
  busy.value = true
  try {
    await auth.login({ email: email.value.trim(), password: password.value })
  } catch(e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-normal">Sign in</h1>
      <p class="mt-1 text-sm text-muted">
        The app only has Sign in. Add people under Accounts first, then sign
        in here or in Obsidian.
      </p>
    </div>

    <OCallout v-if="auth.email" kind="success">
      Signed in as <strong class="text-normal">{{ auth.email }}</strong>
      <OButton class="ml-2" variant="ghost" type="button" @click="auth.logout()">
        Log out
      </OButton>
    </OCallout>

    <OCard>
      <form class="space-y-4" @submit.prevent="submit">
        <label class="block space-y-1.5 text-sm">
          <span class="text-muted">Email</span>
          <OInput
            v-model="email"
            type="email"
            required
            autocomplete="email"
          />
        </label>
        <label class="block space-y-1.5 text-sm">
          <span class="text-muted">Password</span>
          <OInput
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
          />
        </label>
        <OCallout v-if="error" kind="error">{{ error }}</OCallout>
        <OButton type="submit" variant="cta" :disabled="busy">
          {{ busy ? "Signing in…" : "Sign in" }}
        </OButton>
      </form>
    </OCard>
  </div>
</template>
