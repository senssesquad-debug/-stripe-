<script setup>
// Services as a pinned horizontal reel on desktop; a swipeable strip on touch.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useSite } from '../composables/useSite.js'
import { gsap, reducedMotion, isDesktop } from '../composables/useMotion.js'
import BookLink from '../components/BookLink.vue'
import Icon from '../components/Icon.vue'

defineProps({ index: { type: String, default: '02' } })
const { t, services, to } = useSite()
const root = ref(null)
const track = ref(null)
let ctx

onMounted(() => {
  if (reducedMotion.value || !isDesktop()) return
  ctx = gsap.context(() => {
    const distance = () => track.value.scrollWidth - window.innerWidth
    const tween = gsap.to(track.value, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: root.value,
        start: 'top top',
        end: () => '+=' + distance(),
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    })
    gsap.to('.reel__progress i', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: root.value, start: 'top top', end: () => '+=' + distance(), scrub: true } })
    root.value.querySelectorAll('.reel__panel img').forEach((img) => {
      gsap.fromTo(
        img,
        { xPercent: -7 },
        { xPercent: 7, ease: 'none', scrollTrigger: { containerAnimation: tween, trigger: img.closest('.reel__panel'), start: 'left right', end: 'right left', scrub: true } },
      )
    })
    root.value.querySelectorAll('.reel__panel').forEach((panel) => {
      gsap.fromTo(
        panel.querySelector('.reel__meta'),
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, ease: 'expo.out', duration: 1, scrollTrigger: { containerAnimation: tween, trigger: panel, start: 'left 85%', toggleActions: 'play none none reverse' } },
      )
    })
  }, root.value)
})
onBeforeUnmount(() => ctx?.revert())
</script>

<template>
  <section id="services" ref="root" class="reel">
    <div ref="track" class="reel__track">
      <header class="reel__intro">
        <p class="label bronze">{{ index }}</p>
        <h2 class="reel__title serif">{{ t.nav.services }}</h2>
        <p class="reel__count serif outline-text" aria-hidden="true">{{ String(services.length).padStart(2, '0') }}</p>
      </header>

      <RouterLink
        v-for="(s, i) in services"
        :key="s.id"
        :to="{ path: to('services'), query: { s: s.id } }"
        class="reel__panel"
        :class="[s.image ? 'has-image' : 'is-type', i % 2 ? 'is-low' : '']"
        data-cursor
      >
        <span class="reel__num label">{{ String(s.index).padStart(2, '0') }} / {{ String(services.length).padStart(2, '0') }}</span>
        <figure v-if="s.image" class="reel__img frame">
          <img :src="s.image.src" :width="s.image.w" :height="s.image.h" :alt="s.title" loading="lazy" decoding="async" />
        </figure>
        <span v-else class="reel__type serif" aria-hidden="true">{{ s.price }}<small>€</small></span>
        <span class="reel__meta">
          <span class="reel__name serif">{{ s.title }}</span>
          <span v-if="s.description" class="reel__desc">{{ s.description }}</span>
          <span class="reel__price">
            <span class="serif">{{ s.price }} €</span>
            <Icon name="arrow-up-right" />
          </span>
        </span>
      </RouterLink>

      <div class="reel__end">
        <RouterLink :to="to('prices')" class="reel__end-link serif" data-cursor>
          {{ t.nav.prices }}
          <Icon name="arrow" />
        </RouterLink>
        <BookLink />
      </div>
    </div>
    <div class="reel__progress" aria-hidden="true"><i></i></div>
  </section>
</template>

<style scoped>
.reel {
  position: relative;
  z-index: 2;
  background: linear-gradient(180deg, var(--black), var(--charcoal) 30%, #120f0d);
  overflow: hidden;
  border-top: 1px solid var(--hair);
}
.reel__track {
  display: flex;
  align-items: center;
  gap: clamp(28px, 3.4vw, 64px);
  height: 100vh;
  min-height: 640px;
  padding: calc(var(--header-h) + 20px) var(--gutter) 60px;
  width: max-content;
  will-change: transform;
}
.reel__intro {
  width: min(46vw, 760px);
  display: grid;
  gap: 18px;
  align-self: stretch;
  align-content: center;
}
.reel__title {
  font-size: var(--fs-xl);
}
.reel__count {
  font-size: clamp(8rem, 22vw, 24rem);
  line-height: 0.8;
  margin-top: 10px;
}
.reel__panel {
  position: relative;
  display: grid;
  gap: 16px;
  width: clamp(280px, 26vw, 420px);
  flex: none;
  align-self: center;
}
.reel__panel.is-low {
  transform: translateY(7vh);
}
.reel__panel.is-type {
  width: clamp(220px, 19vw, 320px);
}
.reel__num {
  color: var(--ink-faint);
}
.reel__img {
  height: clamp(280px, 46vh, 520px);
}
.reel__img img {
  width: 116%;
  max-width: none;
  margin-left: -8%;
  transition: transform 1.2s var(--ease-out), filter 0.8s;
  filter: saturate(0.72) brightness(0.92);
}
.reel__panel:hover .reel__img img {
  filter: saturate(1) brightness(1);
}
.reel__type {
  display: flex;
  align-items: flex-end;
  height: clamp(200px, 30vh, 340px);
  padding: 22px;
  font-size: clamp(6rem, 11vw, 11rem);
  line-height: 0.8;
  color: transparent;
  -webkit-text-stroke: 1px var(--bronze);
  background:
    radial-gradient(120% 80% at 20% 0%, rgba(152, 118, 83, 0.18), transparent 60%),
    var(--chocolate);
  transition: color 0.6s;
}
.reel__type small {
  font-size: 0.35em;
  margin-left: 6px;
}
.reel__panel:hover .reel__type {
  color: var(--bronze);
}
.reel__meta {
  display: grid;
  gap: 10px;
}
.reel__name {
  font-size: clamp(1.6rem, 2.1vw, 2.3rem);
  line-height: 1.05;
  font-weight: 400;
}
.reel__desc {
  font-size: 0.9rem;
  color: var(--ink-soft);
  line-height: 1.55;
}
.reel__price {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--hair);
  color: var(--champagne);
}
.reel__price .serif {
  font-size: 1.9rem;
  line-height: 1;
}
.reel__price .icon {
  transition: transform 0.5s var(--ease-out);
}
.reel__panel:hover .reel__price .icon {
  transform: translate(4px, -4px);
}
.reel__end {
  display: grid;
  gap: 30px;
  justify-items: start;
  width: min(40vw, 520px);
  padding-right: 6vw;
}
.reel__end-link {
  display: inline-flex;
  align-items: center;
  gap: 20px;
  font-size: var(--fs-xl);
  font-style: italic;
  transition: color 0.4s, gap 0.6s var(--ease-out);
}
.reel__end-link:hover {
  color: var(--champagne);
  gap: 34px;
}
.reel__end-link .icon {
  width: 0.5em;
  height: 0.5em;
}
.reel__progress {
  position: absolute;
  left: var(--gutter);
  right: var(--gutter);
  bottom: 28px;
  height: 1px;
  background: var(--hair);
}
.reel__progress i {
  display: block;
  height: 100%;
  background: var(--bronze);
  transform: scaleX(0);
  transform-origin: 0 50%;
}

/* touch & tablet: native horizontal swipe */
@media (max-width: 1023px), (prefers-reduced-motion: reduce) {
  .reel__track {
    height: auto;
    min-height: 0;
    width: auto;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding-top: 96px;
    padding-bottom: 72px;
    align-items: stretch;
    scrollbar-width: none;
    overscroll-behavior-x: contain;
  }
  .reel__track::-webkit-scrollbar {
    display: none;
  }
  .reel__intro,
  .reel__panel,
  .reel__end {
    scroll-snap-align: start;
    scroll-margin-left: var(--gutter);
  }
  .reel__intro {
    width: max-content;
    min-width: min(78vw, 420px);
    max-width: 92vw;
    padding-right: 32px;
    flex: none;
  }
  .reel__count {
    font-size: clamp(7rem, 34vw, 12rem);
  }
  .reel__panel,
  .reel__panel.is-type {
    width: min(78vw, 380px);
  }
  .reel__panel.is-low {
    transform: none;
  }
  .reel__img {
    height: auto;
    aspect-ratio: 4 / 5;
  }
  .reel__img img {
    width: 100%;
    margin: 0;
  }
  .reel__type {
    height: auto;
    aspect-ratio: 4 / 5;
  }
  .reel__end {
    flex: none;
    width: 78vw;
    align-content: center;
  }
  .reel__progress {
    display: none;
  }
}
</style>
