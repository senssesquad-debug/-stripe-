<script setup>
import { computed, onMounted } from 'vue'
import { useSite } from '../composables/useSite.js'
import { gsap, ScrollTrigger, reducedMotion } from '../composables/useMotion.js'
import { boot } from '../composables/useBoot.js'
import backdrop from '../assets/interior-floor.webp'
import RazorStage from '../components/RazorStage.vue'
import HomeHero from '../sections/HomeHero.vue'
import Manifesto from '../sections/Manifesto.vue'
import Marquee from '../sections/Marquee.vue'
import ServicesReel from '../sections/ServicesReel.vue'
import PriceMenu from '../sections/PriceMenu.vue'
import TeamGallery from '../sections/TeamGallery.vue'
import Journal from '../sections/Journal.vue'
import BookingSteps from '../sections/BookingSteps.vue'
import ContactSection from '../sections/ContactSection.vue'

const { info, t } = useSite()
const ribbon = computed(() => ['JZ Cuts & Shave', info.value.address, t.value.nav.services, t.value.nav.team, info.value.phoneDisplay])

// Razor choreography. Each pose is reached when its trigger hits its start;
// v is the 3D layer's opacity, so the razor can bow out behind solid chapters.
const poses = (desktop) => {
  const heroOpen = desktop
    ? { open: 1, rx: 0.32, ry: -0.42, rz: 0.24, x: 2.6, y: 0.2, z: 0, s: 0.62, v: 1, bg: 1 }
    : { open: 1, rx: 0.3, ry: -0.35, rz: 0.38, x: 0, y: 3.4, z: 0, s: 0.3, v: 1, bg: 1 }
  const heroCut = { open: 1, rx: 1.22, ry: 0.05, rz: -0.02, x: -1.4, y: -0.1, z: 1, s: 0.8, v: 1, bg: 0.35 }
  const about = desktop
    ? { open: 0.5, rx: 0.45, ry: 0.95, rz: -0.6, x: -7.2, y: -0.6, z: 0, s: 0.5, v: 1, bg: 0 }
    : { open: 0.5, rx: 0.4, ry: 0.9, rz: -0.5, x: 0, y: 6, z: -2, s: 0.3, v: 0, bg: 0 }
  const booking = desktop
    ? { open: 0.08, rx: 0.25, ry: -0.7, rz: 1.35, x: 5.6, y: 3.4, z: -2, s: 0.4, v: 1, bg: 0 }
    : { open: 0.08, rx: 0.25, ry: -0.7, rz: 1.25, x: 1.8, y: 3.4, z: -3, s: 0.3, v: 0, bg: 0 }
  const hide = (p) => ({ ...p, v: 0 })

  const frames = [{ trigger: '#hero', start: 'top top', state: heroOpen }]
  if (desktop) frames.push({ trigger: '#about', start: 'top bottom', state: heroCut })
  frames.push(
    { trigger: '#about', start: 'top 20%', state: about },
    { trigger: '#about', start: 'bottom 70%', state: about },
    { trigger: '#services', start: 'top 55%', state: hide(about) },
    { trigger: '#booking', start: 'top bottom', state: hide(booking) },
    { trigger: '#booking', start: 'top 30%', state: booking },
    { trigger: '#booking', start: 'bottom 60%', state: booking },
    { trigger: '#contacts', start: 'top 70%', state: hide(booking) },
  )
  return frames
}
const intro = { open: 0, rx: 1.1, ry: -1.6, rz: 0.9, y: -1.5, s: 0.42 }

onMounted(async () => {
  // children have created their pins by now; re-measure in page order,
  // and again once late images/fonts have settled the layout
  const remeasure = () => {
    ScrollTrigger.sort()
    ScrollTrigger.refresh()
  }
  remeasure()
  requestAnimationFrame(() => requestAnimationFrame(remeasure))
  document.fonts?.ready.then(remeasure)
  if (reducedMotion.value) return
  const img = document.querySelector('.home-backdrop img')
  gsap.set(img, { scale: 1.2, opacity: 0 })
  await boot.released
  gsap.to(img, { scale: 1.04, opacity: 1, duration: 2.8, ease: 'expo.out' })
})
</script>

<template>
  <RazorStage :keyframes="poses" :intro="intro">
    <template #backdrop>
      <div class="home-backdrop">
        <img :src="backdrop" alt="" fetchpriority="high" />
      </div>
    </template>
  </RazorStage>
  <HomeHero />
  <Manifesto />
  <Marquee :items="ribbon" />
  <ServicesReel index="01" />
  <PriceMenu index="02" />
  <TeamGallery index="03" />
  <Journal index="04" />
  <BookingSteps index="05" />
  <ContactSection index="06" />
</template>

<style scoped>
.home-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.home-backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.5) brightness(0.36) contrast(1.12) sepia(0.3);
}
.home-backdrop::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(55% 55% at 64% 50%, rgba(152, 118, 83, 0.26), transparent 70%),
    radial-gradient(120% 90% at 50% 50%, transparent 30%, rgba(8, 8, 7, 0.94) 85%),
    linear-gradient(180deg, rgba(8, 8, 7, 0.55), transparent 30%, transparent 65%, var(--black));
}
</style>
