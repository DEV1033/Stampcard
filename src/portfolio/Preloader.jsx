import { useEffect, useRef, useState } from 'react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { createPixelLoader } from './pixelShaders.js'
import { loadSettings } from './settings.js'

const LOAD_TIME = 2.2 // s for the counter to reach 100

// Pixel preloader: pixels in the saved tile colour light up as a counter runs 0 → 100,
// then the pixels switch off in a scattered wave to reveal the page.
export default function Preloader({ onDone }) {
  const canvasRef = useRef(null)
  const [count, setCount] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const reduceMotion = useReducedMotion()
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    const loader = createPixelLoader(canvas, { cell: window.innerWidth < 640 ? 18 : 26, tint: loadSettings().tile })
    const u = loader.uniforms
    loader.resize(canvas.clientWidth, canvas.clientHeight)
    const ro = new ResizeObserver(([e]) => loader.resize(e.contentRect.width, e.contentRect.height))
    ro.observe(canvas)

    let raf
    const t0 = performance.now()
    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      u.uTime.value = (now - t0) / 1000
      loader.render()
    }
    raf = requestAnimationFrame(loop)

    let cancelled = false
    const controls = []
    const run = async () => {
      // Count up, but don't finish before the fonts are ready.
      const fonts = document.fonts?.ready ?? Promise.resolve()
      await animate(0, 1, {
        duration: reduceMotion ? 0.3 : LOAD_TIME,
        ease: [0.65, 0, 0.35, 1],
        onUpdate: (v) => {
          u.uProgress.value = v
          setCount(Math.round(v * 100))
        },
      })
      await fonts
      if (cancelled) return
      setLeaving(true)
      await new Promise((r) => setTimeout(r, reduceMotion ? 0 : 250))
      const exit = animate(0, 1.02, {
        duration: reduceMotion ? 0.2 : 1.0,
        ease: [0.55, 0, 0.45, 1],
        onUpdate: (v) => (u.uExit.value = v),
      })
      controls.push(exit)
      // Let the page start its entrance while the pixels are still clearing.
      setTimeout(() => !cancelled && doneRef.current('reveal'), reduceMotion ? 0 : 350)
      await exit
      if (!cancelled) doneRef.current('gone')
    }
    run()

    return () => {
      cancelled = true
      controls.forEach((c) => c.stop())
      cancelAnimationFrame(raf)
      ro.disconnect()
      loader.dispose()
    }
  }, [reduceMotion])

  return (
    <div className="fixed inset-0 z-50" role="status" aria-live="polite" aria-label={`Loading ${count}%`}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-6 pb-6 text-ink md:px-10 md:pb-10"
        animate={{ opacity: leaving ? 0 : 1, y: leaving ? 12 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-sm tracking-wide text-ink/60">Loading portfolio</span>
        <span className="font-display text-[22vw] leading-[0.8] tabular-nums md:text-[14vw]">
          {count}
          <span className="text-[0.35em] align-top">%</span>
        </span>
      </motion.div>
    </div>
  )
}
