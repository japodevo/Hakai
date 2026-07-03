import { useEffect, useRef, useState } from 'react'
import { loadManifest, loadTile } from './tiles.js'
import { lonLatToUtm, utmToLonLat, fmtDepth } from './proj.js'
import { useGeolocation } from './useGeolocation.js'
import { SPECIES } from '../scoring/species.js'
import { computeSpots } from '../scoring/score.js'
import { loadTides, phaseNow } from '../tides/tides.js'
import TideStrip from '../tides/TideStrip.jsx'
import SpotCard from './SpotCard.jsx'
import { allCatches, putCatch, deleteCatch, newId } from '../catch/db.js'
import CatchLog from '../catch/CatchLog.jsx'
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
  const spotsRef = useRef([])
  const speciesRef = useRef(null)
  const activeSpotRef = useRef(null)
  const spotsCacheRef = useRef({})
  const speciesKeyRef = useRef(null)
  const tilesLoadedRef = useRef(false)

  const { pos, error: gpsError, request: requestGps } = useGeolocation()
  const posRef = useRef(null)
  const unitsRef = useRef('m')
  const [status, setStatus] = useState('loading chart…')
  const [readout, setReadout] = useState(null)
  const [units, setUnits] = useState('m')
  const [legendOpen, setLegendOpen] = useState(true)
  const [gpsState, setGpsState] = useState('off')  // off | acquiring | active
  const [speciesKey, setSpeciesKey] = useState(null)
  const [spots, setSpots] = useState([])
  const [scoring, setScoring] = useState(false)
  const [activeSpot, setActiveSpot] = useState(null)
  const [tide, setTide] = useState(null)
  const [showTide, setShowTide] = useState(false)
  const [catches, setCatches] = useState([])
  const [showLog, setShowLog] = useState(false)
  const catchesRef = useRef([])
  const tideRef = useRef(null)

  useEffect(() => { loadTides().then(setTide) }, [])
  useEffect(() => { tideRef.current = tide }, [tide])
  useEffect(() => { allCatches().then(setCatches).catch(() => {}) }, [])
  useEffect(() => { catchesRef.current = catches; scheduleDraw() }, [catches])

  // Depth (m) under a lat/lon from the loaded tiles, or null if unsurveyed.
  function depthAt(lat, lon) {
    const man = manifestRef.current
    if (!man || lat == null) return null
    const [E, N] = lonLatToUtm(lon, lat, epsgRef.current)
    const fx = Math.floor((E - man.origin[0]) / man.res[0])
    const fy = Math.floor((man.origin[1] - N) / man.res[1])
    if (fx < 0 || fy < 0 || fx >= man.full.width || fy >= man.full.height) return null
    const T = man.tileSize
    const tile = tilesRef.current.get(`${man.layer}_${Math.floor(fx / T)}_${Math.floor(fy / T)}`)
    if (!tile) return null
    const lx = fx - Math.floor(fx / T) * T, ly = fy - Math.floor(fy / T) * T
    const dm = tile.depths[ly * tile.t.w + lx]
    return dm === man.depth.nodata ? null : dm / man.depth.scale
  }
  function getCapture() {
    const p = posRef.current
    return {
      ts: Date.now(),
      lat: p ? p.lat : null,
      lon: p ? p.lon : null,
      depthM: p ? depthAt(p.lat, p.lon) : null,
      tidePhase: tideRef.current ? phaseNow(tideRef.current, Date.now()) : null,
    }
  }
  async function saveCatch(fields, snap) {
    const entry = { id: newId(), ...snap, ...fields, length: fields.length ? Number(fields.length) : null }
    try { await putCatch(entry); setCatches(await allCatches()) } catch (e) { console.warn('save catch failed', e) }
  }
  async function removeCatch(id) {
    try { await deleteCatch(id); setCatches(await allCatches()) } catch (e) { console.warn('delete catch failed', e) }
  }

  useEffect(() => {
    posRef.current = pos
    if (pos) setGpsState('active')
    scheduleDraw()
  }, [pos])
  useEffect(() => { unitsRef.current = units }, [units])
  useEffect(() => { spotsRef.current = spots; scheduleDraw() }, [spots])
  useEffect(() => { activeSpotRef.current = activeSpot; scheduleDraw() }, [activeSpot])
  useEffect(() => {
    speciesKeyRef.current = speciesKey
    setActiveSpot(null)
    runScoring(speciesKey)
  }, [speciesKey])

  function runScoring(key) {
    const man = manifestRef.current
    const sp = SPECIES.find((s) => s.key === key) || null
    speciesRef.current = sp
    if (!sp) { setSpots([]); return }
    if (!man || !tilesLoadedRef.current) return   // will re-run when tiles finish
    if (spotsCacheRef.current[key]) { setSpots(spotsCacheRef.current[key]); return }
    setScoring(true)
    // defer so the "finding spots" spinner paints before the heavy sync compute
    setTimeout(() => {
      try {
        const list = computeSpots(man, [...tilesRef.current.values()], sp)
        spotsCacheRef.current[key] = list
        setSpots(list)
      } catch (e) { console.warn('scoring failed', e) }
      setScoring(false)
    }, 30)
  }

  function startGps() { setGpsState('acquiring'); requestGps() }

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

    // Scale bar (metric, live with zoom), bottom-left.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const mPerPx = man.res[0] / scale
    const target = 90 * mPerPx
    const p10 = Math.pow(10, Math.floor(Math.log10(target)))
    let nice = p10
    for (const s of [1, 2, 5, 10]) if (s * p10 <= target) nice = s * p10
    const barPx = nice / mPerPx
    const bx = 16, by = ch - 74
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(bx, by - 6); ctx.lineTo(bx, by)
    ctx.lineTo(bx + barPx, by); ctx.lineTo(bx + barPx, by - 6)
    ctx.stroke()
    ctx.font = '600 12px -apple-system, system-ui, sans-serif'
    ctx.fillText(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, bx, by - 9)
    ctx.shadowBlur = 0

    // ranked spot pins for the active species
    const sp = speciesRef.current
    const spotList = spotsRef.current
    if (sp && spotList.length) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '700 12px -apple-system, system-ui, sans-serif'
      const active = activeSpotRef.current
      for (const s of spotList) {
        const px = (s.fx + 0.5) * scale + tx
        const py = (s.fy + 0.5) * scale + ty
        if (px < -24 || py < -24 || px > cw + 24 || py > ch + 24) continue
        const r = s.rank === 1 ? 13 : 10
        if (active && active.rank === s.rank) {
          ctx.beginPath(); ctx.arc(px, py, r + 5, 0, Math.PI * 2)
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()
        }
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fillStyle = sp.color; ctx.fill()
        ctx.lineWidth = 2; ctx.strokeStyle = '#06101a'; ctx.stroke()
        ctx.fillStyle = '#06101a'; ctx.fillText(String(s.rank), px, py + 0.5)
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    }

    // logged catches (own history) — small amber rings
    const cs = catchesRef.current
    if (cs && cs.length) {
      for (const c of cs) {
        if (c.lat == null) continue
        const [E, N] = lonLatToUtm(c.lon, c.lat, epsgRef.current)
        const fx = (E - man.origin[0]) / man.res[0]
        const fy = (man.origin[1] - N) / man.res[1]
        const px = fx * scale + tx, py = fy * scale + ty
        if (px < -12 || py < -12 || px > cw + 12 || py > ch + 12) continue
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#ffcf6b'; ctx.fill()
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#06101a'; ctx.stroke()
      }
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
      let done = 0, ok = 0
      for (const t of man.tiles) {
        try {
          const tile = await loadTile(man, t)
          if (cancelled) return
          tilesRef.current.set(t.id, { t, ...tile })
          ok++
        } catch (e) {
          console.warn('tile failed', t.id, e)
        }
        done++
        setStatus(`loading ${done}/${man.tiles.length} tiles`)
        scheduleDraw()
      }
      setStatus(ok === 0
        ? 'no tiles rendered — tile fetch/decompress failed (see console)'
        : null)
      tilesLoadedRef.current = true
      if (speciesKeyRef.current) runScoring(speciesKeyRef.current)
      startGps()
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
  function onDoubleClick(e) {
    const { x, y } = localXY(e)
    zoomAbout(x, y, 1.8)
  }
  function zoomCenter(factor) {
    const wrap = wrapRef.current
    if (wrap) zoomAbout(wrap.clientWidth / 2, wrap.clientHeight / 2, factor)
  }

  // ---- tap readout ---------------------------------------------------------
  function probe(sx, sy) {
    const man = manifestRef.current
    if (!man) return
    const v = viewRef.current

    // spot pins first — tap one to open its card
    if (speciesRef.current && spotsRef.current.length) {
      let best = null, bestD = 1e9
      for (const s of spotsRef.current) {
        const px = (s.fx + 0.5) * v.scale + v.tx
        const py = (s.fy + 0.5) * v.scale + v.ty
        const d = Math.hypot(px - sx, py - sy)
        if (d < bestD) { bestD = d; best = s }
      }
      if (best && bestD <= 22) { setActiveSpot(best); return }
    }
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
    if (!p) { startGps(); return }
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
    <div className={`chart ${showTide ? 'tide-open' : ''}`} ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
      />
      {status && <div className="chart-status">{status}</div>}

      <div className="species-chips">
        {SPECIES.map((s) => (
          <button key={s.key}
            className={`chip ${speciesKey === s.key ? 'active' : ''}`}
            style={speciesKey === s.key ? { borderColor: s.color, color: '#fff' } : undefined}
            onClick={() => setSpeciesKey(speciesKey === s.key ? null : s.key)}>
            <span className="dot" style={{ background: s.color }} />{s.label}
          </button>
        ))}
        {scoring && <span className="chip-status">finding spots…</span>}
        {!scoring && speciesKey && spots.length > 0 &&
          <span className="chip-status">{spots.length} spots · tap a pin</span>}
        {!scoring && speciesKey && spots.length === 0 &&
          <span className="chip-status">no strong spots in survey</span>}
      </div>

      <div className={`chart-legend ${legendOpen ? '' : 'collapsed'}`}>
        <button className="legend-toggle" onClick={() => setLegendOpen((o) => !o)}>
          Depth {legendOpen ? '▾' : '▸'}
        </button>
        {legendOpen && (
          <div className="legend-body">
            <div className="ramp" />
            <div className="ramp-labels">
              <span>0</span><span>{fmtDepth(50, units)}</span><span>{fmtDepth(200, units)}+</span>
            </div>
            <div className="legend-key"><span className="sw hatch" />no survey</div>
            <div className="legend-key"><span className="sw fill" />coarse fill (low conf)</div>
          </div>
        )}
      </div>

      <div className="chart-controls">
        <button className={showLog ? 'primary' : ''} onClick={() => setShowLog((v) => !v)}
          title="Catch log">🎣</button>
        <button className={showTide ? 'primary' : ''} onClick={() => setShowTide((v) => !v)}
          title="Tides">🌊</button>
        <button onClick={() => setUnits((u) => (u === 'm' ? 'ft' : 'm'))}
          title="Depth units">{units}</button>
        <button onClick={() => zoomCenter(1.6)} title="Zoom in">+</button>
        <button onClick={() => zoomCenter(1 / 1.6)} title="Zoom out">−</button>
        <button className={`primary gps-${gpsState}`} onClick={recenter}
          title="Center on GPS">◎</button>
        <button onClick={fitView} title="Fit whole area">⤢</button>
      </div>

      {readout && (
        <div className="chart-readout">
          <span className="mono">{readout.lat.toFixed(5)}, {readout.lon.toFixed(5)}</span>
          <span>{readout.depth != null
            ? <>depth <b>{fmtDepth(readout.depth, units)}</b></>
            : <span className="muted">no survey here</span>}</span>
          {readout.source && (
            <span className={readout.source.conf === 'low' ? 'warn' : 'ok'}>
              {readout.source.name}{readout.source.conf ? ` · ${readout.source.conf}` : ''}
            </span>
          )}
        </div>
      )}

      {gpsError && <div className="chart-gps-err">GPS: {gpsError}</div>}

      {showTide && (
        <TideStrip tide={tide} species={SPECIES.find((s) => s.key === speciesKey) || null}
          onClose={() => setShowTide(false)} />
      )}

      {activeSpot && speciesRef.current && (
        <SpotCard spot={activeSpot} species={speciesRef.current} units={units} tide={tide}
          onClose={() => setActiveSpot(null)} />
      )}

      {showLog && (
        <CatchLog catches={catches}
          defaultSpecies={(SPECIES.find((s) => s.key === speciesKey) || {}).label}
          getCapture={getCapture} onSave={saveCatch} onDelete={removeCatch}
          units={units} onClose={() => setShowLog(false)} />
      )}
    </div>
  )
}
