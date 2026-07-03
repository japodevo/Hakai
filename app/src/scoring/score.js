// Scoring engine: combine terrain + depth-band + (future) bottom into a per-cell
// species score, then peak-pick ranked spots with min-distance suppression.
// Produces the "where + how deep" recommendations; tide phasing ("when") is paired
// from the species profile (and, once a tide prefetch is loaded, timed windows).
import { analyzeTile } from './terrain.js'
import { utmToLonLat } from '../chart/proj.js'

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

  const candidates = []
  for (const tile of tiles) {
    const { t, depths, src } = tile
    const { dmM, scoreable, promN, slopeN, adjN, flatN } =
      analyzeTile(depths, src, t.w, t.h, { nodata: depth.nodata, scale: depth.scale, resM, scoreTiers })

    const S = new Float32Array(t.w * t.h)
    for (let i = 0; i < S.length; i++) {
      if (!scoreable[i]) continue
      const d = dmM[i]
      const g = Math.exp(-((d - sc.depthMeanM) ** 2) / (2 * sc.depthSigmaM * sc.depthSigmaM))
      const terr = (sc.weights.prominence * promN[i] + sc.weights.slope * slopeN[i] +
        sc.weights.adjacency * adjN[i] + sc.weights.flatness * flatN[i]) / wsum
      // depth acts as a soft gate (never fully kills a spot); terrain carries the shape.
      S[i] = (0.4 + 0.6 * g) * terr
    }

    // local maxima (3x3), skipping the 1-px tile border to avoid seam artefacts
    for (let y = 1; y < t.h - 1; y++) {
      for (let x = 1; x < t.w - 1; x++) {
        const i = y * t.w + x
        const s = S[i]
        if (s < PEAK_MIN_SCORE) continue
        let isMax = true
        for (let dy = -1; dy <= 1 && isMax; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx || dy) && S[(y + dy) * t.w + (x + dx)] > s) { isMax = false; break }
          }
        }
        if (!isMax) continue
        candidates.push({
          fx: t.col * T + x, fy: t.row * T + y, s, dM: dmM[i],
          prom: promN[i], slope: slopeN[i], adj: adjN[i], flat: flatN[i],
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
      comp: { prom: c.prom, slope: c.slope, adj: c.adj, flat: c.flat },
    }
  })
}

// A plain-language tide hint from the species' best phases (until timed windows load).
export function tideHint(species) {
  const map = {
    change: 'the tide change', slack: 'slack', flood: 'the flood',
    ebb: 'the ebb', maxFlow: 'max flow', 'tide-change': 'the tide change',
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
