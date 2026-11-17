import { motion } from 'framer-motion'
import { LayoutGrid, Mail, Shapes, UserRound } from 'lucide-react'
import { SettingsControls } from './SettingsPanel.jsx'

export const SIDEBAR_WIDTH = 240

export const SECTIONS = [
  { id: 'work', label: 'Work', href: '#work', icon: LayoutGrid },
  { id: 'about', label: 'About', href: '#about', icon: UserRound },
  { id: 'playground', label: 'Playground', href: '#playground', icon: Shapes },
  { id: 'contact', label: 'Contact', href: '#contact', icon: Mail },
]

// Shared spacing so every section and item lines up.
const SECTION_LABEL = 'px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-ink/40'
const NAV_ITEM = 'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[15px] transition-colors'
const ICON = 'size-[18px] shrink-0'

export function Logo() {
  return (
    <a href="#" className="flex items-center gap-2.5 text-[15px] font-semibold">
      <span aria-hidden="true" className="grid size-7 grid-cols-2 gap-[3px] rounded-md bg-ink p-[5px]">
        <span className="rounded-[1px] bg-sky-300" />
        <span className="rounded-[1px] bg-white" />
        <span className="rounded-[1px] bg-white" />
        <span className="rounded-[1px] bg-sky-300" />
      </span>
      Portfolio
    </a>
  )
}

export function AvailabilityPill() {
  return (
    <span className="flex items-center gap-2 rounded-full border border-ink/10 bg-white/60 px-3 py-1.5 text-[13px]">
      <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" />
      Available for work
    </span>
  )
}

// Desktop-only app sidebar: navigation, the settings (tile colour + font
// sizes) inline, and the status pinned to the bottom. Scrolls if it runs
// taller than the screen.
export default function Sidebar({ active, motionProps, settings, onSettingsChange, onNavigate }) {
  return (
    <motion.aside
      {...motionProps}
      style={{ width: SIDEBAR_WIDTH }}
      className="fixed inset-y-0 left-0 z-30 hidden flex-col gap-8 border-r border-ink/[0.08] bg-paper/75 p-4 backdrop-blur-md md:flex overflow-y-auto"
    >
      <div className="flex h-[44px] items-center px-3">
        <Logo />
      </div>

      <nav aria-label="Sections" className="flex flex-col gap-1">
        <div className={SECTION_LABEL}>Navigate</div>
        {SECTIONS.map(({ id, label, href, icon: Icon }) => {
          const isActive = active === id
          return (
            <a
              key={id}
              href={href}
              onClick={(e) => onNavigate?.(e, href)}
              aria-current={isActive ? 'page' : undefined}
              className={`${NAV_ITEM} ${
                isActive
                  ? 'border-ink/10 bg-white/80 font-semibold text-ink shadow-[0_1px_2px_rgba(11,27,43,0.05)]'
                  : 'border-transparent text-ink/60 hover:bg-white/50 hover:text-ink'
              }`}
            >
              <Icon className={ICON} strokeWidth={1.75} />
              {label}
            </a>
          )
        })}
      </nav>

      <section aria-label="Settings" className="flex flex-col">
        <div className={SECTION_LABEL}>Settings</div>
        <div className="px-3">
          <SettingsControls settings={settings} onChange={onSettingsChange} compact />
        </div>
      </section>

      <div className="mt-auto px-1 pt-2">
        <AvailabilityPill />
      </div>
    </motion.aside>
  )
}
