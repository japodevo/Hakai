import { useEffect, useRef, useState } from 'react'

// Watch device GPS. Works offline (GPS != cell). Returns the latest fix,
// an error, and a `request()` to (re)start the watch after a permission prompt.
export function useGeolocation() {
  const [pos, setPos] = useState(null)      // { lat, lon, accuracy, heading }
  const [error, setError] = useState(null)
  const watchId = useRef(null)

  const request = () => {
    if (!('geolocation' in navigator)) {
      setError('no geolocation on this device')
      return
    }
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setError(null)
        setPos({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracy: p.coords.accuracy,
          heading: p.coords.heading,
        })
      },
      // plain-English errors (iOS otherwise surfaces raw kCLError strings)
      (e) => setError(
        e.code === 1 ? 'location permission denied — allow it in Settings › Safari (or the app) › Location'
        : e.code === 3 ? 'no fix yet (timed out) — still trying; open sky helps'
        : 'no GPS fix yet — still trying; works best under open sky (no cell service needed)'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    )
  }

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
  }, [])

  return { pos, error, request }
}
