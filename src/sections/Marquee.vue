<script setup>
// A slow ribbon of the shop's name and address between chapters; speeds up
// with scroll velocity.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { gsap, ScrollTrigger, reducedMotion } from '../composables/useMotion.js'

defineProps({ items: { type: Array, required: true } })
const track = ref(null)
let tween, st
let boost = 0
let dir = 1
const decay = () => {
  boost *= 0.92
  tween.timeScale(dir * (1 + boost))
}

onMounted(() => {
  if (reducedMotion.value) return
  tween = gsap.to(track.value, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 })
  // start deep into the loop so scrolling up can run it backwards
  tween.totalTime(tween.duration() * 100)
  st = ScrollTrigger.create({
    trigger: track.value,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      dir = self.direction < 0 ? -1 : 1
      boost = Math.max(boost, Math.min(Math.abs(self.getVelocity()) / 300, 8))
    },
  })
  gsap.ticker.add(decay)
})
onBeforeUnmount(() => {
  gsap.ticker.remove(decay)
  tween?.kill()
  st?.kill()
})
</script>

<template>
  <div class="marquee" aria-hidden="true">
    <div ref="track" class="marquee__track">
      <template v-for="n in 2" :key="n">
        <span v-for="(it, i) in items" :key="`${n}-${i}`" class="marquee__item serif" :class="{ italic: i % 2 }">
          {{ it }}<i class="marquee__sep"></i>
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.marquee {
  position: relative;
  z-index: 2;
  overflow: hidden;
  padding: clamp(20px, 3vw, 40px) 0;
  border-block: 1px solid var(--hair);
  background: var(--black);
}
.marquee__track {
  display: flex;
  width: max-content;
}
.marquee__item {
  display: inline-flex;
  align-items: center;
  font-size: clamp(2.2rem, 5vw, 5rem);
  line-height: 1;
  white-space: nowrap;
  padding-right: 0.5em;
  color: var(--champagne);
}
.marquee__item.italic {
  color: transparent;
  -webkit-text-stroke: 1px var(--champagne);
}
.marquee__sep {
  display: inline-block;
  width: 0.9em;
  height: 1px;
  margin-left: 0.5em;
  background: var(--bronze);
}
</style>
