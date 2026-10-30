<script setup>
// Opening spread for inner pages: oversized title that rises letter by letter
// over a slow-drifting interior photograph.
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { gsap, reducedMotion } from '../composables/useMotion.js'
import { boot } from '../composables/useBoot.js'

const props = defineProps({
  title: { type: String, required: true },
  index: { type: String, default: '' },
  image: { type: String, default: '' },
})
const root = ref(null)
const words = computed(() => props.title.split(/\s+/).filter(Boolean).map((w) => Array.from(w)))
let ctx

onMounted(async () => {
  if (reducedMotion.value) return
  ctx = gsap.context(() => {
    gsap.set('.phero__char', { yPercent: 110 })
    gsap.set('.phero__meta', { opacity: 0, y: 14 })
  }, root.value)
  await boot.released
  ctx.add(() => {
    gsap.to('.phero__char', { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.035, delay: 0.15 })
    gsap.to('.phero__meta', { opacity: 1, y: 0, duration: 1, delay: 0.5, stagger: 0.08 })
    if (!props.image) return
    gsap.fromTo('.phero__img', { scale: 1.25 }, { scale: 1.05, duration: 2.4, ease: 'expo.out' })
    gsap.to('.phero__img', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: root.value, start: 'top top', end: 'bottom top', scrub: true } })
  })
})
onBeforeUnmount(() => ctx?.revert())
</script>

<template>
  <section ref="root" class="phero">
    <div v-if="image" class="phero__bg" aria-hidden="true">
      <img :src="image" alt="" class="phero__img" fetchpriority="high" />
    </div>
    <div class="phero__content wrap">
      <p v-if="index" class="phero__meta label bronze">{{ index }}</p>
      <h1 class="phero__title serif" :class="{ 'is-long': title.length > 11 }" :aria-label="title">
        <span class="mask" aria-hidden="true">
          <span class="phero__line">
            <template v-for="(w, wi) in words" :key="wi">
              <span class="phero__word"><span v-for="(c, i) in w" :key="i" class="phero__char">{{ c }}</span></span>{{ wi < words.length - 1 ? ' ' : '' }}
            </template>
          </span>
        </span>
      </h1>
      <div class="phero__meta phero__slot"><slot /></div>
    </div>
  </section>
</template>

<style scoped>
.phero {
  position: relative;
  min-height: clamp(520px, 82vh, 900px);
  display: flex;
  align-items: flex-end;
  padding-top: calc(var(--header-h) + 60px);
  padding-bottom: clamp(48px, 7vw, 96px);
  overflow: hidden;
  isolation: isolate;
}
.phero__bg {
  position: absolute;
  inset: 0;
  z-index: -1;
}
.phero__bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(8, 8, 7, 0.75) 0%, rgba(8, 8, 7, 0.35) 40%, var(--black) 100%),
    radial-gradient(70% 60% at 80% 30%, rgba(73, 55, 43, 0.35), transparent 70%);
}
.phero__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.7) contrast(1.05) brightness(0.8);
  transform: scale(1.05);
}
.phero__content {
  width: 100%;
  display: grid;
  gap: 18px;
}
.phero__title {
  font-size: var(--fs-mega);
  line-height: 0.86;
  letter-spacing: -0.035em;
  margin-left: -0.05em;
}
.phero__line {
  white-space: nowrap;
}
.phero__title.is-long {
  font-size: clamp(3rem, 9.6vw, 11rem);
}
.phero__title.is-long .phero__line {
  white-space: normal;
}
.phero__word {
  display: inline-block;
  white-space: nowrap;
}
.phero__char {
  display: inline-block;
}
.phero__slot {
  max-width: 640px;
}
.phero__slot:empty {
  display: none;
}
@media (max-width: 640px) {
  .phero__title {
    font-size: clamp(3.4rem, 17vw, 6rem);
  }
  .phero__line {
    white-space: normal;
  }
}
</style>
