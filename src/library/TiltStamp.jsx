import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Tilt state for a stamp. Targets are set with point()/set(); the rendered
// rotation follows through a spring so it always moves smoothly.
export function useTilt(max, spring = { stiffness: 180, damping: 20, mass: 0.6 }) {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const srx = useSpring(rx, spring)
  const sry = useSpring(ry, spring)

  // nx, ny in -1..1: where the pointer is relative to the stamp's centre.
  // That side presses away from the viewer.
  const set = (nx, ny) => {
    ry.set(clamp(nx, -1, 1) * max)
    rx.set(-clamp(ny, -1, 1) * max)
  }
  // px, py in 0..1 within the stamp's box.
  const point = (px, py) => set(px * 2 - 1, py * 2 - 1)
  const reset = () => set(0, 0)

  return { rx, ry, srx, sry, max, set, point, reset }
}

// The stamp with a 3D tilt, a glare that follows the tilt, the repeating
// shimmer, and a drop shadow that shifts as it tilts. The shadow sits on the
// outer (untransformed) element so it's cast by the tilted shape. At rest the
// shadow is identical to `.stamp-shadow`, which the paste effect also uses.
// Sizes are in cqw, so the parent must be an @container.
export default function TiltStamp({
  as = 'div',
  url,
  alt,
  tilt,
  glare,
  shimmerDelay = 0,
  imgRef,
  className = '',
  ...rest
}) {
  const Outer = as === 'button' ? motion.button : motion.div
  const { srx, sry, max } = tilt

  const glareX = useTransform(sry, [-max, max], [0, 100])
  const glareY = useTransform(srx, [max, -max], [0, 100])
  const glareBg = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.34), rgba(255,255,255,0) 58%)`

  // The edge that lifts towards the viewer throws its shadow further out.
  const shadowX = useTransform(sry, (v) => -v * 0.18)
  const shadowY = useTransform(srx, (v) => 3.75 + v * 0.18)
  // Same as .stamp-shadow, in units that scale with the stamp size (--sf).
  const filter = useMotionTemplate`drop-shadow(0 calc(0.6 * var(--u)) calc(0.7 * var(--u)) rgba(0,0,0,0.16)) drop-shadow(calc(${shadowX} * var(--u)) calc(${shadowY} * var(--u)) calc(5 * var(--u)) rgba(0,0,0,0.13))`

  return (
    <Outer
      {...rest}
      className={`relative block ${className}`}
      style={{ filter, '--u': 'calc(1cqw * var(--sf, 0.7) / 0.7)' }}
    >
      <motion.div
        className="relative"
        style={{ rotateX: srx, rotateY: sry, transformPerspective: 700 }}
      >
        <img ref={imgRef} src={url} alt={alt} draggable={false} className="stamp-thumb block object-cover" />
        <span aria-hidden="true" className="stamp-shimmer" style={{ animationDelay: `${shimmerDelay}s` }} />
        <motion.span aria-hidden="true" className="stamp-glare" style={{ background: glareBg, opacity: glare }} />
      </motion.div>
    </Outer>
  )
}
