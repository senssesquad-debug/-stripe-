<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useSite } from '../composables/useSite.js'
import { revealIn } from '../composables/useMotion.js'
import Hours from '../components/Hours.vue'
import Icon from '../components/Icon.vue'

const props = defineProps({ index: { type: String, default: '07' }, heading: { type: Boolean, default: true }, map: { type: Boolean, default: true } })
const { t, info } = useSite()
const root = ref(null)
const mapEl = ref(null)
const mapOn = ref(false)

let undo, io
onMounted(() => {
  undo = revealIn(root.value)
  if (!props.map || !mapEl.value) return
  // the map iframe only loads once it is about to be seen
  io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        mapOn.value = true
        io.disconnect()
      }
    },
    { rootMargin: '400px' },
  )
  io.observe(mapEl.value)
})
onBeforeUnmount(() => {
  undo?.()
  io?.disconnect()
})
</script>

<template>
  <section id="contacts" ref="root" class="contact section">
    <div class="wrap">
      <div v-if="heading" class="section-head">
        <p v-if="props.index" class="index label" data-reveal>{{ props.index }}</p>
        <h2 class="serif contact__title" data-reveal>{{ t.contactsTitle }}</h2>
      </div>

      <div class="contact__grid">
        <div class="contact__main">
          <p class="contact__desc muted" data-reveal>{{ info.description }}</p>
          <a :href="`tel:${info.phone}`" class="contact__phone serif" data-reveal data-cursor>
            <span class="mask"><span>{{ info.phoneDisplay }}</span></span>
          </a>
          <ul class="contact__lines">
            <li data-reveal>
              <Icon name="mail" />
              <a :href="`mailto:${info.email}`" class="link-line">{{ info.email }}</a>
            </li>
            <li data-reveal>
              <Icon name="pin" />
              <a :href="info.map" target="_blank" rel="noopener" class="link-line">{{ info.address }}</a>
            </li>
          </ul>
          <div class="contact__social" data-reveal>
            <p class="label faint">{{ t.contactUs }}</p>
            <div>
              <a :href="info.fb" target="_blank" rel="noopener" aria-label="Facebook"><Icon name="facebook" /></a>
              <a :href="info.ig" target="_blank" rel="noopener" aria-label="Instagram"><Icon name="instagram" /></a>
              <a :href="info.whatsapp" target="_blank" rel="noopener" aria-label="WhatsApp"><Icon name="whatsapp" /></a>
            </div>
          </div>
        </div>

        <div class="contact__hours" data-reveal>
          <p class="label bronze">{{ t.workingHours }}</p>
          <Hours />
        </div>
      </div>

      <div v-if="map" ref="mapEl" class="contact__map" data-reveal="mask">
        <iframe
          v-if="mapOn"
          :src="`https://maps.google.com/maps?q=${encodeURIComponent(info.address)}&z=16&output=embed`"
          :title="info.address"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
        <a :href="info.map" target="_blank" rel="noopener" class="contact__map-link btn btn--solid">
          {{ t.viewOnMap }} <Icon name="arrow-up-right" />
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.contact {
  z-index: 2;
  background: var(--black);
  border-top: 1px solid var(--hair);
}
.contact__grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: clamp(40px, 7vw, 120px);
  align-items: start;
}
.contact__main {
  display: grid;
  gap: 28px;
}
.contact__desc {
  max-width: 46ch;
  font-size: 1.05rem;
}
.contact__phone {
  font-size: clamp(2.8rem, 7.4vw, 8rem);
  line-height: 0.95;
  letter-spacing: -0.03em;
  transition: color 0.4s;
  white-space: nowrap;
}
.contact__phone:hover {
  color: var(--champagne);
  font-style: italic;
}
.contact__lines {
  display: grid;
  gap: 14px;
  font-size: 1.1rem;
}
.contact__lines li {
  display: flex;
  align-items: center;
  gap: 14px;
}
.contact__lines .icon {
  color: var(--bronze);
}
.contact__social {
  display: grid;
  gap: 12px;
}
.contact__social > div {
  display: flex;
  gap: 10px;
}
.contact__social a {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border: 1px solid var(--hair-strong);
  border-radius: 50%;
  font-size: 1.1rem;
  transition: background 0.4s, color 0.4s;
}
.contact__social a:hover {
  background: var(--ivory);
  color: var(--black);
}
.contact__hours {
  display: grid;
  gap: 18px;
  padding: clamp(24px, 3vw, 40px);
  border: 1px solid var(--hair);
  background: linear-gradient(160deg, rgba(48, 36, 30, 0.45), rgba(23, 22, 21, 0.3));
}
.contact__map {
  position: relative;
  margin-top: clamp(60px, 8vw, 120px);
  height: clamp(320px, 46vw, 560px);
  background: var(--charcoal);
  overflow: hidden;
}
.contact__map iframe {
  width: 100%;
  height: 100%;
  border: 0;
  filter: grayscale(1) invert(0.92) sepia(0.35) contrast(0.9) brightness(0.95);
}
.contact__map-link {
  position: absolute;
  left: 20px;
  bottom: 20px;
}
@media (max-width: 860px) {
  .contact__grid {
    grid-template-columns: 1fr;
  }
  .contact__phone {
    font-size: clamp(2.4rem, 12vw, 4rem);
  }
}
</style>
