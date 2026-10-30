<script setup>
// Service index: names on the left, the chosen service's photograph, price
// and description held in a sticky plate on the right (inline on phones).
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSite } from '../composables/useSite.js'
import { revealIn, gsap, reducedMotion } from '../composables/useMotion.js'
import PageHero from '../components/PageHero.vue'
import BookLink from '../components/BookLink.vue'
import img from '../assets/interior-floor.webp'

const route = useRoute()
const router = useRouter()
const { t, services } = useSite()
const root = ref(null)
const plate = ref(null)

const activeId = computed(() => Number(route.query.s) || services.value[0]?.id)
const active = computed(() => services.value.find((s) => s.id === activeId.value) || services.value[0])

function select(s) {
  router.replace({ query: { s: s.id } })
}

watch(activeId, () => {
  if (reducedMotion.value || !plate.value) return
  gsap.fromTo(plate.value.querySelectorAll('[data-swap]'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out' })
  gsap.fromTo(plate.value.querySelector('.svc__img img'), { scale: 1.12 }, { scale: 1, duration: 1.4, ease: 'expo.out' })
})

let undo
onMounted(() => (undo = revealIn(root.value)))
onBeforeUnmount(() => undo?.())
</script>

<template>
  <PageHero :title="t.nav.services" index="JZ Barbershop" :image="img" />
  <section ref="root" class="svc section">
    <div class="svc__grid wrap">
      <ol class="svc__list" role="list">
        <li v-for="s in services" :key="s.id" class="svc__item" :class="{ 'is-active': s.id === active.id }" data-reveal="fade">
          <button type="button" class="svc__btn" :aria-pressed="s.id === active.id ? 'true' : 'false'" @click="select(s)">
            <span class="svc__no label">{{ String(s.index).padStart(2, '0') }}</span>
            <span class="svc__name serif">{{ s.title }}</span>
            <span class="svc__price serif">{{ s.price }} €</span>
          </button>
          <div v-if="s.id === active.id" class="svc__inline">
            <figure v-if="s.image" class="svc__img frame"><img :src="s.image.src" :alt="s.title" loading="lazy" /></figure>
            <p class="muted">{{ s.description }}</p>
          </div>
        </li>
      </ol>

      <aside ref="plate" class="svc__plate" aria-live="polite">
        <figure class="svc__img frame">
          <img v-if="active.image" :src="active.image.src" :width="active.image.w" :height="active.image.h" :alt="active.title" />
          <span v-else class="svc__type serif" aria-hidden="true">{{ active.price }}<small>€</small></span>
        </figure>
        <h2 class="svc__title serif" data-swap>{{ active.title }} ({{ active.price }}€)</h2>
        <p class="svc__desc muted" data-swap>{{ active.description }}</p>
        <div data-swap><BookLink /></div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.svc {
  z-index: 2;
}
.svc__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: clamp(40px, 6vw, 110px);
  align-items: start;
}
.svc__list {
  border-top: 1px solid var(--hair);
}
.svc__item {
  border-bottom: 1px solid var(--hair);
}
.svc__btn {
  width: 100%;
  display: grid;
  grid-template-columns: 3.4em 1fr auto;
  align-items: baseline;
  gap: 16px;
  padding: clamp(14px, 1.6vw, 22px) 0;
  text-align: left;
  transition: padding 0.6s var(--ease-out), color 0.4s;
}
.svc__btn:hover,
.is-active .svc__btn {
  padding-left: 14px;
}
.svc__no {
  color: var(--ink-faint);
}
.is-active .svc__no {
  color: var(--bronze);
}
.svc__name {
  font-size: clamp(1.4rem, 2.4vw, 2.4rem);
  line-height: 1.1;
  color: var(--ink-soft);
  transition: color 0.4s;
}
.svc__btn:hover .svc__name,
.is-active .svc__name {
  color: var(--ink);
}
.is-active .svc__name {
  font-style: italic;
}
.svc__price {
  font-size: clamp(1.3rem, 2vw, 2rem);
  color: var(--champagne);
}
.svc__inline {
  display: none;
}
.svc__plate {
  position: sticky;
  top: calc(var(--header-h) + 24px);
  display: grid;
  gap: 22px;
}
.svc__img {
  aspect-ratio: 4 / 5;
  max-height: 62vh;
  width: 100%;
}
.svc__type {
  display: flex;
  align-items: flex-end;
  width: 100%;
  height: 100%;
  padding: 28px;
  font-size: clamp(8rem, 16vw, 15rem);
  line-height: 0.8;
  color: transparent;
  -webkit-text-stroke: 1px var(--bronze);
  background: radial-gradient(120% 80% at 20% 0%, rgba(152, 118, 83, 0.2), transparent 60%), var(--chocolate);
}
.svc__type small {
  font-size: 0.35em;
}
.svc__title {
  font-size: clamp(2rem, 3.4vw, 3.4rem);
  line-height: 1.02;
}
.svc__desc {
  max-width: 50ch;
}
@media (max-width: 860px) {
  .svc__grid {
    grid-template-columns: 1fr;
  }
  .svc__plate {
    display: none;
  }
  .svc__inline {
    display: grid;
    gap: 16px;
    padding: 0 0 26px;
  }
  .svc__inline .svc__img {
    aspect-ratio: 16 / 11;
  }
}
</style>
