import { useEffect, useRef, useState } from 'react'
import { loadManifest, loadTile } from './tiles.js'
import { lonLatToUtm, utmToLonLat, fmtDepth } from './proj.js'
import { useGeolocation } from './useGeolocation.js'
import { SPECIES } from '../scoring/species.js'
import { computeSpots, buildHeat, liveScore } from '../scoring/score.js'
import { loadTides, phaseNow, referenceNow, tideFitAt } from '../tides/tides.js'
import TideStrip from '../tides/TideStrip.jsx'
import SpotCard from './SpotCard.jsx'
import { allCatches, putCatch, deleteCatch, newId } from '../catch/db.js'
import CatchLog from '../catch/CatchLog.jsx'
import PlanSheet from '../plan/PlanSheet.jsx'
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
  const spotsRef = useRef([])        // full scored pool for the active species
  const visRef = useRef([])          // top spots within the current viewport (re-ranked)
  const speciesRef = useRef(null)
  const activeSpotRef = useRef(null)
  const spotsCacheRef = useRef({})
  const speciesKeyRef = useRef(null)
  const tilesLoadedRef = useRef(false)
  const heatRef = useRef([])
  const heatCacheRef = useRef({})

  const { pos, error: gpsError, request: requestGps } = useGeolocation()
  const posRef = useRef(null)
  const unitsRef = useRef('m')
  const [status, setStatus] = useState('loading chart…')
  const [readout, setReadout] = useState(null)
  const [units, setUnits] = useState('m')
  // collapsed by default so it never crowds the species chips on a small phone
  const [legendOpen, setLegendOpen] = useState(false)
  const [gpsState, setGpsState] = useState('off')  // off | acquiring | active
  const [speciesKey, setSpeciesKey] = useState(null)
  const [spots, setSpots] = useState([])
  const [scoring, setScoring] = useState(false)
  const [activeSpot, setActiveSpot] = useState(null)
  const [tide, setTide] = useState(null)
  const [showTide, setShowTide] = useState(false)
  const [refTime, setRefTime] = useState(null)   // time-of-day slider (null = real now)
  const [noRigger, setNoRigger] = useState(() => {
    try { return localStorage.getItem('hakai.noRigger') === '1' } catch { return false }
  })
  const toggleRigger = () => setNoRigger((v) => {
    const n = !v
    try { localStorage.setItem('hakai.noRigger', n ? '1' : '0') } catch { /* private mode */ }
    return n
  })
  const [catches, setCatches] = useState([])
  const [showLog, setShowLog] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const [allSpots, setAllSpots] = useState({})
  const [planBuilding, setPlanBuilding] = useState(false)
  const [showHeat, setShowHeat] = useState(false)
  const [zoneSpots, setZoneSpots] = useState(null)   // ad-hoc "rescore this view" result
  const [zoneScoring, setZoneScoring] = useState(false)
  const zoneRef = useRef(null)
  useEffect(() => { zoneRef.current = zoneSpots; scheduleDraw() }, [zoneSpots])
  const catchesRef = useRef([])
  const tideRef = useRef(null)
  const effTimeRef = useRef(Date.now())   // effective "now" from the time slider, for pin tide-fit
  const coastRef = useRef(null)      // optional OSM shoreline polylines
  const placesRef = useRef(null)     // optional named place labels

  useEffect(() => { loadTides().then(setTide) }, [])
  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}data/coastline.json`).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.lines) { coastRef.current = j.lines; scheduleDraw() } }).catch(() => {})
    fetch(`${base}data/places.json`).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.places) { placesRef.current = j.places; scheduleDraw() } }).catch(() => {})
  }, [])
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

  // Score every species (cached) so the game plan can fuse all of them.
  function ensureAllSpots() {
    const man = manifestRef.current
    if (!man || !tilesLoadedRef.current) { setAllSpots({}); return }
    setPlanBuilding(true)
    setTimeout(() => {
      const tilesArr = [...tilesRef.current.values()]
      const out = {}
      for (const s of SPECIES) {
        if (!spotsCacheRef.current[s.key]) {
          try { spotsCacheRef.current[s.key] = computeSpots(man, tilesArr, s, { maxSpots: 40, minDistM: 130 }) }
          catch (e) { spotsCacheRef.current[s.key] = [] }
        }
        out[s.key] = spotsCacheRef.current[s.key]
      }
      setAllSpots(out); setPlanBuilding(false)
    }, 30)
  }
  function openPlan() { setShowPlan(true); ensureAllSpots() }
  function centerOn(lat, lon) {
    const man = manifestRef.current, wrap = wrapRef.current
    if (!man || !wrap || lat == null) return
    const [E, N] = lonLatToUtm(lon, lat, epsgRef.current)
    const v = viewRef.current
    v.scale = clampScale(Math.max(v.scale, 2.5))
    v.tx = wrap.clientWidth / 2 - ((E - man.origin[0]) / man.res[0]) * v.scale
    v.ty = wrap.clientHeight / 2 - ((man.origin[1] - N) / man.res[1]) * v.scale
    scheduleDraw()
  }
  function pickFromPlan(species, spot) {
    setSpeciesKey(species.key)   // cached scoring -> pins; effect no longer clears activeSpot
    setShowPlan(false)
    setActiveSpot(spot)
    centerOn(spot.lat, spot.lon)
  }

  // Top pool spots inside the current viewport, re-ranked for this zone.
  function visibleSpots() {
    const man = manifestRef.current, wrap = wrapRef.current
    if (!man || !wrap) return []
    const pool = spotsRef.current
    if (!pool.length) return []
    const v = viewRef.current, cw = wrap.clientWidth, ch = wrap.clientHeight
    const inView = pool.filter((s) => {
      const px = (s.fx + 0.5) * v.scale + v.tx, py = (s.fy + 0.5) * v.scale + v.ty
      return px >= -8 && py >= -8 && px <= cw + 8 && py <= ch + 8
    })
    if (!inView.length) return []
    const max = Math.max(...inView.map((s) => s.score))
    return inView.sort((a, b) => b.score - a.score).slice(0, 12)
      .map((s, i) => ({ ...s, rank: i + 1, rel: max > 0 ? s.score / max : 0 }))
  }

  // Re-score ONLY the current viewport (finds local structure that missed the global
  // cut). Absolute scores preserved, so zones are comparable.
  function rescoreZone() {
    const man = manifestRef.current, wrap = wrapRef.current, sp = speciesRef.current
    if (!man || !wrap || !sp) return
    const v = viewRef.current
    const bounds = {
      x0: Math.floor((0 - v.tx) / v.scale), x1: Math.ceil((wrap.clientWidth - v.tx) / v.scale),
      y0: Math.floor((0 - v.ty) / v.scale), y1: Math.ceil((wrap.clientHeight - v.ty) / v.scale),
    }
    setZoneScoring(true)
    setActiveSpot(null)
    setTimeout(() => {
      try {
        const list = computeSpots(man, [...tilesRef.current.values()], sp,
          { bounds, minScore: 0.12, maxSpots: 8, minDistM: 90 })
        setZoneSpots(list)
      } catch (e) { console.warn('zone rescore failed', e); setZoneSpots([]) }
      setZoneScoring(false)
    }, 30)
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
    setZoneSpots(null)
    runScoring(speciesKey)
  }, [speciesKey])

  // (re)build the heat overlay when it's toggled or the species changes
  useEffect(() => {
    const man = manifestRef.current
    if (!showHeat || !speciesKey || !man || !tilesLoadedRef.current) { heatRef.current = []; scheduleDraw(); return }
    if (heatCacheRef.current[speciesKey]) { heatRef.current = heatCacheRef.current[speciesKey]; scheduleDraw(); return }
    const sp = SPECIES.find((s) => s.key === speciesKey)
    let cancelled = false
    const id = setTimeout(() => {
      try {
        const h = buildHeat(man, [...tilesRef.current.values()], sp)
        heatCacheRef.current[speciesKey] = h
        if (!cancelled) { heatRef.current = h; scheduleDraw() }
      } catch (e) { console.warn('heat failed', e) }
    }, 30)
    return () => { cancelled = true; clearTimeout(id) }
  }, [showHeat, speciesKey])

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
        const list = computeSpots(man, [...tilesRef.current.values()], sp, { maxSpots: 40, minDistM: 130 })
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

    // bilinear smoothing so the 10 m cells blend into a relief map, not hard pixels
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, tx * dpr, ty * dpr)
    const T = man.tileSize
    for (const { t, canvas: tc } of tilesRef.current.values()) {
      ctx.drawImage(tc, t.col * T, t.row * T)
    }
    // heat overlay (score field for the active species), under the pins
    for (const h of heatRef.current) {
      ctx.drawImage(h.canvas, h.col * T, h.row * T)
    }
    // depth contour lines — crisp (no smoothing) over the smooth relief
    ctx.imageSmoothingEnabled = false
    for (const { t, contour } of tilesRef.current.values()) {
      if (contour) ctx.drawImage(contour, t.col * T, t.row * T)
    }
    ctx.imageSmoothingEnabled = true

    // optional OSM shoreline (screen space)
    const coast = coastRef.current
    if (coast) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.strokeStyle = 'rgba(232,226,198,0.75)'
      ctx.lineWidth = 1.3
      const ox = man.origin[0], oy = man.origin[1], rx = man.res[0], ry = man.res[1]
      for (const line of coast) {
        ctx.beginPath()
        for (let i = 0; i < line.length; i++) {
          const [E, N] = lonLatToUtm(line[i][0], line[i][1], epsgRef.current)
          const px = ((E - ox) / rx) * scale + tx
          const py = ((oy - N) / ry) * scale + ty
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py)
        }
        ctx.stroke()
      }
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

    // ranked spot pins — zone rescore result if present, else the pool re-ranked
    // to the current viewport.
    const sp = speciesRef.current
    const isZone = !!(zoneRef.current && zoneRef.current.length)
    const shown = isZone ? zoneRef.current : (sp ? visibleSpots() : [])
    visRef.current = shown
    if (sp && shown.length) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '700 11px -apple-system, system-ui, sans-serif'
      const active = activeSpotRef.current
      // live tide fit for the active species: brightens pins in a good window,
      // dims them at slack / off-tide, so scrubbing the slider visibly changes them.
      const t = tideRef.current
      const fit = t ? tideFitAt(t, sp, effTimeRef.current) : 1
      const alpha = 0.4 + 0.6 * fit
      for (const s of shown) {
        const px = (s.fx + 0.5) * scale + tx
        const py = (s.fy + 0.5) * scale + ty
        if (px < -24 || py < -24 || px > cw + 24 || py > ch + 24) continue
        const r = s.rank === 1 ? 15 : 13   // a touch bigger to fit the 2-digit score
        if (active && active.fx === s.fx && active.fy === s.fy) {
          ctx.beginPath(); ctx.arc(px, py, r + 5, 0, Math.PI * 2)
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()
        }
        ctx.globalAlpha = alpha
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2)
        ctx.fillStyle = sp.color; ctx.fill()
        // zone pins get a dashed white ring to show they're an ad-hoc rescore
        ctx.lineWidth = 2; ctx.strokeStyle = isZone ? '#fff' : '#06101a'
        if (isZone) ctx.setLineDash([3, 3])
        ctx.stroke(); ctx.setLineDash([])
        // label = live "bite now" score (structure gated by the tide at the slider time),
        // so the number rises in a good window and drops at slack / off-tide.
        const live = t ? liveScore(s.score, sp, t, effTimeRef.current) : s.score
        ctx.fillStyle = '#06101a'
        ctx.fillText(String(Math.min(99, Math.round(live * 100))), px, py + 0.5)
        ctx.globalAlpha = 1
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

    // place-name labels (on top, screen space)
    const places = placesRef.current
    if (places) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = '600 12px -apple-system, system-ui, sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3
      const ox = man.origin[0], oy = man.origin[1], rx = man.res[0], ry = man.res[1]
      for (const p of places) {
        const [E, N] = lonLatToUtm(p.lon, p.lat, epsgRef.current)
        const px = ((E - ox) / rx) * scale + tx
        const py = ((oy - N) / ry) * scale + ty
        if (px < 0 || py < 0 || px > cw || py > ch) continue
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(235,244,252,0.92)'
        ctx.fillText(p.name, px + 6, py)
      }
      ctx.shadowBlur = 0
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
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
    if (speciesRef.current && visRef.current.length) {
      let best = null, bestD = 1e9
      for (const s of visRef.current) {
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

  const effRef = refTime != null ? refTime : (tide ? referenceNow(tide) : Date.now())
  // keep the draw loop's notion of "now" in sync with the slider so pins re-tint live
  useEffect(() => { effTimeRef.current = effRef; scheduleDraw() }, [effRef])

  // live tide quality for the active species at the slider time (drives the status chip)
  const activeSp = SPECIES.find((s) => s.key === speciesKey) || null
  const tideFit = tide && activeSp ? tideFitAt(tide, activeSp, effRef) : null
  const fitLabel = tideFit == null ? null
    : tideFit >= 0.66 ? 'prime tide now'
    : tideFit >= 0.33 ? 'fair tide now'
    : 'slack / off — pins dimmed'

  return (
    <div className={`chart ${showTide ? 'tide-open' : ''} ${(showTide || showPlan || showLog || activeSpot) ? 'sheet-open' : ''}`} ref={wrapRef}>
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
            onClick={() => { setActiveSpot(null); setSpeciesKey(speciesKey === s.key ? null : s.key) }}>
            <span className="dot" style={{ background: s.color }} />{s.label}
          </button>
        ))}
        {speciesKey && (
          <button className={`chip ${showHeat ? 'active' : ''}`} onClick={() => setShowHeat((v) => !v)}>
            Heat
          </button>
        )}
        {speciesKey && !zoneSpots && (
          <button className="chip" onClick={rescoreZone} disabled={zoneScoring}>
            {zoneScoring ? 'scoring…' : 'Rescore zone'}
          </button>
        )}
        {zoneSpots && (
          <button className="chip active" onClick={() => setZoneSpots(null)}>
            Zone ✕ ({zoneSpots.length})
          </button>
        )}
        {scoring && <span className="chip-status">finding spots…</span>}
        {!scoring && fitLabel &&
          <span className={`chip-status fit-${tideFit >= 0.66 ? 'hi' : tideFit >= 0.33 ? 'mid' : 'lo'}`}>
            🌊 {fitLabel}
          </span>}
        {!scoring && speciesKey && !fitLabel && !zoneSpots &&
          <span className="chip-status">tap a pin · zoom re-ranks</span>}
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
        <button className={`plan-btn ${showPlan ? 'primary' : ''}`} onClick={openPlan}
          title="Game plan">Plan</button>
        <button className={showLog ? 'primary' : ''} onClick={() => setShowLog((v) => !v)}
          title="Catch log">🎣</button>
        <button className={showTide ? 'primary' : ''}
          onClick={() => setShowTide((v) => { if (!v) setRefTime(null); return !v })}
          title="Tides">🌊</button>
        <button onClick={() => setUnits((u) => (u === 'm' ? 'ft' : 'm'))}
          title="Depth units">{units}</button>
        <button className={`primary gps-${gpsState}`} onClick={recenter}
          title="Center on GPS">◎</button>
        <button onClick={fitView} title="Fit whole area">⤢</button>
        <button onClick={() => window.location.reload()} title="Refresh / check for update">↻</button>
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
          speciesList={SPECIES} refTime={effRef} onRefTime={setRefTime}
          onPickSpecies={(k) => { setActiveSpot(null); setSpeciesKey(k) }}
          onClose={() => setShowTide(false)} />
      )}

      {activeSpot && speciesRef.current && (
        <SpotCard spot={activeSpot} species={speciesRef.current} units={units} tide={tide}
          now={effRef} noRigger={noRigger} onToggleRigger={toggleRigger}
          onClose={() => setActiveSpot(null)} />
      )}

      {showLog && (
        <CatchLog catches={catches}
          defaultSpecies={(SPECIES.find((s) => s.key === speciesKey) || {}).label}
          getCapture={getCapture} onSave={saveCatch} onDelete={removeCatch}
          units={units} onClose={() => setShowLog(false)} />
      )}

      {showPlan && (
        <PlanSheet allSpots={allSpots} tide={tide} speciesList={SPECIES}
          units={units} building={planBuilding} now={effRef}
          onPick={pickFromPlan} onClose={() => setShowPlan(false)} />
      )}
    </div>
  )
}
