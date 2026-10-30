<script setup>
import { ref, onMounted } from 'vue'
import { refreshLive } from '../composables/useSite.js'
import SiteHeader from '../components/SiteHeader.vue'
import MenuOverlay from '../components/MenuOverlay.vue'
import SiteFooter from '../components/SiteFooter.vue'
import MobileBar from '../components/MobileBar.vue'

const menuOpen = ref(false)
onMounted(() => refreshLive())
</script>

<template>
  <SiteHeader :menu-open="menuOpen" @menu="menuOpen = !menuOpen" />
  <MenuOverlay :open="menuOpen" @close="menuOpen = false" />
  <main id="main" tabindex="-1">
    <RouterView />
  </main>
  <SiteFooter />
  <MobileBar />
</template>
