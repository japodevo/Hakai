// On-device terrain analysis (ported from the prototype's approach, per CLAUDE.md):
// slope, prominence (box-mean relief via a summed-area table), and adjacency-to-drop.
// Runs per tile on the decoded Int16 depth grid. All outputs are normalised 0..1.
//
// Depth convention: positive-down metres. A "high spot" (pinnacle/hump) is SHALLOWER
// (smaller depth) than its surroundings, so prominence = boxMeanDepth - cellDepth.

const PROM_CAP = 18      // m of relief that maps to prominence = 1
const SLOPE_CAP = 0.7    // rise/run (~35°) that maps to slope = 1
const PROM_RADIUS_M = 150
const ADJ_RADIUS_M = 60

export function analyzeTile(depths, src, w, h, opts) {
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

  return { dmM, scoreable, promN, slopeN, adjN, flatN }
}
