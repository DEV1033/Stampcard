import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { WORKS } from './works.js'

const EASE = [0.22, 1, 0.36, 1]

// Muted looping video that only plays while on screen.
function AutoVideo({ src, poster, label }) {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const video = ref.current
    if (!video || reduceMotion) return
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? video.play().catch(() => {}) : video.pause()),
      { threshold: 0.25 },
    )
    io.observe(video)
    return () => io.disconnect()
  }, [reduceMotion])

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      controls={reduceMotion}
      aria-label={label}
      className="block h-full w-full rounded-[12px] bg-white object-cover shadow-[0_12px_32px_rgba(11,27,43,0.12)]"
    />
  )
}

// VyanEx screens drifting sideways; pauses on hover.
function ScreenStrip({ screens }) {
  const reduceMotion = useReducedMotion()
  const items = reduceMotion ? screens : [...screens, ...screens]
  return (
    <div className="group relative h-full overflow-hidden rounded-[12px] [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div
        className={`flex h-full w-max items-center py-2 ${
          reduceMotion ? 'overflow-x-auto' : 'animate-[works-marquee_40s_linear_infinite] group-hover:[animation-play-state:paused]'
        }`}
      >
        {items.map((s, i) => (
          <img
            key={i}
            src={s.src}
            alt={i < screens.length ? s.alt : ''}
            aria-hidden={i >= screens.length || undefined}
            loading="lazy"
            className="mr-4 h-full max-h-[380px] w-auto rounded-[10px] bg-white object-contain shadow-[0_10px_28px_rgba(11,27,43,0.12)]"
          />
        ))}
      </div>
    </div>
  )
}

function WorkRow({ work, index }) {
  const flip = index % 2 === 1
  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, ease: EASE }}
      className="grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:gap-14"
    >
      {/* Media */}
      <div
        className={`aspect-[16/11] min-w-0 rounded-[20px] bg-[linear-gradient(135deg,#eaf5ff,#d7ecff)] p-3 ring-1 ring-sky-100 md:p-4 ${
          flip ? 'md:order-2' : ''
        }`}
      >
        {work.video ? (
          <AutoVideo src={work.video} poster={work.poster} label={`${work.title} preview`} />
        ) : (
          <ScreenStrip screens={work.screens} />
        )}
      </div>

      {/* Details */}
      <div className={`min-w-0 ${flip ? "md:order-1" : ""}`}>
        <p className="font-mono text-[12px] tracking-wide text-slate-500">
          {String(index + 1).padStart(2, '0')} · {work.meta}
        </p>
        <h3 className="mt-3 font-display text-[36px] leading-[1.05] md:text-[44px]">{work.title}</h3>

        {work.body?.map((p, i) => (
          <p key={i} className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-ink/65">
            {p}
          </p>
        ))}

        {work.points && (
          <ul className="mt-5 space-y-2 text-[15px] text-ink/70">
            {work.points.map((pt) => (
              <li key={pt} className="flex gap-3">
                <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-[1px] bg-sky-400" />
                {pt}
              </li>
            ))}
          </ul>
        )}

        {work.stats && (
          <dl className="mt-6 grid max-w-md grid-cols-3 gap-3">
            {work.stats.map((s) => (
              <div key={s.label} className="rounded-[14px] border border-sky-100 bg-white/70 px-3 py-3">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-[28px] leading-none text-sky-600">{s.value}</dd>
                <dd className="mt-1.5 text-[12px] leading-snug text-ink/55">{s.label}</dd>
              </div>
            ))}
          </dl>
        )}

        {work.quote && (
          <blockquote className="mt-6 border-l-2 border-sky-300 pl-4 text-[15px] italic text-ink/70">
            {work.quote}
          </blockquote>
        )}

        {work.tags && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {work.tags.map((t) => (
              <li key={t} className="rounded-full border border-ink/10 bg-white/70 px-3 py-1 text-[13px] text-ink/70">
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.article>
  )
}

export default function SelectedWorks() {
  return (
    <section id="work" className="scroll-mt-8 px-6 py-24 md:px-12 md:py-32 lg:px-[120px]">
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mb-14 flex items-end justify-between gap-6 border-b border-ink/10 pb-6 md:mb-20"
      >
        <div>
          <p className="font-mono text-[12px] tracking-wide text-slate-500">(01) — Selected works</p>
          <h2 className="mt-3 font-display text-[40px] leading-[1.05] md:text-[56px]">Selected works</h2>
        </div>
        <span className="shrink-0 whitespace-nowrap font-mono text-[13px] text-slate-500">{String(WORKS.length).padStart(2, '0')} projects</span>
      </motion.header>

      <div className="flex flex-col gap-24 md:gap-32">
        {WORKS.map((w, i) => (
          <WorkRow key={w.id} work={w} index={i} />
        ))}
      </div>
    </section>
  )
}
