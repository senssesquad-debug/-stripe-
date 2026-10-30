<script setup>
// First screen. The headline is printed twice and clipped into halves; while
// the hero is pinned, the razor turns edge-on and the halves slide apart as if
// the line had been cut.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useSite } from '../composables/useSite.js'
import { gsap, reducedMotion, isDesktop } from '../composables/useMotion.js'
import { boot } from '../composables/useBoot.js'
import BookLink from '../components/BookLink.vue'
import Magnetic from '../components/Magnetic.vue'

const { t, info, hours, to } = useSite()
const root = ref(null)
const today = computed(() => hours.value.find((h) => h.today))

// Split the headline into two balanced lines by words.
const lines = computed(() => {
  const words = info.value.homeTitle.split(/\s+/).filter(Boolean)
  if (words.length < 3) return [words.join(' ')]
  let best = 1
  let bestDiff = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length
    const b = words.slice(i).join(' ').length
    if (Math.abs(a - b) < bestDiff) {
      bestDiff = Math.abs(a - b)
      best = i
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
})

let ctx
onMounted(async () => {
  if (reducedMotion.value) return
  ctx = gsap.context(() => {
    gsap.set('.hero__word', { yPercent: 115 })
    gsap.set('[data-hero-fade]', { opacity: 0, y: 20 })
    // the pin is created right away so every trigger below it measures correctly
    if (isDesktop()) {
      gsap
        .timeline({
          scrollTrigger: { trigger: root.value, start: 'top top', end: '+=110%', scrub: 0.8, pin: true, pinSpacing: true, anticipatePin: 1 },
        })
        .to('.hero__cutline', { scaleX: 1, duration: 0.45, ease: 'power2.inOut' }, 0.05)
        .to('.hero__half--top', { xPercent: -3.5, yPercent: -6, duration: 0.6, ease: 'power2.inOut' }, 0.3)
        .to('.hero__half--bottom', { xPercent: 4, yPercent: 7, color: 'transparent', duration: 0.6, ease: 'power2.inOut' }, 0.3)
        .fromTo('.hero__fadeout', { opacity: 1, y: 0 }, { opacity: 0, y: -30, duration: 0.35, stagger: 0.03 }, 0.25)
        .to('.hero__headline', { yPercent: -12, opacity: 0, duration: 0.22 }, 0.9)
    }
  }, root.value)
  await boot.released
  ctx.add(() => {
    gsap.to('.hero__word', { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: 0.09, delay: 0.2 })
    gsap.to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: 0.7 })
  })
})
onBeforeUnmount(() => ctx?.revert())
</script>

<template>
  <section id="hero" ref="root" class="hero">
    <div class="hero__top wrap hero__fadeout"><div class="hero__top-in" data-hero-fade>
      <p class="label">
        <span class="bronze">JZ Cuts &amp; Shave</span>
        <span class="faint"> — </span>
        <a :href="info.map" target="_blank" rel="noopener" class="link-line">{{ info.address }}</a>
      </p>
      <p v-if="today" class="label hero__today">
        <span class="hero__dot" :class="{ 'is-closed': today.closed }" aria-hidden="true"></span>
        {{ today.day }} · {{ today.value }}
      </p>
    </div></div>

    <h1 class="hero__headline serif">
      <template v-for="(line, i) in lines" :key="i">
        <span class="hero__line" :class="`hero__line--${i}`">
          <span class="hero__half hero__half--top">
            <span class="mask"><span class="hero__word" :class="{ italic: i === 1 }">{{ line }}</span></span>
          </span>
          <!-- the lower half of the cut is drawn from data-text so the heading text exists once -->
          <span class="hero__half hero__half--bottom" aria-hidden="true">
            <span class="mask"><span class="hero__word hero__word--ghost" :class="{ italic: i === 1 }" :data-text="line"></span></span>
          </span>
        </span>{{ i < lines.length - 1 ? ' ' : '' }}
      </template>
      <span class="hero__cutline" aria-hidden="true"></span>
    </h1>

    <div class="hero__bottom wrap hero__fadeout">
      <div class="hero__intro">
        <!-- left un-animated: it is the page's largest text paint -->
        <p class="hero__desc">{{ info.homeDesc }}</p>
        <div class="hero__ctas" data-hero-fade>
          <Magnetic>
            <RouterLink :to="to('services')" class="btn" data-cursor>
              <span>{{ t.viewServices }}</span>
            </RouterLink>
          </Magnetic>
          <BookLink />
        </div>
      </div>
      <div class="hero__scroll label faint" data-hero-fade aria-hidden="true">
        <span>{{ t.ui.scroll }}</span>
        <span class="hero__scroll-line"></span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  z-index: 2;
  height: 100vh;
  height: 100svh;
  min-height: 620px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding-top: calc(var(--header-h) + 18px);
  padding-bottom: clamp(24px, 4vw, 48px);
  overflow: hidden;
}

.hero__top-in {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.hero__today {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--champagne);
}
.hero__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--bronze);
  box-shadow: 0 0 0 4px rgba(152, 118, 83, 0.2);
}
.hero__dot.is-closed {
  background: var(--ink-faint);
  box-shadow: none;
}

.hero__headline {
  position: relative;
  align-self: center;
  display: grid;
  padding-inline: var(--gutter);
  font-size: clamp(3.4rem, 10.6vw, 12.5rem);
  line-height: 0.88;
  letter-spacing: -0.035em;
  pointer-events: none;
}
.hero__line {
  position: relative;
  display: block;
  white-space: nowrap;
}
.hero__line--1 {
  justify-self: end;
  color: var(--champagne);
}
.hero__half {
  display: block;
}
.hero__half--top {
  clip-path: inset(-20% -5% 50% -5%);
}
.hero__half--bottom {
  position: absolute;
  inset: 0;
  padding: inherit;
  clip-path: inset(50% -5% -20% -5%);
  -webkit-text-stroke: 1px var(--champagne);
}
.hero__word {
  display: inline-block;
  padding-bottom: 0.08em;
}
.hero__word--ghost::before {
  content: attr(data-text);
}
.hero__cutline {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--champagne) 20%, var(--ivory) 50%, var(--champagne) 80%, transparent);
  transform: scaleX(0);
  box-shadow: 0 0 18px rgba(214, 195, 165, 0.6);
}

.hero__bottom {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 32px;
}
.hero__intro {
  display: grid;
  gap: 26px;
  max-width: 640px;
}
.hero__desc {
  max-width: 500px;
  font-size: clamp(1rem, 1.2vw, 1.15rem);
  color: var(--ink-soft);
  line-height: 1.65;
}
.hero__ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.hero__scroll {
  display: grid;
  justify-items: center;
  gap: 14px;
  writing-mode: vertical-rl;
}
.hero__scroll-line {
  width: 1px;
  height: 70px;
  background: linear-gradient(var(--champagne), transparent);
  animation: drip 2.2s var(--ease-inout) infinite;
  transform-origin: top;
}
@keyframes drip {
  0% { transform: scaleY(0); }
  50% { transform: scaleY(1); transform-origin: top; }
  51% { transform-origin: bottom; }
  100% { transform: scaleY(0); transform-origin: bottom; }
}

@media (max-width: 1023px) {
  .hero {
    grid-template-rows: auto 1fr auto auto;
  }
  .hero__headline {
    align-self: end;
    padding-bottom: 36px;
    font-size: clamp(3rem, 13vw, 7.5rem);
  }
  .hero__line {
    white-space: normal;
  }
  .hero__line--1 {
    justify-self: start;
    padding-left: 12vw;
  }
  .hero__scroll {
    display: none;
  }
}
@media (max-width: 560px) {
  .hero {
    min-height: 640px;
  }
  .hero__headline {
    font-size: clamp(2.9rem, 14.5vw, 4.6rem);
  }
  .hero__line--1 {
    padding-left: 0;
  }
  .hero__ctas {
    display: grid;
  }
  .hero__ctas :deep(.magnetic),
  .hero__ctas :deep(.btn) {
    width: 100%;
  }
  .hero__top .label:first-child .faint,
  .hero__top .label:first-child .bronze {
    display: none;
  }
}
</style>
