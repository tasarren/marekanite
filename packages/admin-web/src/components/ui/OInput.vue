<script setup lang="ts">
defineProps<{
  modelValue: string;
  type?: string;
  placeholder?: string;
  autocomplete?: string;
  required?: boolean;
  disabled?: boolean;
  minlength?: number | string;
}>()
const emit = defineEmits<{ "update:modelValue": [value: string] }>()
</script>

<template>
  <input
    class="o-input"
    :type="type || 'text'"
    :value="modelValue"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :required="required"
    :disabled="disabled"
    :minlength="minlength"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  >
</template>
