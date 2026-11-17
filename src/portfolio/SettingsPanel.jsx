import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { FONT_SIZES, TILE_PRESETS } from './settings.js'

const SECTION_LABEL = 'pb-3 text-xs font-semibold uppercase tracking-wider text-ink/40'
const SIDEBAR_SUBLABEL = 'pb-2.5 text-[13px] font-semibold text-ink/70'

// Sheet sliding in from the right: tile colour for the pixels, and font sizes.
export default function SettingsPanel({ settings, onChange, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40">
      <motion.div
        className="absolute inset-0 bg-ink/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[360px] flex-col border-l border-ink/[0.08] bg-white shadow-[0_0_40px_rgba(11,27,43,0.12)]"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-ink/[0.08] px-6">
          <h2 id="settings-title" className="font-display text-[24px] text-ink">
            Settings
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="grid size-9 place-items-center rounded-lg text-ink/60 hover:bg-ink/[0.05] hover:text-ink"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 py-6">
          <SettingsControls settings={settings} onChange={onChange} />
        </div>
      </motion.div>
    </div>
  )
}

// Tile colour, font sizes and reset. Used in the desktop sidebar (`compact`)
// and in the phone settings sheet.
export function SettingsControls({ settings, onChange, compact = false }) {
  const isPreset = TILE_PRESETS.some((p) => p.value.toLowerCase() === settings.tile.toLowerCase())
  const swatch = compact ? 'size-7' : 'size-9'

  return (
    <div className={`flex flex-col ${compact ? 'gap-6' : 'gap-8'}`}>
      <section>
        <div className={compact ? SIDEBAR_SUBLABEL : SECTION_LABEL}>Tile colour</div>
        <div className={`flex flex-wrap ${compact ? 'gap-2' : 'gap-2.5'}`}>
          {TILE_PRESETS.map((p) => {
            const active = p.value.toLowerCase() === settings.tile.toLowerCase()
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => onChange({ tile: p.value })}
                aria-label={p.name}
                aria-pressed={active}
                title={p.name}
                className={`grid ${swatch} place-items-center rounded-full ring-offset-2 transition-shadow ${
                  active ? 'ring-2 ring-ink' : 'ring-1 ring-ink/10 hover:ring-ink/30'
                }`}
                style={{ background: p.value }}
              >
                {active && <Check className="size-4 text-white" strokeWidth={3} />}
              </button>
            )
          })}
          <label
            title="Custom colour"
            className={`relative grid ${swatch} cursor-pointer place-items-center overflow-hidden rounded-full ring-offset-2 ${
              isPreset ? 'ring-1 ring-ink/10 hover:ring-ink/30' : 'ring-2 ring-ink'
            }`}
            style={{
              background: isPreset
                ? 'conic-gradient(#ff7aa8, #ffd166, #4fd1a5, #6bb8ff, #a58bff, #ff7aa8)'
                : settings.tile,
            }}
          >
            <span className="sr-only">Custom colour</span>
            <input
              type="color"
              value={settings.tile}
              onChange={(e) => onChange({ tile: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <p className="mt-3 font-mono text-[12px] text-ink/50">{settings.tile.toUpperCase()}</p>
      </section>

      <section>
        <div className={compact ? SIDEBAR_SUBLABEL : SECTION_LABEL}>Font sizes</div>
        <div className={`flex flex-col ${compact ? 'gap-4' : 'gap-5'}`}>
          {FONT_SIZES.map(({ key, label, min, max }) => (
            <label key={key} className="flex flex-col gap-2">
              <span className={`flex items-baseline justify-between text-ink ${compact ? 'text-[14px]' : 'text-[15px]'}`}>
                {label}
                <span className="font-mono text-[12px] text-ink/50">{settings[key]}px</span>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={settings[key]}
                onChange={(e) => onChange({ [key]: Number(e.target.value) })}
                className="w-full accent-ink"
              />
            </label>
          ))}
        </div>
      </section>
      <button
        type="button"
        onClick={() => onChange(null)}
        className="w-full rounded-lg border border-ink/10 px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-ink/[0.03]"
      >
        Reset to defaults
      </button>
    </div>
  )
}
