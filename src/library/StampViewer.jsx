import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import HoldToDeleteButton from '@/components/ui/hold-to-delete-button'
import TiltStamp, { useTilt } from './TiltStamp.jsx'
import { formatDay } from './dates.js'
import { dissolveToSand } from '../stampcard-effect/sand.js'

const MAX_TILT = 14
const IDLE_MS = 1500 // after this long without input, the stamp sways by itself
const GRAIN_SIZE = 4 // px
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// White popup with one large stamp on a "gyroscope": it tilts with the mouse
// on desktop or with the phone's motion, and sways gently when left alone.
// Delete turns the stamp to sand that pours down into a heap on the floor above
// the buttons, then removes it.
export default function StampViewer({ stamp, onClose, onDelete }) {
  const reduceMotion = useReducedMotion()
  const tilt = useTilt(MAX_TILT, { stiffness: 90, damping: 16, mass: 0.8 })
  const cardRef = useRef(null)
  const stampBoxRef = useRef(null)
  const imgRef = useRef(null)
  const footerRef = useRef(null)
  const canvasRef = useRef(null)
  const lastInput = useRef(0)
  const frozen = useRef(false) // stop tilting once the stamp starts to break
  const [phase, setPhase] = useState('idle') // idle | breaking | broken
  const busy = phase !== 'idle'

  const close = () => !busy && onClose()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  // Phone motion: tilt relative to how the phone was held when opened.
  useEffect(() => {
    if (reduceMotion) return
    let base = null
    const onOrient = (e) => {
      if (frozen.current || e.beta == null || e.gamma == null) return
      base ??= { beta: e.beta, gamma: e.gamma }
      tilt.set((e.gamma - base.gamma) / 25, (e.beta - base.beta) / 25)
      lastInput.current = performance.now()
    }
    window.addEventListener('deviceorientation', onOrient)
    return () => window.removeEventListener('deviceorientation', onOrient)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion])

  // Idle sway, like a card balanced on a gyroscope.
  useEffect(() => {
    if (reduceMotion) return
    let raf
    const start = performance.now()
    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      if (frozen.current || now - lastInput.current < IDLE_MS) return
      const t = (now - start) / 1000
      tilt.set(Math.sin(t * 0.9) * 0.35, Math.sin(t * 0.7 + 1.2) * 0.3)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion])

  const onPointerMove = (e) => {
    if (reduceMotion || frozen.current || !stampBoxRef.current) return
    const r = stampBoxRef.current.getBoundingClientRect()
    tilt.set((e.clientX - (r.left + r.width / 2)) / r.width, (e.clientY - (r.top + r.height / 2)) / r.height)
    lastInput.current = performance.now()
  }

  const deleteStamp = async () => {
    if (busy) return
    if (reduceMotion) {
      setPhase('broken')
      return onDelete()
    }

    // Straighten up, then break.
    frozen.current = true
    tilt.reset()
    setPhase('breaking')
    await wait(450) // let the tilt spring settle flat

    const card = cardRef.current.getBoundingClientRect()
    const img = imgRef.current.getBoundingClientRect()
    const foot = footerRef.current.getBoundingClientRect()
    try {
      const fx = await dissolveToSand({
        canvas: canvasRef.current,
        width: card.width,
        height: card.height,
        imageUrl: stamp.url,
        rect: { x: img.left - card.left, y: img.top - card.top, w: img.width, h: img.height },
        groundY: foot.top - card.top - 10,
        grain: GRAIN_SIZE,
      })
      await fx.firstFrame
      setPhase('broken') // hide the real stamp; the particles now stand in for it
      await fx.done
    } catch (err) {
      console.error('Sand effect failed', err)
    }
    onDelete()
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-neutral-900/25 p-4 backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={close}
      onPointerMove={onPointerMove}
    >
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stamp-viewer-title"
        className="relative flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5 md:p-8"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="stamp-viewer-title" className="font-display text-[22px] leading-tight text-neutral-900 md:text-[24px]">
          {formatDay(new Date(stamp.createdAt))}
        </h2>

        <div ref={stampBoxRef} className="@container grid aspect-[10/11] w-[min(76vw,380px)] place-items-center">
          <motion.div
            animate={{ opacity: phase === 'broken' ? 0 : 1 }}
            transition={{ duration: phase === 'broken' ? 0.12 : 0 }}
          >
            <TiltStamp url={stamp.url} alt={stamp.title} tilt={tilt} glare={1} imgRef={imgRef} />
          </motion.div>
        </div>

        <div ref={footerRef} className="flex flex-col gap-2.5">
          <HoldToDeleteButton onComplete={deleteStamp} disabled={busy} className="w-full" />
          <button
            type="button"
            onClick={close}
            disabled={busy}
            autoFocus
            className="w-full rounded-[100px] bg-neutral-900 px-6 py-3 text-[15px] font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        {/* Sand grains are drawn here while the stamp dissolves. */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 block h-full w-full rounded-3xl"
        />
      </motion.div>
    </motion.div>
  )
}

// iOS only delivers motion events after permission granted from a user
// gesture, so call this directly inside the click that opens the viewer.
export function requestMotionPermission() {
  const DOE = window.DeviceOrientationEvent
  if (DOE && typeof DOE.requestPermission === 'function') DOE.requestPermission().catch(() => {})
}
