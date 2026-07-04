// On-device terrain analysis (ported from the prototype's approach, per CLAUDE.md):
// slope, prominence (box-mean relief via a summed-area table), and adjacency-to-drop.
// Runs per tile on the decoded Int16 depth grid. All outputs are normalised 0..1.
//
// Depth convention: positive-down metres. A "high spot" (pinnacle/hump) is SHALLOWER
// (smaller depth) than its surroundings, so prominence = boxMeanDepth - cellDepth.

// Caps set high so only exceptional structure hits 1.0 — this spreads the scores
// out (otherwise most decent structure saturates and everything scores the same).
const PROM_CAP = 35      // m of relief that maps to prominence = 1
const SLOPE_CAP = 1.0    // rise/run (~45°) that maps to slope = 1
const PROM_RADIUS_M = 150
const ADJ_RADIUS_M = 60
// Rugosity (bottom-hardness proxy): mean |depth − local 3×3 mean| over a small
// window. Subtracting the local mean removes planar tilt, so a smooth steep wall
// reads ~0 while broken rock reads high — texture, not slope. Multibeam over rock
// carries decimetre-scale texture the 10 m NONNA grid preserves; sand/mud is smooth.
const RUGOSITY_CAP = 0.5     // m of mean residual relief that reads as fully rocky
const RUGOSITY_RADIUS_M = 30
// Current-energy proxies (where tidal FLOW concentrates bait):
//  * VENTURI — a channel/pass: water stays deep along one axis but shoals across it,
//    so the same tidal prism squeezes through less cross-section and accelerates.
//    Measured as (mean depth along best axis − mean depth across it), sampled out to
//    ~210 m. Nodata samples fall back to the cell's own depth (neutral) so survey
//    gaps can't fabricate channels.
//  * UPWELLING — structure standing proud of a LARGE deep neighbourhood (450 m box):
//    moving water has nowhere to go but up and over, stacking bait on the crest.
const VENTURI_CAP = 20       // m of along-vs-across depth contrast = full venturi
const VENTURI_STEP_M = 40, VENTURI_SAMPLES = 5
const VENTURI_LATTICE = 2    // venturi varies over ~200 m; compute every Nth cell, fill blocks
const UPWELL_RADIUS_M = 450
const UPWELL_CAP = 50        // m of large-scale relief = full upwelling potential

// Terrain is species-independent, so memoize per tile (keyed on the decoded depth
// array) — every species and the heat map reuse one analysis instead of recomputing.
const _memo = new WeakMap()

export function analyzeTile(depths, src, w, h, opts) {
  const hit = _memo.get(depths)
  if (hit) return hit
  const out = _analyzeTile(depths, src, w, h, opts)
  _memo.set(depths, out)
  return out
}

function _analyzeTile(depths, src, w, h, opts) {
  const { nodata, scale, resM, scoreTiers } = opts
  const n = w * h
  const dmM = new Float32Array(n)         // depth in metres (0 where invalid)
  const hasDepth = new Uint8Array(n)      // any surveyed cell (incl. coarse fill) = context
  const scoreable = new Uint8Array(n)     // structure-grade cells we actually score
  for (let i = 0; i < n; i++) {
    const v = depths[i]
    if (v === nodata) continue
    dmM[i] = v / scale
    hasDepth[i] = 1
    scoreable[i] = (!src || !scoreTiers || scoreTiers.includes(src[i])) ? 1 : 0
  }

  // --- summed-area tables of depth + valid-count for O(1) box means ----------
  const sw = w + 1
  const S = new Float64Array(sw * (h + 1))
  const C = new Float64Array(sw * (h + 1))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const d = hasDepth[i] ? dmM[i] : 0
      const c = hasDepth[i] ? 1 : 0
      const a = (y + 1) * sw + (x + 1)
      S[a] = d + S[y * sw + (x + 1)] + S[(y + 1) * sw + x] - S[y * sw + x]
      C[a] = c + C[y * sw + (x + 1)] + C[(y + 1) * sw + x] - C[y * sw + x]
    }
  }
  const boxMean = (x0, y0, x1, y1) => {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0)
    x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1)
    const s = S[(y1 + 1) * sw + (x1 + 1)] - S[y0 * sw + (x1 + 1)] - S[(y1 + 1) * sw + x0] + S[y0 * sw + x0]
    const c = C[(y1 + 1) * sw + (x1 + 1)] - C[y0 * sw + (x1 + 1)] - C[(y1 + 1) * sw + x0] + C[y0 * sw + x0]
    return c > 0 ? s / c : NaN
  }

  const R = Math.max(3, Math.round(PROM_RADIUS_M / resM))
  const promN = new Float32Array(n)
  const slopeMag = new Float32Array(n)
  const slopeN = new Float32Array(n)
  const flatN = new Float32Array(n)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!hasDepth[i]) continue
      // prominence: how much shallower than the surrounding box
      const bm = boxMean(x - R, y - R, x + R, y + R)
      if (bm === bm) {
        const prom = bm - dmM[i]           // + = high spot
        promN[i] = Math.min(1, Math.max(0, prom / PROM_CAP))
      }
      // slope: central differences (fall back to 0 at nodata neighbours)
      const xl = x > 0 && hasDepth[i - 1] ? dmM[i - 1] : dmM[i]
      const xr = x < w - 1 && hasDepth[i + 1] ? dmM[i + 1] : dmM[i]
      const yt = y > 0 && hasDepth[i - w] ? dmM[i - w] : dmM[i]
      const yb = y < h - 1 && hasDepth[i + w] ? dmM[i + w] : dmM[i]
      const gx = (xr - xl) / (2 * resM)
      const gy = (yb - yt) / (2 * resM)
      const mag = Math.hypot(gx, gy)
      slopeMag[i] = mag
      slopeN[i] = Math.min(1, mag / SLOPE_CAP)
      flatN[i] = 1 - slopeN[i]
    }
  }

  // adjacency-to-drop: max slope within a small radius (separable max) --------
  const ar = Math.max(2, Math.round(ADJ_RADIUS_M / resM))
  const tmp = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0
      for (let dx = -ar; dx <= ar; dx++) {
        const xx = x + dx
        if (xx < 0 || xx >= w) continue
        const v = slopeMag[y * w + xx]
        if (v > m) m = v
      }
      tmp[y * w + x] = m
    }
  }
  const adjN = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0
      for (let dy = -ar; dy <= ar; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        const v = tmp[yy * w + x]
        if (v > m) m = v
      }
      adjN[y * w + x] = Math.min(1, m / SLOPE_CAP)
    }
  }

  // --- rugosity: detrended micro-relief, smoothed over a small window ---------
  const resid = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!hasDepth[i]) continue
      const bm3 = boxMean(x - 1, y - 1, x + 1, y + 1)
      if (bm3 === bm3) resid[i] = Math.abs(dmM[i] - bm3)
    }
  }
  // summed-area table over the residual (reuse the valid-count table C)
  const S2 = new Float64Array(sw * (h + 1))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = (y + 1) * sw + (x + 1)
      S2[a] = resid[y * w + x] + S2[y * sw + (x + 1)] + S2[(y + 1) * sw + x] - S2[y * sw + x]
    }
  }
  const rr = Math.max(2, Math.round(RUGOSITY_RADIUS_M / resM))
  const rugosN = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!hasDepth[i]) continue
      const x0 = Math.max(0, x - rr), y0 = Math.max(0, y - rr)
      const x1 = Math.min(w - 1, x + rr), y1 = Math.min(h - 1, y + rr)
      const s = S2[(y1 + 1) * sw + (x1 + 1)] - S2[y0 * sw + (x1 + 1)] - S2[(y1 + 1) * sw + x0] + S2[y0 * sw + x0]
      const c = C[(y1 + 1) * sw + (x1 + 1)] - C[y0 * sw + (x1 + 1)] - C[(y1 + 1) * sw + x0] + C[y0 * sw + x0]
      if (c > 0) rugosN[i] = Math.min(1, (s / c) / RUGOSITY_CAP)
    }
  }

  // --- current-energy: venturi (channel squeeze) + upwelling (flow over a rise) ---
  const vStep = Math.max(1, Math.round(VENTURI_STEP_M / resM))
  const R2 = Math.max(8, Math.round(UPWELL_RADIUS_M / resM))
  // axes: E-W, N-S, NE-SW, NW-SE (unit cell offsets)
  const AXES = [[1, 0], [0, 1], [1, 1], [1, -1]]
  const flowN = new Float32Array(n)
  const ventStr = new Float32Array(n)      // venturi strength alone (for axis confidence)
  const flowAxisDeg = new Float32Array(n)  // bearing of the deep/along axis (0..180 ambiguous)
  // compass bearing of each axis on a north-up grid (+x east, +y south)
  const AXIS_DEG = [90, 0, 135, 45]        // E-W, N-S, SE-NW, NE-SW
  const L = VENTURI_LATTICE
  for (let y = 0; y < h; y += L) {
    for (let x = 0; x < w; x += L) {
      const i = y * w + x
      if (!hasDepth[i]) continue
      const d0 = dmM[i]
      // mean depth along each axis (both directions); nodata/out-of-tile = neutral
      const am = new Array(4)
      for (let a = 0; a < 4; a++) {
        const [ux, uy] = AXES[a]
        let sum = 0
        for (let k = 1; k <= VENTURI_SAMPLES; k++) {
          for (const sgn of [1, -1]) {
            const xx = x + sgn * k * vStep * ux, yy = y + sgn * k * vStep * uy
            if (xx < 0 || yy < 0 || xx >= w || yy >= h || !hasDepth[yy * w + xx]) sum += d0
            else sum += dmM[yy * w + xx]
          }
        }
        am[a] = sum / (2 * VENTURI_SAMPLES)
      }
      // best venturi over the two perpendicular pairs: deep along, shallow across.
      // The winning "deep along" axis is the local flow axis — tidal streams run
      // along the channel, so this is our best offline estimate of flow direction.
      const pairs = [am[0] - am[1], am[1] - am[0], am[2] - am[3], am[3] - am[2]]
      let vent = pairs[0], vi = 0
      for (let p = 1; p < 4; p++) if (pairs[p] > vent) { vent = pairs[p]; vi = p }
      const ventN = Math.min(1, Math.max(0, vent / VENTURI_CAP))
      const axisDeg = AXIS_DEG[vi]
      // upwelling: large-scale prominence (how far this stands above a wide deep box)
      const bm2 = boxMean(x - R2, y - R2, x + R2, y + R2)
      const upN = bm2 === bm2 ? Math.min(1, Math.max(0, (bm2 - d0) / UPWELL_CAP)) : 0
      const f = Math.min(1, 0.6 * ventN + 0.6 * upN)
      // fill the L×L block (venturi/upwelling vary over hundreds of metres)
      for (let by = y; by < Math.min(h, y + L); by++)
        for (let bx = x; bx < Math.min(w, x + L); bx++) {
          const bi = by * w + bx
          flowN[bi] = f; ventStr[bi] = ventN; flowAxisDeg[bi] = axisDeg
        }
    }
  }

  return { dmM, scoreable, promN, slopeN, adjN, flatN, rugosN, flowN, ventStr, flowAxisDeg }
}
