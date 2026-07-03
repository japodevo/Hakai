// UTM <-> WGS84 (transverse Mercator) + depth colormap for the chart.
// The forward/inverse pair round-trips to < 1 mm (verified). epsg 326zz => UTM
// zone zz, northern hemisphere (Hakai is 32609 / zone 9N).

const A = 6378137.0, F = 1 / 298.257223563, E2 = F * (2 - F), K0 = 0.9996
const D2R = Math.PI / 180, R2D = 180 / Math.PI

function lon0(epsg) {
  const zone = epsg - 32600
  return ((zone - 1) * 6 - 180 + 3) * D2R
}

export function lonLatToUtm(lonDeg, latDeg, epsg) {
  const l0 = lon0(epsg), phi = latDeg * D2R, lam = lonDeg * D2R
  const ep2 = E2 / (1 - E2), s = Math.sin(phi)
  const N = A / Math.sqrt(1 - E2 * s * s)
  const T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2
  const Aa = Math.cos(phi) * (lam - l0)
  const M = A * ((1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 ** 3 / 256) * phi
    - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * E2 * E2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * phi)
    - (35 * E2 ** 3 / 3072) * Math.sin(6 * phi))
  const E = 500000 + K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Aa ** 5 / 120)
  const Nn = K0 * (M + N * Math.tan(phi) * (Aa * Aa / 2
    + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Aa ** 6 / 720))
  return [E, Nn]
}

export function utmToLonLat(E, N, epsg) {
  const l0 = lon0(epsg), ep2 = E2 / (1 - E2)
  const x = E - 500000, y = N, M = y / K0
  const mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 ** 3 / 256))
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2))
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu)
  const C1 = ep2 * Math.cos(phi1) ** 2, T1 = Math.tan(phi1) ** 2
  const s = Math.sin(phi1)
  const N1 = A / Math.sqrt(1 - E2 * s * s)
  const R1 = A * (1 - E2) / Math.pow(1 - E2 * s * s, 1.5)
  const D = x / (N1 * K0)
  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720)
  const lonR = l0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(phi1)
  return [lonR * R2D, lat * R2D]
}

// Format a depth (metres, positive-down) in the chosen units. BC salmon anglers
// set downriggers in feet, so 'ft' is a first-class option.
export function fmtDepth(m, units) {
  if (units === 'ft') return `${Math.round(m * 3.28084)} ft`
  return `${m.toFixed(1)} m`
}

// Depth (metres) -> [r,g,b]. Shallow = light, deep = dark blue.
const STOPS = [
  [0, [198, 236, 255]], [10, [120, 200, 240]], [25, [64, 156, 214]],
  [50, [36, 110, 178]], [100, [24, 74, 140]], [200, [16, 44, 96]], [400, [8, 22, 56]],
]
export function depthColor(m) {
  if (m <= STOPS[0][0]) return STOPS[0][1]
  for (let i = 1; i < STOPS.length; i++) {
    if (m <= STOPS[i][0]) {
      const [d0, c0] = STOPS[i - 1], [d1, c1] = STOPS[i]
      const t = (m - d0) / (d1 - d0)
      return [0, 1, 2].map((k) => Math.round(c0[k] + t * (c1[k] - c0[k])))
    }
  }
  return STOPS[STOPS.length - 1][1]
}
