import { useEffect, useState } from 'react'
import ChartCanvas from './chart/ChartCanvas.jsx'
import GuidePage from './guide/GuidePage.jsx'
import './App.css'

export default function App() {
  const [persisted, setPersisted] = useState(null)
  const [showStorageNote, setShowStorageNote] = useState(true)
  const [showGuide, setShowGuide] = useState(false)

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
        <button className="guide-btn" onClick={() => setShowGuide(true)}>📖 Guide</button>
        <div className="notnav">⚠ NOT FOR NAVIGATION</div>
      </header>

      <ChartCanvas />

      {showGuide && <GuidePage onClose={() => setShowGuide(false)} />}

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
