<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router"
import { useAdminStore } from "../stores/admin"
import OButton from "../components/ui/OButton.vue"
import OCard from "../components/ui/OCard.vue"
import OCallout from "../components/ui/OCallout.vue"
import OInput from "../components/ui/OInput.vue"

const admin = useAdminStore()
const router = useRouter()
const token = ref("")

async function submit() {
  const ok = await admin.unlock(token.value)
  if (ok) await router.replace({ name: "home" })
}
</script>

<template>
  <div class="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-normal">
        This server is locked
      </h1>
      <p class="mt-2 text-sm text-muted">
        Enter the admin password you chose when you started it.
      </p>
    </div>

    <OCard class="p-5">
      <form class="space-y-4" @submit.prevent="submit">
        <label class="block space-y-1.5 text-sm">
          <span class="text-muted">Password</span>
          <OInput
            v-model="token"
            type="password"
            required
            autocomplete="current-password"
          />
        </label>
        <OCallout v-if="admin.error" kind="error">{{ admin.error }}</OCallout>
        <OButton type="submit" variant="cta" :disabled="admin.busy || !token.trim()">
          {{ admin.busy ? "Checking…" : "Continue" }}
        </OButton>
      </form>
    </OCard>
  </div>
</template>
