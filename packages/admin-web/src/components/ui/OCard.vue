<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="o-card p-5" v-bind="$attrs">
    <slot />
  </div>
</template>
