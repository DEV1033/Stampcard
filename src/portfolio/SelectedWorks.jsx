import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { WORKS } from './works.js'

const EASE = [0.22, 1, 0.36, 1]

// Muted looping video that only plays while on screen.
function AutoVideo({ src, poster, label, tone }) {
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
      data-tone={tone}
      className="block aspect-video h-auto w-full rounded-[10px] bg-white object-cover shadow-[0_12px_32px_rgba(11,27,43,0.14)]"
    />
  )
}

// One project, stacked: title and meta on top, media below.
function WorkRow({ work }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease: EASE }}
      className="flex flex-col gap-5"
    >
      <div className="min-w-0">
        <h3 className="font-display text-[length:var(--fs-work-title,26px)] leading-[1.15] text-ink">{work.title}</h3>
        <p className="mt-1 font-mono text-[12px] tracking-wide text-slate-500">{work.meta}</p>
      </div>

      <div className="w-full min-w-0 overflow-hidden rounded-[16px] border border-ink/[0.06] bg-white p-5 md:p-7">
        <AutoVideo src={work.video} poster={work.poster} label={`${work.title} preview`} tone={work.tone} />
      </div>
    </motion.article>
  )
}

export default function SelectedWorks() {
  return (
    <section id="work" aria-label="Work" className="scroll-mt-8 lg:pt-12 lg:scroll-mt-24">
      <div className="flex flex-col gap-16 md:gap-20">
        {WORKS.map((w) => (
          <WorkRow key={w.id} work={w} />
        ))}
      </div>
    </section>
  )
}
