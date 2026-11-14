import * as THREE from 'three'

// Dissolves a stamp into sand: it erodes in irregular patches, grains pour
// straight down and pile up into a heap with natural sloping sides on a
// "floor" line, then the heap fades away.
//
// The stamp is redrawn into a tiny offscreen canvas (one pixel per grain,
// with the same margin, cover-cropped image and perforation holes as the
// .stamp-thumb CSS), so every grain takes its colour from the stamp and grains
// only exist where the paper does. Physics and the sandpile run on the CPU;
// all grains are drawn in one instanced draw call as small round dots.

const VERT = /* glsl */ `
  attribute vec2 aOffset;
  attribute vec4 aColor;
  uniform float uSize;
  uniform float uFade;
  varying vec4 vColor;
  varying vec2 vUv;

  void main() {
    vUv = position.xy;
    vColor = vec4(aColor.rgb, aColor.a * uFade);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(aOffset + position.xy * uSize, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  varying vec4 vColor;
  varying vec2 vUv;

  void main() {
    // Round grain with a soft edge and a hint of shading, top-left lit.
    float r = length(vUv);
    float edge = 1.0 - smoothstep(0.38, 0.5, r);
    if (edge * vColor.a < 0.004) discard;
    float shade = 1.0 - 0.18 * smoothstep(0.0, 0.5, length(vUv - vec2(-0.12, 0.12)));
    gl_FragColor = vec4(vColor.rgb * shade, vColor.a * edge);
  }
`

const GRAVITY = 750 // px/s²
const ERODE_TIME = 1.3 // s for the whole stamp to crumble
const PILE_STEP = 0.2 // heap height added per grain, in grain sizes (sand packs densely)
const REPOSE = 1.6 // max height difference between neighbouring columns (grain sizes)
const SETTLE_DELAY = 0.5 // s the finished heap rests before fading
const FADE_TIME = 0.9

function drawStamp(g, img, w, h) {
  // Same proportions as .stamp-thumb: 7:9, margin 9/112, holes r 4.5/112,
  // 7 holes across and 9 down, one in each corner.
  const margin = (w * 9) / 112
  const holeR = (w * 4.5) / 112
  g.fillStyle = '#fffefb'
  g.fillRect(0, 0, w, h)

  const iw = w - 2 * margin
  const ih = h - 2 * margin
  const s = Math.max(iw / img.naturalWidth, ih / img.naturalHeight)
  const sw = iw / s
  const sh = ih / s
  g.imageSmoothingQuality = 'high'
  g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, margin, margin, iw, ih)

  g.globalCompositeOperation = 'destination-out'
  g.beginPath()
  const hole = (x, y) => {
    g.moveTo(x + holeR, y)
    g.arc(x, y, holeR, 0, Math.PI * 2)
  }
  for (let i = 0; i <= 7; i++) {
    hole((i * w) / 7, 0)
    hole((i * w) / 7, h)
  }
  for (let j = 0; j <= 9; j++) {
    hole(0, (j * h) / 9)
    hole(w, (j * h) / 9)
  }
  g.fill()
  g.globalCompositeOperation = 'source-over'
}

// Smooth 2D value noise in 0..1, for patchy erosion.
function makeNoise(cells) {
  const grid = Array.from({ length: (cells + 1) * (cells + 1) }, Math.random)
  const at = (i, j) => grid[j * (cells + 1) + i]
  const fade = (t) => t * t * (3 - 2 * t)
  return (u, v) => {
    const x = u * cells
    const y = v * cells
    const i = Math.min(cells - 1, Math.floor(x))
    const j = Math.min(cells - 1, Math.floor(y))
    const fx = fade(x - i)
    const fy = fade(y - j)
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * fx
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fx
    return a + (b - a) * fy
  }
}

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas  overlay canvas covering the area
 * @param {number} o.width   overlay size in CSS px
 * @param {number} o.height
 * @param {string} o.imageUrl
 * @param {{x:number,y:number,w:number,h:number}} o.rect  stamp box within the overlay
 * @param {number} o.groundY  y (CSS px) of the floor the sand lands on
 * @param {number} [o.grain]  grain size in CSS px
 * @returns {Promise<{ firstFrame: Promise<void>, done: Promise<void>, dispose: () => void }>}
 */
export async function dissolveToSand({ canvas, width, height, imageUrl, rect, groundY, grain = 4 }) {
  const img = new Image()
  img.src = imageUrl
  await img.decode()

  const cols = Math.max(8, Math.round(rect.w / grain))
  const rows = Math.max(8, Math.round(rect.h / grain))
  const cw = rect.w / cols
  const ch = rect.h / rows
  const size = Math.max(cw, ch)

  const off = document.createElement('canvas')
  off.width = cols
  off.height = rows
  const g = off.getContext('2d', { willReadFrequently: true })
  drawStamp(g, img, cols, rows)
  const px = g.getImageData(0, 0, cols, rows).data

  const noise = makeNoise(5)
  const rand = (a, b) => a + Math.random() * (b - a)

  // Grains where the stamp has paper.
  const grains = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 4
      if (px[k + 3] < 128) continue
      const u = i / cols
      const v = j / rows
      // Patchy erosion, a little earlier towards the top.
      const order = 0.7 * noise(u, v) + 0.3 * v
      grains.push({
        x: rect.x + (i + 0.5) * cw,
        y: rect.y + (j + 0.5) * ch,
        // Slight per-grain tone variation, like real sand.
        tone: rand(0.9, 1.06),
        r: px[k] / 255,
        g: px[k + 1] / 255,
        b: px[k + 2] / 255,
        release: Math.min(1, order) * ERODE_TIME + rand(0, 0.12),
      })
    }
  }
  const n = grains.length

  const pos = new Float32Array(n * 2)
  const vel = new Float32Array(n * 2)
  const colors = new Float32Array(n * 4)
  const release = new Float32Array(n)
  const landed = new Uint8Array(n)
  grains.forEach((p, i) => {
    pos[i * 2] = p.x
    pos[i * 2 + 1] = p.y
    vel[i * 2] = rand(-9, 9)
    vel[i * 2 + 1] = rand(0, 20)
    colors.set([Math.min(1, p.r * p.tone), Math.min(1, p.g * p.tone), Math.min(1, p.b * p.tone), 1], i * 4)
    release[i] = p.release
  })

  // Sandpile: a height map of columns across the floor.
  const colW = size * 0.9
  const pileCols = Math.ceil(width / colW)
  const heights = new Float32Array(pileCols)
  const settle = (x) => {
    let c = Math.min(pileCols - 1, Math.max(0, Math.floor(x / colW)))
    // Roll downhill while a neighbour is lower than the angle of repose allows.
    for (let step = 0; step < 40; step++) {
      const l = c > 0 ? heights[c - 1] : Infinity
      const r = c < pileCols - 1 ? heights[c + 1] : Infinity
      const lowL = heights[c] - l > REPOSE
      const lowR = heights[c] - r > REPOSE
      if (!lowL && !lowR) break
      if (lowL && lowR) c += Math.random() < 0.5 ? -1 : 1
      else c += lowL ? -1 : 1
    }
    const h = heights[c]
    heights[c] += PILE_STEP
    return { x: (c + 0.5) * colW + rand(-0.3, 0.3) * size, y: groundY - (h + 0.5) * size * 0.9 }
  }

  // three.js: one instanced dot per grain, camera in CSS pixels (y down).
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height, false)
  const camera = new THREE.OrthographicCamera(0, width, 0, height, -10, 10)
  const scene = new THREE.Scene()

  const base = new THREE.PlaneGeometry(1, 1)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = base.index
  geo.setAttribute('position', base.getAttribute('position'))
  const aOffset = new THREE.InstancedBufferAttribute(pos, 2)
  aOffset.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('aOffset', aOffset)
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 4))
  geo.instanceCount = n

  // Slightly larger than the cell so the intact stamp has no gaps.
  const uniforms = { uSize: { value: size * 1.45 }, uFade: { value: 1 } }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  scene.add(mesh)

  let raf
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(raf)
    base.dispose()
    geo.dispose()
    mat.dispose()
    renderer.dispose()
  }

  // Draw the intact stamp once before anything moves, so the caller can hide
  // the real stamp underneath without a visible change.
  renderer.render(scene, camera)
  const firstFrame = Promise.resolve()

  const done = new Promise((resolve) => {
    const start = performance.now()
    let last = start
    let settled = 0
    let allLandedAt = null

    const step = (now) => {
      if (disposed) return resolve()
      const t = (now - start) / 1000
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now

      for (let i = 0; i < n; i++) {
        if (landed[i] || t < release[i]) continue
        const ix = i * 2
        const iy = ix + 1
        vel[iy] += GRAVITY * dt
        vel[ix] *= Math.pow(0.5, dt)
        pos[ix] += vel[ix] * dt
        pos[iy] += vel[iy] * dt

        // Reached the heap at this x? Settle into the pile.
        const c = Math.min(pileCols - 1, Math.max(0, Math.floor(pos[ix] / colW)))
        const top = groundY - heights[c] * size * 0.9
        if (pos[iy] >= top - size * 0.5) {
          const spot = settle(pos[ix])
          pos[ix] = spot.x
          pos[iy] = spot.y
          landed[i] = 1
          settled++
        }
      }

      // Safety net: never run longer than a few seconds.
      if ((settled === n || t > 6) && allLandedAt === null) allLandedAt = t
      let fade = 0
      if (allLandedAt !== null) {
        const f = Math.min(1, Math.max(0, (t - allLandedAt - SETTLE_DELAY) / FADE_TIME))
        fade = f * f * (3 - 2 * f)
      }
      aOffset.needsUpdate = true
      uniforms.uFade.value = 1 - fade
      renderer.render(scene, camera)

      if (fade >= 1) {
        dispose()
        resolve()
      } else {
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
  })

  return { firstFrame, done, dispose }
}
