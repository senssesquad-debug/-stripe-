<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useSite } from '../composables/useSite.js'
import { gsap, reducedMotion, lockScroll } from '../composables/useMotion.js'
import LangSwitch from './LangSwitch.vue'
import Icon from './Icon.vue'
import imgPosters from '../assets/interior-posters.webp'
import imgCorridor from '../assets/interior-corridor.webp'
import imgFloor from '../assets/interior-floor.webp'
import imgStation from '../assets/interior-station.webp'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])
const route = useRoute()
const { t, to, info, hours, bookingUrl } = useSite()

const root = ref(null)
const active = ref(0)
const images = [imgFloor, imgPosters, imgStation, imgCorridor, imgFloor, imgStation]

const items = computed(() => [
  ...['home', 'team', 'services', 'prices', 'contacts'].map((p) => ({ key: p, label: t.value.nav[p], href: to(p), internal: true })),
  { key: 'booking', label: t.value.nav.booking, href: bookingUrl.value, internal: false },
])

let tl
watch(
  () => props.open,
  async (open) => {
    lockScroll(open)
    await nextTick()
    const el = root.value
    if (!el) return
    tl?.kill()
    if (reducedMotion.value) {
      el.style.visibility = open ? 'visible' : 'hidden'
      el.style.clipPath = 'none'
    } else if (open) {
      tl = gsap
        .timeline()
        .set(el, { visibility: 'visible' })
        .fromTo(el, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' })
        .fromTo(el.querySelectorAll('.menu__item-inner'), { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.06, ease: 'expo.out' }, '-=0.45')
        .fromTo(el.querySelectorAll('[data-menu-fade]'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05 }, '-=0.8')
    } else {
      tl = gsap
        .timeline()
        .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: 'expo.inOut' })
        .set(el, { visibility: 'hidden' })
    }
    if (open) el.querySelector('a')?.focus({ preventScroll: true })
  },
)

watch(
  () => route.fullPath,
  () => props.open && emit('close'),
)

function onKey(e) {
  if (e.key === 'Escape' && props.open) emit('close')
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  lockScroll(false)
})
</script>

<template>
  <div
    id="site-menu"
    ref="root"
    class="menu"
    role="dialog"
    aria-modal="true"
    :aria-label="t.ui.menu"
    :aria-hidden="open ? 'false' : 'true'"
    :inert="!open || undefined"
  >
    <div class="menu__visual" aria-hidden="true">
      <img v-for="(src, i) in images" :key="i" :src="src" alt="" :class="{ 'is-on': i === active }" loading="lazy" />
    </div>

    <nav class="menu__nav" :aria-label="t.ui.menu">
      <ol>
        <li v-for="(item, i) in items" :key="item.key" class="menu__item" @pointerenter="active = i">
          <component
            :is="item.internal ? 'RouterLink' : 'a'"
            v-bind="item.internal ? { to: item.href } : { href: item.href }"
            class="menu__link"
            :class="{ 'is-active': route.meta.page === item.key }"
            @focus="active = i"
          >
            <span class="menu__item-inner">
              <span class="menu__num label">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="menu__text serif">{{ item.label }}</span>
            </span>
          </component>
        </li>
      </ol>
    </nav>

    <aside class="menu__aside">
      <div data-menu-fade>
        <p class="label faint">{{ t.contactsTitle }}</p>
        <a :href="`tel:${info.phone}`" class="menu__big">{{ info.phoneDisplay }}</a>
        <a :href="`mailto:${info.email}`" class="link-line muted">{{ info.email }}</a>
        <a :href="info.map" target="_blank" rel="noopener" class="link-line muted">{{ info.address }}</a>
      </div>
      <div data-menu-fade>
        <p class="label faint">{{ t.workingHours }}</p>
        <dl class="menu__hours">
          <template v-for="h in hours" :key="h.day">
            <dt :class="{ 'is-today': h.today }">{{ h.day }}</dt>
            <dd :class="{ 'is-closed': h.closed, 'is-today': h.today }">{{ h.value }}</dd>
          </template>
        </dl>
      </div>
      <div class="menu__foot" data-menu-fade>
        <LangSwitch />
        <div class="menu__social">
          <a :href="info.fb" target="_blank" rel="noopener" aria-label="Facebook"><Icon name="facebook" /></a>
          <a :href="info.ig" target="_blank" rel="noopener" aria-label="Instagram"><Icon name="instagram" /></a>
          <a :href="info.whatsapp" target="_blank" rel="noopener" aria-label="WhatsApp"><Icon name="whatsapp" /></a>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.menu {
  position: fixed;
  inset: 0;
  z-index: 110;
  visibility: hidden;
  clip-path: inset(0% 0% 100% 0%);
  background: radial-gradient(120% 90% at 85% 10%, #2a1f19 0%, var(--charcoal) 45%, var(--black) 100%);
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  grid-template-rows: 1fr;
  padding: calc(var(--header-h) + 32px) var(--gutter) 36px;
  gap: var(--gutter);
  overflow-y: auto;
}
.menu__visual {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 34vw;
  opacity: 0.22;
  pointer-events: none;
  mask-image: linear-gradient(90deg, transparent, #000 60%);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 60%);
}
.menu__visual img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.08);
  transition: opacity 0.9s var(--ease-out), transform 1.6s var(--ease-out);
}
.menu__visual img.is-on {
  opacity: 1;
  transform: scale(1);
}
.menu__nav {
  position: relative;
  align-self: center;
}
.menu__item {
  overflow: hidden;
  border-bottom: 1px solid var(--hair);
}
.menu__link {
  display: block;
  padding: clamp(6px, 1vw, 12px) 0;
}
.menu__item-inner {
  display: flex;
  align-items: baseline;
  gap: clamp(16px, 2.6vw, 40px);
}
.menu__num {
  color: var(--bronze);
  min-width: 2.4em;
}
.menu__text {
  font-size: clamp(2.6rem, 6.4vw, 6.4rem);
  line-height: 1.02;
  transition: transform 0.7s var(--ease-out), color 0.5s;
}
.menu__link:hover .menu__text,
.menu__link:focus-visible .menu__text {
  transform: translateX(18px);
  font-style: italic;
  color: var(--champagne);
}
.menu__link.is-active .menu__text {
  font-style: italic;
  color: var(--champagne);
}
.menu__aside {
  position: relative;
  align-self: end;
  display: grid;
  gap: 40px;
  max-width: 420px;
  justify-self: end;
  width: 100%;
}
.menu__aside > div {
  display: grid;
  gap: 8px;
}
.menu__big {
  font-family: var(--serif);
  font-size: clamp(1.8rem, 2.6vw, 2.6rem);
  line-height: 1.1;
}
.menu__hours {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 20px;
  font-size: 0.88rem;
  color: var(--ink-soft);
}
.menu__hours dd {
  font-variant-numeric: tabular-nums;
}
.menu__hours .is-closed {
  color: var(--ink-faint);
}
.menu__hours .is-today {
  color: var(--champagne);
}
.menu__foot {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--hair);
  padding-top: 18px;
}
.menu__social {
  display: flex;
  gap: 18px;
  font-size: 1.1rem;
}
.menu__social a {
  color: var(--ink-soft);
  transition: color 0.3s;
}
.menu__social a:hover {
  color: var(--ivory);
}

@media (max-width: 900px) {
  .menu {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    align-content: start;
    gap: 48px;
  }
  .menu__visual {
    width: 100%;
    opacity: 0.12;
  }
  .menu__aside {
    justify-self: stretch;
    max-width: none;
    gap: 28px;
  }
}
</style>
