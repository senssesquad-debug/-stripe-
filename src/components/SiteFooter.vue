<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useSite } from '../composables/useSite.js'
import { gsap, reducedMotion, scrollToTop } from '../composables/useMotion.js'
import Icon from './Icon.vue'
import Hours from './Hours.vue'

const { t, to, info } = useSite()
const root = ref(null)
let ctx

onMounted(() => {
  if (reducedMotion.value) return
  ctx = gsap.context(() => {
    gsap.fromTo(
      '.footer__mark span',
      { yPercent: 100 },
      { yPercent: 0, ease: 'expo.out', duration: 1.6, stagger: 0.08, scrollTrigger: { trigger: '.footer__mark', start: 'top 95%', once: true } },
    )
  }, root.value)
})
onBeforeUnmount(() => ctx?.revert())
</script>

<template>
  <footer ref="root" class="footer">
    <div class="footer__mark serif" aria-hidden="true">
      <span>Cuts</span><span class="italic bronze">&amp;</span><span>Shave</span>
    </div>

    <div class="footer__grid wrap">
      <div class="footer__col footer__about">
        <p class="footer__title">JZ Barbershop</p>
        <p class="muted">{{ info.description }}</p>
        <p class="label faint footer__sub">{{ t.contactUs }}</p>
        <div class="footer__social">
          <a :href="info.fb" target="_blank" rel="noopener" aria-label="Facebook"><Icon name="facebook" /></a>
          <a :href="info.ig" target="_blank" rel="noopener" aria-label="Instagram"><Icon name="instagram" /></a>
          <a :href="info.whatsapp" target="_blank" rel="noopener" aria-label="WhatsApp"><Icon name="whatsapp" /></a>
        </div>
        <RouterLink :to="to('privacy-policy')" class="link-line muted footer__privacy">{{ t.privacy }}</RouterLink>
      </div>

      <div class="footer__col">
        <p class="footer__title">{{ t.contactsTitle }}</p>
        <a :href="`tel:${info.phone}`" class="link-line">{{ info.phoneDisplay }}</a>
        <a :href="`mailto:${info.email}`" class="link-line">{{ info.email }}</a>
        <a :href="info.map" target="_blank" rel="noopener" class="link-line">{{ info.address }}</a>
      </div>

      <div class="footer__col">
        <p class="footer__title">{{ t.workingHours }}</p>
        <Hours compact />
      </div>
    </div>

    <div class="footer__bar wrap">
      <span class="faint">© 2026 JZ Barbershop</span>
      <button type="button" class="footer__top" :aria-label="t.ui.top" @click="scrollToTop">
        <Icon name="arrow" />
      </button>
      <a href="https://goodzilla.dev/" target="_blank" rel="noopener" class="faint link-line">Created By GoOdzilla</a>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  position: relative;
  z-index: 2;
  background: linear-gradient(180deg, var(--black), #0f0c0a 40%, var(--chocolate) 160%);
  border-top: 1px solid var(--hair);
  overflow: hidden;
}
.footer__mark {
  display: flex;
  justify-content: center;
  gap: 0.12em;
  font-size: clamp(4.5rem, 19vw, 21rem);
  line-height: 0.85;
  padding: clamp(60px, 8vw, 120px) var(--gutter) clamp(30px, 4vw, 60px);
  overflow: hidden;
  color: transparent;
  -webkit-text-stroke: 1px rgba(214, 195, 165, 0.32);
  white-space: nowrap;
}
.footer__mark span {
  display: inline-block;
}
.footer__mark .bronze {
  -webkit-text-stroke: 0;
  color: var(--bronze);
}
.footer__grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: clamp(32px, 5vw, 80px);
  padding-block: clamp(40px, 5vw, 70px);
  border-top: 1px solid var(--hair);
}
.footer__col {
  display: grid;
  align-content: start;
  gap: 10px;
}
.footer__about {
  max-width: 420px;
}
.footer__title {
  font-family: var(--serif);
  font-size: 1.7rem;
  line-height: 1.1;
  margin-bottom: 8px;
}
.footer__sub {
  margin-top: 18px;
}
.footer__social {
  display: flex;
  gap: 12px;
}
.footer__social a {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 1px solid var(--hair-strong);
  border-radius: 50%;
  color: var(--ink-soft);
  transition: background 0.4s, color 0.4s, border-color 0.4s;
}
.footer__social a:hover {
  background: var(--ivory);
  color: var(--black);
  border-color: var(--ivory);
}
.footer__privacy {
  justify-self: start;
  margin-top: 16px;
}
.footer__bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding-block: 22px 28px;
  border-top: 1px solid var(--hair);
  font-size: 0.82rem;
}
.footer__bar > :last-child {
  justify-self: end;
}
.footer__top {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border: 1px solid var(--hair-strong);
  border-radius: 50%;
  transform: rotate(-90deg);
  transition: background 0.4s, color 0.4s;
}
.footer__top:hover {
  background: var(--ivory);
  color: var(--black);
}
@media (max-width: 900px) {
  .footer__grid {
    grid-template-columns: 1fr 1fr;
  }
  .footer__about {
    grid-column: 1 / -1;
  }
}
@media (max-width: 560px) {
  .footer__grid {
    grid-template-columns: 1fr;
  }
  .footer__bar {
    grid-template-columns: 1fr auto;
    gap: 10px;
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
  }
  .footer__top {
    grid-row: span 2;
    grid-column: 2;
  }
  .footer__bar > :last-child {
    justify-self: start;
  }
}
</style>
