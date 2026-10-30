<script setup>
// Gentle perspective tilt toward the pointer; inert on touch and reduced motion.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { gsap, isTouch, reducedMotion } from '../composables/useMotion.js'

const props = defineProps({ max: { type: Number, default: 7 }, tag: { type: String, default: 'div' } })
const el = ref(null)
let rx, ry

function move(e) {
  const r = el.value.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width - 0.5
  const py = (e.clientY - r.top) / r.height - 0.5
  ry(px * props.max)
  rx(-py * props.max)
  el.value.style.setProperty('--gx', `${(px + 0.5) * 100}%`)
  el.value.style.setProperty('--gy', `${(py + 0.5) * 100}%`)
}
function leave() {
  rx(0)
  ry(0)
}
onMounted(() => {
  if (isTouch || reducedMotion.value) return
  rx = gsap.quickTo(el.value, 'rotationX', { duration: 0.9, ease: 'power3.out' })
  ry = gsap.quickTo(el.value, 'rotationY', { duration: 0.9, ease: 'power3.out' })
  gsap.set(el.value, { transformPerspective: 900 })
  el.value.addEventListener('pointermove', move)
  el.value.addEventListener('pointerleave', leave)
})
onBeforeUnmount(() => {
  el.value?.removeEventListener('pointermove', move)
  el.value?.removeEventListener('pointerleave', leave)
})
</script>

<template>
  <component :is="tag" ref="el" class="tilt"><slot /></component>
</template>

<style scoped>
.tilt {
  transform-style: preserve-3d;
  will-change: transform;
}
</style>
