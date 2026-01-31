<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="currentColor"
    class="icon-mdi"
  >
    <path :d="path" />
  </svg>
</template>

<script setup>
defineProps({
  path: { type: String, required: true },
  size: { type: [Number, String], default: 24 },
});
</script>

<style scoped>
.icon-mdi {
  flex-shrink: 0;
  display: inline-block;
  vertical-align: middle;
}
</style>
