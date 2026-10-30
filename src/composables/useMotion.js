import { ref } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

const mq = (q) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener() {} })

export const reducedMotion = ref(mq('(prefers-reduced-motion: reduce)').matches)
mq('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => {
  reducedMotion.value = e.matches
})

export const isTouch = mq('(hover: none), (pointer: coarse)').matches
export const isDesktop = () => window.innerWidth >= 1024

let lenis = null

export function startSmoothScroll() {
  if (lenis || reducedMotion.value) return lenis
  lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 3.2), smoothWheel: true, touchMultiplier: 1.4 })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis && lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
  return lenis
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
  else window.scrollTo(0, 0)
}

export function scrollToEl(target, offset = 0) {
  const el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) return
  if (lenis) lenis.scrollTo(el, { offset, duration: 1.4 })
  else el.scrollIntoView({ behavior: reducedMotion.value ? 'auto' : 'smooth' })
}

export function lockScroll(locked) {
  if (lenis) locked ? lenis.stop() : lenis.start()
  document.documentElement.classList.toggle('is-locked', locked)
}

export function onScroll(cb) {
  if (lenis) {
    lenis.on('scroll', cb)
    return () => lenis.off('scroll', cb)
  }
  const h = () => cb({ scroll: window.scrollY, direction: 0 })
  window.addEventListener('scroll', h, { passive: true })
  return () => window.removeEventListener('scroll', h)
}

/**
 * Text and image reveals for everything marked with data-reveal inside `root`.
 * Returns a cleanup function; with reduced motion everything is shown as is.
 */
export function revealIn(root) {
  if (!root) return () => {}
  const ctx = gsap.context(() => {
    if (reducedMotion.value) return
    root.querySelectorAll('[data-reveal]').forEach((el) => {
      const kind = el.dataset.reveal || 'up'
      const st = { trigger: el, start: 'top 90%', once: true }
      const delay = Number(el.dataset.delay || 0)
      if (kind === 'mask') {
        // clip the frame, scale only its picture so layout bounds never grow
        gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.out', delay, scrollTrigger: st })
        const img = el.querySelector('img')
        if (img) gsap.fromTo(img, { scale: 1.14 }, { scale: 1, duration: 1.8, ease: 'expo.out', delay, scrollTrigger: st })
        return
      }
      const from = kind === 'line' ? { scaleX: 0, transformOrigin: '0% 50%' } : kind === 'fade' ? { opacity: 0 } : { yPercent: 40, opacity: 0 }
      const to = kind === 'line' ? { scaleX: 1 } : kind === 'fade' ? { opacity: 1 } : { yPercent: 0, opacity: 1 }
      gsap.fromTo(el, from, { ...to, duration: 1.1, ease: 'expo.out', delay, scrollTrigger: st })
    })
    root.querySelectorAll('[data-parallax]').forEach((el) => {
      const amount = Number(el.dataset.parallax || 12)
      gsap.fromTo(
        el,
        { yPercent: -amount },
        { yPercent: amount, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } },
      )
    })
  }, root)
  return () => ctx.revert()
}

export { gsap, ScrollTrigger }
