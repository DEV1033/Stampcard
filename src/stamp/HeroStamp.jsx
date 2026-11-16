import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import StampApplyOverlay from './StampApplyOverlay.jsx'

// A single stamp that gets pasted on (3D WebGL effect from the bottom-left
// corner) once `start` turns true, then settles into the static stamp with
// its perforated edge, drop shadow and repeating shimmer.
export default function HeroStamp({ start, src, alt = '', delay = 0.9, className = '' }) {
  const reduceMotion = useReducedMotion()
  const [phase, setPhase] = useState('waiting') // waiting | pasting | done

  useEffect(() => {
    if (!start) return
    if (reduceMotion) return setPhase('done')
    const t = setTimeout(() => setPhase('pasting'), delay * 1000)
    return () => clearTimeout(t)
  }, [start, delay, reduceMotion])

  return (
    // --sf 0.7: the stamp is 70% of this box's width; the paste overlay reads it.
    <div
      className={`@container relative grid aspect-[10/11] w-full place-items-center ${className}`}
      style={{ '--sf': 0.7 }}
    >
      <div className={`stamp-shadow relative ${phase === 'done' ? '' : 'invisible'}`}>
        <img src={src} alt={alt} crossOrigin="anonymous" draggable={false} className="stamp-thumb block object-cover" />
        <span aria-hidden="true" className="stamp-shimmer" />
      </div>
      {phase === 'pasting' && <StampApplyOverlay url={src} onDone={() => setPhase('done')} />}
    </div>
  )
}
