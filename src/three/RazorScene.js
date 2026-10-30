import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  Shape,
  ExtrudeGeometry,
  CylinderGeometry,
  MeshPhysicalMaterial,
  MeshBasicMaterial,
  PlaneGeometry,
  CanvasTexture,
  DirectionalLight,
  HemisphereLight,
  PointLight,
  PMREMGenerator,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  RepeatWrapping,
  MathUtils,
  Timer,
  Vector2,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// A straight razor built entirely from code (no model download): a brushed
// steel blade with jimps on the tang, horn scales, brass pins and a wedge.
// The blade pivots open with `state.open` (0 closed, 1 open).

const BLADE_LEN = 9.9
const SCALE_Y = -0.62

function canvasTexture(w, h, draw, repeat = false) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new CanvasTexture(c)
  if (repeat) tex.wrapS = tex.wrapT = RepeatWrapping
  tex.anisotropy = 4
  return tex
}

// Hollow-grind look: satin spine, darker mirror belly, bright honed edge.
function bladeMaps(lowPower) {
  const w = lowPower ? 512 : 1024
  const h = 256
  const color = canvasTexture(w, h, (g) => {
    const grad = g.createLinearGradient(0, h, 0, 0)
    grad.addColorStop(0.0, '#fffaf0')
    grad.addColorStop(0.05, '#e9e3d8')
    grad.addColorStop(0.12, '#5d5953')
    grad.addColorStop(0.42, '#d8d2c6')
    grad.addColorStop(0.7, '#8f887d')
    grad.addColorStop(0.77, '#f2ece2')
    grad.addColorStop(0.83, '#b4ada1')
    grad.addColorStop(1.0, '#d9d2c5')
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  })
  const rough = canvasTexture(w, h, (g) => {
    g.fillStyle = '#3a3a3a'
    g.fillRect(0, 0, w, h)
    // brushed lines along the blade
    for (let i = 0; i < 900; i++) {
      const y = Math.random() * h
      g.strokeStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${0.05 + Math.random() * 0.1})`
      g.lineWidth = Math.random() * 1.2
      g.beginPath()
      g.moveTo(Math.random() * w * 0.3, y)
      g.lineTo(w * (0.6 + Math.random() * 0.4), y + (Math.random() - 0.5) * 2)
      g.stroke()
    }
    // honed edge is almost mirror
    g.fillStyle = '#101010'
    g.fillRect(0, h * 0.93, w, h * 0.07)
  })
  for (const t of [color, rough]) {
    // ExtrudeGeometry caps use shape coordinates as UVs: x ∈ [-3, 10], y ∈ [-1.6, 0.45]
    t.repeat.set(1 / 13, 1 / 2.05)
    t.offset.set(3 / 13, 1.6 / 2.05)
  }
  color.colorSpace = SRGBColorSpace
  return { color, rough }
}

function hornTexture() {
  const tex = canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#20150f'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 160; i++) {
      const y = Math.random() * h
      const a = 0.04 + Math.random() * 0.12
      g.strokeStyle = Math.random() > 0.7 ? `rgba(152,118,83,${a})` : `rgba(8,6,5,${a * 2})`
      g.lineWidth = 1 + Math.random() * 6
      g.beginPath()
      g.moveTo(0, y)
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6 + (Math.random() - 0.5) * 3)
      g.stroke()
    }
  })
  tex.colorSpace = SRGBColorSpace
  tex.repeat.set(1 / 13, 1 / 2.2)
  tex.offset.set(1 / 13, 1.7 / 2.2)
  return tex
}

function shadowTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    r.addColorStop(0, 'rgba(0,0,0,0.55)')
    r.addColorStop(0.55, 'rgba(0,0,0,0.18)')
    r.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = r
    g.fillRect(0, 0, w, h)
  })
}

function bladeShape() {
  const s = new Shape()
  s.moveTo(-2.6, -0.05)
  s.quadraticCurveTo(-2.78, 0.36, -2.36, 0.42)
  // jimps: fine grip notches along the top of the tang
  for (let x = -2.1; x < -0.7; x += 0.14) {
    s.lineTo(x, 0.42)
    s.lineTo(x + 0.07, 0.37)
  }
  s.lineTo(0.6, 0.42)
  s.lineTo(1.25, 0.36)
  s.lineTo(BLADE_LEN - 0.5, 0.36)
  s.quadraticCurveTo(BLADE_LEN + 0.05, 0.32, BLADE_LEN, -0.4)
  s.lineTo(BLADE_LEN - 0.2, -1.55)
  s.lineTo(1.65, -1.55)
  s.quadraticCurveTo(1.0, -1.55, 0.9, -0.9)
  s.quadraticCurveTo(0.8, -0.34, 0.35, -0.32)
  s.lineTo(-2.3, -0.32)
  s.quadraticCurveTo(-2.6, -0.3, -2.6, -0.05)
  return s
}

function scaleShape() {
  const y = SCALE_Y
  const s = new Shape()
  s.moveTo(-0.3, y + 0.78)
  s.bezierCurveTo(-1.15, y + 0.78, -1.15, y - 0.8, -0.3, y - 0.8)
  s.bezierCurveTo(4, y - 1.02, 8, y - 1.06, 11.0, y - 0.92)
  s.bezierCurveTo(11.95, y - 0.86, 11.95, y + 0.86, 11.0, y + 0.92)
  s.bezierCurveTo(8, y + 1.06, 4, y + 1.02, -0.3, y + 0.78)
  return s
}

function buildRazor(lowPower) {
  const maps = bladeMaps(lowPower)
  const steel = new MeshPhysicalMaterial({
    color: 0xffffff,
    map: maps.color,
    metalness: 1,
    roughness: 0.24,
    roughnessMap: maps.rough,
    anisotropy: lowPower ? 0 : 0.7,
    clearcoat: lowPower ? 0 : 0.4,
    clearcoatRoughness: 0.15,
  })
  const horn = new MeshPhysicalMaterial({
    color: 0xffffff,
    map: hornTexture(),
    metalness: 0,
    roughness: 0.42,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
    sheen: 0.3,
    sheenColor: 0x987653,
  })
  const brass = new MeshPhysicalMaterial({ color: 0xb48a5c, metalness: 1, roughness: 0.26, clearcoat: 0.5 })

  const bevelSeg = lowPower ? 1 : 3
  const curveSeg = lowPower ? 10 : 24

  const bladeDepth = 0.1
  const bladeGeo = new ExtrudeGeometry(bladeShape(), {
    depth: bladeDepth,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: bevelSeg,
    curveSegments: curveSeg,
  })
  bladeGeo.translate(0, 0, -bladeDepth / 2)
  const blade = new Mesh(bladeGeo, steel)

  const pivot = new Group()
  pivot.add(blade)

  const scaleDepth = 0.2
  const scaleGeo = new ExtrudeGeometry(scaleShape(), {
    depth: scaleDepth,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.08,
    bevelSegments: lowPower ? 2 : 5,
    curveSegments: curveSeg * 2,
  })
  scaleGeo.translate(0, 0, -scaleDepth / 2)
  const gap = bladeDepth / 2 + 0.07 + scaleDepth / 2 + 0.09
  const scaleA = new Mesh(scaleGeo, horn)
  scaleA.position.z = gap
  const scaleB = new Mesh(scaleGeo, horn)
  scaleB.position.z = -gap

  const handle = new Group()
  handle.add(scaleA, scaleB)

  const pinLen = gap * 2 + scaleDepth + 0.24
  const radial = lowPower ? 16 : 32
  const pinGeo = new CylinderGeometry(0.11, 0.11, pinLen, radial)
  pinGeo.rotateX(Math.PI / 2)
  const collarGeo = new CylinderGeometry(0.24, 0.24, 0.035, radial)
  collarGeo.rotateX(Math.PI / 2)
  for (const [x, y] of [
    [0, 0],
    [10.85, SCALE_Y],
  ]) {
    const pin = new Mesh(pinGeo, brass)
    pin.position.set(x, y, 0)
    handle.add(pin)
    for (const z of [pinLen / 2 - 0.02, -pinLen / 2 + 0.02]) {
      const c = new Mesh(collarGeo, brass)
      c.position.set(x, y, z)
      handle.add(c)
    }
  }
  // wedge between the scales at the far end
  const wedgeShape = new Shape()
  wedgeShape.moveTo(10.1, SCALE_Y - 0.62)
  wedgeShape.lineTo(11.35, SCALE_Y - 0.7)
  wedgeShape.quadraticCurveTo(11.75, SCALE_Y, 11.35, SCALE_Y + 0.7)
  wedgeShape.lineTo(10.1, SCALE_Y + 0.62)
  wedgeShape.lineTo(10.1, SCALE_Y - 0.62)
  const wedgeDepth = gap * 2 - scaleDepth
  const wedgeGeo = new ExtrudeGeometry(wedgeShape, { depth: wedgeDepth, bevelEnabled: false, curveSegments: 12 })
  wedgeGeo.translate(0, 0, -wedgeDepth / 2)
  handle.add(new Mesh(wedgeGeo, brass))

  const inner = new Group()
  inner.add(handle, pivot)

  const root = new Group()
  root.add(inner)
  return { root, inner, pivot }
}

const lerp = MathUtils.lerp

export class RazorScene {
  constructor(canvas, { lowPower = false, onFirstFrame } = {}) {
    this.canvas = canvas
    this.lowPower = lowPower
    this.onFirstFrame = onFirstFrame
    this.renderer = new WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2))
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)

    this.scene = new Scene()
    const pmrem = new PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.85
    pmrem.dispose()

    this.camera = new PerspectiveCamera(30, 1, 0.1, 100)
    this.camera.position.set(0, 0, 26)

    const key = new DirectionalLight(0xffd6a0, 2.6)
    key.position.set(6, 9, 10)
    const rim = new DirectionalLight(0xc0885a, 3.2)
    rim.position.set(-9, 3, -7)
    const top = new DirectionalLight(0xf0e9de, 0.9)
    top.position.set(0, 12, 2)
    this.glow = new PointLight(0xd6a46b, 18, 30, 1.6)
    this.glow.position.set(3, -2, 6)
    this.scene.add(key, rim, top, this.glow, new HemisphereLight(0xf0e9de, 0x30241e, 0.35))

    const { root, inner, pivot } = buildRazor(lowPower)
    this.root = root
    this.inner = inner
    this.pivot = pivot
    this.scene.add(root)

    this.shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }))
    this.shadow.rotation.x = -Math.PI / 2
    this.scene.add(this.shadow)

    // current & target transform; targets are written by scroll choreography
    const base = { open: 0, rx: 0.3, ry: -0.4, rz: 0.25, x: 0, y: 0, z: 0, s: 0.6, shadow: 1 }
    this.current = { ...base }
    this.target = { ...base }
    this.mouse = new Vector2()
    this.mouseSmooth = new Vector2()
    this.idle = true
    this.clock = new Timer()
    this.running = false
    this.firstFrame = false
    this.frameSkip = lowPower ? 1 : 0
    this._frame = 0

    this._onMouse = (e) => {
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
    }
    this._onResize = () => this.resize()
    this._onVis = () => (document.hidden ? this.stop() : this.start())
    window.addEventListener('pointermove', this._onMouse, { passive: true })
    window.addEventListener('resize', this._onResize)
    document.addEventListener('visibilitychange', this._onVis)
    this.resize()
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // keep the object's apparent size steady on narrow screens
    this.camera.fov = w / h < 0.8 ? 44 : 30
    this.camera.updateProjectionMatrix()
    this.renderOnce()
  }

  set(state) {
    Object.assign(this.target, state)
  }

  jump(state) {
    Object.assign(this.target, state)
    Object.assign(this.current, state)
  }

  apply() {
    const c = this.current
    const t = this.clock.getElapsed()
    const float = this.idle ? Math.sin(t * 0.7) * 0.12 : 0
    const sway = this.idle ? Math.sin(t * 0.45) * 0.06 : 0
    // blade swings from closed (0) to resting open (~165°)
    this.pivot.rotation.z = c.open * Math.PI * 0.92
    // keep the composition centred whether open or closed
    this.inner.position.x = -lerp(5.4, 0.9, c.open)
    this.inner.position.y = lerp(0.3, -0.2, c.open)
    this.root.position.set(c.x, c.y + float, c.z)
    this.root.rotation.set(c.rx + sway, c.ry + this.mouseSmooth.x * 0.22, c.rz + this.mouseSmooth.y * 0.08)
    this.root.scale.setScalar(c.s)
    this.shadow.position.set(c.x, c.y - 4.2 * c.s - 1.2, c.z - 1)
    this.shadow.scale.set(22 * c.s, 6 * c.s, 1)
    this.shadow.material.opacity = 0.7 * c.shadow
    this.camera.position.x = this.mouseSmooth.x * 1.1
    this.camera.position.y = this.mouseSmooth.y * 0.7
    this.camera.lookAt(0, 0, 0)
  }

  tick = () => {
    if (!this.running) return
    this._raf = requestAnimationFrame(this.tick)
    this.clock.update()
    const dt = Math.min(this.clock.getDelta(), 0.05)
    if (this.frameSkip && this._frame++ % (this.frameSkip + 1)) return
    const k = 1 - Math.exp(-dt * 4.2)
    for (const key in this.target) this.current[key] = lerp(this.current[key], this.target[key], k)
    this.mouseSmooth.lerp(this.mouse, 1 - Math.exp(-dt * 2.5))
    this.apply()
    this.renderer.render(this.scene, this.camera)
    if (!this.firstFrame) {
      this.firstFrame = true
      this.onFirstFrame?.()
    }
  }

  renderOnce() {
    this.apply()
    this.renderer.render(this.scene, this.camera)
    if (!this.firstFrame) {
      this.firstFrame = true
      this.onFirstFrame?.()
    }
  }

  start() {
    if (this.running) return
    this.running = true
    this.clock.update()
    this.tick()
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this._raf)
  }

  dispose() {
    this.stop()
    window.removeEventListener('pointermove', this._onMouse)
    window.removeEventListener('resize', this._onResize)
    document.removeEventListener('visibilitychange', this._onVis)
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        for (const k of ['map', 'roughnessMap']) o.material[k]?.dispose()
        o.material.dispose()
      }
    })
    this.scene.environment?.dispose()
    this.renderer.dispose()
  }
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch {
    return false
  }
}
