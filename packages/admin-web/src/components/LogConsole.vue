<script setup lang="ts">
import { nextTick, ref, watch } from "vue"

const props = defineProps<{
  lines: string[];
}>()

const el = ref<HTMLPreElement | null>(null)

watch(
  () => props.lines.length,
  async() => {
    await nextTick()
    if (el.value) el.value.scrollTop = el.value.scrollHeight
  },
)
</script>

<template>
  <pre
    ref="el"
    class="h-72 overflow-auto rounded-[var(--radius-l)] border border-border bg-primary-alt p-4 font-[family-name:var(--font-monospace)] text-xs leading-relaxed text-success shadow-[var(--shadow-s)]"
  ><template v-for="(line, i) in lines" :key="i">$ {{ line }}
</template><span v-if="!lines.length" class="text-faint">$ waiting for patch job…</span></pre>
</template>
