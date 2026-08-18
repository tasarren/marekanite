<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "cta" | "default" | "ghost" | "danger";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }>(),
  { variant: "default", type: "button", disabled: false },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="o-btn"
    :class="{
      'o-btn-cta': variant === 'cta',
      'o-btn-default': variant === 'default',
      'o-btn-ghost': variant === 'ghost',
      'o-btn-danger': variant === 'danger',
    }"
  >
    <slot />
  </button>
</template>
