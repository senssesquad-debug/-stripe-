<script setup>
// Booking stays one thumb away on phones.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useSite } from '../composables/useSite.js'
import { onScroll } from '../composables/useMotion.js'
import { useBooking } from '../composables/useBooking.js'
import Icon from './Icon.vue'

const { t, info, bookingUrl } = useSite()
const { openBooking } = useBooking()
const visible = ref(false)
let off
onMounted(() => {
  off = onScroll(({ scroll }) => {
    visible.value = (scroll ?? window.scrollY) > window.innerHeight * 0.6
  })
})
onBeforeUnmount(() => off?.())
</script>

<template>
  <div class="mbar" :class="{ 'is-visible': visible }">
    <a :href="bookingUrl" class="mbar__book" @click="openBooking">
      <span>{{ t.bookOnline }}</span>
      <Icon name="arrow" />
    </a>
    <a :href="`tel:${info.phone}`" class="mbar__icon" :aria-label="info.phoneDisplay"><Icon name="phone" /></a>
    <a :href="info.whatsapp" target="_blank" rel="noopener" class="mbar__icon" aria-label="WhatsApp"><Icon name="whatsapp" /></a>
  </div>
</template>

<style scoped>
.mbar {
  display: none;
}
@media (max-width: 760px) {
  .mbar {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    z-index: 100;
    display: flex;
    gap: 8px;
    transform: translateY(140%);
    transition: transform 0.7s var(--ease-out);
  }
  .mbar.is-visible {
    transform: none;
  }
  .mbar__book {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 56px;
    padding: 0 22px;
    background: var(--ivory);
    color: var(--black);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    line-height: 1.3;
    gap: 12px;
    text-transform: uppercase;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  }
  .mbar__icon {
    display: grid;
    place-items: center;
    width: 56px;
    min-height: 56px;
    background: rgba(23, 22, 21, 0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--hair-strong);
    font-size: 1.1rem;
  }
}
</style>
