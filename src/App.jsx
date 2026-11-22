import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, RotateCcw, ScanSearch, Volume2, VolumeX } from 'lucide-react'
import KeyboardScene from './KeyboardScene.jsx'
import PixelGrid from './PixelGrid.jsx'
import StickerName from './sticker/StickerName.jsx'
import { playKey, unlockSound } from './keySound.js'

const PHRASES = ['Creative Designer', 'Tech Oriented', 'AI Assisted Design']

// Collage stickers cut from the ransom-letter SVG. Repeated letters get their own tilt/offset.
const WORDS = [
  [
    { l: 'D', r: -4, y: 2 },
    { l: 'E', r: 3, y: -3 },
    { l: 'V', r: -2, y: 4 },
  ],
  [
    { l: 'C', r: 2, y: -2 },
    { l: 'H', r: -3, y: 3 },
    { l: 'A', r: 4, y: -4 },
    { l: 'U', r: -2, y: 1 },
    { l: 'D', r: 5, y: -2 },
    { l: 'H', r: 2, y: 4, s: 0.92 },
    { l: 'A', r: -5, y: 1, s: 1.06 },
    { l: 'R', r: 3, y: -3 },
    { l: 'Y', r: -3, y: 3 },
  ],
]

const keyFor = (ch) => (ch === ' ' ? 'space' : ch.toLowerCase())
// Capitals use the Shift on the opposite hand, like a touch typist.
const LEFT_HAND = new Set('`12345qwertasdfgzxcvb')
const shiftFor = (ch) => (LEFT_HAND.has(ch.toLowerCase()) ? 'shiftR' : 'shiftL')

export default function App() {
  const kb = useRef(null)
  const stickers = useRef(null)
  const [text, setText] = useState('')
  const [selected, setSelected] = useState(false)

  // Key click sound: on by default, remembered per visitor. Browsers need one gesture first.
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem('kb-sound') !== 'off'
    } catch {
      return true
    }
  })
  const [unlocked, setUnlocked] = useState(false)
  const soundOnRef = useRef(soundOn)
  soundOnRef.current = soundOn

  useEffect(() => {
    const onGesture = (e) => {
      if (e.target?.closest?.('[data-sound-toggle]')) return // the button handles itself
      if (soundOnRef.current && unlockSound()) setUnlocked(true)
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }, [])

  const toggleSound = () => {
    // Sound is on but the browser hasn't allowed audio yet: this tap just starts it.
    if (soundOn && !unlocked) {
      if (unlockSound()) setUnlocked(true)
      return
    }
    const next = !soundOn
    setSoundOn(next)
    if (next && unlockSound()) setUnlocked(true)
    try {
      localStorage.setItem('kb-sound', next ? 'on' : 'off')
    } catch {
      /* storage unavailable: setting just won't persist */
    }
  }

  const onKeyDown = useCallback((id) => {
    if (soundOnRef.current) playKey(id)
  }, [])

  useEffect(() => {
    let alive = true
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    ;(async () => {
      await sleep(900)
      for (let i = 0; alive; i++) {
        const phrase = PHRASES[i % PHRASES.length]
        for (let k = 0; k < phrase.length; k++) {
          if (!alive) return
          const ch = phrase[k]
          kb.current?.press(keyFor(ch))
          if (ch !== ch.toLowerCase()) kb.current?.press(shiftFor(ch))
          setText(phrase.slice(0, k + 1))
          await sleep(ch === ' ' ? 180 : 85 + Math.random() * 95)
        }
        await sleep(1500)
        if (!alive) return
        setSelected(true)
        await sleep(650)
        kb.current?.press('del')
        setText('')
        setSelected(false)
        await sleep(550)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <main className="paper relative isolate flex min-h-dvh flex-col items-center justify-center py-10 md:justify-start md:pb-0 md:pt-[clamp(40px,10vh,120px)]">
      <PixelGrid />
      <div className="fixed right-3 top-3 z-10 flex items-center gap-2 md:right-5 md:top-5">
        {soundOn && !unlocked && (
          <span className="rounded-full border border-[var(--line-soft)] bg-[var(--card)] px-3 py-1.5 font-mono text-[12px] text-[var(--muted)] shadow-sm">
            Tap anywhere for sound
          </span>
        )}
        <button
          type="button"
          onClick={() => stickers.current?.reset()}
          aria-label="Put the name letters back in place"
          title="Put letters back"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line-soft)] bg-[var(--card)] text-[var(--ink)] shadow-sm transition-colors hover:bg-[var(--paper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
        >
          <RotateCcw size={17} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          data-sound-toggle
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Mute keyboard sound' : 'Turn on keyboard sound'}
          title={soundOn ? 'Mute keyboard sound' : 'Turn on keyboard sound'}
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line-soft)] bg-[var(--card)] text-[var(--ink)] shadow-sm transition-colors hover:bg-[var(--paper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
        >
          {soundOn ? <Volume2 size={18} strokeWidth={1.7} /> : <VolumeX size={18} strokeWidth={1.7} />}
        </button>
      </div>
      <StickerName ref={stickers} words={WORDS} label="Dev Chaudhary" sizeClass="h-[min(calc((100vw-20px)/6.7),96px)] lg:h-[84px]" />

      <div className="mt-[clamp(28px,6vh,56px)] w-full max-w-[632px] px-4">
        <p className="sr-only">Creative Designer, Tech Oriented, AI Assisted Design</p>
        <div
          className="flex h-12 items-center gap-3 rounded-[4px] border border-[var(--line-soft)] bg-[var(--card)] px-4 shadow-[0_1px_2px_rgba(74,59,46,0.08),0_6px_18px_-8px_rgba(74,59,46,0.25)]"
          aria-hidden="true"
        >
          <span className="flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap font-mono text-[clamp(15px,2.2vw,19px)] text-[var(--ink)]">
            <span className={selected ? 'bg-[var(--select)]' : ''}>{text}</span>
            <span className="caret ml-[1px] inline-block h-[1.15em] w-[2px] bg-[var(--ink)]" />
          </span>
          <Mic size={18} strokeWidth={1.6} className="shrink-0 text-[var(--muted)]" />
          <ScanSearch size={18} strokeWidth={1.6} className="shrink-0 text-[var(--muted)]" />
        </div>
      </div>

      <div className="relative mt-3 aspect-[5/4] max-h-[62vh] w-full [mask-image:linear-gradient(to_bottom,black_72%,transparent)] md:aspect-auto md:max-h-none md:min-h-[380px] md:flex-1 md:[mask-image:none]">
        <KeyboardScene ref={kb} onKeyDown={onKeyDown} />
      </div>
    </main>
  )
}
