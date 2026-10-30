<script setup>
// The shop's latest Facebook posts (same feed the original home page shows):
// a draggable filmstrip with a zoom view and a link to each post.
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useSite, media } from '../composables/useSite.js'
import { revealIn, lockScroll } from '../composables/useMotion.js'
import Icon from '../components/Icon.vue'

defineProps({ index: { type: String, default: '05' } })
const { t, feed, info } = useSite()
const root = ref(null)
const strip = ref(null)
const zoomed = ref(-1)
const dialog = ref(null)

const posts = computed(() =>
  feed.value.map((p, i) => ({
    ...p,
    n: i + 1,
    img: media(p.image),
    date: new Date(p.created_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Europe/Riga' }).toUpperCase(),
    video: (p.type || '').includes('video'),
  })),
)

function step(dir) {
  const el = strip.value
  const card = el.querySelector('.post')
  const w = card ? card.getBoundingClientRect().width + 24 : 360
  el.scrollBy({ left: dir * w, behavior: 'smooth' })
}

// mouse drag to scroll (touch scrolls natively)
let down = false
let startX = 0
let startLeft = 0
let moved = false
function pdown(e) {
  if (e.pointerType !== 'mouse') return
  down = true
  moved = false
  startX = e.clientX
  startLeft = strip.value.scrollLeft
}
function pmove(e) {
  if (!down) return
  const dx = e.clientX - startX
  if (Math.abs(dx) > 4) moved = true
  strip.value.scrollLeft = startLeft - dx
}
function pup() {
  down = false
}
function guardClick(e) {
  if (moved) {
    e.preventDefault()
    e.stopPropagation()
  }
}

async function openZoom(i) {
  zoomed.value = i
  lockScroll(true)
  await nextTick()
  dialog.value?.focus()
}
function closeZoom() {
  zoomed.value = -1
  lockScroll(false)
}
function zoomStep(d) {
  const n = posts.value.length
  let i = zoomed.value
  // skip posts without a picture
  for (let k = 0; k < n; k++) {
    i = (i + d + n) % n
    if (posts.value[i].img) break
  }
  zoomed.value = i
}
function key(e) {
  if (zoomed.value < 0) return
  if (e.key === 'Escape') closeZoom()
  if (e.key === 'ArrowRight') zoomStep(1)
  if (e.key === 'ArrowLeft') zoomStep(-1)
}

let undo
onMounted(() => {
  undo = revealIn(root.value)
  window.addEventListener('keydown', key)
  window.addEventListener('pointerup', pup)
})
onBeforeUnmount(() => {
  undo?.()
  window.removeEventListener('keydown', key)
  window.removeEventListener('pointerup', pup)
  if (zoomed.value >= 0) lockScroll(false)
})
</script>

<template>
  <section v-if="posts.length" id="journal" ref="root" class="journal section">
    <div class="wrap journal__head">
      <div class="section-head">
        <p class="index label" data-reveal>{{ index }}</p>
        <h2 class="serif" data-reveal>
          <a :href="info.fb" target="_blank" rel="noopener" class="journal__fb">Facebook <Icon name="arrow-up-right" /></a>
        </h2>
      </div>
      <div class="journal__nav">
        <button type="button" class="journal__btn" :aria-label="t.ui.prev" @click="step(-1)"><Icon name="arrow" style="transform: scaleX(-1)" /></button>
        <button type="button" class="journal__btn" :aria-label="t.ui.next" @click="step(1)"><Icon name="arrow" /></button>
      </div>
    </div>

    <div
      ref="strip"
      class="journal__strip"
      tabindex="0"
      aria-label="Facebook"
      @pointerdown="pdown"
      @pointermove="pmove"
      @click.capture="guardClick"
    >
      <article v-for="(p, i) in posts" :key="p.id" class="post" data-reveal="fade" :data-delay="Math.min(i, 4) * 0.08">
        <figure class="post__img frame">
          <img v-if="p.img" :src="p.img.src" alt="" loading="lazy" decoding="async" draggable="false" />
          <span v-if="p.video" class="post__play" aria-hidden="true"><Icon name="play" /></span>
          <button v-if="p.img" type="button" class="post__zoom label" @click="openZoom(i)">
            <Icon name="zoom" /> {{ t.zoom }}
          </button>
        </figure>
        <div class="post__meta label">
          <span>{{ p.date }}</span>
          <span class="faint">POST {{ p.n }} / {{ posts.length }}</span>
        </div>
        <p class="post__msg">{{ p.message }}</p>
        <a :href="p.permalink_url" target="_blank" rel="noopener" class="post__open label">
          <Icon name="facebook" /> {{ t.open }}
        </a>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="zoomed >= 0 && posts[zoomed]?.img"
        ref="dialog"
        class="zoom"
        role="dialog"
        aria-modal="true"
        :aria-label="t.zoom"
        tabindex="-1"
        data-lenis-prevent
        @click.self="closeZoom"
      >
        <button type="button" class="zoom__close" :aria-label="t.ui.close" @click="closeZoom"><Icon name="close" /></button>
        <figure class="zoom__fig">
          <img :src="posts[zoomed].img.src" alt="" />
          <figcaption>
            <span class="label">{{ posts[zoomed].date }} · POST {{ posts[zoomed].n }} / {{ posts.length }}</span>
            <span>{{ posts[zoomed].message }}</span>
            <a :href="posts[zoomed].permalink_url" target="_blank" rel="noopener" class="post__open label"><Icon name="facebook" /> {{ t.open }}</a>
          </figcaption>
        </figure>
        <button type="button" class="zoom__step zoom__step--prev" :aria-label="t.ui.prev" @click="zoomStep(-1)"><Icon name="arrow" style="transform: scaleX(-1)" /></button>
        <button type="button" class="zoom__step zoom__step--next" :aria-label="t.ui.next" @click="zoomStep(1)"><Icon name="arrow" /></button>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.journal {
  z-index: 2;
  background: linear-gradient(180deg, var(--black), var(--charcoal));
  border-top: 1px solid var(--hair);
}
.journal__head {
  position: relative;
}
.journal__fb {
  display: inline-flex;
  align-items: center;
  gap: 0.15em;
  transition: color 0.4s;
}
.journal__fb:hover {
  color: var(--champagne);
}
.journal__fb .icon {
  width: 0.45em;
  height: 0.45em;
}
.journal__nav {
  position: absolute;
  right: var(--gutter);
  bottom: clamp(48px, 7vw, 110px);
  display: flex;
  gap: 10px;
}
.journal__btn {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 1px solid var(--hair-strong);
  border-radius: 50%;
  transition: background 0.4s, color 0.4s;
}
.journal__btn:hover {
  background: var(--ivory);
  color: var(--black);
}
.journal__strip {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  padding: 0 var(--gutter) 8px;
  scroll-snap-type: x proximity;
  scroll-padding-inline: var(--gutter);
  scrollbar-width: none;
  cursor: grab;
  overscroll-behavior-x: contain;
  user-select: none;
}
.journal__strip::-webkit-scrollbar {
  display: none;
}
.journal__strip:active {
  cursor: grabbing;
}
.post {
  flex: none;
  width: clamp(260px, 24vw, 380px);
  display: grid;
  gap: 14px;
  align-content: start;
  scroll-snap-align: start;
}
.post__img {
  aspect-ratio: 4 / 5;
}
.post__img img {
  transition: transform 1.2s var(--ease-out);
  pointer-events: none;
}
.post:hover .post__img img {
  transform: scale(1.05);
}
.post__play {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(8, 8, 7, 0.6);
  backdrop-filter: blur(6px);
  font-size: 0.8rem;
}
.post__zoom {
  position: absolute;
  left: 14px;
  bottom: 14px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--ivory);
  color: var(--black);
  transform: translateY(8px);
  opacity: 0;
  transition: opacity 0.4s, transform 0.6s var(--ease-out);
}
.post:hover .post__zoom,
.post__zoom:focus-visible {
  opacity: 1;
  transform: none;
}
@media (hover: none) {
  .post__zoom {
    opacity: 1;
    transform: none;
  }
}
.post__meta {
  display: flex;
  justify-content: space-between;
  color: var(--champagne);
}
.post__msg {
  font-size: 0.95rem;
  color: var(--ink-soft);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-line;
}
.post__open {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  justify-self: start;
  padding: 10px 0;
  color: var(--ink);
  border-bottom: 1px solid var(--bronze);
}

.zoom {
  position: fixed;
  inset: 0;
  z-index: 170;
  display: grid;
  place-items: center;
  padding: 72px var(--gutter);
  background: rgba(8, 8, 7, 0.94);
  backdrop-filter: blur(10px);
  animation: zoomIn 0.5s var(--ease-out);
}
@keyframes zoomIn {
  from {
    opacity: 0;
  }
}
.zoom:focus {
  outline: none;
}
.zoom__fig {
  display: grid;
  grid-template-columns: auto minmax(0, 340px);
  gap: 32px;
  align-items: end;
  max-height: 100%;
}
.zoom__fig img {
  max-height: calc(100vh - 160px);
  max-width: min(70vw, 900px);
  object-fit: contain;
}
.zoom__fig figcaption {
  display: grid;
  gap: 14px;
  color: var(--ink-soft);
  white-space: pre-line;
}
.zoom__close {
  position: absolute;
  top: 18px;
  right: var(--gutter);
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border: 1px solid var(--hair-strong);
  border-radius: 50%;
}
.zoom__step {
  position: absolute;
  top: 50%;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border: 1px solid var(--hair-strong);
  border-radius: 50%;
  background: rgba(8, 8, 7, 0.5);
}
.zoom__step--prev {
  left: 12px;
}
.zoom__step--next {
  right: 12px;
}
@media (max-width: 760px) {
  .journal__nav {
    display: none;
  }
  .post {
    width: 76vw;
  }
  .zoom__fig {
    grid-template-columns: 1fr;
    justify-items: center;
  }
  .zoom__fig img {
    max-width: 100%;
    max-height: 62vh;
  }
  .zoom__step {
    top: auto;
    bottom: 16px;
  }
}
</style>
