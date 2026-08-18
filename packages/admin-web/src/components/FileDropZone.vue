<script setup lang="ts">
import { ref } from "vue"

defineProps<{
  accept: string;
  label: string;
}>()

const emit = defineEmits<{
  select: [file: File];
}>()

const dragOver = ref(false)
const fileName = ref("")

function onFiles(files: FileList | null) {
  const f = files?.[0]
  if (!f) return
  fileName.value = `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`
  emit("select", f)
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  onFiles(e.dataTransfer?.files ?? null)
}
</script>

<template>
  <label
    class="flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed px-6 py-12 transition"
    :class="
      dragOver
        ? 'border-accent bg-accent/10'
        : 'border-border bg-secondary/60 hover:border-border-hover'
    "
    @dragover.prevent="dragOver = true"
    @dragleave.prevent="dragOver = false"
    @drop.prevent="onDrop"
  >
    <span class="text-sm text-normal">{{ label }}</span>
    <span v-if="fileName" class="mt-2 text-xs text-accent">{{ fileName }}</span>
    <span v-else class="mt-2 text-xs text-faint">or click to browse</span>
    <input
      type="file"
      class="hidden"
      :accept="accept"
      @change="onFiles(($event.target as HTMLInputElement).files)"
    >
  </label>
</template>
