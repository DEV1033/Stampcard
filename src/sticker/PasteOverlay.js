import * as THREE from 'three'
import { stickerVertex, stickerFragment, shadowVertex, shadowFragment } from './pasteShaders.js'

// One full-viewport WebGL layer that plays the sticker-paste effect over any
// element on the page. Scene units are CSS pixels; the camera is placed so the
// z = 0 plane lines up 1:1 with the viewport.
const FOV = 25
const SHINE_TIME = 0.9

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export class PasteOverlay {
  constructor(canvas) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000)
    this.items = new Set()
    this.textures = new Map()
    this.raf = 0
    this.onResize = () => this.resize()
    window.addEventListener('resize', this.onResize)
    this.resize()
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.w = w
    this.h = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    const d = h / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    this.camera.position.set(w / 2, h / 2, d)
    this.camera.near = d * 0.2
    this.camera.far = d * 3
    this.camera.lookAt(w / 2, h / 2, 0)
    this.camera.updateProjectionMatrix()
    if (!this.raf) this.renderer.render(this.scene, this.camera)
  }

  // SVG → high-res canvas texture (mipmapped, so the flap shadow can blur via LOD bias).
  texture(url) {
    if (!this.textures.has(url)) {
      const p = new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const H = 320
          const W = Math.max(1, Math.round((H * img.naturalWidth) / img.naturalHeight))
          const c = document.createElement('canvas')
          c.width = W
          c.height = H
          c.getContext('2d').drawImage(img, 0, 0, W, H)
          const tex = new THREE.CanvasTexture(c)
          tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
          resolve(tex)
        }
        img.onerror = reject
        img.src = url
      })
      this.textures.set(url, p)
    }
    return this.textures.get(url)
  }

  // Plays the paste on `target` (an unrotated box with the sticker's layout size).
  // pose: { url, rot (deg, CSS), dy (px, CSS), scale }; opts: { duration, angle, onStart }.
  // Returns { promise (true when finished, false if cancelled), cancel }.
  play(target, pose, { duration = 1.2, angle = 0.8, onStart } = {}) {
    let item
    let cancelled = false
    let finish
    const promise = new Promise((r) => (finish = r))
    const cancel = () => {
      cancelled = true
      if (item) this.remove(item)
      finish(false)
    }

    this.texture(pose.url)
      .then((tex) => {
        if (cancelled) return
        const s = pose.scale ?? 1
        const w = target.offsetWidth * s
        const h = target.offsetHeight * s
        const uniforms = {
          uDir: { value: new THREE.Vector2(1, 1).normalize() },
          uLine: { value: 0 },
          uCurlRadius: { value: 0.125 * Math.min(w, h) },
          uAngle: { value: angle },
          uMap: { value: tex },
          uSize: { value: new THREE.Vector2(w, h) },
          uLightDir: { value: new THREE.Vector3(-0.4, 0.5, 1) },
          uShadowDir: { value: new THREE.Vector3(-0.35, 0.45, 1) },
          uShine: { value: -10 },
          uOpacity: { value: 0 },
        }
        const geo = new THREE.PlaneGeometry(w, h, 56, 56)
        const sticker = new THREE.Mesh(
          geo,
          new THREE.ShaderMaterial({ uniforms, vertexShader: stickerVertex, fragmentShader: stickerFragment, transparent: true, side: THREE.DoubleSide })
        )
        const shadow = new THREE.Mesh(
          geo,
          new THREE.ShaderMaterial({ uniforms, vertexShader: shadowVertex, fragmentShader: shadowFragment, transparent: true, depthWrite: false })
        )
        shadow.renderOrder = 0
        sticker.renderOrder = 1
        const group = new THREE.Group()
        group.add(shadow, sticker)
        this.scene.add(group)
        // Applied from the bottom-left corner toward the top-right.
        const d = uniforms.uDir.value
        const reach = (Math.abs(d.x) * w + Math.abs(d.y) * h) / 2
        item = { target, pose, group, geo, uniforms, lo: -reach, hi: reach + 0.01, angle, duration, start: performance.now(), shineStart: 0, finish, onStart, started: false }
        this.place(item)
        this.applyFrame(item, 0)
        this.items.add(item)
        this.loop()
      })
      .catch(() => finish(false))

    return { promise, cancel }
  }

  place(item) {
    const r = item.target.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2 + (item.pose.dy ?? 0)
    item.group.position.set(cx, this.h - cy, 0)
    item.group.rotation.z = THREE.MathUtils.degToRad(-(item.pose.rot ?? 0))
  }

  applyFrame(item, t) {
    const u = item.uniforms
    // Brisk start, long soft landing.
    const glide = 0.15 * t + 0.85 * (1 - Math.pow(1 - t, 4))
    u.uLine.value = item.lo + (item.hi - item.lo) * glide
    u.uOpacity.value = smoothstep(0, 0.05, t)
    // The held-up part is lowered as it's pressed: steep at first, then flatter.
    const relax = smoothstep(0, 1, t)
    u.uAngle.value = item.angle * (1 - 0.75 * relax)
    u.uCurlRadius.value = 0.125 * Math.min(u.uSize.value.x, u.uSize.value.y) * (1 - 0.3 * relax)
  }

  loop() {
    if (this.raf) return
    const frame = (now) => {
      for (const item of this.items) {
        this.place(item)
        const t = Math.min(1, (now - item.start) / 1000 / item.duration)
        this.applyFrame(item, t)
        if (t > 0.88 && !item.shineStart) item.shineStart = now
        if (item.shineStart) {
          const k = Math.min(1, (now - item.shineStart) / 1000 / SHINE_TIME)
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
          item.uniforms.uShine.value = -2.2 + 4.4 * e
          if (k >= 1 && t >= 1) item.done = (item.done ?? 0) + 1
        }
      }
      this.renderer.render(this.scene, this.camera)
      for (const item of this.items) {
        if (!item.started) {
          item.started = true
          item.onStart?.()
        }
        // Let the page show the real element first, then drop the WebGL copy a frame later.
        if (item.done === 1) item.finish(true)
        else if (item.done > 1) this.remove(item)
      }
      if (this.items.size) this.raf = requestAnimationFrame(frame)
      else {
        this.raf = 0
        this.renderer.render(this.scene, this.camera) // clear
      }
    }
    this.raf = requestAnimationFrame(frame)
  }

  remove(item) {
    if (!this.items.has(item)) return
    this.items.delete(item)
    this.scene.remove(item.group)
    item.geo.dispose()
    item.group.children.forEach((m) => m.material.dispose())
    if (!this.raf) this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    window.removeEventListener('resize', this.onResize)
    for (const item of [...this.items]) this.remove(item)
    this.textures.forEach((p) => p.then((t) => t.dispose()).catch(() => {}))
    this.renderer.dispose()
  }
}
