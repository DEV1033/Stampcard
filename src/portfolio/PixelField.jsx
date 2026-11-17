import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { createPixelField, DEFAULT_TINT, setTint } from './pixelShaders.js'

// Settings for a small card instead of the full screen: smaller, denser
// pixels and tighter cloud blobs so the effect reads at card size.
const COMPACT = { cell: 10, subtlety: 0.95, strength: 0.9, noiseScale: 160, floor: 0.35 }
// `light`: the same, but fewer and paler pixels.
const COMPACT_LIGHT = { ...COMPACT, subtlety: 0.9, strength: 0.8, floor: 0.3 }

// WebGL background of drifting light-blue pixels, filling its parent.
// `start` switches the pixels on. `compact` tunes it for a card; it also only
// animates while on screen. `light` makes the compact version paler.
// `tint` is the tile colour ('#rrggbb').
export default function PixelField({ start, compact = false, light = false, tint = DEFAULT_TINT }) {
  const canvasRef = useRef(null)
  const fieldRef = useRef(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const field = createPixelField(canvas, { tint })
    fieldRef.current = field
    const u = field.uniforms

    // Phones: slightly bigger, denser and stronger pixels so the effect
    // reads on a small screen. Desktop stays subtle.
    const phone = window.matchMedia('(max-width: 767px)')
    const applyScreen = () => {
      if (compact) {
        const c = light ? COMPACT_LIGHT : COMPACT
        u.uCell.value = c.cell
        u.uSubtlety.value = c.subtlety
        u.uStrength.value = c.strength
        u.uNoiseScale.value = c.noiseScale
        u.uFloor.value = c.floor
        return
      }
      u.uCell.value = phone.matches ? 12 : 14
      u.uSubtlety.value = phone.matches ? 0.95 : 0.6
      u.uStrength.value = phone.matches ? 0.95 : 0.75
      u.uNoiseScale.value = phone.matches ? 200 : 375
      u.uFloor.value = phone.matches ? 0.3 : 0.15
    }
    applyScreen()
    phone.addEventListener('change', applyScreen)

    const ro = new ResizeObserver(([e]) => {
      field.resize(e.contentRect.width, e.contentRect.height)
      field.render()
    })
    ro.observe(canvas)

    // Only animate while the canvas is on screen.
    let raf = null
    const t0 = performance.now()
    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      if (!reduceMotion) u.uTime.value = (now - t0) / 1000
      field.render()
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && raf === null) raf = requestAnimationFrame(loop)
      if (!entry.isIntersecting && raf !== null) {
        cancelAnimationFrame(raf)
        raf = null
      }
    })
    io.observe(canvas)

    return () => {
      if (raf !== null) cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      phone.removeEventListener('change', applyScreen)
      field.dispose()
    }
  }, [reduceMotion, compact, light])

  // Recolour live when the tile colour changes.
  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    setTint(field.uniforms.uTint.value, tint)
    field.render()
  }, [tint])

  useEffect(() => {
    const u = fieldRef.current?.uniforms
    if (!start || !u) return
    const c = animate(u.uIntro.value, 1, {
      duration: reduceMotion ? 0 : 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (u.uIntro.value = v),
    })
    return () => c.stop()
  }, [start, reduceMotion])

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
}
