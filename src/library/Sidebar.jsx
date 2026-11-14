import {
  CalendarDays,
  CalendarRange,
  Calendar,
  Camera,
  CircleHelp,
  Settings,
} from 'lucide-react'
import AnimatedGenerateButton from '@/components/ui/animated-generate-button-shadcn-tailwind'

const VIEWS = [
  { id: 'day', label: 'Day', icon: CalendarDays },
  { id: 'month', label: 'Month', icon: CalendarRange },
  { id: 'year', label: 'Year', icon: Calendar },
]

// Shared spacing so every section and item lines up the same way.
const SECTION_LABEL = 'px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400'
const NAV_ITEM = 'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[15px] transition-colors'
const ICON = 'size-[18px] shrink-0'

export default function Sidebar({ view, onViewChange, onUpload, onCamera }) {
  return (
    <aside className="hidden w-[240px] shrink-0 flex-col gap-8 border-r border-neutral-200 p-4 md:flex">
      <nav className="flex flex-col gap-1">
        <div className={SECTION_LABEL}>View</div>
        {VIEWS.map(({ id, label, icon: Icon }) => {
          const active = view === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              aria-current={active ? 'page' : undefined}
              className={`${NAV_ITEM} ${
                active
                  ? 'border-neutral-200 bg-neutral-100 font-semibold text-neutral-900'
                  : 'border-transparent text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <Icon className={ICON} strokeWidth={1.75} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="flex flex-col gap-2">
        <div className={SECTION_LABEL}>Add stamps</div>
        <AnimatedGenerateButton
          className="w-full text-[15px] font-semibold"
          buttonClassName="w-full py-3"
          labelIdle="Upload file"
          labelActive="Pick image"
          highlightHueDeg={35}
          ariaLabel="Upload file"
          onClick={onUpload}
        />
        <button
          type="button"
          onClick={onCamera}
          className="flex items-center justify-center gap-2.5 rounded-lg border border-neutral-200 px-4 py-3 text-[15px] font-semibold text-neutral-800 hover:bg-neutral-50"
        >
          <Camera className={ICON} strokeWidth={2} />
          Use camera
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-1">
        <button type="button" className={`${NAV_ITEM} border-transparent text-neutral-600 hover:bg-neutral-50`}>
          <CircleHelp className={ICON} strokeWidth={1.75} />
          Help center
        </button>
        <button type="button" className={`${NAV_ITEM} border-transparent text-neutral-600 hover:bg-neutral-50`}>
          <Settings className={ICON} strokeWidth={1.75} />
          Settings
        </button>
      </div>
    </aside>
  )
}
