import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const TICK = 'rgba(11, 27, 43, 0.16)'

// Vertical design-tool ruler fixed to the left or right edge of the screen:
// small ticks every 10px, longer every 50px, Fira Code labels every 100px.
export default function Ruler({ side = 'left', show = true, offset = 0 }) {
  const [height, setHeight] = useState(() => window.innerHeight)

  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const left = side === 'left'
  const labels = Array.from({ length: Math.floor((height - 20) / 100) }, (_, i) => (i + 1) * 100)
  // Ticks hug the outer edge of the screen; the right ruler mirrors the left.
  const tickPos = left ? 'left top' : 'right top'

  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-y-0 z-0 hidden w-7 lg:block ${
        left ? 'border-r' : 'border-l'
      } border-ink/[0.06]`}
      initial={{ opacity: 0 }}
      animate={show ? { opacity: 1 } : undefined}
      transition={{ duration: 0.8 }}
      style={{
        [left ? 'left' : 'right']: offset,
        backgroundImage: [
          // Long tick every 50px
          `repeating-linear-gradient(to bottom, ${TICK} 0 1px, transparent 1px 50px)`,
          // Short tick every 10px
          `repeating-linear-gradient(to bottom, ${TICK} 0 1px, transparent 1px 10px)`,
        ].join(','),
        backgroundSize: '10px 100%, 5px 100%',
        backgroundPosition: `${tickPos}, ${tickPos}`,
        backgroundRepeat: 'no-repeat',
      }}
    >
      {labels.map((n) => (
        <span
          key={n}
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] tracking-wide text-slate-400 [writing-mode:vertical-rl]"
          style={{ top: n }}
        >
          {n}
        </span>
      ))}
    </motion.div>
  )
}
