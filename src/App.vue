<script setup>
import { RouterView, RouterLink } from 'vue-router'
</script>

<template>
  <header class="app-header">
    <RouterLink to="/" class="brand">Memorez <span>Istorie</span></RouterLink>
  </header>
  <main class="app-main">
    <RouterView />
  </main>
</template>
