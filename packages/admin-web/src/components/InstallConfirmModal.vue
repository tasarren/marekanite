<script setup lang="ts">
import OButton from "./ui/OButton.vue"

defineProps<{
  release: string | null;
  sdk: number | null;
  busy?: boolean;
}>()

const emit = defineEmits<{
  cancel: [];
  confirm: [];
}>()
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="install-confirm-title"
    @click.self="!busy && emit('cancel')"
  >
    <div class="o-card max-w-md space-y-3 p-5">
      <h2 id="install-confirm-title" class="text-lg font-medium text-normal">
        Obsidian is already on this phone
      </h2>
      <p class="text-sm text-muted">
        <template v-if="release || sdk">
          Android {{ release ?? "?" }}{{ sdk ? ` (API ${sdk})` : "" }}.
        </template>
        The existing app uses a different signature than this patched build, so
        it has to come off first. Notes you keep in Files / your vault folder
        stay on the phone. The app’s own login and settings do not.
      </p>
      <div class="flex justify-end gap-2 pt-1">
        <OButton variant="ghost" :disabled="busy" @click="emit('cancel')">
          Cancel
        </OButton>
        <OButton variant="danger" :disabled="busy" @click="emit('confirm')">
          {{ busy ? "Working…" : "Remove and install" }}
        </OButton>
      </div>
    </div>
  </div>
</template>
