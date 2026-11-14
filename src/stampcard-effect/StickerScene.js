import * as THREE from 'three'
import { animate } from 'framer-motion'
import {
  stickerVertex,
  stickerFragment,
  shadowVertex,
  shadowFragment,
} from './shaders.js'

// The stamp geometry below has the same proportions as the static
// `.stamp-thumb` (7:9, margin 9/112, holes 4.5/112 every 16/112 of its width),
// and resize() scales the scene so the stamp is STAMP_FRACTION of the canvas
// width, exactly like the CSS stamp is 70% of its cell. The WebGL stamp can
// then be swapped for the plain <img> without a visible jump.
const STAMP_FRACTION = 0.7
const STAMP_W = 1.12
const STAMP_H = 1.44
const BORDER = 0.09
const HOLE_RADIUS = 0.045
const HOLE_SPACING = 0.16
const FOV = 25

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export class StickerScene {
  // stampFraction: how much of the canvas width the flat stamp spans. The
  // canvas can be bigger than the stamp's cell so the lifted flap has room.
  constructor(canvas, { stampFraction = STAMP_FRACTION } = {}) {
    this.stampFraction = stampFraction
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50)
    this.camera.position.set(0, 0, 4)

    this.uniforms = {
      // Applied from the bottom-left corner towards the top-right.
      uDir: { value: new THREE.Vector2(1, 1).normalize() },
      uLine: { value: 0 },
      uCurlRadius: { value: 0.1 },
      uAngle: { value: 0.45 },
      uLift: { value: 0 },
      uMap: { value: null },
      uUvScale: { value: new THREE.Vector2(1, 1) },
      uUvOffset: { value: new THREE.Vector2(0, 0) },
      uSize: { value: new THREE.Vector2(STAMP_W, STAMP_H) },
      uCorner: { value: 0 },
      uBorder: { value: BORDER },
      uPerf: {
        value: new THREE.Vector2(
          STAMP_W / Math.round(STAMP_W / HOLE_SPACING),
          STAMP_H / Math.round(STAMP_H / HOLE_SPACING),
        ),
      },
      uHoleR: { value: HOLE_RADIUS },
      uLightDir: { value: new THREE.Vector3(-0.4, 0.5, 1) },
      uShadowDir: { value: new THREE.Vector3(-0.35, 0.45, 1) },
      uShine: { value: -10 },
      uOpacity: { value: 0 },
    }

    const mat = (vertexShader, fragmentShader, extra = {}) =>
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, transparent: true, ...extra })
    this.stickerMat = mat(stickerVertex, stickerFragment, { side: THREE.DoubleSide })
    // Shadow cast on the surface by the lifted flap only. The stamp's regular
    // drop shadow comes from the CSS filter on the canvas (see overlay).
    this.shadowMat = mat(shadowVertex, shadowFragment, { depthWrite: false })

    this.geometry = new THREE.PlaneGeometry(STAMP_W, STAMP_H, 140, 90)
    const shadow = new THREE.Mesh(this.geometry, this.shadowMat)
    this.sticker = new THREE.Mesh(this.geometry, this.stickerMat)
    shadow.renderOrder = 0
    this.sticker.renderOrder = 1
    this.scene.add(shadow, this.sticker)

    // The press line starts exactly on the bottom-left corner and ends just
    // past the top-right one.
    const d = this.uniforms.uDir.value
    const reach = (Math.abs(d.x) * STAMP_W + Math.abs(d.y) * STAMP_H) / 2
    this.range = [-reach, reach + 0.001]

    this.controls = []
    this.playId = 0
    this.ready = false
    const loop = () => {
      this.raf = requestAnimationFrame(loop)
      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  resize(w, h) {
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // Place the camera so the stamp on the z = 0 surface spans
    // STAMP_FRACTION of the canvas width.
    const pxPerUnit = (w * this.stampFraction) / STAMP_W
    const halfHeight = h / pxPerUnit / 2
    this.camera.position.z = halfHeight / Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    this.camera.updateProjectionMatrix()
  }

  async setImage(url) {
    const texture = await new THREE.TextureLoader().loadAsync(url)
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
    this.uniforms.uMap.value?.dispose()
    this.uniforms.uMap.value = texture

    // object-fit: cover inside the stamp's image area.
    const imgAspect = texture.image.width / texture.image.height
    const boxAspect = (STAMP_W - 2 * BORDER) / (STAMP_H - 2 * BORDER)
    const scale = this.uniforms.uUvScale.value
    const offset = this.uniforms.uUvOffset.value
    if (imgAspect > boxAspect) scale.set(boxAspect / imgAspect, 1)
    else scale.set(1, imgAspect / boxAspect)
    offset.set((1 - scale.x) / 2, (1 - scale.y) / 2)
    this.ready = true
  }

  stop() {
    this.playId++
    this.controls.forEach((c) => c.stop())
    this.controls = []
  }

  tween(from, to, options) {
    const c = animate(from, to, options)
    this.controls.push(c)
    return c
  }

  shine() {
    return this.tween(-2.2, 2.2, {
      duration: 1.1,
      ease: [0.45, 0, 0.55, 1],
      onUpdate: (v) => (this.uniforms.uShine.value = v),
    })
  }

  showApplied() {
    this.stop()
    const u = this.uniforms
    u.uLine.value = this.range[1]
    u.uLift.value = 0
    u.uOpacity.value = 1
  }

  // Resolves once the stamp is fully down and the shine has finished.
  async play() {
    if (!this.ready) return
    this.stop()
    const id = this.playId
    const u = this.uniforms
    const [lo, hi] = this.range

    // Starts from zero: the bottom-left corner already rests on the surface
    // (no hover height) and nothing else is stuck yet. The rest is held up
    // at an angle, like a sticker pinched between finger and thumb.
    const LIFT = 0
    const ANGLE = 0.8
    const RADIUS = 0.14
    this.applyFrame(0, { lo, hi, LIFT, ANGLE, RADIUS })
    u.uShine.value = -10

    // A single linear timeline; every parameter is shaped from it with
    // smooth curves, so nothing starts or stops abruptly.
    let shineCtrl = null
    await this.tween(0, 1, {
      duration: 1.7,
      ease: 'linear',
      onUpdate: (t) => {
        this.applyFrame(t, { lo, hi, LIFT, ANGLE, RADIUS })
        if (!shineCtrl && t > 0.88 && id === this.playId) shineCtrl = this.shine()
      },
    })
    if (shineCtrl && id === this.playId) await shineCtrl
  }

  applyFrame(t, { lo, hi, LIFT, ANGLE, RADIUS }) {
    const u = this.uniforms
    // Application line: brisk start, long soft landing (quintic ease-out
    // blended with a little linear so the start isn't a jolt).
    const glide = 0.15 * t + 0.85 * (1 - Math.pow(1 - t, 4))
    u.uLine.value = lo + (hi - lo) * glide
    // A real sticker is opaque; only the very first frames ease in.
    u.uOpacity.value = smoothstep(0, 0.05, t)
    u.uLift.value = LIFT * (1 - smoothstep(0, 0.32, t))
    // The held-up flap is lowered as it's pressed down: steep at first, then
    // flatter and with a looser bend as less of it is left to stick.
    const relax = smoothstep(0, 1, t)
    u.uAngle.value = ANGLE * (1 - 0.75 * relax)
    u.uCurlRadius.value = RADIUS * (1 - 0.3 * relax)
  }

  dispose() {
    this.stop()
    cancelAnimationFrame(this.raf)
    this.geometry.dispose()
    this.uniforms.uMap.value?.dispose()
    this.stickerMat.dispose()
    this.shadowMat.dispose()
    this.renderer.dispose()
  }
}
