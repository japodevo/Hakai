import { useEffect, useRef, useState } from 'react'
import { loadManifest, loadTile } from './tiles.js'
import { lonLatToUtm, utmToLonLat } from './proj.js'
import { useGeolocation } from './useGeolocation.js'
import './chart.css'

// Chart renderer: pans/zooms the pre-rendered bathy tiles on a canvas and draws
// a GPS own-ship marker. World coordinates == full-raster pixels; screen =
// world * scale + translate.
export default function ChartCanvas() {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const manifestRef = useRef(null)
  const tilesRef = useRef(new Map())        // id -> { t, canvas, depths, src }
  const viewRef = useRef({ scale: 1, tx: 0, ty: 0 })
  const pointersRef = useRef(new Map())     // pointerId -> {x,y}
  const pinchRef = useRef(null)             // { dist, cx, cy }
  const drawScheduled = useRef(false)
  const epsgRef = useRef(32609)

  const { pos, error: gpsError, request: requestGps } = useGeolocation()
  const posRef = useRef(null)
  const [status, setStatus] = useState('loading chart…')
  const [readout, setReadout] = useState(null)

  useEffect(() => { posRef.current = pos; scheduleDraw() }, [pos])

  // ---- draw loop -----------------------------------------------------------
  function scheduleDraw() {
    if (drawScheduled.current) return
    drawScheduled.current = true
    requestAnimationFrame(draw)
  }

  function draw() {
    drawScheduled.current = false
    const canvas = canvasRef.current, wrap = wrapRef.current
    const man = manifestRef.current
    if (!canvas || !wrap || !man) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cw = wrap.clientWidth, ch = wrap.clientHeight
    if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
      canvas.width = cw * dpr; canvas.height = ch * dpr
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'
    }
    const ctx = canvas.getContext('2d')
    const { scale, tx, ty } = viewRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#06101a'
    ctx.fillRect(0, 0, cw, ch)

    ctx.imageSmoothingEnabled = false
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, tx * dpr, ty * dpr)
    const T = man.tileSize
    for (const { t, canvas: tc } of tilesRef.current.values()) {
      ctx.drawImage(tc, t.col * T, t.row * T)
    }

    // GPS own-ship marker (screen space)
    const p = posRef.current
    if (p) {
      const [E, N] = lonLatToUtm(p.lon, p.lat, epsgRef.current)
      const fx = (E - man.origin[0]) / man.res[0]
      const fy = (man.origin[1] - N) / man.res[1]
      const sx = fx * scale + tx, sy = fy * scale + ty
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (p.accuracy) {
        const rr = (p.accuracy / man.res[0]) * scale
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(rr, 6), 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(143,208,255,0.15)'; ctx.fill()
      }
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#8fd0ff'; ctx.fill()
      ctx.lineWidth = 3; ctx.strokeStyle = '#06101a'; ctx.stroke()
    }
  }

  // ---- load ----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let man
      try {
        man = await loadManifest()
      } catch (e) {
        setStatus(e.message)
        return
      }
      if (cancelled) return
      manifestRef.current = man
      const m = String(man.crs).match(/(\d+)/)
      if (m) epsgRef.current = parseInt(m[1], 10)
      fitView()
      let done = 0
      for (const t of man.tiles) {
        try {
          const tile = await loadTile(man, t)
          if (cancelled) return
          tilesRef.current.set(t.id, { t, ...tile })
        } catch (e) {
          console.warn('tile failed', t.id, e)
        }
        done++
        setStatus(`loading ${done}/${man.tiles.length} tiles`)
        scheduleDraw()
      }
      setStatus(null)
      requestGps()
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onResize = () => { scheduleDraw() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function fitView() {
    const man = manifestRef.current, wrap = wrapRef.current
    if (!man || !wrap) return
    const cw = wrap.clientWidth, ch = wrap.clientHeight
    const scale = Math.min(cw / man.full.width, ch / man.full.height)
    viewRef.current = {
      scale,
      tx: (cw - man.full.width * scale) / 2,
      ty: (ch - man.full.height * scale) / 2,
    }
    scheduleDraw()
  }

  function clampScale(s) {
    const man = manifestRef.current
    const fit = man ? Math.min(
      wrapRef.current.clientWidth / man.full.width,
      wrapRef.current.clientHeight / man.full.height) : 0.01
    return Math.max(fit * 0.5, Math.min(s, 8))
  }

  function zoomAbout(sx, sy, factor) {
    const v = viewRef.current
    const ns = clampScale(v.scale * factor)
    const wx = (sx - v.tx) / v.scale, wy = (sy - v.ty) / v.scale
    v.tx = sx - wx * ns; v.ty = sy - wy * ns; v.scale = ns
    scheduleDraw()
  }

  // ---- pointer interaction -------------------------------------------------
  function localXY(e) {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function onPointerDown(e) {
    canvasRef.current.setPointerCapture?.(e.pointerId)
    pointersRef.current.set(e.pointerId, localXY(e))
    pinchRef.current = null
    e.target.__moved = false
  }
  function onPointerMove(e) {
    const pts = pointersRef.current
    if (!pts.has(e.pointerId)) return
    const prev = pts.get(e.pointerId)
    const cur = localXY(e)
    pts.set(e.pointerId, cur)

    if (pts.size === 1) {
      const v = viewRef.current
      v.tx += cur.x - prev.x; v.ty += cur.y - prev.y
      if (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) > 2) e.target.__moved = true
      scheduleDraw()
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
      if (pinchRef.current) {
        zoomAbout(cx, cy, dist / pinchRef.current.dist)
        const v = viewRef.current
        v.tx += cx - pinchRef.current.cx; v.ty += cy - pinchRef.current.cy
      }
      pinchRef.current = { dist, cx, cy }
      e.target.__moved = true
    }
  }
  function onPointerUp(e) {
    const pts = pointersRef.current
    const wasTap = !e.target.__moved && pts.size === 1
    const xy = pts.get(e.pointerId)
    pts.delete(e.pointerId)
    if (pts.size < 2) pinchRef.current = null
    if (wasTap && xy) probe(xy.x, xy.y)
  }
  function onWheel(e) {
    e.preventDefault()
    const { x, y } = localXY(e)
    zoomAbout(x, y, Math.exp(-e.deltaY * 0.0015))
  }

  // ---- tap readout ---------------------------------------------------------
  function probe(sx, sy) {
    const man = manifestRef.current
    if (!man) return
    const v = viewRef.current
    const fx = Math.floor((sx - v.tx) / v.scale)
    const fy = Math.floor((sy - v.ty) / v.scale)
    if (fx < 0 || fy < 0 || fx >= man.full.width || fy >= man.full.height) {
      setReadout(null); return
    }
    const E = man.origin[0] + (fx + 0.5) * man.res[0]
    const N = man.origin[1] - (fy + 0.5) * man.res[1]
    const [lon, lat] = utmToLonLat(E, N, epsgRef.current)

    const T = man.tileSize
    const col = Math.floor(fx / T), row = Math.floor(fy / T)
    const tile = tilesRef.current.get(`${man.layer}_${col}_${row}`)
    let depth = null, source = null
    if (tile) {
      const lx = fx - col * T, ly = fy - row * T, idx = ly * tile.t.w + lx
      const dm = tile.depths[idx]
      if (dm !== man.depth.nodata) depth = dm / man.depth.scale
      if (tile.src && man.source) {
        const code = tile.src[idx]
        if (code > 0) source = {
          name: man.source.legend[code],
          conf: man.source.confidence[code],
        }
      }
    }
    setReadout({ lat, lon, depth, source })
  }

  function recenter() {
    const p = posRef.current, man = manifestRef.current, wrap = wrapRef.current
    if (!man || !wrap) return
    if (!p) { requestGps(); return }
    const [E, N] = lonLatToUtm(p.lon, p.lat, epsgRef.current)
    const fx = (E - man.origin[0]) / man.res[0]
    const fy = (man.origin[1] - N) / man.res[1]
    const v = viewRef.current
    v.scale = clampScale(3)
    v.tx = wrap.clientWidth / 2 - fx * v.scale
    v.ty = wrap.clientHeight / 2 - fy * v.scale
    scheduleDraw()
  }

  return (
    <div className="chart" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
      {status && <div className="chart-status">{status}</div>}

      <div className="chart-controls">
        <button className="primary" onClick={recenter} title="Center on GPS">◎</button>
        <button onClick={fitView} title="Fit whole area">⤢</button>
      </div>

      {readout && (
        <div className="chart-readout">
          <span className="mono">{readout.lat.toFixed(5)}, {readout.lon.toFixed(5)}</span>
          <span>{readout.depth != null
            ? <>depth <b>{readout.depth.toFixed(1)} m</b></>
            : <span className="muted">no survey here</span>}</span>
          {readout.source && (
            <span className={readout.source.conf === 'low' ? 'warn' : 'ok'}>
              {readout.source.name}{readout.source.conf ? ` · ${readout.source.conf}` : ''}
            </span>
          )}
        </div>
      )}

      {gpsError && <div className="chart-gps-err">GPS: {gpsError}</div>}
    </div>
  )
}
