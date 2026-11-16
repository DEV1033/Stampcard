import * as THREE from 'three'

// Shared GLSL helpers: hashing, value noise / fbm, and a 4×4 Bayer matrix
// for ordered dithering (what gives the pixels their crisp, pixel-art steps).
const COMMON = /* glsl */ `
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

  // Light-blue palette, from paper to sky.
  vec3 palette(float level) {
    vec3 c0 = vec3(0.973, 0.984, 1.0);   // #f8fbff
    vec3 c1 = vec3(0.890, 0.949, 1.0);   // #e3f2ff
    vec3 c2 = vec3(0.749, 0.886, 1.0);   // #bfe2ff
    vec3 c3 = vec3(0.576, 0.800, 1.0);   // #93ccff
    vec3 c4 = vec3(0.420, 0.722, 1.0);   // #6bb8ff
    if (level < 0.5) return c0;
    if (level < 1.5) return c1;
    if (level < 2.5) return c2;
    if (level < 3.5) return c3;
    return c4;
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
  ${COMMON}

  // How subtle the background is: share of pixels drawn, and how strongly
  // each pixel shows against the white (1 = full colour).
  const float SUBTLETY = 0.6;
  const float PIXEL_STRENGTH = 0.75;

  void main() {
    vec2 px = vUv * uRes;
    vec2 cell = floor(px / uCell);
    vec2 cuv = (cell + 0.5) * uCell / uRes;
    float aspect = uRes.x / uRes.y;

    float n = fbm(vec2(cuv.x * aspect, cuv.y) * 2.4 + vec2(uTime * 0.035, -uTime * 0.022));
    n = smoothstep(0.32, 0.78, n);

    // Linear ramp: no pixels at the top, full density at the bottom.
    float fall = clamp(1.0 - cuv.y, 0.0, 1.0);
    // Kept subtle: fewer pixels overall.
    float v = n * fall * SUBTLETY;

    // Ordered dithering into the lighter shades only (the darkest is skipped).
    float level = min(floor(clamp(v, 0.0, 1.0) * 4.0 + bayer4(cell)), 3.0);

    // Intro: pixels switch on in a scattered order, from the bottom up.
    if (hash(cell) * 0.75 + cuv.y * 0.25 > uIntro) level = 0.0;

    // Thin gutter between pixels so the grid reads.
    vec2 f = fract(px / uCell);
    float inCell = step(0.06, f.x) * step(f.x, 0.94) * step(0.06, f.y) * step(f.y, 0.94);
    // Soften every pixel a little towards the background.
    vec3 col = mix(palette(0.0), palette(level), inCell * PIXEL_STRENGTH);

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

function makeQuadRenderer(canvas, fragmentShader, uniforms, { alpha = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha, antialias: false, premultipliedAlpha: false })
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

export function createPixelField(canvas, { cell = 14 } = {}) {
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uCell: { value: cell },
    uIntro: { value: 0 },
  }
  return { uniforms, ...makeQuadRenderer(canvas, FIELD_FRAG, uniforms) }
}

export function createPixelLoader(canvas, { cell = 26 } = {}) {
  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uCell: { value: cell },
    uProgress: { value: 0 },
    uExit: { value: 0 },
  }
  return { uniforms, ...makeQuadRenderer(canvas, LOADER_FRAG, uniforms, { alpha: true }) }
}
