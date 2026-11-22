import { useEffect, useRef } from 'react'

const CELL = 40 // must match the grid size in .paper (index.css)
const COLORS = ['74,59,46', '74,59,46', '74,59,46', '241,189,76', '150,196,214'] // ink (mostly), amber, soft blue
const STEPS = 4 // alpha is quantised into a few levels for a stepped, pixel-like fade

// Squares of the background grid that light up and fade like pixels:
// a few random twinkles, plus a short trail under the cursor.
export default function PixelGrid() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cells = new Map() // "i,j" -> { i, j, t, dur, peak, color }
    let w = 0
    let h = 0
    let ox = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Same alignment as `background-position: center top`.
      ox = ((((w - CELL) / 2) % CELL) + CELL) % CELL
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const light = (i, j, peak, dur, color) => {
      const key = `${i},${j}`
      const c = cells.get(key)
      if (c && c.t < c.dur * 0.5) return
      cells.set(key, { i, j, t: 0, dur, peak, color })
    }

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      if (x < 0 || y < 0 || x > w || y > h) return
      const i = Math.floor((x - ox) / CELL)
      const j = Math.floor(y / CELL)
      light(i, j, 0.16, 1.1, COLORS[0])
    }
    if (!reduce) window.addEventListener('pointermove', onMove, { passive: true })

    let raf
    let last = performance.now()
    let spawn = 0
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      // Random twinkles, roughly proportional to the visible area.
      spawn += dt * Math.max(3, (w * h) / 90000)
      while (spawn > 1) {
        spawn -= 1
        const i = Math.floor(Math.random() * (w / CELL + 1)) - 1
        const j = Math.floor(Math.random() * (h / CELL + 1))
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]
        light(i, j, color === COLORS[0] ? 0.07 + Math.random() * 0.06 : 0.22 + Math.random() * 0.12, 1.4 + Math.random() * 1.6, color)
      }

      ctx.clearRect(0, 0, w, h)
      for (const [key, c] of cells) {
        c.t += dt
        if (c.t >= c.dur) {
          cells.delete(key)
          continue
        }
        // Quick rise, slow fall, stepped.
        const p = c.t / c.dur
        const env = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85
        const a = (Math.ceil(env * STEPS) / STEPS) * c.peak
        ctx.fillStyle = `rgba(${c.color},${a})`
        ctx.fillRect(ox + c.i * CELL + 1, c.j * CELL + 1, CELL - 1, CELL - 1)
      }
      raf = requestAnimationFrame(frame)
    }
    if (!reduce) raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 -z-10 h-full w-full" aria-hidden="true" />
}
