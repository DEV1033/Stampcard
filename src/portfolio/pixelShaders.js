import * as THREE from 'three'

// Shared GLSL helpers: hashing, value noise / fbm, and a 4×4 Bayer matrix
// for ordered dithering (what gives the pixels their crisp, pixel-art steps).
const COMMON = /* glsl */ `
  uniform vec3 uTint; // strongest tile colour; lighter shades are mixed towards white
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  // Palette from the white page to the tile colour. With the default sky
  // tint this gives #ffffff, #e3f2ff, #bfe2ff, #93ccff, #6bb8ff.
  vec3 palette(float level) {
    vec3 white = vec3(1.0);
    if (level < 0.5) return white;
    if (level < 1.5) return mix(white, uTint, 0.19);
    if (level < 2.5) return mix(white, uTint, 0.43);
    if (level < 3.5) return mix(white, uTint, 0.73);
    return uTint;
  }
`

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// Full-screen pixel field: a slow cloud of light-blue pixels on a linear
// vertical ramp — white at the top, densest at the bottom.
const FIELD_FRAG = /* glsl */ `
  uniform vec2 uRes;      // CSS px
  uniform float uTime;
  uniform float uCell;    // pixel size in CSS px
  uniform float uIntro;   // 0..1, pixels switching on
  varying vec2 vUv;
  // How subtle the background is: share of pixels drawn, and how strongly
  // each pixel shows against the white (1 = full colour). Set per screen
  // size from JS (stronger on phones, where the pixels are smaller).
  uniform float uSubtlety;
  uniform float uStrength;
  uniform float uNoiseScale; // size of the cloud blobs, in CSS px
  uniform float uFloor;      // minimum density before the top-to-bottom ramp
  ${COMMON}

  void main() {
    vec2 px = vUv * uRes;
    vec2 cell = floor(px / uCell);
    vec2 cuv = (cell + 0.5) * uCell / uRes;
    // Cloud blobs sized in screen pixels (not stretched to the screen's
    // shape), so a tall phone gets evenly spread blobs instead of one giant one.
    vec2 cellPx = (cell + 0.5) * uCell;
    float n = fbm(cellPx / uNoiseScale + vec2(uTime * 0.035, -uTime * 0.022));
    n = smoothstep(0.32, 0.78, n);
    // A light floor so the lower part is never empty, whatever the cloud does.
    n = max(n, uFloor);

    // Linear ramp: no pixels at the top, full density at the bottom.
    float fall = clamp(1.0 - cuv.y, 0.0, 1.0);
    // Kept subtle: fewer pixels overall.
    float v = n * fall * uSubtlety;

    // Ordered dithering into the lighter shades only (the darkest is skipped).
    float level = min(floor(clamp(v, 0.0, 1.0) * 4.0 + bayer4(cell)), 3.0);

    // Intro: pixels switch on in a scattered order, from the bottom up.
    if (hash(cell) * 0.75 + cuv.y * 0.25 > uIntro) level = 0.0;

    // Thin gutter between pixels so the grid reads.
    vec2 f = fract(px / uCell);
    float inCell = step(0.06, f.x) * step(f.x, 0.94) * step(0.06, f.y) * step(f.y, 0.94);
    // Soften every pixel a little towards the background.
    vec3 col = mix(palette(0.0), palette(level), inCell * uStrength);

    gl_FragColor = vec4(col, 1.0);
  }
`

// Preloader overlay: pixels light up with progress (dithered order), then
// switch off in a scattered wave to reveal the page underneath.
const LOADER_FRAG = /* glsl */ `
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uCell;
  uniform float uProgress; // 0..1 loading
  uniform float uExit;     // 0..1 pixels disappearing
  varying vec2 vUv;
  ${COMMON}

  void main() {
    vec2 px = vUv * uRes;
    vec2 cell = floor(px / uCell);
    vec2 cuv = (cell + 0.5) * uCell / uRes;

    // Order in which pixels light up while loading.
    float order = bayer4(cell) * 0.6 + hash(cell) * 0.4;
    float lit = step(order, uProgress);

    // Shade varies softly and shimmers a little.
    float n = fbm(cuv * 3.0 + uTime * 0.15);
    float level = lit > 0.5 ? 1.0 + floor(n * 2.99 + bayer4(cell) * 0.6) : 0.0;
    vec3 col = palette(level);

    // Exit: switch off from the bottom up, scattered.
    float exitOrder = cuv.y * 0.55 + hash(cell + 7.0) * 0.45;
    float alive = step(uExit, exitOrder);

    gl_FragColor = vec4(col, alive);
  }
`

// `preserve` keeps the last frame readable (for drawImage), at a small cost.
function makeQuadRenderer(canvas, fragmentShader, uniforms, { alpha = false, preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: preserve,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  if (alpha) renderer.setClearColor(0x000000, 0)
  const scene = new THREE.Scene()
  const camera = new THREE.Camera()
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader,
    transparent: alpha,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  scene.add(quad)
  return {
    renderer,
    render: () => renderer.render(scene, camera),
    resize: (w, h) => {
      renderer.setSize(w, h, false)
      uniforms.uRes.value.set(w, h)
    },
    dispose: () => {
      quad.geometry.dispose()
      material.dispose()
      renderer.dispose()
    },
  }
}

export const DEFAULT_TINT = '#6bb8ff'

// '#rrggbb' → raw 0..1 RGB, written straight into a vec3 uniform. (THREE.Color
// would convert to linear space, but these shaders output sRGB directly.)
export function setTint(vec, hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  vec.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
  return vec
}

export function createPixelField(canvas, { cell = 14, subtlety = 0.6, strength = 0.75, tint = DEFAULT_TINT } = {}) {
  const uniforms = {
    uTint: { value: setTint(new THREE.Vector3(), tint) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uCell: { value: cell },
    uIntro: { value: 0 },
    uSubtlety: { value: subtlety },
    uStrength: { value: strength },
    uNoiseScale: { value: 375 },
    uFloor: { value: 0.15 },
  }
  // Preserved so the page-turn snapshot can copy the background.
  return { uniforms, ...makeQuadRenderer(canvas, FIELD_FRAG, uniforms, { preserve: true }) }
}

export function createPixelLoader(canvas, { cell = 26, tint = DEFAULT_TINT } = {}) {
  const uniforms = {
    uTint: { value: setTint(new THREE.Vector3(), tint) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uCell: { value: cell },
    uProgress: { value: 0 },
    uExit: { value: 0 },
  }
  return { uniforms, ...makeQuadRenderer(canvas, LOADER_FRAG, uniforms, { alpha: true }) }
}
