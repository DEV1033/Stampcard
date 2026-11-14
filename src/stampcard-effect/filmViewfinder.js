import * as THREE from 'three'

// Live camera viewfinder rendered through a film shader: colour grade per
// film stock, slight barrel distortion, chromatic fringing at the edges,
// vignette, animated grain, flickering scratches and dust. capture() renders
// the same shader at the video's full resolution, so the saved photo looks
// exactly like the viewfinder (in every browser).

export const FILM_STOCKS = [
  { name: 'COLOR', iso: 400, label: '#e8b53a' },
  { name: 'MONO', iso: 100, label: '#a3a8ad' },
  { name: 'WARM', iso: 200, label: '#e0743a' },
  { name: 'FADE', iso: 160, label: '#86b4cc' },
]

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D uVideo;
  uniform vec2 uVideoSize;
  uniform vec2 uViewSize;
  uniform float uTime;
  uniform float uZoom;
  uniform float uMirror;
  uniform int uStock;
  uniform float uFx; // 1 = grain/scratches/dust on, 0 = off
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float hash1(float x) { return fract(sin(x * 91.3458) * 47453.5453); }

  // object-fit: cover
  vec2 coverUv(vec2 uv) {
    float va = uVideoSize.x / uVideoSize.y;
    float sa = uViewSize.x / uViewSize.y;
    vec2 s = vec2(1.0);
    if (sa > va) s.y = va / sa; else s.x = sa / va;
    return (uv - 0.5) * s + 0.5;
  }

  vec3 grade(vec3 c) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    if (uStock == 1) {
      // MONO: punchy black & white
      float m = smoothstep(0.02, 0.98, l);
      return vec3(m * 1.04);
    } else if (uStock == 2) {
      // WARM: golden, slightly saturated
      c = mix(vec3(l), c, 1.15) * vec3(1.08, 1.0, 0.84);
      return c + vec3(0.02, 0.01, 0.0);
    } else if (uStock == 3) {
      // FADE: lifted blacks, soft and cool
      c = mix(vec3(l), c, 0.78);
      c = c * 0.86 + 0.09;
      return c * vec3(0.97, 1.0, 1.04);
    }
    // COLOR: teal shadows, warm highlights, a touch of contrast
    vec3 shadows = vec3(0.92, 1.0, 1.04);
    vec3 highs = vec3(1.05, 1.0, 0.94);
    c *= mix(shadows, highs, smoothstep(0.2, 0.8, l));
    return (c - 0.5) * 1.06 + 0.5;
  }

  void main() {
    vec2 uv = vUv;
    vec2 c = uv - 0.5;
    // Slight barrel distortion, like an old lens.
    uv = 0.5 + c * (1.0 - 0.05 * dot(c, c));
    uv = coverUv(uv);
    uv = (uv - 0.5) / uZoom + 0.5;
    if (uMirror > 0.5) uv.x = 1.0 - uv.x;

    // Chromatic fringing grows towards the edges.
    vec2 ca = c * 0.004;
    vec3 col = vec3(
      texture2D(uVideo, uv + ca).r,
      texture2D(uVideo, uv).g,
      texture2D(uVideo, uv - ca).b
    );
    col = grade(col);

    // Vignette.
    float v = smoothstep(0.85, 0.25, length(c * vec2(1.0, 0.9)));
    col *= mix(0.55, 1.0, v);

    if (uFx > 0.5) {
      float t = floor(uTime * 24.0);
      // Grain.
      col += (hash(vUv * uViewSize + t) - 0.5) * 0.07;
      // A couple of thin vertical scratches that flicker in and out.
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        float seed = floor(uTime * 6.0) + fi * 13.0;
        float x = hash1(seed);
        float on = step(0.55, hash1(seed + 4.0));
        float line = exp(-abs(vUv.x - x) * uViewSize.x * 0.9);
        col += line * on * 0.12;
      }
      // Dust specks.
      vec2 cell = floor(vUv * vec2(28.0, 40.0));
      float d = hash(cell + t * 0.37);
      if (d > 0.996) {
        vec2 f = fract(vUv * vec2(28.0, 40.0)) - 0.5;
        col -= smoothstep(0.12, 0.0, length(f)) * 0.35;
      }
    }

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

export class FilmViewfinder {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()
    this.uniforms = {
      uVideo: { value: null },
      uVideoSize: { value: new THREE.Vector2(16, 9) },
      uViewSize: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uZoom: { value: 1 },
      uMirror: { value: 0 },
      uStock: { value: 0 },
      uFx: { value: 1 },
    }
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.scene.add(this.quad)
    this.size = { w: 1, h: 1 }

    const start = performance.now()
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop)
      if (!this.uniforms.uVideo.value) return
      this.uniforms.uTime.value = (now - start) / 1000
      this.renderer.render(this.scene, this.camera)
    }
    this.raf = requestAnimationFrame(loop)
  }

  setVideo(video) {
    this.uniforms.uVideo.value?.dispose()
    const tex = new THREE.VideoTexture(video)
    tex.colorSpace = THREE.NoColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    this.uniforms.uVideo.value = tex
    this.uniforms.uVideoSize.value.set(video.videoWidth || 16, video.videoHeight || 9)
    this.video = video
  }

  setStock(i) {
    this.uniforms.uStock.value = i
  }
  setZoom(z) {
    this.uniforms.uZoom.value = z
  }
  setMirror(on) {
    this.uniforms.uMirror.value = on ? 1 : 0
  }

  resize(w, h) {
    if (!w || !h) return
    this.size = { w, h }
    this.renderer.setSize(w, h, false)
    this.uniforms.uViewSize.value.set(w, h)
  }

  // Render the shader at the video's resolution and return a JPEG blob.
  capture() {
    const v = this.video
    if (!v?.videoWidth) return Promise.resolve(null)
    const w = v.videoWidth
    const h = v.videoHeight
    const target = new THREE.WebGLRenderTarget(w, h)
    const u = this.uniforms
    const prevView = u.uViewSize.value.clone()
    u.uVideoSize.value.set(w, h)
    u.uViewSize.value.set(w, h)

    this.renderer.setRenderTarget(target)
    this.renderer.render(this.scene, this.camera)
    const pixels = new Uint8Array(w * h * 4)
    this.renderer.readRenderTargetPixels(target, 0, 0, w, h, pixels)
    this.renderer.setRenderTarget(null)
    target.dispose()
    u.uViewSize.value.copy(prevView)

    // WebGL rows are bottom-up; flip into a 2D canvas.
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const ctx = out.getContext('2d')
    const img = ctx.createImageData(w, h)
    const row = w * 4
    for (let y = 0; y < h; y++) {
      img.data.set(pixels.subarray((h - 1 - y) * row, (h - y) * row), y * row)
    }
    ctx.putImageData(img, 0, 0)
    return new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.92))
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.uniforms.uVideo.value?.dispose()
    this.quad.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
  }
}
