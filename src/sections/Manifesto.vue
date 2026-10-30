<script setup>
// The shop's own one-line description, set as a scroll-inked statement,
// beside a parallax collage of the shop's gallery photographs.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useSite } from '../composables/useSite.js'
import { gsap, reducedMotion, revealIn } from '../composables/useMotion.js'
import logo from '../assets/logo.webp'
import station from '../assets/interior-station.webp'
import corridor from '../assets/interior-corridor.webp'

const { info } = useSite()
const root = ref(null)
const words = computed(() => info.value.description.split(/\s+/).filter(Boolean))
// gallery photos first, then two interior shots from the original site's design
const photos = computed(() => [...info.value.gallery, { src: station, w: 1920, h: 1336 }, { src: corridor, w: 1920, h: 1280 }].filter(Boolean))

let ctx
let undo
onMounted(() => {
  undo = revealIn(root.value)
  if (reducedMotion.value) return
  ctx = gsap.context(() => {
    gsap.fromTo(
      '.mf__w',
      { opacity: 0.14 },
      { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '.mf__statement', start: 'top 78%', end: 'bottom 45%', scrub: true } },
    )
    gsap.to('.mf__seal', { rotate: 120, ease: 'none', scrollTrigger: { trigger: root.value, start: 'top bottom', end: 'bottom top', scrub: true } })
  }, root.value)
})
onBeforeUnmount(() => {
  ctx?.revert()
  undo?.()
})
</script>

<template>
  <section id="about" ref="root" class="mf section">
    <div class="mf__grid wrap">
      <p class="mf__kicker label bronze" data-reveal>JZ Barbershop</p>
      <p class="mf__statement serif">
        <span v-for="(w, i) in words" :key="i" class="mf__w">{{ w + (i < words.length - 1 ? " " : "") }}</span>
      </p>

      <div class="mf__seal" aria-hidden="true">
        <svg viewBox="0 0 200 200">
          <defs>
            <path id="mf-circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
          </defs>
          <text>
            <textPath href="#mf-circle" startOffset="0">JZ CUTS &amp; SHAVE BARBERSHOP · DAUGAVPILS · </textPath>
          </text>
        </svg>
        <img :src="logo" alt="" width="120" height="120" loading="lazy" />
      </div>

      <figure v-for="(p, i) in photos.slice(0, 5)" :key="p.src" class="mf__ph frame frame--tone" :class="`mf__ph--${i}`">
        <img :src="p.src" :width="p.w" :height="p.h" alt="JZ Barbershop" loading="lazy" decoding="async" data-parallax="8" />
      </figure>
    </div>
  </section>
</template>

<style scoped>
.mf {
  z-index: 2;
  padding-top: clamp(120px, 16vw, 240px);
}
.mf__grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--gutter);
  align-items: start;
}
.mf__kicker {
  grid-column: 1 / span 3;
  grid-row: 1;
  padding-top: 1.2em;
}
.mf__statement {
  grid-column: 4 / -1;
  grid-row: 1;
  font-size: clamp(2.3rem, 5.4vw, 6rem);
  line-height: 1.02;
  letter-spacing: -0.025em;
  margin-bottom: clamp(60px, 9vw, 140px);
}
.mf__w {
  display: inline;
}
.mf__seal {
  grid-column: 1 / span 3;
  grid-row: 2;
  position: relative;
  width: clamp(140px, 15vw, 210px);
  aspect-ratio: 1;
  align-self: center;
}
.mf__seal svg {
  position: absolute;
  inset: 0;
  font-family: var(--sans);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 4.2px;
  fill: var(--champagne);
}
.mf__seal img {
  position: absolute;
  inset: 26%;
  width: 48%;
  height: 48%;
  border-radius: 50%;
  opacity: 0.9;
}
.mf__ph {
  overflow: hidden;
}
.mf__ph img {
  height: 116%;
  margin-top: -8%;
}
.mf__ph--0 {
  grid-column: 4 / span 4;
  grid-row: 2;
  aspect-ratio: 4 / 5;
}
.mf__ph--1 {
  grid-column: 9 / span 4;
  grid-row: 2;
  aspect-ratio: 1;
  margin-top: 30%;
}
.mf__ph--2 {
  grid-column: 2 / span 5;
  grid-row: 3;
  aspect-ratio: 16 / 11;
  margin-top: -8%;
}
.mf__ph--3 {
  grid-column: 8 / span 3;
  grid-row: 3;
  aspect-ratio: 3 / 4;
  margin-top: 10%;
}
.mf__ph--4 {
  grid-column: 4 / span 6;
  grid-row: 4;
  aspect-ratio: 16 / 9;
  margin-top: 4%;
}
@media (max-width: 760px) {
  .mf__kicker,
  .mf__statement {
    grid-column: 1 / -1;
  }
  .mf__statement {
    grid-row: 2;
    margin-bottom: 40px;
  }
  .mf__seal {
    grid-row: 3;
    grid-column: 1 / -1;
    justify-self: end;
  }
  .mf__ph--0 {
    grid-column: 1 / span 8;
    grid-row: 4;
  }
  .mf__ph--1 {
    grid-column: 6 / -1;
    grid-row: 5;
    margin-top: -20%;
  }
  .mf__ph--2 {
    grid-column: 1 / -1;
    grid-row: 6;
    margin-top: 0;
  }
  .mf__ph--3,
  .mf__ph--4 {
    display: none;
  }
}
</style>
