import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteStamp, getAllStamps, putStamp } from './db.js'

// Loads stamps from IndexedDB and gives each one an object URL for display.
export function useStamps() {
  const [stamps, setStamps] = useState([])
  const urls = useRef(new Map())

  const withUrl = (s) => {
    if (!urls.current.has(s.id)) urls.current.set(s.id, URL.createObjectURL(s.blob))
    return { ...s, url: urls.current.get(s.id) }
  }

  useEffect(() => {
    let alive = true
    getAllStamps()
      .then((all) => alive && setStamps(all.map(withUrl).sort((a, b) => b.createdAt - a.createdAt)))
      .catch((err) => console.error('Could not load stamps', err))
    const map = urls.current
    return () => {
      alive = false
      map.forEach((u) => URL.revokeObjectURL(u))
      map.clear()
    }
  }, [])

  const addStamp = useCallback(async (blob, { title, source }) => {
    const stamp = { id: crypto.randomUUID(), blob, title, source, createdAt: Date.now() }
    await putStamp(stamp)
    setStamps((prev) => [withUrl(stamp), ...prev])
    return stamp
  }, [])

  const removeStamp = useCallback(async (id) => {
    await deleteStamp(id)
    const u = urls.current.get(id)
    if (u) URL.revokeObjectURL(u)
    urls.current.delete(id)
    setStamps((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return { stamps, addStamp, removeStamp }
}
