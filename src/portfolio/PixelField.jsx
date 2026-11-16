import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { createPixelField } from './pixelShaders.js'

// Full-bleed WebGL background of drifting light-blue pixels.
// `start` switches the pixels on once the preloader has gone.
export default function PixelField({ start }) {
  const canvasRef = useRef(null)
  const fieldRef = useRef(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    const field = createPixelField(canvas, { cell: window.innerWidth < 640 ? 11 : 14 })
    fieldRef.current = field
    const u = field.uniforms

    const ro = new ResizeObserver(([e]) => {
      field.resize(e.contentRect.width, e.contentRect.height)
      field.render()
    })
    ro.observe(canvas)

    let raf
    const t0 = performance.now()
    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      if (!reduceMotion) u.uTime.value = (now - t0) / 1000
      field.render()
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      field.dispose()
    }
  }, [reduceMotion])

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
