// Tide engine: load the prefetched IWLS predictions (data/tides.json from
// fetch_tides.py) and derive the fishing windows the app cares about — slack /
// tide-change (around each high & low) and moving-water (max-flow between them) —
// then rank them per species from its tidePhaseWeight.
//
// Water-level hi/lo is a proxy for CURRENT. Two corrections applied:
//  * SLACK LAG — in a strong passage like Hakai, the current keeps running after the
//    height turns; slack water arrives ~20-60 min later. All current windows (slack
//    AND max-flow) are shifted by SLACK_LAG_MIN after the height extremes.
//  * SPRING/NEAP — window strength scales with the range of each individual tide:
//    a big spring exchange moves more bait (stronger, longer moving-water windows;
//    shorter slacks) than a lazy neap.
const BASE = import.meta.env.BASE_URL
const MIN = 60000
const SLACK_HALF = 35 * MIN      // +/- around a current slack (before spring/neap scaling)
const FLOW_HALF = 60 * MIN       // +/- around the mid-tide max-flow (before scaling)
export const SLACK_LAG_MIN = 40  // current slack ≈ this many min AFTER the height turn
const LAG = SLACK_LAG_MIN * MIN
const REF_RANGE_M = 3.0          // "typical" Hakai exchange; strength = range / this
const STR_MIN = 0.7, STR_MAX = 1.25

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
  // Robust "big flow" reference: 95th percentile of |dh/dt| across the whole
  // prefetch, so flowRateAt() ≈ 1 on a ripping spring mid-tide and ~0.5 on a neap.
  const rates = []
  for (let i = 1; i < pred.length; i++) {
    const dt = pred[i].t - pred[i - 1].t
    if (dt > 0) rates.push(Math.abs(pred[i].v - pred[i - 1].v) / dt)
  }
  rates.sort((a, b) => a - b)
  const flowMax = rates.length ? rates[Math.floor(rates.length * 0.95)] : 0
  return {
    station: j.station || null,
    tripFrom: j.tripFrom, tripTo: j.tripTo,
    pred, hilo, flowMax,
    start: pred.length ? pred[0].t : null,
    end: pred.length ? pred[pred.length - 1].t : null,
  }
}

// Continuous current-speed proxy at CURRENT time t: |dh/dt| of the height curve
// (lag-shifted), normalised 0..1 against the prefetch's 95th-percentile rate.
// This is the smooth signal behind "how hard is the water moving right now" —
// finer than the window boxes, and it distinguishes a spring rip from a neap push.
export function flowRateAt(tide, t) {
  const pred = tide?.pred
  if (!pred || pred.length < 2 || !tide.flowMax) return 0
  const tt = t - LAG                       // current lags the height curve
  let lo = 0, hi = pred.length - 1
  if (tt <= pred[0].t || tt >= pred[hi].t) return 0
  while (hi - lo > 1) {                    // binary search for the bracketing pair
    const mid = (lo + hi) >> 1
    if (pred[mid].t <= tt) lo = mid; else hi = mid
  }
  const dt = pred[hi].t - pred[lo].t
  if (dt <= 0) return 0
  const rate = Math.abs(pred[hi].v - pred[lo].v) / dt
  return Math.min(1, rate / tide.flowMax)
}

export function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Strength of the exchange between two adjacent hi/lo events (spring vs neap),
// normalised so a typical Hakai tide ≈ 1.
function exchangeStrength(a, b) {
  const range = Math.abs((b?.v ?? 0) - (a?.v ?? 0))
  return Math.min(STR_MAX, Math.max(STR_MIN, range / REF_RANGE_M))
}

// All candidate fishing windows for a species, weighted by its tide-phase prefs.
// Times are CURRENT times (height extremes shifted by the slack lag).
export function speciesWindows(tide, species) {
  if (!tide || !tide.hilo || tide.hilo.length < 2) return []
  const w = species.scoring.tidePhaseWeight
  const changeW = Math.max(w.change || 0, w.slack || 0)
  const out = []
  for (let i = 0; i < tide.hilo.length; i++) {
    const e = tide.hilo[i]
    // slack strength from the bigger of the two adjacent exchanges: a spring tide
    // rips harder, so its slack is briefer.
    const s = Math.max(
      exchangeStrength(tide.hilo[i - 1], e),
      exchangeStrength(e, tide.hilo[i + 1]))
    const half = SLACK_HALF / s
    const c = e.t + LAG                       // current slack lags the height turn
    out.push({
      start: c - half, end: c + half, center: c,
      phase: 'change', weight: changeW, strength: s,
      label: (e.type === 'high' ? 'High' : 'Low') + ' slack / turn',
    })
  }
  for (let i = 0; i < tide.hilo.length - 1; i++) {
    const a = tide.hilo[i], b = tide.hilo[i + 1]
    const s = exchangeStrength(a, b)
    const mid = (a.t + b.t) / 2 + LAG         // max flow shifts with the slacks
    const half = FLOW_HALF * s                // spring tide → longer productive push
    const rising = b.v > a.v
    const phase = rising ? 'flood' : 'ebb'
    out.push({
      start: mid - half, end: mid + half, center: mid,
      phase, strength: s,
      // moving-water windows also score by exchange strength (neap ebb ≠ spring ebb)
      weight: Math.max(w[phase] || 0, 0.5 * (w.maxFlow || 0)) * s,
      label: (rising ? 'Flood' : 'Ebb') + ' — moving water' +
        (s >= 1.12 ? ' (big tide)' : s <= 0.78 ? ' (soft neap)' : ''),
    })
  }
  return out.sort((x, y) => x.start - y.start)
}

// How well time `now` suits fishing this species, 0..1, from the tide alone.
// Two signals, best wins: the labelled windows (slack/turn, moving water), and the
// CONTINUOUS flow-rate curve for moving-water species — so between window boxes the
// fit follows the real predicted current instead of snapping to zero.
export function tideFitAt(tide, species, now) {
  const ws = speciesWindows(tide, species)
  if (!ws.length) return 1
  let best = 0
  for (const w of ws) {
    if (now < w.start || now > w.end) continue
    const half = (w.end - w.start) / 2 || 1
    const prox = 1 - Math.abs(now - w.center) / half   // 1 at centre → 0 at the edge
    best = Math.max(best, w.weight * (0.55 + 0.45 * prox))
  }
  const wgt = species.scoring.tidePhaseWeight || {}
  const movingW = Math.max(wgt.flood || 0, wgt.ebb || 0)
  if (movingW > 0) best = Math.max(best, movingW * flowRateAt(tide, now) * 0.9)
  return Math.max(0, Math.min(1, best))
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

// The tide phase at a moment (for auto-tagging a catch): high/low slack, flood, ebb.
// Uses CURRENT timing (height extremes + slack lag), matching speciesWindows.
export function phaseNow(tide, now) {
  if (!tide || !tide.hilo || tide.hilo.length < 2) return null
  const tn = now - LAG   // compare in height-time space
  let near = null, nd = Infinity
  for (const e of tide.hilo) {
    const d = Math.abs(e.t - tn)
    if (d < nd) { nd = d; near = e }
  }
  if (near && nd <= SLACK_HALF) return `${near.type === 'high' ? 'high' : 'low'} slack`
  let prev = null, next = null
  for (const e of tide.hilo) {
    if (e.t <= tn) prev = e
    else { next = e; break }
  }
  if (prev && next) return next.v > prev.v ? 'flood' : 'ebb'
  return null
}

export function dayBounds(ms) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  const s = d.getTime()
  return [s, s + 24 * 60 * MIN]
}
