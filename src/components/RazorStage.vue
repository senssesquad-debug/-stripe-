<script setup>
// Fixed WebGL layer behind the home page. The razor's pose is choreographed by
// scroll position: each keyframe is pinned to a ScrollTrigger start, and the
// scene eases toward the interpolated pose every frame.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { gsap, ScrollTrigger, reducedMotion } from '../composables/useMotion.js'
import { boot } from '../composables/useBoot.js'

const props = defineProps({
  // [{ trigger, start, state }] — state may include v (layer opacity 0..1)
  keyframes: { type: Function, required: true },
  intro: { type: Object, default: null },
})

const canvas = ref(null)
const backdrop = ref(null)
const failed = ref(false)
const ready = ref(false)
let scene
let triggers = []
let frames = []
let introDone = false
let raf

const smooth = (t) => t * t * (3 - 2 * t)

function poseAt(y) {
  if (!frames.length) return null
  const pts = frames.map((f, i) => ({ at: i === 0 ? 0 : triggers[i].start, state: f.state }))
  if (y <= pts[0].at) return pts[0].state
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (y <= b.at) {
      const t = b.at === a.at ? 1 : smooth(Math.min(1, Math.max(0, (y - a.at) / (b.at - a.at))))
      const out = {}
      for (const k in b.state) out[k] = (a.state[k] ?? b.state[k]) + (b.state[k] - (a.state[k] ?? b.state[k])) * t
      return out
    }
  }
  return pts[pts.length - 1].state
}

let layerV = 1
let layerBg = -1
function setBackdrop(bg) {
  if (!backdrop.value || Math.abs(bg - layerBg) < 0.002) return
  layerBg = bg
  backdrop.value.style.opacity = bg.toFixed(3)
  backdrop.value.style.visibility = bg < 0.005 ? 'hidden' : 'visible'
}
function loop() {
  raf = requestAnimationFrame(loop)
  if (!frames.length) return
  const pose = poseAt(window.scrollY)
  if (!pose) return
  const { v = 1, bg = 0, ...state } = pose
  setBackdrop(bg)
  if (!scene || !introDone) return
  scene.set(state)
  if (Math.abs(v - layerV) > 0.001) {
    layerV = v
    canvas.value.style.opacity = v.toFixed(3)
  }
  v < 0.01 ? scene.stop() : scene.start()
}

function setupFrames() {
  frames = props.keyframes(window.innerWidth >= 1024)
  triggers = frames.map((f) => ScrollTrigger.create({ trigger: f.trigger, start: f.start || 'top top' }))
}

onMounted(async () => {
  setupFrames()
  loop()
  const { RazorScene, webglAvailable } = await import('../three/RazorScene.js')
  if (!webglAvailable()) {
    failed.value = true
    ready.value = true
    boot.markSceneReady()
    return
  }
  const lowPower = window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4
  try {
    scene = new RazorScene(canvas.value, { lowPower, onFirstFrame: () => boot.markSceneReady() })
  } catch {
    failed.value = true
    ready.value = true
    boot.markSceneReady()
    return
  }
  const first = { ...frames[0].state }
  delete first.v
  delete first.bg

  if (reducedMotion.value) {
    scene.idle = false
    scene.jump(first)
    scene.renderOnce()
    introDone = true
    ready.value = true
    return
  }

  scene.jump({ ...first, ...(props.intro || {}) })
  scene.start()
  await boot.released
  ready.value = true
  const proxy = { ...scene.current }
  gsap.to(proxy, {
    ...first,
    duration: 2.4,
    ease: 'expo.out',
    delay: 0.1,
    onUpdate: () => scene.jump({ ...proxy }),
    onComplete: () => (introDone = true),
  })
  // scrolling early hands control to the choreography straight away
  const early = () => {
    if (window.scrollY > 40) {
      introDone = true
      window.removeEventListener('scroll', early)
    }
  }
  window.addEventListener('scroll', early, { passive: true })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  triggers.forEach((t) => t.kill())
  scene?.dispose()
})
</script>

<template>
  <div class="stage" :class="{ 'is-ready': ready }" aria-hidden="true">
    <div ref="backdrop" class="stage__backdrop"><slot name="backdrop" /></div>
    <canvas v-if="!failed" ref="canvas" class="stage__canvas"></canvas>
  </div>
</template>

<style scoped>
.stage {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.stage__backdrop {
  position: absolute;
  inset: 0;
}
.stage__canvas {
  position: relative;
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0;
  transition: opacity 1.2s var(--ease-out);
}
.stage:not(.is-ready) .stage__canvas {
  opacity: 0 !important;
}
.stage.is-ready .stage__canvas {
  opacity: 1;
}
</style>
