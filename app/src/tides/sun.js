// Solar model for the bite clock: sun altitude at Hakai from pure math (NOAA
// low-precision solar position, good to ~0.2°) — fully offline, no data files.
//
// Why: light drives the salmon bite as hard as tide does. Big chinook feed at
// first light; the grey dawn/dusk band is prime, flat midday sun is slower, and
// full night is slow for everything that hunts by sight. Each species carries a
// light profile in its scoring config; lightFit() blends smoothly between bands
// so the time slider doesn't step.

const RAD = Math.PI / 180
// Pruth Bay / Hakai Passage — close enough for the whole AOI (sun altitude
// varies < 0.3° across it).
const LAT = 51.66
const LON = -128.12

// Sun altitude in degrees at time t (ms epoch) for the AOI.
export function sunAltitudeDeg(t) {
  const d = t / 86400000 - 10957.5              // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD    // mean anomaly
  const q = 280.459 + 0.98564736 * d            // mean longitude (deg)
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD // ecliptic lon
  const e = (23.439 - 0.00000036 * d) * RAD     // obliquity
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / RAD // right ascension (deg)
  const dec = Math.asin(Math.sin(e) * Math.sin(L))                    // declination (rad)
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24
  const lst = ((gmst + LON / 15) % 24 + 24) % 24                      // local sidereal (h)
  const H = ((lst * 15 - ((ra % 360) + 360) % 360 + 540) % 360 - 180) * RAD // hour angle
  const alt = Math.asin(Math.sin(LAT * RAD) * Math.sin(dec) +
    Math.cos(LAT * RAD) * Math.cos(dec) * Math.cos(H))
  return alt / RAD
}

const lerp = (a, b, u) => a + (b - a) * Math.min(1, Math.max(0, u))

// Light band boundaries (sun altitude, deg): full night below -12 (nautical dark),
// the dawn/dusk "grey light" prime band roughly -6..+6, full day above +15.
export function lightFit(species, t) {
  const p = species?.scoring?.light
  if (!p) return 1
  const alt = sunAltitudeDeg(t)
  if (alt <= -12) return p.night
  if (alt <= -6) return lerp(p.night, p.lowLight, (alt + 12) / 6)
  if (alt <= 6) return p.lowLight
  if (alt <= 15) return lerp(p.lowLight, p.day, (alt - 6) / 9)
  return p.day
}

// Coarse band name for labels: 'night' | 'lowLight' | 'day'.
export function lightBand(t) {
  const alt = sunAltitudeDeg(t)
  return alt <= -9 ? 'night' : alt <= 8 ? 'lowLight' : 'day'
}

// Sunrise/sunset (alt crosses 0) within [t0, t1], by 5-min scan — plenty for UI.
export function sunTimes(t0, t1) {
  const STEP = 5 * 60000
  let rise = null, set = null
  let prev = sunAltitudeDeg(t0)
  for (let t = t0 + STEP; t <= t1; t += STEP) {
    const a = sunAltitudeDeg(t)
    if (prev <= 0 && a > 0 && rise == null) rise = t
    if (prev > 0 && a <= 0 && set == null) set = t
    prev = a
  }
  return { rise, set }
}
