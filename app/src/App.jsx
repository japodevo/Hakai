import { useEffect, useState } from 'react'
import ChartCanvas from './chart/ChartCanvas.jsx'
import './App.css'

export default function App() {
  const [persisted, setPersisted] = useState(null)
  const [showStorageNote, setShowStorageNote] = useState(true)

  // Ask the browser to keep our offline data from being evicted (M6 hardens this).
  useEffect(() => {
    if (navigator.storage?.persist) {
      navigator.storage.persisted().then((already) => {
        if (already) { setPersisted(true); return }
        navigator.storage.persist().then(setPersisted)
      })
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">Hakai Structure Finder</div>
        <div className="notnav">⚠ NOT FOR NAVIGATION</div>
      </header>

      <ChartCanvas />

      {persisted === false && showStorageNote && (
        <div className="app-toast">
          <span>Storage not persisted — add to Home Screen to keep offline data.</span>
          <button className="toast-x" onClick={() => setShowStorageNote(false)}
            aria-label="Dismiss">×</button>
        </div>
      )}
    </div>
  )
}
