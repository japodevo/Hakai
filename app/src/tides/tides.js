// Tide engine: load the prefetched IWLS predictions (data/tides.json from
// fetch_tides.py) and derive the fishing windows the app cares about — slack /
// tide-change (around each high & low) and moving-water (max-flow between them) —
// then rank them per species from its tidePhaseWeight.
//
// Water-level hi/lo is a proxy for CURRENT: in a strong passage like Hakai, current
// slack lags the height turn by ~20-60 min, so slack windows are approximate.
const BASE = import.meta.env.BASE_URL
const MIN = 60000
const SLACK_HALF = 35 * MIN     // +/- around a high/low
const FLOW_HALF = 60 * MIN      // +/- around the mid-tide max-flow

export async function loadTides() {
  try {
    const r = await fetch(`${BASE}data/tides.json`)
    if (!r.ok) return null
    return normalize(await r.json())
  } catch {
    return null
  }
}

function normalize(j) {
  const pred = (j.predictions || [])
    .map((p) => ({ t: Date.parse(p.t), v: p.v }))
    .filter((p) => !Number.isNaN(p.t))
    .sort((a, b) => a.t - b.t)
  const hilo = (j.hilo || [])
    .map((e) => ({ t: Date.parse(e.t), v: e.v, type: e.type }))
    .filter((e) => !Number.isNaN(e.t))
    .sort((a, b) => a.t - b.t)
  return {
    station: j.station || null,
    tripFrom: j.tripFrom, tripTo: j.tripTo,
    pred, hilo,
    start: pred.length ? pred[0].t : null,
    end: pred.length ? pred[pred.length - 1].t : null,
  }
}

export function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// All candidate fishing windows for a species, weighted by its tide-phase prefs.
export function speciesWindows(tide, species) {
  if (!tide || !tide.hilo || tide.hilo.length < 2) return []
  const w = species.scoring.tidePhaseWeight
  const changeW = Math.max(w.change || 0, w.slack || 0)
  const out = []
  for (const e of tide.hilo) {
    out.push({
      start: e.t - SLACK_HALF, end: e.t + SLACK_HALF, center: e.t,
      phase: 'change', weight: changeW,
      label: (e.type === 'high' ? 'High' : 'Low') + ' slack / turn',
    })
  }
  for (let i = 0; i < tide.hilo.length - 1; i++) {
    const a = tide.hilo[i], b = tide.hilo[i + 1]
    const mid = (a.t + b.t) / 2
    const rising = b.v > a.v
    const phase = rising ? 'flood' : 'ebb'
    out.push({
      start: mid - FLOW_HALF, end: mid + FLOW_HALF, center: mid,
      phase, weight: Math.max(w[phase] || 0, 0.5 * (w.maxFlow || 0)),
      label: (rising ? 'Flood' : 'Ebb') + ' — moving water',
    })
  }
  return out.sort((x, y) => x.start - y.start)
}

// The current or next good window for a species at time `now`.
export function nextWindow(tide, species, now, minW = 0.6) {
  const ws = speciesWindows(tide, species).filter((x) => x.weight >= minW)
  if (!ws.length) return null
  const cur = ws.find((x) => now >= x.start && now <= x.end)
  if (cur) return { ...cur, current: true }
  const nxt = ws.find((x) => x.start > now)
  return nxt ? { ...nxt, current: false } : null
}

// A sensible "reference now" clamped into the prefetched range (so it's useful to
// preview before the trip): real now if in range, else the trip's first day.
export function referenceNow(tide) {
  const now = Date.now()
  if (!tide || tide.start == null) return now
  if (now < tide.start) return tide.start
  if (now > tide.end) return tide.end
  return now
}

export function dayBounds(ms) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  const s = d.getTime()
  return [s, s + 24 * 60 * MIN]
}
