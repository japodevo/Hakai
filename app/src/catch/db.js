// Offline catch log storage (IndexedDB). Survives with no connectivity and
// persists across sessions once storage.persist() is granted.
const DB = 'hakai-structure-finder'
const STORE = 'catches'
const VER = 1

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VER)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function allCatches() {
  const db = await open()
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    rq.onsuccess = () => resolve((rq.result || []).sort((a, b) => b.ts - a.ts))
    rq.onerror = () => reject(rq.error)
  })
}

export async function putCatch(entry) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteCatch(id) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// --- export helpers -------------------------------------------------------
const COLS = ['ts', 'iso', 'species', 'length_cm', 'method', 'lure', 'lat', 'lon', 'depth_m', 'tide_phase', 'notes']

export function toCSV(catches) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = catches.map((c) => [
    c.ts, new Date(c.ts).toISOString(), c.species, c.length, c.method, c.lure,
    c.lat, c.lon, c.depthM == null ? '' : c.depthM.toFixed(1), c.tidePhase, c.notes,
  ].map(esc).join(','))
  return [COLS.join(','), ...rows].join('\n')
}

export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
