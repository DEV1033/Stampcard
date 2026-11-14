import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { RefreshCcw, X, Zap } from 'lucide-react'
import { FILM_STOCKS, FilmViewfinder } from '../stampcard-effect/filmViewfinder.js'
import { LeatherSurface } from '../stampcard-effect/leather.js'

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Full-screen dark film camera for phones. The live image runs through a
// WebGL film shader (grade, grain, scratches, vignette); the deck is a
// shader-rendered leather surface.
export default function MobileCamera({ onCapture, onClose, onFallbackUpload, latestUrl, todayCount }) {
  const videoRef = useRef(null)
  const viewCanvasRef = useRef(null)
  const viewWrapRef = useRef(null)
  const leatherCanvasRef = useRef(null)
  const finderRef = useRef(null)
  const trackRef = useRef(null)
  const zoomDrag = useRef(null)

  const [facing, setFacing] = useState('environment')
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [stock, setStock] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [capturing, setCapturing] = useState(false)
  const shutter = useAnimationControls()
  const screenFlash = useAnimationControls()
  const film = FILM_STOCKS[stock]

  // Film viewfinder (WebGL).
  useEffect(() => {
    const finder = new FilmViewfinder(viewCanvasRef.current)
    finderRef.current = finder
    const ro = new ResizeObserver(([e]) => finder.resize(e.contentRect.width, e.contentRect.height))
    ro.observe(viewWrapRef.current)
    return () => {
      ro.disconnect()
      finder.dispose()
      finderRef.current = null
    }
  }, [])

  // Leather deck (WebGL, static).
  useEffect(() => {
    const canvas = leatherCanvasRef.current
    const leather = new LeatherSurface(canvas)
    const ro = new ResizeObserver(([e]) => leather.resize(e.contentRect.width, e.contentRect.height))
    ro.observe(canvas)
    return () => {
      ro.disconnect()
      leather.dispose()
    }
  }, [])

  // Camera stream; restarts when switching front/back.
  useEffect(() => {
    let stream
    let alive = true
    setReady(false)
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser can’t open the camera.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const video = videoRef.current
        video.srcObject = s
        video.play().catch(() => {})
        const track = s.getVideoTracks()[0]
        trackRef.current = track
        setTorchSupported(!!track?.getCapabilities?.().torch)
      })
      .catch((err) =>
        setError(err.name === 'NotAllowedError' ? 'Camera access was blocked.' : 'No camera could be opened.'),
      )
    return () => {
      alive = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing])

  useEffect(() => finderRef.current?.setStock(stock), [stock])
  useEffect(() => finderRef.current?.setZoom(zoom), [zoom])
  useEffect(() => finderRef.current?.setMirror(facing === 'user'), [facing])

  const onVideoReady = () => {
    finderRef.current?.setVideo(videoRef.current)
    finderRef.current?.setMirror(facing === 'user')
    setReady(true)
  }

  const toggleFlash = async () => {
    const next = !flashOn
    setFlashOn(next)
    if (torchSupported) {
      try {
        await trackRef.current?.applyConstraints({ advanced: [{ torch: next }] })
      } catch {
        setTorchSupported(false)
      }
    }
  }

  const capture = async () => {
    if (!ready || capturing || !finderRef.current) return
    setCapturing(true)
    // Without a real torch, "flash" lights the scene with a white screen.
    if (flashOn && !torchSupported) {
      await screenFlash.start({ opacity: 1, transition: { duration: 0.08 } })
    }
    const blob = await finderRef.current.capture()
    screenFlash.start({ opacity: 0, transition: { duration: 0.3 } })
    // Shutter blades close and open over the viewfinder.
    await shutter.start({ scaleY: [0, 1, 0], transition: { duration: 0.32, times: [0, 0.45, 1], ease: 'easeInOut' } })
    if (blob) onCapture(blob)
    else setCapturing(false)
  }

  // Zoom wheel: drag up/down.
  const onWheelDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    zoomDrag.current = { y: e.clientY, zoom }
  }
  const onWheelMove = (e) => {
    if (!zoomDrag.current) return
    const dy = zoomDrag.current.y - e.clientY
    setZoom(clamp(zoomDrag.current.zoom + dy / 120, MIN_ZOOM, MAX_ZOOM))
  }
  const onWheelUp = () => (zoomDrag.current = null)

  const nextStock = useCallback(() => setStock((s) => (s + 1) % FILM_STOCKS.length), [])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Camera"
      className="fixed inset-0 z-50 flex flex-col bg-[#1b1b1c] text-neutral-300"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        onLoadedMetadata={onVideoReady}
        className="pointer-events-none absolute size-px opacity-0"
      />

      {/* Camera body */}
      <div
        className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,#252526,#1c1c1d)] px-4 pb-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <div className="flex items-center justify-between py-2">
          <span className="text-[13px] font-bold tracking-[0.35em] text-[#141415] [text-shadow:0_1px_0_rgba(255,255,255,0.07)]">
            STAMPBOOK
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="cam-key grid size-9 place-items-center rounded-full text-neutral-300"
          >
            <X className="size-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 gap-3">
          {/* Recessed viewfinder */}
          <div className="relative min-w-0 flex-1 rounded-[14px] bg-[#111112] p-2.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.06)]">
            <div
              ref={viewWrapRef}
              className="relative h-full w-full overflow-hidden rounded-[6px] bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
            >
              <canvas ref={viewCanvasRef} className="block h-full w-full" />

              {/* Corner brackets */}
              {['left-3 top-3 border-l-2 border-t-2', 'right-3 top-3 border-r-2 border-t-2', 'left-3 bottom-3 border-l-2 border-b-2', 'right-3 bottom-3 border-r-2 border-b-2'].map(
                (c) => (
                  <span key={c} aria-hidden="true" className={`pointer-events-none absolute size-7 border-white/45 ${c}`} />
                ),
              )}
              {/* Exposure scale */}
              <div aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-end gap-[7px]">
                {Array.from({ length: 13 }, (_, i) => (
                  <span key={i} className={`h-px bg-white/50 ${i === 6 ? 'w-4' : i % 3 === 0 ? 'w-3' : 'w-1.5'}`} />
                ))}
              </div>

              {/* Shutter blades */}
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 origin-top bg-black"
                initial={{ scaleY: 0 }}
                animate={shutter}
              />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 origin-bottom bg-black"
                initial={{ scaleY: 0 }}
                animate={shutter}
              />

              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-sm text-neutral-300">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={onFallbackUpload}
                    className="rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-neutral-900"
                  >
                    Upload a file instead
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Side controls */}
          <div className="flex w-[68px] shrink-0 flex-col items-center gap-3">
            {/* LCD readout */}
            <div className="w-full rounded-[8px] bg-[#111112] p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex flex-col items-center gap-1.5 rounded-[5px] bg-[linear-gradient(180deg,#b9bca6,#9ea18b)] px-1 py-2 font-mono text-[#2a2c24] shadow-[inset_0_1px_4px_rgba(0,0,0,0.35)]">
                <span className="text-[10px] font-bold">{film.name}</span>
                <span className="text-[10px]">
                  <Zap className="inline size-2.5" /> {flashOn ? 'ON' : 'OFF'}
                </span>
                <span className="text-[18px] font-bold leading-none tracking-tight">{film.iso}</span>
                <span className="text-[8px] tracking-widest">ISO</span>
                <span className="mt-1 border-t border-[#2a2c24]/30 pt-1 text-[10px]">×{todayCount}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleFlash}
              aria-label={flashOn ? 'Flash off' : 'Flash on'}
              aria-pressed={flashOn}
              className={`cam-key grid h-11 w-full place-items-center rounded-[10px] ${flashOn ? 'text-amber-300' : 'text-neutral-300'}`}
            >
              <Zap className="size-[18px]" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
              aria-label="Switch camera"
              className="cam-key grid h-11 w-full place-items-center rounded-[10px] text-neutral-300"
            >
              <RefreshCcw className="size-[18px]" strokeWidth={2.25} />
            </button>

            {/* Knurled zoom wheel */}
            <div className="mt-auto flex w-full flex-col items-center gap-1">
              <div
                role="slider"
                aria-label="Zoom"
                aria-valuemin={MIN_ZOOM}
                aria-valuemax={MAX_ZOOM}
                aria-valuenow={Number(zoom.toFixed(1))}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') setZoom((z) => clamp(z + 0.2, MIN_ZOOM, MAX_ZOOM))
                  if (e.key === 'ArrowDown') setZoom((z) => clamp(z - 0.2, MIN_ZOOM, MAX_ZOOM))
                }}
                onPointerDown={onWheelDown}
                onPointerMove={onWheelMove}
                onPointerUp={onWheelUp}
                onPointerCancel={onWheelUp}
                className="h-32 w-full touch-none rounded-[10px] bg-[#111112] p-1.5 shadow-[inset_0_2px_5px_rgba(0,0,0,0.85)]"
              >
                <div
                  className="h-full w-full rounded-[6px] shadow-[inset_0_6px_8px_rgba(0,0,0,0.6),inset_0_-6px_8px_rgba(0,0,0,0.6)]"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(180deg,#5a5a5c 0px,#2a2a2b 2px,#6e6e70 3px,#3a3a3b 5px), linear-gradient(90deg,rgba(0,0,0,0.5),rgba(255,255,255,0.12) 50%,rgba(0,0,0,0.5))',
                    backgroundBlendMode: 'overlay',
                    backgroundPositionY: `${zoom * 40}px`,
                  }}
                />
              </div>
              <span className="font-mono text-[10px] text-neutral-500">{zoom.toFixed(1)}×</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metal rail */}
      <div className="h-2.5 shrink-0 bg-[linear-gradient(180deg,#3a3a3c,#141415_45%,#2c2c2e)] shadow-[0_1px_0_rgba(255,255,255,0.05)]" />

      {/* Leather deck */}
      <div className="relative h-[30%] min-h-[190px] shrink-0">
        <canvas ref={leatherCanvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
        <div
          className="relative flex h-full items-center justify-between px-6"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Film canister: tap to change stock */}
          <button
            type="button"
            onClick={nextStock}
            aria-label={`Film: ${film.name} ${film.iso}. Tap to change`}
            className="relative flex h-[118px] w-[50px] flex-col overflow-hidden rounded-[10px] bg-[#0f0f10] p-1 shadow-[inset_0_2px_5px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)] active:scale-[0.97]"
          >
            <span className="h-2.5 rounded-t-[5px] bg-[linear-gradient(90deg,#4a4a4c,#c9c9cc_45%,#5a5a5c)]" />
            <motion.span
              key={film.name}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 flex-col items-center justify-center gap-1"
              style={{
                background: `linear-gradient(90deg, rgba(0,0,0,0.45), transparent 35%, rgba(255,255,255,0.25) 50%, transparent 65%, rgba(0,0,0,0.45)), ${film.label}`,
              }}
            >
              <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-black tracking-[0.18em] text-black/75">
                {film.name}
              </span>
              <span className="text-[10px] font-black text-black/70">{film.iso}</span>
            </motion.span>
            <span className="h-2.5 rounded-b-[5px] bg-[linear-gradient(90deg,#4a4a4c,#c9c9cc_45%,#5a5a5c)]" />
          </button>

          {/* Shutter */}
          <div className="relative">
            <button
              type="button"
              onClick={capture}
              disabled={!ready || !!error || capturing}
              aria-label="Take photo"
              className="group grid size-[124px] place-items-center rounded-full bg-[radial-gradient(circle_at_50%_40%,#2a2a2b,#0d0d0e_70%)] shadow-[inset_0_2px_4px_rgba(255,255,255,0.06),inset_0_-4px_10px_rgba(0,0,0,0.8),0_10px_24px_rgba(0,0,0,0.6)] disabled:opacity-70"
            >
              <span className="grid size-[86px] place-items-center rounded-full bg-[repeating-conic-gradient(from_0deg,#d9d9dc_0deg,#9c9ca0_6deg,#e8e8eb_12deg,#a8a8ac_18deg,#d9d9dc_24deg)] shadow-[0_4px_10px_rgba(0,0,0,0.6),inset_0_2px_2px_rgba(255,255,255,0.7),inset_0_-3px_6px_rgba(0,0,0,0.35)] transition-transform duration-100 group-active:scale-95">
                <span className="grid size-[86px] place-items-center rounded-full bg-[radial-gradient(circle_at_40%_30%,rgba(255,255,255,0.55),transparent_55%)]">
                  <span className="grid size-9 place-items-center rounded-full bg-[radial-gradient(circle_at_50%_40%,#3a3a3c,#0b0b0c)] shadow-[0_0_0_3px_#8d8d91,inset_0_2px_3px_rgba(0,0,0,0.9)]">
                    <span className="size-3 rounded-full bg-[radial-gradient(circle_at_40%_35%,#5a5a5c,#111)]" />
                  </span>
                </span>
              </span>
            </button>
            {/* ISO dial */}
            <motion.div
              aria-hidden="true"
              className="absolute -right-3 -top-2 grid size-12 place-items-center rounded-full bg-[radial-gradient(circle_at_40%_35%,#2c2c2e,#0c0c0d)] shadow-[0_3px_8px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.08)]"
              animate={{ rotate: stock * 90 }}
              transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            >
              <span className="text-[9px] font-bold text-amber-400">{film.iso}</span>
            </motion.div>
          </div>

          {/* Latest stamp: back to the library */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to library"
            className="size-[72px] overflow-hidden rounded-[12px] bg-[#0f0f10] p-1 shadow-[inset_0_2px_5px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.06)] active:scale-95"
          >
            {latestUrl ? (
              <img src={latestUrl} alt="" className="h-full w-full rounded-[8px] object-cover opacity-90" />
            ) : (
              <span className="block h-full w-full rounded-[8px] bg-[linear-gradient(135deg,#2a2a2c,#18181a)]" />
            )}
          </button>
        </div>
      </div>

      {/* Screen flash (used when the camera has no torch) */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[60] bg-white"
        initial={{ opacity: 0 }}
        animate={screenFlash}
      />
    </motion.div>
  )
}
