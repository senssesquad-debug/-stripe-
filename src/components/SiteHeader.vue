<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSite } from '../composables/useSite.js'
import { onScroll } from '../composables/useMotion.js'
import LangSwitch from './LangSwitch.vue'
import logo from '../assets/logo.webp'

const emit = defineEmits(['menu'])
defineProps({ menuOpen: Boolean })

const route = useRoute()
const { t, to, bookingUrl } = useSite()
const hidden = ref(false)
const scrolled = ref(false)
const light = ref(false)
const pages = ['home', 'team', 'services', 'prices', 'contacts']
const links = computed(() => pages.map((p) => ({ page: p, href: to(p), label: t.value.nav[p] })))

let last = 0
let off
onMounted(() => {
  off = onScroll(({ scroll }) => {
    const y = scroll ?? window.scrollY
    scrolled.value = y > 40
    hidden.value = y > 320 && y > last
    last = y
    // switch to dark ink while passing over light (paper) chapters
    const under = document.elementsFromPoint(window.innerWidth / 2, 40).find((el) => !el.closest('.header'))
    light.value = !!under?.closest('[data-theme="light"]')
  })
})
onBeforeUnmount(() => off?.())
</script>

<template>
  <header class="header" :class="{ 'is-hidden': hidden && !menuOpen, 'is-scrolled': scrolled, 'is-light': light && !menuOpen }">
    <RouterLink :to="to('home')" class="brand" aria-label="JZ Barbershop">
      <img :src="logo" alt="" width="44" height="44" class="brand__logo" />
      <span class="brand__name">JZ Barbershop</span>
    </RouterLink>

    <nav class="nav" aria-label="JZ Barbershop">
      <RouterLink
        v-for="l in links"
        :key="l.page"
        :to="l.href"
        class="nav__link link-line"
        :class="{ 'is-active': route.meta.page === l.page }"
        :aria-current="route.meta.page === l.page ? 'page' : undefined"
      >
        {{ l.label }}
      </RouterLink>
    </nav>

    <div class="tools">
      <LangSwitch class="tools__lang" />
      <a :href="bookingUrl" class="tools__book" data-cursor>{{ t.nav.booking }}</a>
      <button
        class="burger"
        type="button"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        aria-controls="site-menu"
        @click="emit('menu')"
      >
        <span class="burger__label">{{ menuOpen ? t.ui.close : t.ui.menu }}</span>
        <span class="burger__lines" :class="{ 'is-open': menuOpen }" aria-hidden="true"><i></i><i></i></span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 120;
  height: var(--header-h);
  color: var(--ink);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding-inline: var(--gutter);
  transition: transform 0.7s var(--ease-out), background-color 0.6s, color 0.6s, backdrop-filter 0.6s;
}
.header::after {
  content: '';
  position: absolute;
  left: var(--gutter);
  right: var(--gutter);
  bottom: 0;
  height: 1px;
  background: var(--hair);
  transform: scaleX(0);
  transition: transform 0.8s var(--ease-out);
}
.header.is-scrolled {
  background: rgba(8, 8, 7, 0.62);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
}
.header.is-scrolled::after {
  transform: scaleX(1);
}
.header.is-light {
  color: var(--black);
  background: rgba(240, 233, 222, 0.72);
}
.header.is-light::after {
  background: rgba(48, 36, 30, 0.2);
}
.header.is-light .nav__link {
  color: rgba(8, 8, 7, 0.62);
}
.header.is-light .nav__link:hover,
.header.is-light .nav__link.is-active {
  color: var(--black);
}
.header.is-light .tools__book {
  color: var(--espresso);
}
.header.is-light :deep(.lang__item) {
  color: rgba(8, 8, 7, 0.45);
}
.header.is-light :deep(.lang__item.is-current) {
  color: var(--black);
}
.header.is-hidden {
  transform: translateY(-100%);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  justify-self: start;
}
.brand__logo {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--hair-strong);
}
.brand__name {
  font-family: var(--serif);
  font-size: 1.35rem;
  font-weight: 400;
  letter-spacing: 0.01em;
}

.nav {
  display: flex;
  gap: clamp(18px, 2.2vw, 36px);
}
.nav__link {
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-soft);
  padding: 8px 0;
  transition: color 0.4s;
}
.nav__link:hover,
.nav__link.is-active {
  color: var(--ink);
}

.tools {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.6vw, 22px);
}
.tools__book {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 13px 20px;
  border: 1px solid var(--bronze);
  color: var(--champagne);
  transition: background 0.4s, color 0.4s;
}
.tools__book:hover {
  background: var(--bronze);
  color: var(--black);
}

.burger {
  display: none;
  align-items: center;
  gap: 12px;
  padding: 10px 0 10px 6px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}
.burger__lines {
  position: relative;
  width: 26px;
  height: 10px;
}
.burger__lines i {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: currentColor;
  transition: transform 0.6s var(--ease-out), top 0.6s var(--ease-out);
}
.burger__lines i:first-child {
  top: 0;
}
.burger__lines i:last-child {
  top: 9px;
}
.burger__lines.is-open i:first-child {
  top: 5px;
  transform: rotate(18deg);
}
.burger__lines.is-open i:last-child {
  top: 5px;
  transform: rotate(-18deg);
}

@media (max-width: 1180px) {
  .header {
    grid-template-columns: 1fr auto;
  }
  .nav {
    display: none;
  }
  .burger {
    display: inline-flex;
  }
}
@media (max-width: 640px) {
  .brand__logo {
    width: 38px;
    height: 38px;
  }
  .brand__name {
    font-size: 1.15rem;
  }
  .tools__book,
  .tools__lang {
    display: none;
  }
  .burger__label {
    display: none;
  }
}
</style>
