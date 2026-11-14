import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useReducedMotion, useSpring } from 'framer-motion'
import { formatStampTime, isSameDay } from './dates.js'
import StampApplyOverlay from './StampApplyOverlay.jsx'
import TiltStamp, { useTilt } from './TiltStamp.jsx'

const HOVER_TILT = 8 // degrees

// Just the stamp, pasted on the canvas. The cell is a size container: the
// stamp is 70% of its width, and the space around it gives the WebGL effect
// room for the lifted edge and its shadow while it plays.
function StampTile({ stamp, index, playing, onOpen, onPlayed }) {
  const reduceMotion = useReducedMotion()
  const tilt = useTilt(HOVER_TILT)
  const glare = useSpring(0, { stiffness: 200, damping: 26 })

  // Subtle hover: the side under the cursor presses away, a glare follows
  // the pointer and the shadow shifts. Mouse only; touch just taps to open.
  const onPointerMove = (e) => {
    if (reduceMotion || playing || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    tilt.point((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
    glare.set(1)
  }
  const onPointerLeave = () => {
    tilt.reset()
    glare.set(0)
  }

  return (
    <div className="stamp-cell @container relative grid aspect-[10/11] w-full place-items-center">
      <TiltStamp
        as="button"
        type="button"
        onClick={onOpen}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        title={`${stamp.title} · ${formatStampTime(stamp.createdAt)}`}
        aria-label={`Open ${stamp.title}`}
        className={playing ? 'invisible' : ''}
        url={stamp.url}
        alt={stamp.title}
        tilt={tilt}
        glare={glare}
        shimmerDelay={(index % 6) * 0.12}
      />

      {playing && <StampApplyOverlay key={playing} url={stamp.url} onDone={onPlayed} />}
    </div>
  )
}

// Frosted "glass" chevron floating on the left or right edge of the canvas.
export function GlassChevron({ side, onClick, disabled, label }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`glass-button absolute top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-[100px] text-neutral-800 md:size-12 ${
        side === 'left' ? 'left-1.5 md:left-5' : 'right-1.5 md:right-5'
      }`}
    >
      <Icon className="size-5" strokeWidth={2.25} />
    </button>
  )
}

export default function DayView({ date, stamps, onAdd, playing, onOpen, onPlayed }) {
  const dayStamps = stamps.filter((s) => isSameDay(new Date(s.createdAt), date))

  return (
    <div className="flex flex-1 flex-col">
      {dayStamps.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add a stamp"
            className="grid h-[144px] w-[112px] place-items-center rounded-md border border-neutral-200 bg-white text-neutral-400 shadow-sm transition-colors hover:text-neutral-700"
          >
            <Plus className="size-5" strokeWidth={1.75} />
          </button>
          <p className="text-[13px] text-neutral-500">Add a stamp to this day</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 content-start gap-0 md:grid-cols-3 md:gap-2 lg:grid-cols-4 xl:grid-cols-6">
          {dayStamps.map((s, i) => (
            <StampTile
              key={s.id}
              stamp={s}
              index={i}
              playing={playing?.id === s.id ? playing.n : null}
              onOpen={() => onOpen(s)}
              onPlayed={() => onPlayed(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
