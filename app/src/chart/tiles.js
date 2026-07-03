// Load + decode the pipeline's gzipped bathy tiles, and pre-render each tile to
// its own canvas so the chart can pan/zoom by blitting cached bitmaps.
import { depthColor } from './proj.js'

const BASE = import.meta.env.BASE_URL

async function gunzip(buf) {
  const u8 = new Uint8Array(buf)
  // If the server already inflated the .gz (e.g. Vite/sirv sets Content-Encoding:
  // gzip and the browser decompresses transparently), the bytes won't start with
  // the gzip magic number — use them as-is. Otherwise decompress ourselves.
  if (u8.length < 2 || u8[0] !== 0x1f || u8[1] !== 0x8b) return u8
  const stream = new Response(u8).body.pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function loadManifest() {
  const r = await fetch(`${BASE}data/tiles/manifest.json`)
  if (!r.ok) throw new Error('manifest not found — run the pipeline, then `npm run sync-data`')
  return r.json()
}

async function fetchGz(name) {
  const r = await fetch(`${BASE}data/tiles/${name}`)
  if (!r.ok) throw new Error(`tile ${name} missing`)
  return gunzip(await r.arrayBuffer())
}

// Render one tile to an offscreen canvas. Returns { canvas, depths, src }.
export async function loadTile(manifest, t) {
  const NODATA = manifest.depth.nodata, SCALE = manifest.depth.scale
  const bin = await fetchGz(t.bin)
  const depths = new Int16Array(bin.buffer, bin.byteOffset, bin.byteLength / 2)
  let src = null
  if (t.src) src = await fetchGz(t.src)

  const W = t.w, H = t.h
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)

  // --- hillshade (relief) so the seafloor reads as 3-D, not flat pixels -----
  const cs = manifest.res[0] || 10       // metres per cell
  const EXAG = 6                         // vertical exaggeration (underwater relief is subtle)
  // unit light vector for a NW light at 45° altitude (dot-product hillshade — cheap)
  const LX = -0.5, LY = -0.5, LZ = 0.7071
  const FLAT = LZ                        // hillshade of flat ground
  const zAt = (idx) => {                 // exaggerated elevation (shallow = high), null at nodata
    const v = depths[idx]
    return v === NODATA ? null : (-v / SCALE) * EXAG
  }

  let dmin = Infinity, dmax = -Infinity
  for (let i = 0; i < depths.length; i++) {
    const dm = depths[i], o = i * 4
    if (dm === NODATA) {
      const px = i % W, py = (i / W) | 0
      const hatch = ((px + py) & 3) === 0
      img.data[o] = hatch ? 46 : 13
      img.data[o + 1] = hatch ? 54 : 22
      img.data[o + 2] = hatch ? 66 : 32
      img.data[o + 3] = 255
      continue
    }
    const m = dm / SCALE
    if (m < dmin) dmin = m
    if (m > dmax) dmax = m
    let [r, g, b] = depthColor(m)
    if (src && src[i] > 1) {   // low-confidence fill: desaturate
      r = r * 0.55 + 96 * 0.45
      g = g * 0.55 + 110 * 0.45
      b = b * 0.55 + 122 * 0.45
    }
    // relief shading from the local depth gradient
    const x = i % W, y = (i / W) | 0
    const zc = (-m) * EXAG
    const zl = x > 0 ? zAt(i - 1) : null
    const zr = x < W - 1 ? zAt(i + 1) : null
    const zu = y > 0 ? zAt(i - W) : null
    const zd = y < H - 1 ? zAt(i + W) : null
    const dzdx = ((zr == null ? zc : zr) - (zl == null ? zc : zl)) / (2 * cs)
    const dzdy = ((zd == null ? zc : zd) - (zu == null ? zc : zu)) / (2 * cs)
    // hillshade = dot(surface normal, light) — normal = (-dzdx, -dzdy, 1)
    const hs = (-dzdx * LX - dzdy * LY + LZ) / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1)
    const f = Math.min(1.4, Math.max(0.45, 1 + (hs - FLAT) * 1.6))
    img.data[o] = r * f; img.data[o + 1] = g * f; img.data[o + 2] = b * f; img.data[o + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return { canvas, depths, src, dmin, dmax }
}
