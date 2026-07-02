import { useEffect, useState } from 'react'
import ChartCanvas from './chart/ChartCanvas.jsx'
import './App.css'

export default function App() {
  const [persisted, setPersisted] = useState(null)

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

      {persisted === false && (
        <div className="app-toast">
          Storage not persisted — offline data may be evicted. (Add to Home Screen helps.)
        </div>
      )}
    </div>
  )
}
