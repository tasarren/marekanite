<script setup lang="ts">
withDefaults(
  defineProps<{
    kind?: "info" | "success" | "error" | "warning";
  }>(),
  { kind: "info" },
)
</script>

<template>
  <div
    class="rounded-[var(--radius-m)] border px-3 py-2 text-sm"
    :class="{
      'border-border bg-primary-alt text-muted': kind === 'info',
      'border-success/40 bg-success/10 text-success': kind === 'success',
      'border-error/40 bg-error/10 text-error': kind === 'error',
      'border-border bg-secondary text-muted': kind === 'warning',
    }"
  >
    <slot />
  </div>
</template>
