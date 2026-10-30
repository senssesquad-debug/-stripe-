<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { gsap, ScrollTrigger, reducedMotion, startSmoothScroll, scrollToTop } from './composables/useMotion.js'
import { useSite } from './composables/useSite.js'
import { applyHead } from './composables/useHead.js'
import Loader from './components/Loader.vue'
import Cursor from './components/Cursor.vue'

const router = useRouter()
const route = useRoute()
const { t, lang } = useSite()
const curtain = ref(null)
let first = true

// Curtain between pages: two warm panels sweep up, the page swaps underneath.
router.beforeEach(async (to, from) => {
  if (first || reducedMotion.value || to.path === from.path || !curtain.value) return
  const [a, b] = curtain.value.querySelectorAll('.curtain__panel')
  await gsap
    .timeline()
    .set([a, b], { transformOrigin: '50% 100%' })
    .to(b, { scaleY: 1, duration: 0.55, ease: 'expo.inOut' })
    .to(a, { scaleY: 1, duration: 0.55, ease: 'expo.inOut' }, 0.08)
    .to(curtain.value.querySelector('.curtain__mark'), { opacity: 1, duration: 0.3 }, 0.35)
})

router.afterEach(async (to, from) => {
  if (first) {
    first = false
    return
  }
  if (to.path === from.path) return
  await nextTick()
  scrollToTop()
  ScrollTrigger.refresh()
  if (reducedMotion.value || !curtain.value) return
  const [a, b] = curtain.value.querySelectorAll('.curtain__panel')
  gsap
    .timeline({ delay: 0.12 })
    .to(curtain.value.querySelector('.curtain__mark'), { opacity: 0, duration: 0.2 })
    .set([a, b], { transformOrigin: '50% 0%' })
    .to(a, { scaleY: 0, duration: 0.7, ease: 'expo.inOut' })
    .to(b, { scaleY: 0, duration: 0.7, ease: 'expo.inOut' }, '-=0.6')
})

watch(
  () => [route.fullPath, lang.value],
  () => applyHead(route, t.value),
  { immediate: true },
)

onMounted(() => {
  startSmoothScroll()
})
</script>

<template>
  <a href="#main" class="skip-link">{{ t.ui.skip }}</a>
  <RouterView />
  <div ref="curtain" class="curtain" aria-hidden="true">
    <div class="curtain__panel curtain__panel--b"></div>
    <div class="curtain__panel"></div>
    <span class="curtain__mark">JZ</span>
  </div>
  <Loader />
  <Cursor />
  <div class="grain" aria-hidden="true"></div>
</template>
