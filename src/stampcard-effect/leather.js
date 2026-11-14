import * as THREE from 'three'

// Procedural pebbled leather: cellular (Worley) noise gives the raised
// grains, a height-field normal is lit from above, plus fine pores and a
// soft vignette. Static, so it only re-renders on resize.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  // Distance to nearest cell centre minus second nearest: pebble shape.
  float pebble(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hash2(i + g);
        float d = length(g + o - f);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    return smoothstep(0.0, 0.35, d2 - d1);
  }

  float height(vec2 px) {
    vec2 p = px / 7.0; // pebble size in px
    return pebble(p) * 0.8 + pebble(p * 2.3 + 17.0) * 0.2;
  }

  void main() {
    vec2 px = vUv * uSize;
    float h = height(px);
    float hx = height(px + vec2(1.0, 0.0)) - h;
    float hy = height(px + vec2(0.0, 1.0)) - h;
    vec3 n = normalize(vec3(-hx * 2.2, -hy * 2.2, 1.0));
    vec3 l = normalize(vec3(-0.3, 0.6, 1.0));
    float diff = max(dot(n, l), 0.0);
    float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);

    vec3 base = vec3(0.105, 0.105, 0.11);
    vec3 col = base * (0.55 + 0.6 * diff) + spec * 0.05;
    // Pores in the creases.
    col *= 1.0 - (1.0 - h) * 0.35;
    col *= 0.96 + hash(floor(px)) * 0.06;
    // Darker towards the edges.
    vec2 c = vUv - 0.5;
    col *= 1.0 - dot(c, c) * 0.9;
    gl_FragColor = vec4(col, 1.0);
  }
`

export class LeatherSurface {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.scene = new THREE.Scene()
    this.camera = new THREE.Camera()
    this.uniforms = { uSize: { value: new THREE.Vector2(1, 1) } }
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.scene.add(this.quad)
  }

  resize(w, h) {
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.uniforms.uSize.value.set(w, h)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.quad.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
  }
}
