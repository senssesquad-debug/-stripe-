<script setup>
// First-load veil: waits for fonts (and the hero scene when present), never
// longer than a couple of seconds, then lifts like a blade-cut curtain.
import { ref, onMounted } from 'vue'
import { gsap, reducedMotion } from '../composables/useMotion.js'
import { boot } from '../composables/useBoot.js'

const root = ref(null)
const pct = ref(0)
const done = ref(false)

onMounted(async () => {
  const counter = { v: 0 }
  const count = gsap.to(counter, { v: 86, duration: 1.4, ease: 'power2.out', onUpdate: () => (pct.value = Math.round(counter.v)) })
  const fonts = document.fonts?.ready ?? Promise.resolve()
  // phones get a shorter veil: content first, the scene can fade in after
  const small = window.innerWidth < 760
  const minMs = reducedMotion.value ? 0 : small ? 450 : 900
  const maxMs = small ? 1500 : 2600
  await Promise.race([Promise.all([fonts, boot.sceneReady, new Promise((r) => setTimeout(r, minMs))]), new Promise((r) => setTimeout(r, maxMs))])
  count.kill()
  if (reducedMotion.value) {
    done.value = true
    boot.release()
    return
  }
  gsap
    .timeline({ onComplete: () => (done.value = true) })
    .to(counter, { v: 100, duration: 0.35, ease: 'power1.out', onUpdate: () => (pct.value = Math.round(counter.v)) })
    .to(root.value.querySelector('.loader__line'), { scaleX: 1, duration: 0.5, ease: 'expo.inOut' }, '<')
    .to(root.value.querySelector('.loader__inner'), { yPercent: -40, opacity: 0, duration: 0.7, ease: 'expo.in' }, '+=0.05')
    .add(() => boot.release(), '-=0.1')
    .to(root.value, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.05, ease: 'expo.inOut' }, '-=0.2')
})
</script>

<template>
  <div v-if="!done" ref="root" class="loader" role="status" aria-live="polite">
    <div class="loader__inner">
      <p class="loader__mark serif">JZ<span class="italic bronze">.</span></p>
      <p class="loader__sub label">Cuts &amp; Shave · Daugavpils</p>
      <div class="loader__bar">
        <span class="loader__line"></span>
      </div>
      <p class="loader__pct label" aria-hidden="true">{{ String(pct).padStart(3, '0') }}</p>
    </div>
  </div>
</template>

<style scoped>
.loader {
  position: fixed;
  inset: 0;
  z-index: 160;
  display: grid;
  place-items: center;
  background: radial-gradient(80% 70% at 50% 40%, #1d1713, var(--black) 70%);
  clip-path: inset(0% 0% 0% 0%);
}
.loader__inner {
  display: grid;
  justify-items: center;
  gap: 18px;
}
.loader__mark {
  font-size: clamp(5rem, 14vw, 11rem);
  line-height: 0.8;
}
.loader__sub {
  color: var(--champagne);
}
.loader__bar {
  width: min(240px, 60vw);
  height: 1px;
  background: var(--hair);
  overflow: hidden;
}
.loader__line {
  display: block;
  height: 100%;
  background: var(--bronze);
  transform: scaleX(0.15);
  transform-origin: 0 50%;
  animation: load 1.6s var(--ease-out) forwards;
}
@keyframes load {
  to {
    transform: scaleX(0.82);
  }
}
.loader__pct {
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}
</style>
