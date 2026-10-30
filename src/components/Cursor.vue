<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { gsap, isTouch, reducedMotion } from '../composables/useMotion.js'

const el = ref(null)
const hover = ref(false)
const hidden = ref(true)
const enabled = !isTouch && !reducedMotion.value
let xTo, yTo

function move(e) {
  hidden.value = false
  xTo(e.clientX)
  yTo(e.clientY)
}
function over(e) {
  hover.value = !!e.target.closest?.('a, button, [data-cursor], summary, label')
}
function leave() {
  hidden.value = true
}

onMounted(() => {
  if (!enabled) return
  xTo = gsap.quickTo(el.value, 'x', { duration: 0.35, ease: 'power3.out' })
  yTo = gsap.quickTo(el.value, 'y', { duration: 0.35, ease: 'power3.out' })
  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('pointerover', over, { passive: true })
  document.documentElement.addEventListener('pointerleave', leave)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerover', over)
  document.documentElement.removeEventListener('pointerleave', leave)
})
</script>

<template>
  <div v-if="enabled" ref="el" class="cursor" :class="{ 'is-hover': hover, 'is-hidden': hidden }" aria-hidden="true"></div>
</template>
