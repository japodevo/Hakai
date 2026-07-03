// Scoring engine: combine terrain + depth-band + (future) bottom into a per-cell
// species score, then peak-pick ranked spots with min-distance suppression.
// Produces the "where + how deep" recommendations; tide phasing ("when") is paired
// from the species profile (and, once a tide prefetch is loaded, timed windows).
import { analyzeTile } from './terrain.js'
import { utmToLonLat } from '../chart/proj.js'
import { tideFitAt } from '../tides/tides.js'
import { lightFit } from '../tides/sun.js'

const PEAK_MIN_SCORE = 0.28
const DEFAULT_MIN_DIST_M = 220
const DEFAULT_MAX_SPOTS = 12

function classify(c) {
  if (c.prom > 0.55 && c.slope > 0.3) return 'pinnacle'
  if (c.adj > 0.6 && c.slope > 0.45) return 'wall / drop-off'
  if (c.prom > 0.4) return 'hump / high spot'
  if (c.adj > 0.5) return 'shelf break'
  if (c.flat > 0.72) return 'bench / flat'
  return 'structure'
}

// tiles: iterable of { t, depths, src } (as retained by the chart)
export function computeSpots(manifest, tiles, species, opts = {}) {
  const T = manifest.tileSize
  const res = manifest.res
  const origin = manifest.origin
  const depth = manifest.depth
  const resM = res[0]
  const epsg = parseInt(String(manifest.crs).match(/(\d+)/)[1], 10)
  const scoreTiers = manifest.source ? manifest.source.scoreTiers : null
  const sc = species.scoring
  const wsum = (sc.weights.prominence + sc.weights.slope + sc.weights.adjacency + sc.weights.flatness) || 1
  const minScore = opts.minScore != null ? opts.minScore : PEAK_MIN_SCORE
  const B = opts.bounds || null   // {x0,y0,x1,y1} in full-raster cells; only peaks inside

  // Bottom preference via the rugosity proxy: rough (detrended) bottom reads as rock,
  // smooth as sediment. Normalised to the species' best-loved bottom so the multiplier
  // tops out at 1 — it can only suppress wrong bottom, never inflate.
  const bp = sc.bottom || {}
  const maxPref = Math.max(bp.rock || 0, bp.gravel || 0, bp.soft || 0) || 1

  const candidates = []
  for (const tile of tiles) {
    const { t, depths, src } = tile
    const { dmM, scoreable, promN, slopeN, adjN, flatN, rugosN } =
      analyzeTile(depths, src, t.w, t.h, { nodata: depth.nodata, scale: depth.scale, resM, scoreTiers })

    const S = new Float32Array(t.w * t.h)
    for (let i = 0; i < S.length; i++) {
      if (!scoreable[i]) continue
      const d = dmM[i]
      const g = Math.exp(-((d - sc.depthMeanM) ** 2) / (2 * sc.depthSigmaM * sc.depthSigmaM))
      const terr = (sc.weights.prominence * promN[i] + sc.weights.slope * slopeN[i] +
        sc.weights.adjacency * adjN[i] + sc.weights.flatness * flatN[i]) / wsum
      const bFit = ((bp.rock || 0) * rugosN[i] + (bp.soft || 0) * (1 - rugosN[i])) / maxPref
      // Depth gates harder now (0.2..1.0) so species with different depth bands pick
      // genuinely different spots instead of all landing on the same big structure.
      S[i] = (0.2 + 0.8 * g) * terr * (0.55 + 0.45 * bFit)
    }

    // local maxima (3x3), skipping the 1-px tile border to avoid seam artefacts
    for (let y = 1; y < t.h - 1; y++) {
      for (let x = 1; x < t.w - 1; x++) {
        const i = y * t.w + x
        const s = S[i]
        if (s < minScore) continue
        const FX = t.col * T + x, FY = t.row * T + y
        if (B && (FX < B.x0 || FX > B.x1 || FY < B.y0 || FY > B.y1)) continue
        let isMax = true
        for (let dy = -1; dy <= 1 && isMax; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx || dy) && S[(y + dy) * t.w + (x + dx)] > s) { isMax = false; break }
          }
        }
        if (!isMax) continue
        // drop aspect: bearing toward the deepest nearby cell — the side the bottom
        // falls away on. Drives the flood/ebb "current play" note on the spot card.
        let bd = -Infinity, adx = 0, ady = -1
        for (let dy2 = -3; dy2 <= 3; dy2++) {
          for (let dx2 = -3; dx2 <= 3; dx2++) {
            if (!dx2 && !dy2) continue
            const xx = x + dx2, yy = y + dy2
            if (xx < 0 || yy < 0 || xx >= t.w || yy >= t.h) continue
            const dd = dmM[yy * t.w + xx]
            if (dd > bd) { bd = dd; adx = dx2; ady = dy2 }
          }
        }
        // grid: +x = east, +y = south (row-down in a north-up UTM raster)
        const dropDirDeg = (Math.atan2(adx, -ady) * 180 / Math.PI + 360) % 360
        candidates.push({
          fx: FX, fy: FY, s, dM: dmM[i], dropDirDeg,
          prom: promN[i], slope: slopeN[i], adj: adjN[i], flat: flatN[i], rugos: rugosN[i],
        })
      }
    }
  }

  candidates.sort((a, b) => b.s - a.s)
  const minCells = (opts.minDistM || DEFAULT_MIN_DIST_M) / resM
  const maxSpots = opts.maxSpots || DEFAULT_MAX_SPOTS
  const chosen = []
  for (const c of candidates) {
    if (chosen.length >= maxSpots) break
    if (chosen.some((o) => Math.hypot(o.fx - c.fx, o.fy - c.fy) < minCells)) continue
    chosen.push(c)
  }

  const maxScore = chosen.length ? chosen[0].s : 1
  return chosen.map((c, idx) => {
    const E = origin[0] + (c.fx + 0.5) * res[0]
    const N = origin[1] - (c.fy + 0.5) * res[1]
    const [lon, lat] = utmToLonLat(E, N, epsg)
    const structure = classify(c)
    return {
      rank: idx + 1,
      lat, lon, fx: c.fx, fy: c.fy,
      depthM: c.dM,
      score: c.s,
      rel: maxScore > 0 ? c.s / maxScore : 0,   // 0..1 relative to the top spot
      structure,
      dropDirDeg: c.dropDirDeg,
      comp: { prom: c.prom, slope: c.slope, adj: c.adj, flat: c.flat, rugos: c.rugos },
    }
  })
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
export function compass(deg) {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

// How to play the current on this spot: uses the drop aspect (which side falls away)
// plus the species' tide temperament. Rule-of-thumb positioning, not hydrodynamics.
export function currentPlay(species, spot) {
  if (spot.dropDirDeg == null) return null
  const deep = compass(spot.dropDirDeg)
  const shallow = compass(spot.dropDirDeg + 180)
  const w = species.scoring.tidePhaseWeight || {}
  const slackFirst = (w.slack || 0) >= Math.max(w.flood || 0, w.ebb || 0)
  if (slackFirst) {
    return `Bottom falls away to the ${deep}. At slack sit right on the peak — that's the pounce window; ` +
      `once the current builds, tuck into the ${deep} face out of the main flow and work the ledges.`
  }
  return `Bottom falls away to the ${deep}. On moving water, set up up-current and present along the ` +
    `${shallow}→${deep} lip so bait sweeps over the edge; the down-current side of the ${spot.structure} holds the ambush seam.`
}

// Season fit: 1 in-season, tapering to 0.5 out of season (still fishable structure).
export function seasonFit(species, timeMs) {
  const months = species.seasonMonths || []
  if (!months.length) return 1
  const m = new Date(timeMs).getMonth() + 1
  return months.includes(m) ? 1 : 0.5
}

// The live "bite score" for a spot at a moment: its structural score gated by how well
// the tide, the LIGHT, and the season suit this species right now. This is what the
// pin/card show, so scrubbing the time slider changes the numbers — dawn on a tide
// change lights up; flat midday sun at slack goes cold.
export function liveScore(baseScore, species, tide, timeMs) {
  const tideMult = tide ? (0.35 + 0.65 * tideFitAt(tide, species, timeMs)) : 1
  return baseScore * tideMult * lightFit(species, timeMs) * seasonFit(species, timeMs)
}

// A plain-language tide hint from the species' best phases (until timed windows load).
export function tideHint(species) {
  // no leading article — the rationale templates already read "…on the {tide}"
  const map = {
    change: 'tide change', slack: 'slack', flood: 'flood',
    ebb: 'ebb', maxFlow: 'max flow', 'tide-change': 'tide change',
  }
  const phases = (species.tidePhase?.bestPhases || []).map((p) => map[p] || p)
  if (!phases.length) return 'moving water'
  if (phases.length === 1) return phases[0]
  return phases.slice(0, -1).join(', ') + ' or ' + phases[phases.length - 1]
}

// Fill the species' rationale template: {structure}, {depth}, {tide}.
export function rationale(species, spot, depthStr) {
  const tmpl = species.rationaleTemplate || '{structure} at {depth} — fish it on {tide}'
  return tmpl
    .replace('{structure}', spot.structure)
    .replace('{depth}', depthStr)
    .replace('{tide}', tideHint(species))
}

// Why this spot scored: name the terrain drivers that mattered most for this species.
export function explain(species, spot) {
  const w = species.scoring.weights, c = spot.comp
  const drivers = [
    { t: 'a pinnacle standing proud of the bottom', s: c.prom * w.prominence },
    { t: 'a steep drop-off right alongside', s: c.adj * w.adjacency },
    { t: 'steep, broken relief', s: c.slope * w.slope },
    { t: 'a clean bench/flat', s: c.flat * w.flatness },
  ].sort((a, b) => b.s - a.s)
  const top = drivers.filter((d) => d.s > 0.06).slice(0, 2).map((d) => d.t)
  const near = Math.abs(spot.depthM - species.scoring.depthMeanM) <= species.scoring.depthSigmaM
  const bits = []
  if (top.length) bits.push(top.join(' with '))
  if (near) bits.push(`in the ~${Math.round(species.scoring.depthMeanM)} m band ${species.label.toLowerCase()} favour`)
  // bottom-hardness read (rugosity proxy), when it matters to this species
  const rug = spot.comp.rugos
  if (rug != null && (species.scoring.bottom?.rock ?? 0) >= 0.7) {
    if (rug > 0.45) bits.push('over hard, broken bottom (reads as rock)')
    else if (rug < 0.15) bits.push('though the bottom reads smooth (likely sand/mud) — confirm rock on the sounder')
  }
  return bits.length ? `Picked for ${bits.join(', ')}.` : 'Structure inside the target depth band.'
}

// --- heat map: the full scoring surface for a species -----------------------
function heatColor(s) {
  const a = Math.max(0, Math.min(1, (s - 0.12) / 0.45)) * 190   // fade in with score
  const t = Math.max(0, Math.min(1, (s - 0.12) / 0.5))          // teal -> yellow -> red
  let r, g, b
  if (t < 0.5) { const u = t / 0.5; r = 60 + u * 180; g = 195; b = 130 - u * 100 }
  else { const u = (t - 0.5) / 0.5; r = 240; g = 200 - u * 150; b = 30 }
  return [r, g, b, a]
}

// Returns per-tile heat overlays [{col,row,w,h,canvas}] for the species score field.
export function buildHeat(manifest, tiles, species) {
  const depth = manifest.depth, resM = manifest.res[0]
  const scoreTiers = manifest.source ? manifest.source.scoreTiers : null
  const sc = species.scoring
  const wsum = (sc.weights.prominence + sc.weights.slope + sc.weights.adjacency + sc.weights.flatness) || 1
  const bp = sc.bottom || {}
  const maxPref = Math.max(bp.rock || 0, bp.gravel || 0, bp.soft || 0) || 1
  const out = []
  for (const tile of tiles) {
    const { t, depths, src } = tile
    const { dmM, scoreable, promN, slopeN, adjN, flatN, rugosN } =
      analyzeTile(depths, src, t.w, t.h, { nodata: depth.nodata, scale: depth.scale, resM, scoreTiers })
    const canvas = document.createElement('canvas')
    canvas.width = t.w; canvas.height = t.h
    const ctx = canvas.getContext('2d')
    const img = ctx.createImageData(t.w, t.h)
    let any = false
    for (let i = 0; i < dmM.length; i++) {
      if (!scoreable[i]) continue
      const d = dmM[i]
      const g = Math.exp(-((d - sc.depthMeanM) ** 2) / (2 * sc.depthSigmaM * sc.depthSigmaM))
      const terr = (sc.weights.prominence * promN[i] + sc.weights.slope * slopeN[i] +
        sc.weights.adjacency * adjN[i] + sc.weights.flatness * flatN[i]) / wsum
      const bFit = ((bp.rock || 0) * rugosN[i] + (bp.soft || 0) * (1 - rugosN[i])) / maxPref
      const [r, gg, b, a] = heatColor((0.2 + 0.8 * g) * terr * (0.55 + 0.45 * bFit))
      if (a <= 1) continue
      const o = i * 4
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = a
      any = true
    }
    if (!any) continue
    ctx.putImageData(img, 0, 0)
    out.push({ col: t.col, row: t.row, w: t.w, h: t.h, canvas })
  }
  return out
}
