import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { StickerScene } from './StickerScene.js'

// Plays the WebGL "stamp being stuck down" effect over a tile's thumbnail
// area, then calls onDone so the tile can show its plain <img> again.
export default function StampApplyOverlay({ url, onDone }) {
  const canvasRef = useRef(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    // The canvas is 1.5× the cell's width (see className), and the stamp is
    // --sf of the cell (0.7, or 0.8 on phones), so it spans --sf / 1.5.
    const sf = parseFloat(getComputedStyle(canvas).getPropertyValue('--sf')) || 0.7
    const scene = new StickerScene(canvas, { stampFraction: sf / 1.5 })
    // Size it right away so the first frame isn't drawn at the default size.
    scene.resize(canvas.clientWidth, canvas.clientHeight)
    const ro = new ResizeObserver(([e]) => scene.resize(e.contentRect.width, e.contentRect.height))
    ro.observe(canvas)
    let alive = true
    scene
      .setImage(url)
      .then(() => (reduceMotion || !alive ? scene.showApplied() : scene.play()))
      .then(() => alive && doneRef.current())
      .catch(() => alive && doneRef.current())
    return () => {
      alive = false
      ro.disconnect()
      scene.dispose()
    }
  }, [url, reduceMotion])

  // Extends 25% past the cell on every side (so 1.5× its size) and sits
  // above neighbouring stamps, giving the raised flap room without clipping.
  // `stamp-shadow` is the exact same CSS drop shadow as the finished stamp,
  // drawn from the WebGL stamp's shape, so the shadow never jumps at the swap.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="stamp-shadow pointer-events-none absolute -inset-x-[25%] -inset-y-[25%] z-10 block h-[150%] w-[150%]"
    />
  )
}
