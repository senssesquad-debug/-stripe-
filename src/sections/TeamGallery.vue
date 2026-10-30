<script setup>
// The barbers as an editorial contact sheet: three columns drifting at
// different speeds, names set large across each portrait.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useSite } from '../composables/useSite.js'
import { gsap, reducedMotion, revealIn, isDesktop } from '../composables/useMotion.js'
import TiltCard from '../components/TiltCard.vue'

const props = defineProps({
  index: { type: String, default: '04' },
  full: { type: Boolean, default: false },
  heading: { type: Boolean, default: true },
})
const { t, team, to } = useSite()
const root = ref(null)

const columns = computed(() => {
  const cols = [[], [], []]
  team.value.forEach((m, i) => cols[i % 3].push({ ...m, n: i + 1 }))
  return cols
})

let ctx, undo
onMounted(() => {
  undo = revealIn(root.value)
  if (reducedMotion.value || !isDesktop()) return
  ctx = gsap.context(() => {
    ;[-3, 6, -1].forEach((amt, i) => {
      gsap.fromTo(
        `.team__col--${i}`,
        { yPercent: -amt },
        { yPercent: amt, ease: 'none', scrollTrigger: { trigger: '.team__cols', start: 'top bottom', end: 'bottom top', scrub: true } },
      )
    })
  }, root.value)
})
onBeforeUnmount(() => {
  ctx?.revert()
  undo?.()
})
</script>

<template>
  <section id="team" ref="root" class="team section" :class="{ 'team--full': full }">
    <div class="wrap">
      <div v-if="heading" class="section-head">
        <p v-if="props.index" class="index label" data-reveal>{{ props.index }}</p>
        <h2 class="serif" data-reveal>{{ t.nav.team }}</h2>
      </div>

      <div class="team__cols">
        <div v-for="(col, ci) in columns" :key="ci" class="team__col" :class="`team__col--${ci}`">
          <article v-for="m in col" :key="m.id" class="member" :style="{ order: m.n }">
            <TiltCard class="member__card">
              <figure class="member__photo frame" data-reveal="mask">
                <img :src="m.photo.src" :width="m.photo.w" :height="m.photo.h" :alt="m.name" loading="lazy" decoding="async" />
              </figure>
              <span class="member__no label" aria-hidden="true">{{ String(m.n).padStart(2, '0') }}</span>
              <h3 class="member__name serif">{{ m.name }}</h3>
            </TiltCard>
            <p class="member__desc muted">{{ m.description }}</p>
            <details v-if="full" class="member__services">
              <summary class="label">
                <span>{{ t.nav.services }}</span>
                <span class="faint">{{ m.services.length }}</span>
              </summary>
              <ul>
                <li v-for="s in m.services" :key="s">{{ s }}</li>
              </ul>
            </details>
          </article>
        </div>
      </div>

      <div v-if="!full" class="team__more" data-reveal>
        <RouterLink :to="to('team')" class="btn" data-cursor>{{ t.nav.team }}</RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.team {
  z-index: 2;
  background: var(--black);
}
.team__cols {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(20px, 3vw, 56px);
  align-items: start;
}
.team__col {
  display: grid;
  gap: clamp(60px, 8vw, 140px);
}
.team__col--1 {
  padding-top: clamp(80px, 14vw, 240px);
}
.team__col--2 {
  padding-top: clamp(30px, 5vw, 90px);
}
.member {
  display: grid;
  gap: 18px;
}
.member__card {
  position: relative;
}
.member__photo {
  aspect-ratio: 5 / 6;
}
.member__photo img {
  filter: grayscale(0.55) contrast(1.05) brightness(0.9);
  transition: filter 0.9s var(--ease-out), scale 1.4s var(--ease-out);
}
.member:hover .member__photo img {
  filter: grayscale(0) contrast(1) brightness(1);
  scale: 1.04;
}
.member__photo::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(40% 40% at var(--gx, 50%) var(--gy, 30%), rgba(214, 195, 165, 0.18), transparent 70%);
  opacity: 0;
  transition: opacity 0.6s;
}
.member:hover .member__photo::before {
  opacity: 1;
}
.member__no {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
  color: var(--champagne);
}
.member__name {
  position: absolute;
  left: -0.04em;
  bottom: -0.32em;
  z-index: 2;
  font-size: clamp(3rem, 6.2vw, 6.8rem);
  font-weight: 300;
  letter-spacing: -0.03em;
  transform: translateZ(40px);
  text-shadow: 0 10px 40px rgba(8, 8, 7, 0.6);
}
.member__desc {
  margin-top: clamp(26px, 2.6vw, 44px);
  max-width: 36ch;
  font-size: 0.95rem;
}
.member__services {
  border-top: 1px solid var(--hair);
  padding-top: 12px;
}
.member__services summary {
  display: flex;
  justify-content: space-between;
  cursor: pointer;
  list-style: none;
  padding: 6px 0;
  color: var(--champagne);
}
.member__services summary::-webkit-details-marker {
  display: none;
}
.member__services summary::after {
  content: '+';
  font-size: 1rem;
  line-height: 1;
  margin-left: 12px;
  transition: transform 0.4s var(--ease-out);
}
.member__services[open] summary::after {
  transform: rotate(45deg);
}
.member__services summary .faint {
  margin-left: auto;
}
.member__services ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 0;
  padding: 10px 0 4px;
  font-size: 0.85rem;
  color: var(--ink-soft);
}
.member__services li:not(:last-child)::after {
  content: '/';
  margin: 0 10px;
  color: var(--bronze);
}
.team__more {
  display: flex;
  justify-content: center;
  margin-top: clamp(80px, 10vw, 160px);
}
@media (max-width: 900px) {
  .team__cols {
    grid-template-columns: 1fr 1fr;
  }
  .team__col {
    display: contents;
  }
  .member:nth-child(n) {
    margin-top: 0;
  }
  .team__col--1,
  .team__col--2 {
    padding-top: 0;
  }
}
@media (max-width: 560px) {
  .team__cols {
    grid-template-columns: 1fr;
    gap: 72px;
  }
  .member__photo {
    aspect-ratio: 4 / 5;
  }
  .member__name {
    font-size: clamp(3.4rem, 18vw, 5rem);
  }
}
</style>
