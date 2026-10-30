<script setup>
// The shop's own online booking (service → barber → date → SMS-verified phone
// and name) runs inside this sheet, so bookings go through the real system
// without leaving the site.
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useSite } from '../composables/useSite.js'
import { useBooking } from '../composables/useBooking.js'
import { gsap, reducedMotion, lockScroll } from '../composables/useMotion.js'
import Icon from './Icon.vue'

const { t, bookingUrl } = useSite()
const { bookingOpen, closeBooking } = useBooking()
const root = ref(null)
const src = ref('')
const loaded = ref(false)
let opener = null

function onLoad() {
  if (src.value) loaded.value = true
}

watch(bookingOpen, async (open) => {
  lockScroll(open)
  if (open) {
    opener = document.activeElement
    // a new language means a new booking page; otherwise keep the form's state
    if (src.value !== bookingUrl.value) {
      loaded.value = false
      src.value = bookingUrl.value
    }
  }
  await nextTick()
  const el = root.value
  if (!el) return
  if (reducedMotion.value) {
    el.style.visibility = open ? 'visible' : 'hidden'
  } else if (open) {
    gsap.timeline().set(el, { visibility: 'visible' }).fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: 'expo.out' })
  } else {
    gsap.timeline().to(el, { yPercent: 100, duration: 0.6, ease: 'expo.in' }).set(el, { visibility: 'hidden' })
  }
  if (open) el.querySelector('.sheet__close')?.focus({ preventScroll: true })
  else opener?.focus?.({ preventScroll: true })
})

function onKey(e) {
  if (e.key === 'Escape' && bookingOpen.value) closeBooking()
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (bookingOpen.value) lockScroll(false)
  closeBooking()
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="root"
      class="sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="t.nav.booking"
      :aria-hidden="bookingOpen ? 'false' : 'true'"
      :inert="!bookingOpen || undefined"
      data-lenis-prevent
    >
      <header class="sheet__bar">
        <p class="sheet__title serif">{{ t.nav.booking }}</p>
        <a :href="bookingUrl" target="_blank" rel="noopener" class="sheet__ext label" :title="t.bookOnline">
          <Icon name="arrow-up-right" />
          <span>jzbarbershop.com</span>
        </a>
        <button type="button" class="sheet__close" :aria-label="t.ui.close" @click="closeBooking"><Icon name="close" /></button>
      </header>
      <div class="sheet__body">
        <div v-if="!loaded" class="sheet__loading" aria-hidden="true">
          <span class="serif">JZ</span>
          <i></i>
        </div>
        <iframe
          v-if="src"
          :src="src"
          :title="t.nav.booking"
          class="sheet__frame"
          :class="{ 'is-loaded': loaded }"
          allow="otp-credentials; clipboard-write"
          @load="onLoad"
        ></iframe>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet {
  position: fixed;
  inset: 0;
  z-index: 140;
  visibility: hidden;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--charcoal);
}
.sheet__bar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: var(--header-h);
  padding: 0 var(--gutter);
  padding-top: env(safe-area-inset-top);
  box-sizing: content-box;
  border-bottom: 1px solid var(--hair);
  background: var(--black);
}
.sheet__title {
  flex: 1;
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  line-height: 1;
}
.sheet__ext {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-soft);
  transition: color 0.3s;
}
.sheet__ext:hover {
  color: var(--ink);
}
.sheet__close {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--hair-strong);
  border-radius: 50%;
  transition: background 0.3s, color 0.3s;
}
.sheet__close:hover {
  background: var(--ivory);
  color: var(--black);
}
.sheet__body {
  position: relative;
  min-height: 0;
}
.sheet__frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: var(--charcoal);
  opacity: 0;
  transition: opacity 0.6s;
}
.sheet__frame.is-loaded {
  opacity: 1;
}
.sheet__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 18px;
}
.sheet__loading .serif {
  font-size: 4rem;
  line-height: 1;
  color: var(--champagne);
}
.sheet__loading i {
  width: 140px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--bronze), transparent);
  animation: sweep 1.4s var(--ease-inout) infinite;
}
@keyframes sweep {
  0% { transform: scaleX(0.1); opacity: 0.3; }
  50% { transform: scaleX(1); opacity: 1; }
  100% { transform: scaleX(0.1); opacity: 0.3; }
}
@media (max-width: 560px) {
  .sheet__ext span {
    display: none;
  }
}
</style>
