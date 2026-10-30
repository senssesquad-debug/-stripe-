<script setup>
// Wraps a link/button and lets it lean toward the pointer.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { gsap, isTouch, reducedMotion } from '../composables/useMotion.js'

const props = defineProps({ strength: { type: Number, default: 0.35 } })
const el = ref(null)
let xTo, yTo

function move(e) {
  const r = el.value.getBoundingClientRect()
  xTo((e.clientX - (r.left + r.width / 2)) * props.strength)
  yTo((e.clientY - (r.top + r.height / 2)) * props.strength)
}
function leave() {
  xTo(0)
  yTo(0)
}

onMounted(() => {
  if (isTouch || reducedMotion.value) return
  xTo = gsap.quickTo(el.value, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.45)' })
  yTo = gsap.quickTo(el.value, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.45)' })
  el.value.addEventListener('pointermove', move)
  el.value.addEventListener('pointerleave', leave)
})
onBeforeUnmount(() => {
  el.value?.removeEventListener('pointermove', move)
  el.value?.removeEventListener('pointerleave', leave)
})
</script>

<template>
  <span ref="el" class="magnetic"><slot /></span>
</template>

<style scoped>
.magnetic {
  display: inline-flex;
  will-change: transform;
}
</style>
