// Shared deformation: everything on the far side of the "application line"
// lifts off the surface like paper being smoothed down. The bend angle grows
// smoothly with distance from the line, theta(s) = uAngle * (1 - e^(-s/R)),
// so there is no crease between a curved and a straight part: curvature
// fades out gradually and highlights glide across the bend. Position along
// the bent strip is found by integrating (cos theta, sin theta) numerically.
const deform = /* glsl */ `
  uniform vec2 uDir;
  uniform float uLine;
  uniform float uCurlRadius;
  uniform float uAngle;
  uniform float uLift;

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
    return vec3(xy, z + uLift);
  }
`

const sdf = /* glsl */ `
  uniform vec2 uPerf;   // spacing of perforation holes along x / y edges
  uniform float uHoleR; // perforation hole radius

  float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  // Postage-stamp outline: a rectangle with half-circle holes punched
  // along every edge (holes sit centred on the edge, one in each corner).
  float sdStamp(vec2 p, vec2 h) {
    float box = sdRoundRect(p, h, 0.0);
    float hx = clamp(-h.x + floor((p.x + h.x) / uPerf.x + 0.5) * uPerf.x, -h.x, h.x);
    float hy = clamp(-h.y + floor((p.y + h.y) / uPerf.y + 0.5) * uPerf.y, -h.y, h.y);
    float dTB = length(p - vec2(hx, sign(p.y) * h.y)) - uHoleR;
    float dLR = length(p - vec2(sign(p.x) * h.x, hy)) - uHoleR;
    return max(box, -min(dTB, dLR));
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
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
    p.z += 0.002;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    vNormal = n;
    vLocal = position.xy;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

export const stickerFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec2 uUvScale;
  uniform vec2 uUvOffset;
  uniform vec2 uSize;
  uniform float uCorner;
  uniform float uBorder;
  uniform vec3 uLightDir;
  uniform float uShine;
  uniform float uOpacity;
  varying vec2 vLocal;
  varying vec3 vNormal;
  varying vec3 vWorld;
  ${sdf}

  void main() {
    vec2 halfSize = uSize * 0.5;
    float d = sdStamp(vLocal, halfSize);
    float aa = fwidth(d);
    float mask = 1.0 - smoothstep(-aa, aa, d);
    if (mask < 0.001) discard;

    vec3 N = normalize(vNormal);
    vec3 base;
    bool front = gl_FrontFacing;
    // Fine paper grain.
    float grain = hash(floor(vLocal * 900.0)) - 0.5;

    if (front) {
      // Image inside the white stamp margin, square corners.
      vec2 innerHalf = halfSize - uBorder;
      float di = sdRoundRect(vLocal, innerHalf, 0.0);
      float ai = fwidth(di);
      vec2 uv = (vLocal + innerHalf) / (2.0 * innerHalf);
      uv = clamp(uv, 0.0, 1.0) * uUvScale + uUvOffset;
      vec3 img = texture2D(uMap, uv).rgb;
      float inImg = 1.0 - smoothstep(-ai, ai, di);
      // Same paper colour as the .stamp-thumb CSS (#fffefb).
      vec3 paper = vec3(1.0, 0.996, 0.984);
      base = mix(paper, img, inImg);
    } else {
      // Gummed back of the stamp.
      N = -N;
      base = vec3(0.93, 0.92, 0.88) * (1.0 + grain * 0.05);
    }

    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 H = normalize(L + V);
    float diff = max(dot(N, L), 0.0);
    // Paper is mostly matte: broad, weak highlight.
    float spec = pow(max(dot(N, H), 0.0), 24.0);

    // Normalised so a flat stamp shows its true colours (matches the <img>).
    float flatDiff = max(L.z, 0.0);
    vec3 col = base * (0.5 + 0.55 * diff) / (0.5 + 0.55 * flatDiff);
    float flatSpec = pow(max(H.z, 0.0), 24.0);
    col += max(spec - flatSpec, 0.0) * (front ? 0.12 : 0.04);

    if (front) {
      // Soft light sweep across the stamp.
      float t = dot(vLocal / max(halfSize.x, halfSize.y), normalize(vec2(1.0, 0.6)));
      float band = exp(-pow((t - uShine) / 0.2, 2.0));
      col += band * 0.13;
    }

    gl_FragColor = vec4(col, mask * uOpacity);
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
    // Project the deformed sticker onto the surface along the light direction.
    vec2 g = p.xy - (uShadowDir.xy / uShadowDir.z) * p.z;
    vHeight = p.z;
    vLocal = position.xy;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(g, 0.0005, 1.0);
  }
`

export const shadowFragment = /* glsl */ `
  uniform vec2 uSize;
  uniform float uCorner;
  uniform float uOpacity;
  varying vec2 vLocal;
  varying float vHeight;
  ${sdf}

  void main() {
    float d = sdStamp(vLocal, uSize * 0.5);
    // Higher off the surface means a softer, lighter shadow.
    float soft = 0.012 + vHeight * 0.45;
    float a = 1.0 - smoothstep(-soft, 0.0, d);
    float strength = mix(0.14, 0.04, clamp(vHeight / 0.8, 0.0, 1.0));
    gl_FragColor = vec4(0.0, 0.0, 0.0, a * strength * uOpacity);
  }
`

// Note: the stamp's own drop shadow is not drawn here. The overlay <canvas>
// gets the same CSS .stamp-shadow filter as the finished <img>, so the
// browser draws one identical shadow before, during and after the paste.
