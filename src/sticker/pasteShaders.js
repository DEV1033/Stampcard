// Sticker-paste shaders, adapted from the original stamp effect (commit 903c37b).
// Units are CSS pixels. Everything beyond the "application line" is lifted off the
// page like a sticker being smoothed down; the bend angle grows smoothly with
// distance from the line, theta(s) = uAngle * (1 - e^(-s/R)), so there is no crease.
const deform = /* glsl */ `
  uniform vec2 uDir;
  uniform float uLine;
  uniform float uCurlRadius;
  uniform float uAngle;

  float bendAngle(float s) {
    return uAngle * (1.0 - exp(-s / uCurlRadius));
  }

  vec3 deform(vec2 xy, out vec3 n) {
    float s = dot(xy, uDir) - uLine;
    n = vec3(0.0, 0.0, 1.0);
    float z = 0.0;
    if (s > 0.0) {
      const int STEPS = 24;
      float ds = s / float(STEPS);
      float along = 0.0;
      for (int i = 0; i < STEPS; i++) {
        float th = bendAngle((float(i) + 0.5) * ds);
        along += cos(th) * ds;
        z += sin(th) * ds;
      }
      float th = bendAngle(s);
      n = vec3(-sin(th) * uDir, cos(th));
      xy += uDir * (along - s);
    }
    return vec3(xy, z);
  }
`

export const stickerVertex = /* glsl */ `
  ${deform}
  varying vec2 vLocal;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vec3 n;
    vec3 p = deform(position.xy, n);
    p.z += 0.05;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    vNormal = mat3(modelMatrix) * n;
    vLocal = position.xy;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

export const stickerFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSize;
  uniform vec3 uLightDir;
  uniform float uShine;
  uniform float uOpacity;
  varying vec2 vLocal;
  varying vec3 vNormal;
  varying vec3 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = vLocal / uSize + 0.5;
    vec4 tex = texture2D(uMap, uv);
    if (tex.a < 0.004) discard;

    vec3 N = normalize(vNormal);
    vec3 base;
    bool front = gl_FrontFacing;
    if (front) {
      base = tex.rgb;
    } else {
      // Paper backing of the sticker.
      N = -N;
      float grain = hash(floor(vLocal * 3.0)) - 0.5;
      base = vec3(0.95, 0.94, 0.91) * (1.0 + grain * 0.05);
    }

    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 H = normalize(L + V);
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 24.0);

    // Normalised so a flat sticker shows its true colours (matches the <img>).
    float flatDiff = max(L.z, 0.0);
    vec3 col = base * (0.5 + 0.55 * diff) / (0.5 + 0.55 * flatDiff);
    float flatSpec = pow(max(H.z, 0.0), 24.0);
    col += max(spec - flatSpec, 0.0) * (front ? 0.14 : 0.05);

    if (front) {
      // Soft light sweep across the sticker once it's down.
      vec2 halfSize = uSize * 0.5;
      float t = dot(vLocal / max(halfSize.x, halfSize.y), normalize(vec2(1.0, 0.6)));
      col += exp(-pow((t - uShine) / 0.2, 2.0)) * 0.14;
    }

    gl_FragColor = vec4(col, tex.a * uOpacity);
  }
`

export const shadowVertex = /* glsl */ `
  ${deform}
  uniform vec3 uShadowDir;
  varying vec2 vLocal;
  varying float vHeight;

  void main() {
    vec3 n;
    vec3 p = deform(position.xy, n);
    // Project the lifted sticker onto the page along the light direction.
    vec3 sd = inverse(mat3(modelMatrix)) * uShadowDir;
    vec2 g = p.xy - (sd.xy / sd.z) * p.z;
    vHeight = p.z;
    vLocal = position.xy;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(g, 0.0, 1.0);
  }
`

export const shadowFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uSize;
  uniform float uOpacity;
  varying vec2 vLocal;
  varying float vHeight;

  void main() {
    if (vHeight <= 0.0) discard; // flat part: the CSS drop shadow covers it
    float h = vHeight / max(uSize.x, uSize.y);
    // Higher off the page means a softer, lighter shadow (blur via mip bias).
    float a = texture2D(uMap, vLocal / uSize + 0.5, 1.0 + h * 9.0).a;
    float strength = mix(0.2, 0.05, clamp(h / 0.6, 0.0, 1.0));
    gl_FragColor = vec4(0.0, 0.0, 0.0, a * strength * uOpacity);
  }
`
