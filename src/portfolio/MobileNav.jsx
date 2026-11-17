import { motion } from 'framer-motion'
import { Settings } from 'lucide-react'
import { SECTIONS } from './Sidebar.jsx'

// Phones and tablets (below lg, where the sidebar is hidden): a floating
// white tab bar at the bottom, plus a round white Settings button.
export default function MobileNav({ active, onNavigate, onSettings, motionProps }) {
  return (
    <motion.div
      {...motionProps}
      className="fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2.5 lg:hidden"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <nav aria-label="Sections" className="flex gap-1 rounded-full border border-ink/[0.08] bg-white shadow-[0_1px_2px_rgba(11,27,43,0.06),0_4px_10px_rgba(11,27,43,0.06),0_14px_36px_rgba(11,27,43,0.12)] p-1.5">
        {SECTIONS.map(({ id, label, href, icon: Icon }) => {
          const isActive = active === id
          return (
            <a
              key={id}
              href={href}
              onClick={(e) => onNavigate(e, href)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex w-[64px] flex-col items-center gap-0.5 rounded-full py-2 transition-colors sm:w-[76px] ${
                isActive ? 'text-ink' : 'text-ink/55'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-nav-pill"
                  className="absolute inset-0 rounded-full bg-ink/[0.06]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Icon className="relative size-[20px]" strokeWidth={isActive ? 2 : 1.75} />
              <span className={`relative text-[11px] leading-none ${isActive ? 'font-semibold' : ''}`}>{label}</span>
            </a>
          )
        })}
      </nav>
      <button
        type="button"
        onClick={onSettings}
        aria-label="Settings"
        aria-haspopup="dialog"
        className="grid size-[58px] shrink-0 place-items-center rounded-full border border-ink/[0.08] bg-white shadow-[0_1px_2px_rgba(11,27,43,0.06),0_4px_10px_rgba(11,27,43,0.06),0_14px_36px_rgba(11,27,43,0.12)] text-ink/75 transition-transform hover:scale-105 active:scale-95"
      >
        <Settings className="size-[22px]" strokeWidth={1.75} />
      </button>
    </motion.div>
  )
}
