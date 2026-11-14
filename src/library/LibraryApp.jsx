import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera } from 'lucide-react'
import StampViewer, { requestMotionPermission } from './StampViewer.jsx'
import AnimatedGenerateButton from '@/components/ui/animated-generate-button-shadcn-tailwind'
import Sidebar from './Sidebar.jsx'
import DayView, { GlassChevron } from './DayView.jsx'
import CameraModal from './CameraModal.jsx'
import MobileCamera from './MobileCamera.jsx'
import { useMediaQuery } from './useMediaQuery.js'
import { useStamps } from './useStamps.js'
import { addDays, formatDay, formatMonth, isSameDay, startOfDay } from './dates.js'

function PlaceholderView({ name }) {
  return (
    <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-neutral-200">
      <div className="text-center">
        <div className="font-display text-xl text-neutral-800">{name} view</div>
        <p className="mt-1 text-[13px] text-neutral-500">Coming soon.</p>
      </div>
    </div>
  )
}

export default function LibraryApp() {
  const { stamps, addStamp, removeStamp } = useStamps()
  const [view, setView] = useState('day')
  const [date, setDate] = useState(() => startOfDay(new Date()))
  const [playing, setPlaying] = useState(null) // { id, n }: stamp whose stick effect is playing
  const [cameraOpen, setCameraOpen] = useState(false)
  const [viewing, setViewing] = useState(null) // stamp shown in the popup
  const fileRef = useRef(null)

  const today = startOfDay(new Date())
  const canNext = date < today

  const title = {
    day: formatDay(date),
    month: formatMonth(date),
    year: String(date.getFullYear()),
  }[view]

  const openUpload = () => fileRef.current?.click()

  const play = useCallback((id) => setPlaying((p) => ({ id, n: (p?.n ?? 0) + 1 })), [])
  const played = useCallback((id) => setPlaying((p) => (p?.id === id ? null : p)), [])

  // Save straight to the library, jump to today, and stick it down on the canvas.
  const addToLibrary = async (blob, source, title) => {
    try {
      const stamp = await addStamp(blob, { title, source })
      setView('day')
      setDate(startOfDay(new Date()))
      play(stamp.id)
    } catch (err) {
      console.error(err)
      window.alert('That stamp couldn’t be saved. Please try again.')
    }
  }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file?.type.startsWith('image/')) return
    addToLibrary(file, 'upload', file.name.replace(/\.[^.]+$/, '') || 'Untitled stamp')
  }

  const closeCamera = useCallback(() => setCameraOpen(false), [])
  const onCameraCapture = (blob) => {
    setCameraOpen(false)
    addToLibrary(blob, 'camera', 'Captured stamp')
  }
  const onCameraFallback = () => {
    setCameraOpen(false)
    openUpload()
  }
  const isMobile = useMediaQuery('(max-width: 767px)')
  const todayCount = stamps.filter((s) => isSameDay(new Date(s.createdAt), today)).length

  // Must run inside the click so iOS can ask for motion permission.
  const openViewer = (stamp) => {
    requestMotionPermission()
    setViewing(stamp)
  }
  const closeViewer = useCallback(() => setViewing(null), [])

  return (
    <div className="h-dvh">
      <div className="flex h-full overflow-hidden bg-surface">
        <Sidebar view={view} onViewChange={setView} onUpload={openUpload} onCamera={() => setCameraOpen(true)} />

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-4 md:px-6 md:py-5">
            <h1 className="min-w-0 truncate font-display text-[24px] leading-tight text-neutral-900 md:text-[28px]">
              {title}
            </h1>
            <div className="flex shrink-0 gap-2">
              <AnimatedGenerateButton
                className="text-[15px] font-semibold"
                labelIdle="Add stamp"
                labelActive="Pick image"
                highlightHueDeg={35}
                ariaLabel="Add stamp"
                onClick={openUpload}
              />
            </div>
          </header>

          {/* Canvas. The day chevrons float over its left/right edges and stay
              put while the stamps scroll underneath. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              className={`flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-28 md:p-6 ${
                view === 'day' ? 'px-3 md:px-24' : ''
              }`}
            >
              {view === 'day' && (
                <DayView
                  date={date}
                  stamps={stamps}
                  onAdd={openUpload}
                  playing={playing}
                  onOpen={openViewer}
                  onPlayed={played}
                />
              )}
              {view === 'month' && <PlaceholderView name="Month" />}
              {view === 'year' && <PlaceholderView name="Year" />}
            </div>

            {view === 'day' && (
              <>
                <GlassChevron side="left" label="Previous day" onClick={() => setDate((d) => addDays(d, -1))} />
                <GlassChevron
                  side="right"
                  label="Next day"
                  disabled={!canNext}
                  onClick={() => setDate((d) => (isSameDay(d, today) ? d : addDays(d, 1)))}
                />
              </>
            )}

            {/* Mobile bottom bar (the sidebar is hidden on small screens):
                floating glass view switcher + glowing camera button. */}
            <div
              className="absolute left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 md:hidden"
              style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            >
            <nav aria-label="View" className="glass-bar flex gap-1 rounded-full p-1.5">
              {['day', 'month', 'year'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-current={view === v ? 'page' : undefined}
                  className={`relative rounded-full px-5 py-2.5 text-[15px] capitalize transition-colors ${
                    view === v ? 'text-neutral-900' : 'text-neutral-500'
                  }`}
                >
                  {view === v && (
                    <motion.span
                      layoutId="mobile-view-pill"
                      className="absolute inset-0 rounded-full bg-white/90 shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{v}</span>
                </button>
              ))}
            </nav>
            <AnimatedGenerateButton
              icon={<Camera className="size-[22px]" strokeWidth={2} />}
              hideLabel
              ariaLabel="Use camera"
              highlightHueDeg={35}
              buttonClassName="size-[54px] p-0! rounded-full! [--radius:27px]"
              onClick={() => setCameraOpen(true)}
            />
            </div>
          </div>
        </main>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {cameraOpen && !isMobile && (
        <CameraModal
          onClose={closeCamera}
          onCapture={onCameraCapture}
          onFallbackUpload={onCameraFallback}
        />
      )}

      {/* Phones get the full-screen instant-camera UI. */}
      <AnimatePresence>
        {cameraOpen && isMobile && (
          <MobileCamera
            onClose={closeCamera}
            onCapture={onCameraCapture}
            onFallbackUpload={onCameraFallback}
            latestUrl={stamps[0]?.url}
            total={stamps.length}
            todayCount={todayCount}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewing && (
          <StampViewer
            key={viewing.id}
            stamp={viewing}
            onClose={closeViewer}
            onDelete={async () => {
              setViewing(null)
              await removeStamp(viewing.id)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
