<script setup>
// The four steps of the shop's online booking, shown as a ledger. Each row
// previews what that step offers using live data and opens the booking form.
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useSite } from '../composables/useSite.js'
import { revealIn } from '../composables/useMotion.js'
import { useBooking } from '../composables/useBooking.js'
import BookLink from '../components/BookLink.vue'
import Icon from '../components/Icon.vue'

const props = defineProps({ index: { type: String, default: '06' }, heading: { type: Boolean, default: true } })
const { t, info, services, team, hours, bookingUrl } = useSite()
const { openBooking } = useBooking()
const root = ref(null)
const openDays = computed(() => hours.value.filter((h) => !h.closed))

let undo
onMounted(() => (undo = revealIn(root.value)))
onBeforeUnmount(() => undo?.())
</script>

<template>
  <section id="booking" ref="root" class="booking section">
    <div class="wrap">
      <div v-if="heading" class="section-head">
        <p v-if="props.index" class="index label" data-reveal>{{ props.index }}</p>
        <h2 class="serif booking__title" data-reveal>{{ t.nav.booking }}</h2>
      </div>

      <ol class="steps">
        <li v-for="(step, i) in t.steps" :key="i" class="step" data-reveal="fade" :data-delay="i * 0.06">
          <a :href="bookingUrl" class="step__btn" data-cursor @click="openBooking">
          <span class="step__no serif" aria-hidden="true">{{ i + 1 }}</span>
          <span class="step__text serif" aria-hidden="true">{{ step.replace(/^\d+\.\s*/, '') }}</span>
          <span class="visually-hidden">{{ step }}</span>
          <span class="step__peek" aria-hidden="true">
            <template v-if="i === 0">
              <span v-for="s in services.slice(0, 3)" :key="s.id" class="step__chip">{{ s.title }}</span>
              <span class="step__chip faint">+{{ services.length - 3 }}</span>
            </template>
            <template v-else-if="i === 1">
              <span class="step__faces">
                <img v-for="m in team" :key="m.id" :src="m.photo.src" alt="" loading="lazy" width="44" height="44" />
              </span>
            </template>
            <template v-else-if="i === 2">
              <span v-for="h in openDays" :key="h.day" class="step__chip">{{ h.day.slice(0, 3) }} {{ h.value }}</span>
            </template>
            <template v-else>
              <span class="step__chip"><Icon name="phone" /> +371 ···</span>
            </template>
          </span>
          <span class="step__go" aria-hidden="true"><Icon name="arrow" /></span>
          </a>
        </li>
      </ol>

      <div class="booking__cta" data-reveal>
        <BookLink v-if="info.bookingEnabled" />
        <a :href="`tel:${info.phone}`" class="booking__phone serif link-line">{{ info.phoneDisplay }}</a>
        <a :href="info.whatsapp" target="_blank" rel="noopener" class="booking__wa label"><Icon name="whatsapp" /> WhatsApp</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.booking {
  z-index: 2;
  background: radial-gradient(70% 60% at 85% 40%, rgba(73, 55, 43, 0.4), transparent 70%);
}
.steps {
  border-top: 1px solid var(--hair);
}
.step {
  position: relative;
  border-bottom: 1px solid var(--hair);
  overflow: hidden;
  isolation: isolate;
}
.step__btn {
  display: grid;
  grid-template-columns: clamp(60px, 9vw, 150px) 1fr auto auto;
  align-items: center;
  gap: clamp(12px, 2vw, 32px);
  padding: clamp(18px, 2.4vw, 34px) 0;
}
.step__go {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--hair-strong);
  border-radius: 50%;
  color: var(--champagne);
  transition: background 0.4s, color 0.4s, transform 0.6s var(--ease-out);
}
.step:hover .step__go,
.step__btn:focus-visible .step__go {
  background: var(--ivory);
  color: var(--black);
  transform: translateX(4px);
}
.step::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(152, 118, 83, 0.14), transparent 70%);
  transform: scaleX(0);
  transform-origin: 0 50%;
  transition: transform 0.9s var(--ease-out);
  z-index: -1;
}
.step:hover::before {
  transform: scaleX(1);
}
.step__no {
  font-size: clamp(3rem, 6vw, 6.5rem);
  line-height: 0.8;
  color: transparent;
  -webkit-text-stroke: 1px var(--bronze);
  transition: color 0.5s;
}
.step:hover .step__no {
  color: var(--bronze);
}
.step__text {
  font-size: clamp(1.6rem, 3.4vw, 3.6rem);
  line-height: 1.05;
}
.step__peek {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 420px;
  opacity: 0.35;
  transition: opacity 0.6s;
}
.step:hover .step__peek {
  opacity: 1;
}
.step__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--hair-strong);
  font-size: 0.75rem;
  white-space: nowrap;
}
.step__faces {
  display: flex;
}
.step__faces img {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--black);
  margin-left: -12px;
  filter: grayscale(0.4);
}
.booking__cta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: clamp(18px, 3vw, 44px);
  margin-top: clamp(48px, 6vw, 90px);
}
.booking__phone {
  font-size: clamp(1.8rem, 3vw, 3rem);
}
.booking__wa {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--champagne);
}
@media (max-width: 860px) {
  .step__btn {
    grid-template-columns: 56px 1fr auto;
  }
  .step__go {
    grid-column: 3;
    grid-row: 1;
    width: 42px;
    height: 42px;
  }
  .step__peek {
    grid-column: 2 / -1;
    justify-content: flex-start;
    opacity: 0.8;
  }
}
</style>
