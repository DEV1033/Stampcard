import { motion, useReducedMotion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1]

// Placeholder About page until the real content is written.
export default function AboutPage() {
  const reduceMotion = useReducedMotion()
  const fadeUp = (delay) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE, delay: reduceMotion ? 0 : delay },
  })

  return (
    <main className="px-6 pb-32 pt-10 md:px-12 lg:pt-12 xl:px-20">
      <motion.span
        {...fadeUp(0.1)}
        className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-3 py-1.5 font-mono text-[12px] tracking-wide text-ink/60"
      >
        <span className="size-1.5 rounded-full bg-[var(--tile)]" />
        Coming soon
      </motion.span>

      <motion.h1
        {...fadeUp(0.2)}
        className="mt-5 max-w-[16ch] font-display text-[length:var(--fs-heading)] leading-[1.05] tracking-[-0.015em]"
      >
        About me is <span className="italic text-[var(--tile)]">coming soon</span>
      </motion.h1>

      <motion.p
        {...fadeUp(0.35)}
        className="mt-5 max-w-[54ch] text-[length:var(--fs-body)] leading-relaxed text-ink/65"
      >
        I’m still writing this page. Soon you’ll find my story here: how I got into design, the way I work, and
        what I care about when building products.
      </motion.p>

      {/* Dummy blocks hinting at what the page will hold. */}
      <motion.div {...fadeUp(0.5)} className="mt-12 grid max-w-[880px] grid-cols-1 gap-4 sm:grid-cols-3">
        {['My story', 'How I work', 'Toolkit'].map((title) => (
          <div key={title} className="rounded-[16px] border border-ink/[0.06] bg-white/80 p-5">
            <div className="font-display text-[20px] text-ink">{title}</div>
            <div className="mt-4 space-y-2" aria-hidden="true">
              <div className="h-2 w-full rounded-full bg-ink/[0.06]" />
              <div className="h-2 w-5/6 rounded-full bg-ink/[0.06]" />
              <div className="h-2 w-2/3 rounded-full bg-ink/[0.06]" />
            </div>
            <div className="mt-5 font-mono text-[11px] tracking-wide text-ink/40">Coming soon</div>
          </div>
        ))}
      </motion.div>
    </main>
  )
}
