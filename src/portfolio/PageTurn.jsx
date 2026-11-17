import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { animate } from 'framer-motion'
import { SIDEBAR_WIDTH } from './Sidebar.jsx'

export const HEADER_H = 72 // desktop header bar height (px)
const RULER_W = 28 // the rulers on the left and right edges (px)
const TURN_S = 2.2

// The area the page turns in: below the header and between the two rulers
// on desktop (lg and up), the whole screen on phones and tablets. Shared with the snapshot code.
export function getTurnRegion() {
  const w = window.innerWidth
  const h = window.innerHeight
  if (w < 1024) return { left: 0, top: 0, width: w, height: h }
  const left = SIDEBAR_WIDTH + RULER_W
  return { left, top: HEADER_H, width: w - left - RULER_W, height: h - HEADER_H }
}

// Peel that rolls up. A fold line (the axis) sweeps across the page from
// one bottom corner; everything past it wraps round and round a cylinder
// sitting on the page, so the paper rolls up into a tube that travels across
// and off the page. The printed side ends up inside the roll, the paper's
// back on the outside.
const SHEET_VERT = /* glsl */ `
  uniform vec2 uDir;     // unit vector pointing at the corner that lifts first
  uniform float uAxis;   // where the roll touches the page, measured along uDir
  uniform float uRadius; // radius of the roll
  varying vec2 vUv;
  varying vec3 vNormal;  // normal of the printed side
  const float PI = 3.14159265;

  void main() {
    vUv = uv;
    vec3 p = position;
    float proj = dot(p.xy, uDir);
    vec2 perp = p.xy - proj * uDir;
    float d = proj - uAxis;
    vec3 n = vec3(0.0, 0.0, 1.0);

    if (d > 0.0) {
      float a = d / uRadius; // keeps winding: several turns overlap in the roll
      p.xy = perp + (uAxis + uRadius * sin(a)) * uDir;
      p.z = uRadius * (1.0 - cos(a));
      n = vec3(-sin(a) * uDir, cos(a));
    }

    vNormal = n;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const SHEET_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 c = texture2D(uTex, vUv).rgb;
    if (!gl_FrontFacing) {
      // Back of the paper: off-white with the print faintly showing through.
      n = -n;
      c = mix(vec3(0.965), c, 0.08);
    }
    // Soft light from the upper left, plus a glossy highlight along the roll.
    vec3 L = normalize(vec3(-0.35, 0.45, 1.0));
    float diff = max(dot(n, L), 0.0);
    float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
    vec3 col = c * (0.5 + 0.5 * diff) + 0.22 * spec;
    gl_FragColor = vec4(col, 1.0);
  }
`

// Soft contact shadow the roll casts on the new page just past it.
const SHADOW_VERT = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SHADOW_FRAG = /* glsl */ `
  uniform vec2 uDir;
  uniform float uAxis;
  uniform float uRadius;
  varying vec2 vPos;
  void main() {
    float d = dot(vPos, uDir) - uAxis;
    float a = d > 0.0 ? 0.3 * exp(-d / (uRadius * 2.2)) : 0.0;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`

// 3D page turn: shows `image` (a snapshot of the old page) as a sheet of
// paper over the turn region, then peels it up into a roll that travels off
// the page, revealing the new page underneath. `dir` 'forward' starts at the
// bottom-right corner, 'back' at the bottom-left. Draws its first frame before the browser paints, so the new
// page never flashes before the sheet covers it.
export default function PageTurn({ image, dir = 'forward', onDone }) {
  const canvasRef = useRef(null)
  const region = useRef(getTurnRegion()).current
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useLayoutEffect(() => {
    const { width: w, height: h } = region
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h, false)
    renderer.setClearColor(0x000000, 0)

    // Perspective camera placed so the flat sheet (z = 0) exactly fills the
    // region; the roll lifts towards it and gains real depth.
    const fov = 25
    const camera = new THREE.PerspectiveCamera(fov, w / h, 1, 20000)
    camera.position.z = h / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2))

    const texture = new THREE.CanvasTexture(image)
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter

    const radius = Math.min(70, Math.max(36, Math.min(w, h) * 0.07))
    const v = new THREE.Vector2(dir === 'back' ? -1 : 1, -0.45).normalize()
    // Furthest corner along the direction: the page is flat until the axis
    // reaches it, and the roll is fully off the page past the opposite one.
    const maxProj = (Math.abs(v.x) * w) / 2 + (Math.abs(v.y) * h) / 2
    const uniforms = {
      uTex: { value: texture },
      uDir: { value: v },
      uAxis: { value: maxProj },
      uRadius: { value: radius },
    }

    const scene = new THREE.Scene()
    const sheetGeo = new THREE.PlaneGeometry(w, h, 140, 90)
    const sheet = new THREE.Mesh(
      sheetGeo,
      new THREE.ShaderMaterial({ uniforms, vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG, side: THREE.DoubleSide }),
    )
    const shadowGeo = new THREE.PlaneGeometry(w, h)
    const shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: SHADOW_VERT,
        fragmentShader: SHADOW_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    )
    shadow.position.z = -1
    scene.add(shadow, sheet)
    renderer.render(scene, camera)

    const anim = animate(maxProj, -maxProj - radius * 2.5, {
      duration: TURN_S,
      ease: [0.55, 0, 0.35, 1],
      onUpdate: (a) => {
        uniforms.uAxis.value = a
        renderer.render(scene, camera)
      },
      onComplete: () => doneRef.current(),
    })

    return () => {
      anim.stop()
      sheetGeo.dispose()
      shadowGeo.dispose()
      sheet.material.dispose()
      shadow.material.dispose()
      texture.dispose()
      renderer.dispose()
    }
    // One turn per mount; the parent remounts it (new key) for each change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed z-[60] block"
      style={{ left: region.left, top: region.top, width: region.width, height: region.height }}
    />
  )
}
