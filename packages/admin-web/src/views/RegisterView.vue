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
const name = ref("")
const error = ref("")
const success = ref("")
const busy = ref(false)

async function submit() {
  error.value = ""
  success.value = ""
  busy.value = true
  try {
    await auth.register({
      email: email.value.trim(),
      password: password.value,
      name: name.value.trim() || email.value.split("@")[0] || "User",
    })
    success.value = "Done. Sign in with this email in the patched app."
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
      <h1 class="text-2xl font-semibold text-normal">Create an account</h1>
      <p class="mt-1 text-sm text-muted">
        You’ll use this email and password in the patched app.
      </p>
    </div>

    <OCard>
      <form class="space-y-4" @submit.prevent="submit">
        <label class="block space-y-1.5 text-sm">
          <span class="text-muted">Name</span>
          <OInput v-model="name" autocomplete="name" placeholder="Display name" />
        </label>
        <label class="block space-y-1.5 text-sm">
          <span class="text-muted">Email</span>
          <OInput
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
          />
        </label>
        <label class="block space-y-1.5 text-sm">
          <span class="text-muted">Password</span>
          <OInput
            v-model="password"
            type="password"
            required
            minlength="1"
            autocomplete="new-password"
          />
        </label>
        <OCallout v-if="error" kind="error">{{ error }}</OCallout>
        <OCallout v-if="success" kind="success">{{ success }}</OCallout>
        <OButton type="submit" variant="cta" :disabled="busy">
          {{ busy ? "Creating…" : "Create account" }}
        </OButton>
      </form>
    </OCard>
  </div>
</template>
