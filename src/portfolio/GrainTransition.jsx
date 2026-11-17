import { motion } from 'framer-motion'

// Film-grain noise as an inline SVG (fractal turbulence, greyscale).
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`

export const COVER_MS = 450 // time for the blur to fully cover the screen

// Full-screen frosted blur with moving film grain, shown while the page
// switches underneath. Mount it inside <AnimatePresence> to fade in and out.
export default function GrainTransition() {
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-0 z-[60] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: COVER_MS / 1000, ease: [0.65, 0, 0.35, 1] }}
    >
      <div className="absolute inset-0 bg-white/45 backdrop-blur-[28px]" />
      <div
        className="grain-jitter absolute -inset-[50%] opacity-[0.28] mix-blend-multiply"
        style={{ backgroundImage: GRAIN, backgroundSize: '220px 220px' }}
      />
    </motion.div>
  )
}
