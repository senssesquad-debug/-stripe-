<script setup>
// Entry page (/): choose the location, as on the original site.
import { onMounted, ref } from 'vue'
import { useSite, preferredLang } from '../composables/useSite.js'
import { gsap, reducedMotion } from '../composables/useMotion.js'
import { boot } from '../composables/useBoot.js'
import Icon from '../components/Icon.vue'
import bg from '../assets/interior-corridor.webp'
import logo from '../assets/logo.webp'

const { countries } = useSite()
const lang = preferredLang()
const root = ref(null)

onMounted(async () => {
  if (reducedMotion.value) return
  gsap.set(root.value.querySelectorAll('[data-in]'), { opacity: 0, y: 30 })
  await boot.released
  gsap.to(root.value.querySelectorAll('[data-in]'), { opacity: 1, y: 0, duration: 1.4, stagger: 0.1, ease: 'expo.out' })
  gsap.fromTo(root.value.querySelector('.loc__bg img'), { scale: 1.2 }, { scale: 1, duration: 3, ease: 'expo.out' })
})
</script>

<template>
  <main id="main" ref="root" class="loc">
    <div class="loc__bg" aria-hidden="true"><img :src="bg" alt="" /></div>
    <img :src="logo" alt="JZ Cuts & Shave Barbershop" class="loc__logo" width="120" height="120" data-in />
    <div v-for="c in countries" :key="c.code" class="loc__country">
      <p class="label bronze" data-in>{{ c.title }}</p>
      <h1 class="loc__title serif" data-in>JZ Barbershop</h1>
      <ul class="loc__list">
        <li v-for="d in c.departments" :key="d.code" data-in>
          <RouterLink :to="`/${lang}/${d.code}/home`" class="loc__dept" data-cursor>
            <span class="serif italic">{{ d.title }}</span>
            <Icon name="arrow" />
          </RouterLink>
        </li>
      </ul>
    </div>
  </main>
</template>

<style scoped>
.loc {
  position: relative;
  min-height: 100vh;
  min-height: 100svh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 40px;
  padding: 60px var(--gutter);
  text-align: center;
  overflow: hidden;
  isolation: isolate;
}
.loc__bg {
  position: absolute;
  inset: 0;
  z-index: -1;
}
.loc__bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.32) saturate(0.6) sepia(0.2);
}
.loc__bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(70% 60% at 50% 50%, transparent, var(--black) 90%);
}
.loc__logo {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  border: 1px solid var(--hair-strong);
}
.loc__country {
  display: grid;
  justify-items: center;
  gap: 16px;
}
.loc__title {
  font-size: var(--fs-xl);
}
.loc__dept {
  display: inline-flex;
  align-items: center;
  gap: 24px;
  margin-top: 12px;
  padding: 18px 34px;
  border: 1px solid var(--hair-strong);
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  transition: background 0.5s, color 0.5s, gap 0.6s var(--ease-out);
}
.loc__dept:hover {
  background: var(--ivory);
  color: var(--black);
  gap: 36px;
}
</style>
