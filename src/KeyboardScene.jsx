import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// Warm, minimal, outlined palette for the keyboard.
const C = {
  cap: '#FBF6EC',
  side: '#E8DCC8',
  line: '#4A3B2E',
  press: '#F1BD4C',
  baseCap: '#F3EADB',
  baseSide: '#DCCBB0',
  label: '#4A3B2E',
  skin: '#E8B597',
  nail: '#F4D9CF',
  sleeve: '#3A3632',
}

// [id, widthInUnits, label]
const ROWS = [
  [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['del', 2, 'del']],
  [['tab', 1.5, 'tab'], ...'qwertyuiop'.split('').map((k) => [k, 1]), ['[', 1], [']', 1], ['\\', 1.5]],
  [['caps', 1.75, 'caps'], ...'asdfghjkl'.split('').map((k) => [k, 1]), [';', 1], ["'", 1], ['enter', 2.25, 'enter']],
  [['shiftL', 2.25, 'shift'], ...'zxcvbnm'.split('').map((k) => [k, 1]), [',', 1], ['.', 1], ['/', 1], ['shiftR', 2.75, 'shift']],
  [['fn', 1.25, 'fn'], ['ctrl', 1.25, 'ctrl'], ['alt', 1.25, 'alt'], ['space', 6.25, ''], ['altR', 1.25, 'alt'], ['fnR', 1.25, 'fn'], ['ctrlR', 1.25, 'ctrl']],
]

const UNIT = 1
const GAP = 0.14
const KEY_H = 0.32
const BOARD_W = 15 * UNIT
const ROWS_D = ROWS.length * UNIT
const BASE_W = BOARD_W + 0.7
const BASE_D = ROWS_D + 0.9

// Key centres on the board.
const KEY_POS = new Map()
ROWS.forEach((row, r) => {
  let x = -BOARD_W / 2
  const z = -ROWS_D / 2 + UNIT / 2 + r * UNIT
  row.forEach(([id, w]) => {
    KEY_POS.set(id, { x: x + (w * UNIT) / 2, z })
    x += w * UNIT
  })
})

// ---------- Hands ----------
// Rigged hand meshes (WebXR "generic-hand", MIT) are in metres; 1 key unit ≈ 19 mm.
const SCALE = 50
const TIP_DZ = 0.25 // fingertips land a little below key centre so the key stays visible
const TIP_Y = KEY_H + 0.36 // fingertip joint height when touching a key top
const HOVER = 0.08
const PRESS_DELAY = 0.06 // key goes down once the finger arrives
const DIP_COUPLE = 0.75 // last joint bends with the middle one, like a real finger

const HANDS = [
  {
    file: '/hands/left.glb',
    s: 1, // +x points toward the centre of the board for the left hand
    yaw: -0.2,
    fingers: {
      'pinky-finger': { home: 'a', keys: '` 1 q a z tab caps shiftL fn ctrl' },
      'ring-finger': { home: 's', keys: '2 w s x alt' },
      'middle-finger': { home: 'd', keys: '3 e d c' },
      'index-finger': { home: 'f', keys: '4 5 r t f g v b' },
      thumb: { keys: '' },
    },
  },
  {
    file: '/hands/right.glb',
    s: -1,
    yaw: 0.2,
    fingers: {
      'pinky-finger': { home: ';', keys: "0 - = p [ ] \\ ; ' / enter shiftR del altR fnR ctrlR" },
      'ring-finger': { home: 'l', keys: '9 o l .' },
      'middle-finger': { home: 'k', keys: '8 i k ,' },
      'index-finger': { home: 'j', keys: '6 7 y u h j n m' },
      thumb: { keys: 'space' },
    },
  },
]

function roundedRectShape(w, d, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -d / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + d - r)
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d)
  s.lineTo(x + r, y + d)
  s.quadraticCurveTo(x, y + d, x, y + d - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

function slab(w, d, h, r) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), {
    depth: h,
    bevelEnabled: false,
    curveSegments: 8,
  })
  g.rotateX(-Math.PI / 2) // extrude upward (+y), shape depth runs along -z
  return g
}

function labelTexture(text, wUnits) {
  const scale = 128
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(scale * wUnits)
  canvas.height = scale
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = C.label
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const isWord = text.length > 1
  ctx.font = `${isWord ? 400 : 500} ${isWord ? 28 : 44}px 'Fira Code', ui-monospace, monospace`
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// Ribbed knit for the sleeves.
function knitTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(128, 128)
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const rib = 0.5 + 0.5 * Math.cos((x / 128) * Math.PI * 2 * 4)
      const stitch = 0.5 + 0.5 * Math.cos((y / 128) * Math.PI * 2 * 8 + (x % 32 < 16 ? 0 : Math.PI))
      const v = 70 + rib * 120 + stitch * 40 + (Math.random() - 0.5) * 30
      const i = (y * 128 + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(10, 24)
  return tex
}

const _q = new THREE.Quaternion()
const _ta = new THREE.Matrix4()
const _tb = new THREE.Matrix4()
// Rotation about an axis through a pivot point.
function rotAbout(out, pivot, axis, angle) {
  _q.setFromAxisAngle(axis, angle)
  _ta.makeTranslation(pivot.x, pivot.y, pivot.z)
  _tb.makeRotationFromQuaternion(_q)
  out.multiplyMatrices(_ta, _tb)
  _ta.makeTranslation(-pivot.x, -pivot.y, -pivot.z)
  return out.multiply(_ta)
}

// Builds a solver for one finger from the bone rest pose (bones are siblings, so we drive them all directly).
// joints: indices of the three bending joints in `bones`; the last bone is the tip.
function makeFinger(bones, joints, palmN, opts) {
  const rest = bones.map((b) => b.matrix.clone())
  const P = bones.map((b) => b.position.clone())
  const J = joints.map((j) => P[j])
  const E = P[P.length - 1]
  const n = palmN.clone()
  const d = E.clone().sub(J[0])
  d.addScaledVector(n, -d.dot(n)).normalize()
  const a = new THREE.Vector3().crossVectors(d, n).normalize()
  const ends = [J[1], J[2], E]
  const seg = J.map((j, k) => {
    const v = ends[k].clone().sub(j)
    return { L: v.length(), phi: Math.atan2(v.dot(n), v.dot(d)) }
  })
  const reach = seg.reduce((s, x) => s + x.L, 0)
  const fk = (t1, t2) => {
    const ang = [seg[0].phi + t1, seg[1].phi + t1 + t2, seg[2].phi + t1 + t2 + DIP_COUPLE * t2]
    let u = 0
    let v = 0
    seg.forEach((sg, k) => {
      u += sg.L * Math.cos(ang[k])
      v += sg.L * Math.sin(ang[k])
    })
    return [u, v]
  }
  const G = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()]
  const tmp = new THREE.Matrix4()
  const rel = new THREE.Vector3()
  const cr = new THREE.Vector3()
  // Which transform drives each bone: bones before joint 0 stay put.
  const driver = bones.map((_, i) => {
    let k = -1
    joints.forEach((j, jj) => {
      if (i >= j) k = jj
    })
    return k
  })

  // target: point in armature space that the tip joint should reach.
  const solve = (target) => {
    rel.subVectors(target, J[0])
    const gp = rel.clone().addScaledVector(n, -rel.dot(n))
    let abd = Math.atan2(cr.crossVectors(d, gp).dot(n), d.dot(gp))
    abd = THREE.MathUtils.clamp(abd, -opts.abd, opts.abd)
    rel.applyAxisAngle(n, -abd)
    const gu = rel.dot(d)
    const gv = rel.dot(n)
    const dist = Math.hypot(gu, gv)
    let lo = opts.t2[0]
    let hi = opts.t2[1]
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2
      const [u, v] = fk(0, mid)
      if (Math.hypot(u, v) > dist) lo = mid
      else hi = mid
    }
    const t2 = (lo + hi) / 2
    const [u0, v0] = fk(0, t2)
    let t1 = Math.atan2(gv, gu) - Math.atan2(v0, u0)
    t1 = THREE.MathUtils.clamp(t1, opts.t1[0], opts.t1[1])

    rotAbout(G[0], J[0], n, abd).multiply(rotAbout(tmp, J[0], a, t1))
    G[1].copy(G[0]).multiply(rotAbout(tmp, J[1], a, t2))
    G[2].copy(G[1]).multiply(rotAbout(tmp, J[2], a, DIP_COUPLE * t2))
    bones.forEach((b, i) => {
      const k = driver[i]
      if (k < 0) return
      b.matrix.multiplyMatrices(G[k], rest[i])
      b.matrixWorldNeedsUpdate = true
    })
  }
  return { solve, reach, base: J[0], tip: bones[bones.length - 1] }
}

// Fingernail resting on the back of the last finger segment, parented to that bone.
function addNail(distal, tip, back, scale, mesh, mat) {
  const dir = tip.position.clone().sub(distal.position)
  const len = dir.length()
  dir.normalize()
  // Back surface: farthest bind-pose vertex along `back` near this segment.
  const pos = mesh.geometry.attributes.position
  const v = new THREE.Vector3()
  let off = 0.006
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(distal.position)
    const t = v.dot(dir)
    if (t < len * 0.3 || t > len * 1.1) continue
    const radial = v.clone().addScaledVector(dir, -t)
    if (radial.length() > 0.013) continue
    off = Math.max(off, radial.dot(back))
  }
  const right = new THREE.Vector3().crossVectors(back, dir).normalize()
  const up = new THREE.Vector3().crossVectors(dir, right)
  const m = new THREE.Matrix4().makeBasis(right, up, dir)
  m.setPosition(tip.position.clone().addScaledVector(dir, -len * 0.05).addScaledVector(up, off - 0.0012 * scale))
  m.scale(new THREE.Vector3(0.0052 * scale, 0.0016 * scale, 0.0068 * scale))
  const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat)
  nail.castShadow = true
  nail.matrixAutoUpdate = false
  nail.matrix.copy(distal.matrix.clone().invert().multiply(m))
  distal.add(nail)
  return nail
}

// ---------- Skin shading ----------
// Fine pores + faint creases, used as bump and roughness detail.
function skinDetailTexture() {
  const N = 512
  const c = document.createElement('canvas')
  c.width = c.height = N
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'rgb(128,128,128)'
  ctx.fillRect(0, 0, N, N)
  // pores: tiny dark dots
  for (let i = 0; i < 9000; i++) {
    const g = 95 + Math.random() * 25
    ctx.fillStyle = `rgba(${g},${g},${g},${0.35 + Math.random() * 0.4})`
    const r = 0.5 + Math.random() * 1.1
    ctx.beginPath()
    ctx.arc(Math.random() * N, Math.random() * N, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // soft mottling
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * N
    const y = Math.random() * N
    const r = 8 + Math.random() * 26
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const v = Math.random() < 0.5 ? 150 : 108
    g.addColorStop(0, `rgba(${v},${v},${v},0.18)`)
    g.addColorStop(1, `rgba(${v},${v},${v},0)`)
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // fine creases
  ctx.strokeStyle = 'rgba(100,100,100,0.25)'
  ctx.lineWidth = 0.7
  for (let i = 0; i < 380; i++) {
    const x = Math.random() * N
    const y = Math.random() * N
    const a = (Math.random() - 0.5) * 0.9
    const l = 6 + Math.random() * 18
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + (Math.random() - 0.5) * 3, x + Math.cos(a) * l, y + Math.sin(a) * l)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  tex.anisotropy = 4
  return tex
}

// Physical skin with: wrap-lit subsurface scattering, back-light translucency (fingertips glow),
// blood flush at fingertips/knuckles, lighter palms, pore bump and an oily clear-coat lobe.
function makeSkinMaterial(detail) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: C.skin,
    roughness: 0.56,
    roughnessMap: detail,
    bumpMap: detail,
    bumpScale: 0.9,
    specularIntensity: 0.55,
    specularColor: '#fff3ea',
    sheen: 0.45,
    sheenRoughness: 0.55,
    sheenColor: '#ffd2bd',
    clearcoat: 0.12,
    clearcoatRoughness: 0.42,
  })
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uScatter = { value: new THREE.Color('#ff5a3c') }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aSkin;\nvarying vec3 vSkin;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSkin = aSkin;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkin;\nuniform vec3 uScatter;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  // blood flush at fingertips and knuckles, lighter palm side
  float flush = clamp(vSkin.x * 0.6 + vSkin.y * 0.4, 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 0.74, 0.70), flush);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.07, 1.0, 0.97), vSkin.z * 0.7);`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
  #if NUM_DIR_LIGHTS > 0
  {
    vec3 sss = vec3(0.0);
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
      vec3 L = directionalLights[i].direction;
      float ndl = dot(normal, L);
      // light bleeding past the terminator
      float wrap = max(0.0, (ndl + 0.5) / 1.5) - max(0.0, ndl);
      // light shining through thin parts toward the viewer
      vec3 Ht = normalize(L + normal * 0.4);
      float trans = pow(saturate(dot(geometryViewDir, -Ht)), 3.0) * (0.25 + vSkin.x * 0.9);
      sss += directionalLights[i].color * (wrap * 0.9 + trans);
    }
    reflectedLight.directDiffuse += sss * diffuseColor.rgb * uScatter * 0.55;
  }
  #endif`
      )
  }
  mat.customProgramCacheKey = () => 'skin-sss-v1'
  return mat
}

// Per-vertex skin data in bind pose: x = fingertip flush, y = knuckle flush, z = palm side.
function addSkinAttribute(mesh, bone, palmN) {
  const g = mesh.geometry
  if (g.getAttribute('aSkin')) return
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const fingers = ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger']
  const tips = fingers.map((f) => [bone(`${f}-phalanx-distal`).position, bone(`${f}-tip`).position])
  const knuckles = []
  for (const f of fingers.slice(1)) knuckles.push(bone(`${f}-phalanx-proximal`).position, bone(`${f}-phalanx-intermediate`).position)
  const data = new Float32Array(pos.count * 3)
  const v = new THREE.Vector3()
  const seg = new THREE.Line3()
  const cp = new THREE.Vector3()
  const ss = (e0, e1, x) => {
    const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)
  }
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    let tip = 0
    for (const [a, b] of tips) {
      seg.set(a, b)
      seg.closestPointToPoint(v, true, cp)
      tip = Math.max(tip, ss(0.016, 0.004, cp.distanceTo(v)))
    }
    let kn = 0
    for (const k of knuckles) kn = Math.max(kn, ss(0.013, 0.005, k.distanceTo(v)))
    const palm = Math.max(0, nor.getX(i) * palmN.x + nor.getY(i) * palmN.y + nor.getZ(i) * palmN.z)
    data[i * 3] = tip
    data[i * 3 + 1] = kn
    data[i * 3 + 2] = palm
  }
  g.setAttribute('aSkin', new THREE.BufferAttribute(data, 3))
}

const KeyboardScene = forwardRef(function KeyboardScene({ onKeyDown }, ref) {
  const mountRef = useRef(null)
  const onKeyDownRef = useRef(onKeyDown)
  onKeyDownRef.current = onKeyDown
  const keysRef = useRef(new Map())
  const fingersRef = useRef(new Map())

  useImperativeHandle(ref, () => ({
    press(id) {
      const k = keysRef.current.get(id)
      if (k) k.pending = PRESS_DELAY
      const f = fingersRef.current.get(id)
      if (f) {
        const p = KEY_POS.get(id)
        f.key = id
        if (!f.isThumb) {
          f.target.set(p.x, 0, p.z + TIP_DZ)
          f.until = performance.now() / 1000 + PRESS_DELAY + 0.2
        }
      }
    },
  }))

  useEffect(() => {
    const mount = mountRef.current
    let disposed = false
    const disposables = []
    const track = (o) => (disposables.push(o), o)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 400)
    const board = new THREE.Group()
    scene.add(board)

    // Light for the hands (the keyboard itself stays flat/unlit, it only receives their shadows).
    const pmrem = new THREE.PMREMGenerator(renderer)
    const env = track(pmrem.fromScene(new RoomEnvironment(), 0.04).texture)
    pmrem.dispose()
    scene.environment = env
    scene.environmentIntensity = 0.35
    scene.add(new THREE.HemisphereLight('#fff6ea', '#8c7562', 1.1))
    const sun = new THREE.DirectionalLight('#fff0dc', 2.4)
    sun.position.set(-7, 16, -3)
    sun.target.position.set(0, 0, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 16, bottom: -16, near: 1, far: 60 })
    sun.shadow.radius = 6
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.03
    scene.add(sun, sun.target)
    const bounce = new THREE.DirectionalLight('#ffd9bf', 0.45) // warm light bouncing up off the desk
    bounce.position.set(2, -3, 6)
    const rim = new THREE.DirectionalLight('#dfe9ff', 0.7) // cool edge light from behind
    rim.position.set(6, 5, -12)
    scene.add(bounce, rim)

    const shadowMat = track(new THREE.ShadowMaterial({ opacity: 0.2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }))

    const lineMat = track(new THREE.LineBasicMaterial({ toneMapped: false, color: C.line }))
    const sideMat = track(new THREE.MeshBasicMaterial({ toneMapped: false, color: C.side }))
    const capColor = new THREE.Color(C.cap)
    const pressColor = new THREE.Color(C.press)

    // Base plate
    const baseGeo = track(slab(BASE_W, BASE_D, 0.28, 0.45))
    const base = new THREE.Mesh(baseGeo, [
      track(new THREE.MeshBasicMaterial({ toneMapped: false, color: C.baseCap })),
      track(new THREE.MeshBasicMaterial({ toneMapped: false, color: C.baseSide })),
    ])
    base.position.y = -0.28
    base.add(new THREE.LineSegments(track(new THREE.EdgesGeometry(baseGeo, 25)), lineMat))
    const baseShadow = new THREE.Mesh(baseGeo, shadowMat)
    baseShadow.receiveShadow = true
    base.add(baseShadow)
    board.add(base)

    // Soft shadow of the arms on the page.
    const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(120, 120)), track(new THREE.ShadowMaterial({ opacity: 0.14 })))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.3
    ground.receiveShadow = true
    scene.add(ground)

    // Shared geometry per key width
    const geoCache = new Map()
    const keyGeo = (w) => {
      if (!geoCache.has(w)) {
        const g = track(slab(w * UNIT - GAP, UNIT - GAP, KEY_H, 0.12))
        geoCache.set(w, { g, edges: track(new THREE.EdgesGeometry(g, 25)) })
      }
      return geoCache.get(w)
    }

    const buildKeys = () => {
      if (disposed) return
      ROWS.forEach((row) => {
        row.forEach(([id, w, label]) => {
          const { g, edges } = keyGeo(w)
          const capMat = track(new THREE.MeshBasicMaterial({ toneMapped: false, color: C.cap }))
          const group = new THREE.Group()
          const mesh = new THREE.Mesh(g, [capMat, sideMat])
          mesh.add(new THREE.LineSegments(edges, lineMat))
          const sh = new THREE.Mesh(g, shadowMat)
          sh.receiveShadow = true
          mesh.add(sh)
          group.add(mesh)

          const text = label ?? id
          if (text) {
            const tex = track(labelTexture(text, w))
            const plane = new THREE.Mesh(
              track(new THREE.PlaneGeometry(w * UNIT - GAP, UNIT - GAP)),
              track(new THREE.MeshBasicMaterial({ toneMapped: false, map: tex, transparent: true }))
            )
            plane.rotation.x = -Math.PI / 2
            plane.position.y = KEY_H + 0.002
            group.add(plane)
          }

          const p = KEY_POS.get(id)
          group.position.set(p.x, 0, p.z)
          board.add(group)
          keysRef.current.set(id, { group, capMat, t: 0, hold: 0, pending: 0, e: 0 })
        })
      })
    }
    // Wait for the label font so the canvases render in Fira Code.
    ;(Promise.all([document.fonts?.load?.("500 44px 'Fira Code'"), document.fonts?.load?.("400 28px 'Fira Code'")])).catch(() => {}).finally(buildKeys)

    // ---------- Hands ----------
    const skinDetail = track(skinDetailTexture())
    const skinMat = track(makeSkinMaterial(skinDetail))
    const nailMat = track(new THREE.MeshPhysicalMaterial({ color: C.nail, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.25 }))
    const knit = track(knitTexture())
    const sleeveMat = track(new THREE.MeshStandardMaterial({ color: C.sleeve, map: knit, bumpMap: knit, bumpScale: 1.2, roughness: 0.95 }))
    // Thin white cut-out edge around the hands, like the collage reference.
    const edgeMat = track(new THREE.MeshBasicMaterial({ toneMapped: false, color: '#ffffff', side: THREE.BackSide }))
    edgeMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  transformed += normalize(objectNormal) * 0.0014;')
    }

    const gapC = (KEY_POS.get('f').x + KEY_POS.get('j').x) / 2
    const spaceZ = KEY_POS.get('space').z
    const hands = []
    const loader = new GLTFLoader()

    const setupHand = (cfg, gltf) => {
      const root = gltf.scene
      const armature = root.getObjectByName('Armature') ?? root
      let mesh
      root.traverse((o) => {
        if (o.isSkinnedMesh) mesh = o
      })
      root.updateMatrixWorld(true)
      const bone = (n) => root.getObjectByName(n)
      mesh.material = skinMat
      mesh.castShadow = true
      mesh.receiveShadow = true
      addSkinAttribute(mesh, bone, new THREE.Vector3(cfg.s, 0, 0))
      mesh.frustumCulled = false
      track(mesh.geometry)

      const outline = new THREE.SkinnedMesh(mesh.geometry, edgeMat)
      outline.bind(mesh.skeleton, mesh.bindMatrix)
      outline.frustumCulled = false
      mesh.parent.add(outline)

      const s = cfg.s
      const palmN = new THREE.Vector3(s, 0, 0) // palm faces +x (left) / −x (right) in model space
      const back = palmN.clone().negate()

      // Orientation: fingers (−y) toward the top of the board (−z), palm facing down.
      const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -s, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-s, 0, 0))
      const q = new THREE.Quaternion().setFromRotationMatrix(basis)
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cfg.yaw))
      root.quaternion.copy(q)
      root.scale.setScalar(SCALE)

      // Place the hand so the middle knuckle sits behind and above its home key.
      const midHome = KEY_POS.get(cfg.fingers['middle-finger'].home)
      root.position.set(0, 0, 0)
      root.updateMatrixWorld(true)
      const knuckle = bone('middle-finger-phalanx-proximal').getWorldPosition(new THREE.Vector3())
      const want = new THREE.Vector3(midHome.x - s * 0.55, 2.55, midHome.z + 3.0)
      root.position.copy(want.sub(knuckle))
      scene.add(root)

      // Sleeve over the wrist, running off the bottom of the page.
      const wrist = bone('wrist').position
      const prof = [
        [0.86, 0.075],
        [0.86, 0.046],
        [0.9, 0.0405],
        [0.97, 0.0402],
        [1.0, 0.046],
        [1.06, 0.12],
        [1.28, 0.75],
      ].map(([r, y]) => new THREE.Vector2(r, y))
      const sleeveGeo = track(new THREE.LatheGeometry(prof, 48))
      sleeveGeo.scale(0.026, 1, 0.034)
      sleeveGeo.computeVertexNormals()
      const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat)
      sleeve.position.set(wrist.x, 0, wrist.z)
      sleeve.castShadow = true
      armature.add(sleeve)
      const sleeveEdge = new THREE.Mesh(sleeveGeo, track(new THREE.MeshBasicMaterial({ toneMapped: false, color: '#ffffff', side: THREE.BackSide })))
      sleeveEdge.scale.set(1.05, 1, 1.04)
      sleeve.add(sleeveEdge)

      const toLocal = new THREE.Matrix4()
      const fingers = []
      for (const [name, fc] of Object.entries(cfg.fingers)) {
        const isThumb = name === 'thumb'
        const names = isThumb
          ? ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
          : ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'].map((p) => `${name}-${p}`)
        const bones = names.map(bone)
        bones.forEach((b) => (b.matrixAutoUpdate = false))
        const solver = makeFinger(bones, isThumb ? [0, 1, 2] : [1, 2, 3], palmN, isThumb ? { abd: 0.9, t1: [-0.5, 0.9], t2: [-0.2, 1.0] } : { abd: 0.4, t1: [-0.4, 1.5], t2: [0, 1.7] })
        const n = bones.length
        addNail(bones[n - 2], bones[n - 1], back, isThumb ? 1.3 : name === 'pinky-finger' ? 0.82 : 1, mesh, nailMat)

        let homeT
        if (isThumb) homeT = new THREE.Vector3(gapC - s * 0.7, TIP_Y + HOVER, spaceZ + 0.4)
        else {
          const h = KEY_POS.get(fc.home)
          homeT = new THREE.Vector3(h.x, TIP_Y + HOVER, h.z + TIP_DZ)
        }
        const st = { isThumb, solver, home: homeT, target: homeT.clone(), reach: 0, until: 0, key: null, bias: new THREE.Vector3(), world: new THREE.Vector3(), local: new THREE.Vector3() }
        fc.keys.split(' ').filter(Boolean).forEach((id) => fingersRef.current.set(id, st))
        fingers.push(st)
      }
      hands.push({ root, armature, rest: root.position.clone(), fingers, toLocal, off: new THREE.Vector3(), offGoal: new THREE.Vector3() })
    }

    HANDS.forEach((cfg) =>
      loader.load(cfg.file, (gltf) => {
        if (disposed) return
        setupHand(cfg, gltf)
      })
    )

    // Fit the camera: board near the top, hands and arms filling the space below.
    const dir = new THREE.Vector3(0, 1, 0.12).normalize()
    const lookAt = new THREE.Vector3()
    camera.up.set(0, 0, -1)
    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      // Phones: board nearly edge to edge, framed down to just past the wrists.
      const narrow = w < 640
      const boardPx = Math.min(w - (narrow ? 12 : 32), 760)
      const dW = (BASE_W * 1.02 * (w / boardPx)) / (2 * tanHalf * camera.aspect)
      const zTop = -BASE_D / 2 - (narrow ? 0.2 : 0.35)
      const zBot = BASE_D / 2 + (narrow ? 3.2 : 4.5)
      const dH = (zBot - zTop) / (2 * tanHalf)
      const d = Math.max(dW, dH)
      lookAt.set(0, 0, zTop + d * tanHalf)
      camera.position.copy(dir).multiplyScalar(d).add(lookAt)
      camera.lookAt(lookAt)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    const keyE = (id) => (id ? keysRef.current.get(id)?.e ?? 0 : 0)
    const baseW = new THREE.Vector3()
    const tipW = new THREE.Vector3()

    const clock = new THREE.Clock()
    let raf
    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05)
      const now = performance.now() / 1000

      keysRef.current.forEach((k, id) => {
        if (k.pending > 0) {
          k.pending -= dt
          if (k.pending <= 0) {
            k.t = 1
            k.hold = 0.12
            onKeyDownRef.current?.(id)
          }
        } else if (k.hold > 0) k.hold -= dt
        else if (k.t > 0) k.t = Math.max(0, k.t - dt * 3.2)
        const e = k.t * k.t * (3 - 2 * k.t)
        k.e = e
        k.group.position.y = -0.14 * e
        k.capMat.color.copy(capColor).lerp(pressColor, Math.min(1, e * 1.4))
      })

      const follow = 1 - Math.exp(-dt * 24)
      for (const hand of hands) {
        // The whole hand leans toward far keys so fingers never over-stretch.
        hand.offGoal.set(0, 0, 0)
        for (const f of hand.fingers) {
          if (f.isThumb) continue
          f.reach += ((now < f.until ? 1 : 0) - f.reach) * follow
          if (f.reach < 0.001) continue
          baseW.copy(f.solver.base).applyMatrix4(hand.armature.matrixWorld).sub(hand.off)
          const dx = f.target.x - baseW.x
          const dz = f.target.z - baseW.z
          const dy = TIP_Y - baseW.y
          const d = Math.hypot(dx, dy, dz)
          const max = f.solver.reach * SCALE * 0.9
          if (d > max) {
            const k = ((d - max) / Math.hypot(dx, dz)) * f.reach
            hand.offGoal.x += dx * k
            hand.offGoal.z += dz * k
          }
          hand.offGoal.x += (f.target.x - f.home.x) * 0.15 * f.reach
          hand.offGoal.z += (f.target.z - f.home.z) * 0.15 * f.reach
        }
        for (const f of hand.fingers) hand.offGoal.add(f.bias)
        hand.off.lerp(hand.offGoal, 1 - Math.exp(-dt * 12))
        hand.root.position.copy(hand.rest).add(hand.off)
        hand.root.updateMatrixWorld(true)
        hand.toLocal.copy(hand.armature.matrixWorld).invert()

        for (const f of hand.fingers) {
          const w = f.world.copy(f.home)
          if (f.isThumb) {
            w.x += hand.off.x * 0.6
            w.z += hand.off.z * 0.6
            w.y -= (HOVER + 0.16) * keyE(f.key)
          } else {
            w.x += hand.off.x + (f.target.x - hand.off.x - f.home.x) * f.reach
            w.z += hand.off.z + (f.target.z - hand.off.z - f.home.z) * f.reach
            w.y += 0.55 * f.reach * (1 - f.reach) * 4 - (HOVER + 0.15) * keyE(f.key) * Math.min(1, f.reach * 1.5)
          }
          f.solver.solve(f.local.copy(w).applyMatrix4(hand.toLocal))
          // Whatever the finger can't reach, the hand makes up by sliding over.
          if (f.isThumb) continue
          if (f.reach > 0.3) {
            tipW.setFromMatrixPosition(f.solver.tip.matrix).applyMatrix4(hand.armature.matrixWorld)
            const g = Math.min(1, dt * 9) * f.reach
            f.bias.x += (w.x - tipW.x) * g
            f.bias.z += (w.z - tipW.z) * g
            f.bias.clampLength(0, 3)
          } else f.bias.multiplyScalar(Math.exp(-dt * 6))
        }
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      disposables.forEach((d) => d.dispose?.())
      keysRef.current.clear()
      fingersRef.current.clear()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />
})

export default KeyboardScene
