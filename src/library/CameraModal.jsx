import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

// Live camera preview with a shutter; hands back a JPEG blob.
export default function CameraModal({ onCapture, onClose, onFallbackUpload }) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream
    let alive = true
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser can’t open the camera.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream = s
        videoRef.current.srcObject = s
      })
      .catch((err) =>
        setError(err.name === 'NotAllowedError' ? 'Camera access was blocked.' : 'No camera could be opened.'),
      )
    return () => {
      alive = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const capture = () => {
    const v = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-900/30 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Capture a stamp"
        className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h3 className="font-display text-lg">Capture a stamp</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-neutral-900">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-neutral-300">
              <p>{error}</p>
              <button
                type="button"
                onClick={onFallbackUpload}
                className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-neutral-900"
              >
                Upload a file instead
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setReady(true)}
                className="h-full w-full object-cover"
              />
              {/* Framing guide */}
              <div className="pointer-events-none absolute inset-[14%_26%] rounded-sm border-2 border-dashed border-white/70" />
            </>
          )}
        </div>

        <div className="flex items-center justify-center border-t border-neutral-200 p-3">
          <button
            type="button"
            onClick={capture}
            disabled={!ready || !!error}
            className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-neutral-700 disabled:opacity-40"
          >
            <Camera className="size-4" />
            Capture
          </button>
        </div>
      </div>
    </div>
  )
}
