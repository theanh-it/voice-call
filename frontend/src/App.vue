<template>
  <div class="app">
    <router-view />
    <ToastContainer />
  </div>
</template>

<script setup>
import ToastContainer from "./components/ToastContainer.vue";
</script>

<style scoped>
.app {
  min-height: 100vh;
}
</style>
