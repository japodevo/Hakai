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

  const canvas = document.createElement('canvas')
  canvas.width = t.w
  canvas.height = t.h
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(t.w, t.h)
  let dmin = Infinity, dmax = -Infinity
  for (let i = 0; i < depths.length; i++) {
    const dm = depths[i], o = i * 4
    if (dm === NODATA) {
      const px = i % t.w, py = (i / t.w) | 0
      const hatch = ((px + py) & 3) === 0
      img.data[o] = hatch ? 51 : 11
      img.data[o + 1] = hatch ? 51 : 22
      img.data[o + 2] = hatch ? 68 : 34
      img.data[o + 3] = 255
    } else {
      const m = dm / SCALE
      if (m < dmin) dmin = m
      if (m > dmax) dmax = m
      let [r, g, b] = depthColor(m)
      // Low-confidence fill (source code > 1, e.g. NONNA-100): desaturate.
      if (src && src[i] > 1) {
        r = Math.round(r * 0.55 + 96 * 0.45)
        g = Math.round(g * 0.55 + 110 * 0.45)
        b = Math.round(b * 0.55 + 122 * 0.45)
      }
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return { canvas, depths, src, dmin, dmax }
}
