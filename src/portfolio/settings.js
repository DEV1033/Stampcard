import { useCallback, useState } from 'react'
import { DEFAULT_TINT } from './pixelShaders.js'

const KEY = 'portfolio-settings'

export const TILE_PRESETS = [
  { name: 'Sky', value: DEFAULT_TINT },
  { name: 'Mint', value: '#4fd1a5' },
  { name: 'Lilac', value: '#a58bff' },
  { name: 'Peach', value: '#ff9f6b' },
  { name: 'Rose', value: '#ff7aa8' },
  { name: 'Slate', value: '#8a99ad' },
]

// Font sizes in px, with the range each slider allows.
export const FONT_SIZES = [
  { key: 'heading', label: 'Heading', min: 28, max: 64 },
  { key: 'body', label: 'Body text', min: 14, max: 22 },
  { key: 'workTitle', label: 'Project titles', min: 18, max: 40 },
]

export const DEFAULTS = { tile: DEFAULT_TINT, heading: 40, body: 17, workTitle: 26 }

// Saved per visitor in this browser only. Storage can be missing or blocked
// (private windows), so every read and write is guarded.
export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings)
  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = patch === null ? { ...DEFAULTS } : { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Not saved; the change still applies for this visit.
      }
      return next
    })
  }, [])
  return [settings, update]
}
