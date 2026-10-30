<script setup>
// The price list printed like a menu card on warm paper. On fine pointers the
// service photograph trails the cursor over the row being read.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useSite } from '../composables/useSite.js'
import { gsap, isTouch, reducedMotion, revealIn } from '../composables/useMotion.js'

const props = defineProps({ index: { type: String, default: '03' }, heading: { type: Boolean, default: true } })
const { t, services } = useSite()
const root = ref(null)
const preview = ref(null)
const current = ref(null)
const showPreview = !isTouch && !reducedMotion.value
let xTo, yTo, undo

function enter(s) {
  if (!showPreview) return
  current.value = s.image ? s : null
}
function move(e) {
  if (!xTo) return
  xTo(e.clientX)
  yTo(e.clientY)
}

onMounted(() => {
  undo = revealIn(root.value)
  if (!showPreview) return
  xTo = gsap.quickTo(preview.value, 'x', { duration: 0.7, ease: 'power3.out' })
  yTo = gsap.quickTo(preview.value, 'y', { duration: 0.7, ease: 'power3.out' })
})
onBeforeUnmount(() => undo?.())
</script>

<template>
  <section id="prices" ref="root" class="menu-card section" data-theme="light" @pointermove="move" @pointerleave="current = null">
    <div class="wrap">
      <div v-if="heading" class="section-head">
        <p v-if="props.index" class="index label" data-reveal>{{ props.index }}</p>
        <h2 class="serif menu-card__title" data-reveal>{{ t.nav.prices }}</h2>
      </div>

      <ol class="menu-card__list">
        <li v-for="s in services" :key="s.id" class="menu-card__row" @pointerenter="enter(s)">
          <span class="menu-card__num label">{{ String(s.index).padStart(2, '0') }}</span>
          <span class="menu-card__name serif">{{ s.title }}</span>
          <span class="menu-card__lead" aria-hidden="true"></span>
          <span class="menu-card__price serif">{{ s.price }} €</span>
        </li>
      </ol>
    </div>

    <div v-if="showPreview" ref="preview" class="menu-card__preview" :class="{ 'is-on': current }" aria-hidden="true">
      <div class="menu-card__preview-inner">
        <img v-for="s in services.filter((x) => x.image)" :key="s.id" :src="s.image.src" alt="" loading="lazy" :class="{ 'is-on': current && current.id === s.id }" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.menu-card {
  z-index: 2;
  --ink: var(--black);
  color: var(--black);
  background:
    radial-gradient(90% 60% at 10% 0%, rgba(255, 255, 255, 0.55), transparent 60%),
    radial-gradient(70% 70% at 100% 100%, rgba(152, 118, 83, 0.22), transparent 70%),
    var(--ivory);
}
.menu-card :deep(.index) {
  color: var(--espresso);
}
.menu-card :deep(.index)::after {
  background: rgba(48, 36, 30, 0.35);
}
.menu-card__title {
  color: var(--black);
}
.menu-card__list {
  border-top: 1px solid rgba(48, 36, 30, 0.28);
}
.menu-card__row {
  display: grid;
  grid-template-columns: 4.5em auto 1fr auto;
  align-items: baseline;
  gap: clamp(10px, 2vw, 28px);
  padding: clamp(14px, 1.6vw, 22px) 0;
  border-bottom: 1px solid rgba(48, 36, 30, 0.18);
  transition: padding 0.6s var(--ease-out), color 0.4s;
}
.menu-card__num {
  color: var(--bronze);
}
.menu-card__name {
  font-size: clamp(1.5rem, 2.8vw, 2.9rem);
  font-weight: 400;
  line-height: 1.08;
}
.menu-card__lead {
  border-bottom: 1px dotted rgba(48, 36, 30, 0.45);
  transform: translateY(-0.35em);
  min-width: 24px;
}
.menu-card__price {
  font-size: clamp(1.5rem, 2.8vw, 2.9rem);
  font-style: italic;
  white-space: nowrap;
  font-variant-numeric: lining-nums;
}
@media (hover: hover) {
  .menu-card__row:hover {
    padding-left: 18px;
    color: var(--espresso);
  }
}
.menu-card__preview {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 50;
  width: clamp(200px, 18vw, 300px);
  aspect-ratio: 4 / 5;
  translate: 28px -55%;
  pointer-events: none;
}
.menu-card__preview-inner {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  clip-path: inset(50% 50% 50% 50%);
  transition: clip-path 0.7s var(--ease-out);
  box-shadow: 0 30px 60px rgba(8, 8, 7, 0.35);
}
.menu-card__preview.is-on .menu-card__preview-inner {
  clip-path: inset(0% 0% 0% 0%);
}
.menu-card__preview img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.15);
  transition: opacity 0.5s, transform 1.2s var(--ease-out);
}
.menu-card__preview img.is-on {
  opacity: 1;
  transform: scale(1);
}
@media (max-width: 640px) {
  .menu-card__row {
    grid-template-columns: 2.4em 1fr auto;
    gap: 6px 12px;
  }
  .menu-card__lead {
    display: none;
  }
  .menu-card__name,
  .menu-card__price {
    font-size: 1.4rem;
  }
}
</style>
