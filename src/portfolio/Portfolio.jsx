import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Mail } from 'lucide-react'
import AnimatedGenerateButton from '@/components/ui/animated-generate-button-shadcn-tailwind'
import Preloader from './Preloader.jsx'
import PixelField from './PixelField.jsx'
import HeroStamp from '../stamp/HeroStamp.jsx'
import Ruler from './Ruler.jsx'
import SelectedWorks from './SelectedWorks.jsx'

// Placeholder image for the hero stamp; swap for your own (a file in /public
// works too, e.g. '/my-work.jpg').
const STAMP_IMAGE = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=900&q=80&auto=format&fit=crop'

const HEADING = ['Designing', 'product', 'that', 'makes', 'it', 'feel', 'easy']
const EASE = [0.22, 1, 0.36, 1]
const SKY_HUE = 205 // light-blue glow on the CTAs, matching the pixels

export default function Portfolio() {
  const [stage, setStage] = useState('loading') // loading | reveal | gone
  const reduceMotion = useReducedMotion()
  const show = stage !== 'loading'

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
    <div className="relative bg-paper text-ink">
      {/* Hero: one screen tall, with its own pixel background */}
      <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      {/* Full-screen pixel shader behind the hero: white at the top,
          pixels building up linearly towards the bottom. */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        initial={{ opacity: 0 }}
        animate={show ? { opacity: 1 } : undefined}
        transition={{ duration: 0.6 }}
      >
        <PixelField start={show} />
        {/* Progressive blur over the light upper part, fading to crisp pixels. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[75%] backdrop-blur-[2px] [mask-image:linear-gradient(to_bottom,black_40%,transparent)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[55%] backdrop-blur-[5px] [mask-image:linear-gradient(to_bottom,black_30%,transparent)]" />
      </motion.div>

      <motion.header {...fadeUp(0.1)} className="flex items-center justify-between px-6 py-6 md:px-12 md:py-8 lg:px-[120px]">
        <a href="#" className="flex items-center gap-2.5 text-[15px] font-semibold">
          <span aria-hidden="true" className="grid size-7 grid-cols-2 gap-[3px] rounded-md bg-ink p-[5px]">
            <span className="rounded-[1px] bg-sky-300" />
            <span className="rounded-[1px] bg-white" />
            <span className="rounded-[1px] bg-white" />
            <span className="rounded-[1px] bg-sky-300" />
          </span>
          Portfolio
        </a>
        <nav className="hidden items-center gap-8 text-[15px] text-ink/70 md:flex">
          <a href="#work" className="hover:text-ink">Work</a>
          <a href="#about" className="hover:text-ink">About</a>
          <a href="#contact" className="hover:text-ink">Contact</a>
        </nav>
        <span className="flex items-center gap-2 rounded-full border border-ink/10 bg-white/60 px-3 py-1.5 text-[13px]">
          <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" />
          Available for work
        </span>
      </motion.header>

      <main className="flex flex-1 flex-col">
        <section className="grid items-center gap-6 px-6 pb-10 pt-[8vh] md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-10 md:px-12 md:pb-14 md:pt-[10vh] lg:px-[120px]">
          {/* Heading + intro + CTAs */}
          <div className="flex flex-col items-start text-left">
          <h1 className="max-w-[16ch] font-display text-[44px] leading-[1.05] tracking-[-0.015em] md:text-[64px]">
            {HEADING.map((word, i) => (
              <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                <motion.span
                  {...rise(i)}
                  className={`inline-block ${word === 'easy' ? 'italic text-sky-500' : ''}`}
                >
                  {word}
                </motion.span>
                {i < HEADING.length - 1 && ' '}
              </span>
            ))}
          </h1>

          <motion.p
            {...fadeUp(0.5)}
            className="mt-5 max-w-[54ch] font-sans text-[17px] leading-relaxed text-ink/65"
          >
            I’m a self-taught product designer. I found design through frontend development in my 2nd year of
            college, when one question wouldn’t leave me alone: how are these interfaces made?
          </motion.p>

          <motion.div {...fadeUp(0.7)} className="mt-8 flex flex-wrap items-center justify-start gap-4">
            <AnimatedGenerateButton
              className="text-[15px] font-semibold"
              labelIdle="View my work"
              labelActive="Opening…"
              highlightHueDeg={SKY_HUE}
              ariaLabel="View my work"
              onClick={() => (window.location.hash = 'work')}
            />
            <AnimatedGenerateButton
              className="text-[15px] font-semibold"
              icon={<Mail className="size-5" strokeWidth={2} />}
              labelIdle="Get in touch"
              labelActive="Say hello"
              highlightHueDeg={SKY_HUE}
              ariaLabel="Get in touch"
              onClick={() => (window.location.hash = 'contact')}
            />
          </motion.div>
          </div>

          {/* Stamp, pasted on once the hero has appeared */}
          <HeroStamp
            start={show}
            src={STAMP_IMAGE}
            alt="Featured work"
            className="mx-auto max-w-[300px] md:max-w-[440px]"
          />
        </section>
      </main>
      </div>

      <SelectedWorks />

      <Ruler side="left" show={show} />
      <Ruler side="right" show={show} />

      {stage !== 'gone' && <Preloader onDone={setStage} />}
    </div>
  )
}
