import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Mail, Settings } from 'lucide-react'
import AnimatedGenerateButton from '@/components/ui/animated-generate-button-shadcn-tailwind'
import Preloader from './Preloader.jsx'
import PixelField from './PixelField.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import { useSettings } from './settings.js'
import Ruler from './Ruler.jsx'
import SelectedWorks from './SelectedWorks.jsx'
import Sidebar, { AvailabilityPill, Logo, SIDEBAR_WIDTH } from './Sidebar.jsx'
import AboutPage from './AboutPage.jsx'
import GrainTransition, { COVER_MS } from './GrainTransition.jsx'

const HEADING = ['Designing', 'product', 'that', 'makes', 'it', 'feel', 'easy']
const EASE = [0.22, 1, 0.36, 1]
const SKY_HUE = 205 // light-blue glow on the CTAs, matching the pixels
const HEADER_H = 72 // desktop header bar height (px)
// Header title: today's day and date, e.g. "Tuesday, 17 November 2026".
const DAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// Pages live in the address hash: '#about' is the About page, anything else
// (including '#work', '#contact') belongs to the home page.
const pageFromHash = (hash) => (hash === '#about' ? 'about' : 'home')

// Page switching with a grainy blur: cover the screen, swap the page
// underneath, then clear. Also runs for the browser's back/forward buttons.
function usePages() {
  const [page, setPage] = useState(() => pageFromHash(window.location.hash))
  const [covering, setCovering] = useState(false)
  const pageRef = useRef(page)
  const timers = useRef([])

  const transitionTo = useCallback((target, hash) => {
    timers.current.forEach(clearTimeout)
    setCovering(true)
    timers.current = [
      setTimeout(() => {
        pageRef.current = target
        setPage(target)
        // Land at the top of the new page, or on the section the link names.
        requestAnimationFrame(() => {
          const el = hash && hash !== '#about' ? document.getElementById(hash.slice(1)) : null
          if (el) el.scrollIntoView({ behavior: 'instant' })
          else window.scrollTo({ top: 0, behavior: 'instant' })
        })
        timers.current.push(setTimeout(() => setCovering(false), 120))
      }, COVER_MS),
    ]
  }, [])

  // Sidebar link clicks: links within the current page just scroll as usual.
  const navigate = useCallback(
    (e, href) => {
      const target = pageFromHash(href)
      if (target === pageRef.current) return
      e.preventDefault()
      window.history.pushState(null, '', href)
      transitionTo(target, href)
    },
    [transitionTo],
  )

  useEffect(() => {
    const onPop = () => {
      const target = pageFromHash(window.location.hash)
      if (target !== pageRef.current) transitionTo(target, window.location.hash)
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      timers.current.forEach(clearTimeout)
    }
  }, [transitionTo])

  return { page, covering, navigate }
}

export default function Portfolio() {
  // `?skip-intro` in the address skips the preloader (handy for testing).
  const [stage, setStage] = useState(() =>
    new URLSearchParams(window.location.search).has('skip-intro') ? 'gone' : 'loading',
  ) // loading | reveal | gone
  const reduceMotion = useReducedMotion()
  const show = stage !== 'loading'
  const [settings, updateSettings] = useSettings()
  const { page, covering, navigate } = usePages()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const rise = (i) => ({
    initial: { y: reduceMotion ? 0 : '110%', opacity: reduceMotion ? 0 : 1 },
    animate: show ? { y: '0%', opacity: 1 } : undefined,
    transition: { duration: reduceMotion ? 0.3 : 0.9, ease: EASE, delay: reduceMotion ? 0 : 0.07 * i },
  })
  const fadeUp = (delay) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 16 },
    animate: show ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.7, ease: EASE, delay: reduceMotion ? 0 : delay },
  })

  return (
    <div
      className="relative isolate min-h-dvh bg-paper text-ink"
      style={{
        '--fs-heading': `${settings.heading}px`,
        '--fs-body': `${settings.body}px`,
        '--fs-work-title': `${settings.workTitle}px`,
        '--tile': settings.tile,
      }}
    >
      {/* Light pixels building up along the bottom of the screen, across the whole
          content area (right of the sidebar), with a cloudy blur over the top
          part. Fixed, so it stays put while the work scrolls over it. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[45vh] md:left-[240px] [mask-image:linear-gradient(to_top,black_60%,transparent)]"
        initial={{ opacity: 0 }}
        animate={show ? { opacity: 1 } : undefined}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <PixelField start={show} compact light tint={settings.tile} />
        <div className="absolute inset-x-0 top-0 h-[80%] backdrop-blur-[2px] [mask-image:linear-gradient(to_bottom,black_30%,transparent)]" />
        <div className="absolute inset-x-0 top-0 h-[50%] backdrop-blur-[4px] [mask-image:linear-gradient(to_bottom,black_20%,transparent)]" />
      </motion.div>

      {/* Desktop: app shell (fixed sidebar + header bar). */}
      <Sidebar
        active={page === 'about' ? 'about' : 'work'}
        motionProps={fadeUp(0.1)}
        settings={settings}
        onSettingsChange={updateSettings}
        onNavigate={navigate}
      />

      {/* Mobile header (the sidebar is hidden on small screens). */}
      <motion.header {...fadeUp(0.1)} className="flex items-center justify-between px-6 py-6 md:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <AvailabilityPill />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            aria-haspopup="dialog"
            className="grid size-9 place-items-center rounded-full border border-ink/10 bg-white/60 text-ink/70"
          >
            <Settings className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>
      </motion.header>

      <div className="md:pl-[var(--sidebar-w)]" style={{ '--sidebar-w': `${SIDEBAR_WIDTH}px`, '--header-h': `${HEADER_H}px` }}>
      <motion.header
        {...fadeUp(0.15)}
        className="sticky top-0 z-20 hidden h-[var(--header-h)] items-center justify-between gap-4 border-b border-ink/[0.08] bg-paper/70 px-8 backdrop-blur-md md:flex lg:px-12"
      >
        <h2 className="min-w-0 truncate font-display text-[24px] leading-tight text-ink">
          {DAY_FMT.format(new Date())}
        </h2>
        <AnimatedGenerateButton
          className="shrink-0 text-[15px] font-semibold"
          icon={<Mail className="size-5" strokeWidth={2} />}
          labelIdle="Get in touch"
          labelActive="Say hello"
          highlightHueDeg={SKY_HUE}
          ariaLabel="Get in touch"
          onClick={() => (window.location.hash = 'contact')}
        />
      </motion.header>


      {/* Two columns on desktop: the heading stays pinned on the left while
          the work scrolls on the right. Stacked on smaller screens. */}
      {page === 'about' ? (
        <AboutPage />
      ) : (
      <main className="grid grid-cols-1 gap-16 px-6 md:px-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12 xl:px-20">
        {/* Heading + intro + CTAs (sticky on desktop) */}
        <section className="flex min-w-0 flex-col items-start pt-10 text-left lg:sticky lg:top-[var(--header-h)] lg:h-[calc(100dvh-var(--header-h))] lg:pt-12">
          <h1 className="max-w-[16ch] font-display text-[length:var(--fs-heading)] leading-[1.05] tracking-[-0.015em]">
            {HEADING.map((word, i) => (
              <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <motion.span
                  {...rise(i)}
                  className={`inline-block ${word === 'easy' ? 'italic text-[var(--tile)]' : ''}`}
                >
                  {word}
                </motion.span>
                {i < HEADING.length - 1 && ' '}
              </span>
            ))}
          </h1>

          <motion.p
            {...fadeUp(0.5)}
            className="mt-5 max-w-[54ch] font-sans text-[length:var(--fs-body)] leading-relaxed text-ink/65"
          >
            I’m a self-taught product designer. I found design through frontend development in my 2nd year of
            college, when one question wouldn’t leave me alone: how are these interfaces made?
          </motion.p>

          <motion.div {...fadeUp(0.7)} className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <AnimatedGenerateButton
              className="w-full text-[15px] font-semibold sm:w-auto"
              buttonClassName="w-full sm:w-auto"
              labelIdle="View my work"
              labelActive="Opening…"
              highlightHueDeg={SKY_HUE}
              ariaLabel="View my work"
              onClick={() => (window.location.hash = 'work')}
            />
            <AnimatedGenerateButton
              className="w-full text-[15px] font-semibold sm:w-auto"
              buttonClassName="w-full sm:w-auto"
              icon={<Mail className="size-5" strokeWidth={2} />}
              labelIdle="Get in touch"
              labelActive="Say hello"
              highlightHueDeg={SKY_HUE}
              ariaLabel="Get in touch"
              onClick={() => (window.location.hash = 'contact')}
            />
          </motion.div>
        </section>

        {/* Right column: the work */}
        <div className="min-w-0 pb-32">
          <SelectedWorks />
        </div>
      </main>
      )}
      </div>

      <Ruler side="left" show={show} offset={SIDEBAR_WIDTH} />
      <Ruler side="right" show={show} />

      <AnimatePresence>
        {settingsOpen && (
          <SettingsPanel settings={settings} onChange={updateSettings} onClose={closeSettings} />
        )}
      </AnimatePresence>

      <AnimatePresence>{covering && <GrainTransition />}</AnimatePresence>

      {stage !== 'gone' && <Preloader onDone={setStage} />}
    </div>
  )
}
