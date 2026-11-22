import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { PasteOverlay } from './PasteOverlay.js'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// One letter tile: pasted onto the page like a sticker, and draggable anywhere.
function Sticker({ t, order, overlayRef, zTop, sizeClass, registry }) {
  const boxRef = useRef(null) // unrotated box: drag translate lives here
  const url = `/letters/${t.l}.svg`
  const [shown, setShown] = useState(false)
  const [lifted, setLifted] = useState(false)
  const off = useRef({ x: 0, y: 0 })
  const drag = useRef(null)
  const anim = useRef(null)
  const resetTimer = useRef(0)

  const paste = useCallback(
    (opts) => {
      const ov = overlayRef.current
      anim.current?.cancel()
      if (!ov || reducedMotion()) {
        setShown(true)
        return
      }
      const a = ov.play(boxRef.current, { url, rot: t.r, dy: t.y, scale: t.s ?? 1 }, { ...opts, onStart: () => setShown(false) })
      anim.current = a
      a.promise.then((ok) => {
        if (anim.current === a) anim.current = null
        if (ok) setShown(true)
      })
    },
    [overlayRef, url, t]
  )

  // First paste, staggered letter by letter once the tile image is ready.
  useEffect(() => {
    let alive = true
    const img = new Image()
    img.src = url
    const go = () => alive && setTimeout(() => alive && paste({ duration: 1.25, angle: 0.8 }), 350 + order * 130)
    img.decode().then(go, go)
    return () => {
      alive = false
      anim.current?.cancel()
    }
  }, [url, order, paste])

  // Glide back to the original spot, then paste down again.
  const reset = useCallback(
    (delay) => {
      const el = boxRef.current
      if (!el || (off.current.x === 0 && off.current.y === 0) || drag.current) return
      clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => {
        anim.current?.cancel()
        anim.current = null
        setShown(true)
        off.current = { x: 0, y: 0 }
        const quick = reducedMotion()
        if (quick) {
          el.style.transform = ''
          return
        }
        setLifted(true)
        el.style.transition = 'transform 600ms cubic-bezier(0.2, 0.7, 0.2, 1)'
        el.style.transform = 'translate(0px, 0px)'
        resetTimer.current = setTimeout(() => {
          el.style.transition = ''
          setLifted(false)
          paste({ duration: 0.8, angle: 0.5 })
        }, 620)
      }, delay)
    },
    [paste]
  )

  useEffect(() => {
    registry.current.set(order, reset)
    return () => {
      registry.current.delete(order)
      clearTimeout(resetTimer.current)
    }
  }, [registry, order, reset])

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = boxRef.current
    // Grabbing a letter while it glides back: stop it where it is.
    if (el.style.transition) {
      clearTimeout(resetTimer.current)
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
      off.current = { x: m.m41, y: m.m42 }
      el.style.transition = ''
      el.style.transform = `translate(${m.m41}px, ${m.m42}px)`
    }
    el.setPointerCapture(e.pointerId)
    // Grabbing a sticker mid-paste finishes it instantly.
    if (anim.current) {
      anim.current.cancel()
      anim.current = null
    }
    setShown(true)
    el.style.zIndex = String(++zTop.current)
    drag.current = { sx: e.clientX, sy: e.clientY, ox: off.current.x, oy: off.current.y, rect: el.getBoundingClientRect(), moved: false }
    setLifted(true)
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    let dx = e.clientX - d.sx
    let dy = e.clientY - d.sy
    if (Math.hypot(dx, dy) > 3) d.moved = true
    // Keep the sticker's centre on screen.
    const cx = d.rect.left + d.rect.width / 2
    const cy = d.rect.top + d.rect.height / 2
    dx = Math.min(Math.max(dx, 6 - cx), window.innerWidth - 6 - cx)
    dy = Math.min(Math.max(dy, 6 - cy), window.innerHeight - 6 - cy)
    off.current = { x: d.ox + dx, y: d.oy + dy }
    boxRef.current.style.transform = `translate(${off.current.x}px, ${off.current.y}px)`
  }

  const onPointerUp = () => {
    const d = drag.current
    if (!d) return
    drag.current = null
    setLifted(false)
    if (d.moved) paste({ duration: 0.8, angle: 0.5 })
  }

  return (
    <span
      ref={boxRef}
      className="sticker relative -mx-[0.5%] block cursor-grab touch-none select-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className={`sticker-lift block ${lifted ? 'is-lifted' : ''}`}>
        <img
          src={url}
          alt=""
          draggable="false"
          className={`tile block w-auto ${sizeClass}`}
          style={{ transform: `translateY(${t.y}px) rotate(${t.r}deg) scale(${t.s ?? 1})`, opacity: shown ? 1 : 0 }}
        />
      </span>
    </span>
  )
}

// "Dev Chaudhary" as collage stickers: each letter is pasted on, then can be dragged anywhere.
const StickerName = forwardRef(function StickerName({ words, label, sizeClass }, ref) {
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const zTop = useRef(20)
  const registry = useRef(new Map())

  // reset(): put every moved letter back where it started, one after another.
  useImperativeHandle(ref, () => ({
    reset() {
      let n = 0
      ;[...registry.current.keys()].sort((a, b) => a - b).forEach((k) => registry.current.get(k)(n++ * 60))
    },
  }))

  useEffect(() => {
    try {
      overlayRef.current = new PasteOverlay(canvasRef.current)
    } catch {
      overlayRef.current = null // no WebGL: letters just appear
    }
    return () => {
      overlayRef.current?.dispose()
      overlayRef.current = null
    }
  }, [])

  let order = 0
  return (
    <>
      <h1 className="flex flex-col items-center gap-[clamp(6px,1.4vw,16px)] px-2.5">
        <span className="sr-only">{label}</span>
        {words.map((word, w) => (
          <span key={w} className="flex items-center" aria-hidden="true">
            {word.map((t, i) => (
              <Sticker key={i} t={t} order={order++} overlayRef={overlayRef} zTop={zTop} sizeClass={sizeClass} registry={registry} />
            ))}
          </span>
        ))}
      </h1>
      <canvas ref={canvasRef} aria-hidden="true" className="tile pointer-events-none fixed inset-0 z-[60] block h-full w-full" />
    </>
  )
})

export default StickerName
