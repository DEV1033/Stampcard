// Minimal IndexedDB store so stamps (image blobs) survive page reloads.
const DB_NAME = 'stamp-library'
const STORE = 'stamps'

let dbPromise
function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function run(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req?.result)
    tx.onerror = () => reject(tx.error)
  })
}

export const getAllStamps = () => run('readonly', (s) => s.getAll())
export const putStamp = (stamp) => run('readwrite', (s) => s.put(stamp))
export const deleteStamp = (id) => run('readwrite', (s) => s.delete(id))
