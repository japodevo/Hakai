import { speciesWindows, nextWindow, phaseNow, fmtTime, dayBounds } from './tides.js'

// which species a phase favours, weighted by its tide prefs
function phaseWeightFor(sp, phase) {
  const w = sp.scoring.tidePhaseWeight
  if (!phase) return 0
  if (phase.includes('slack')) return Math.max(w.slack || 0, w.change || 0)
  if (phase === 'flood') return w.flood || 0
  if (phase === 'ebb') return w.ebb || 0
  return 0
}
const PHASE_LABEL = { flood: 'Flood', ebb: 'Ebb', 'high slack': 'High slack', 'low slack': 'Low slack' }

// Day tide strip + a time-of-day slider. Scrubbing moves the marker and updates the
// "fish X now" recommendation (which species the tide favours at that moment).
export default function TideStrip({ tide, species, speciesList, refTime, onRefTime, onPickSpecies, onClose }) {
  if (!tide) {
    return (
      <div className="tide-strip empty">
        <span>No tide data yet — run <code>fetch_tides.py --from … --to …</code> and redeploy.</span>
        <button className="spot-x" onClick={onClose} aria-label="Close">×</button>
      </div>
    )
  }
  const now = refTime
  const [d0, d1] = dayBounds(now)
  const pts = tide.pred.filter((p) => p.t >= d0 && p.t <= d1)
  const hilo = tide.hilo.filter((e) => e.t >= d0 && e.t <= d1)

  const phase = phaseNow(tide, now)
  const month = new Date(now).getMonth() + 1
  const recs = (speciesList || [])
    .map((sp) => ({ sp, w: phaseWeightFor(sp, phase) * ((sp.seasonMonths || []).includes(month) ? 1 : 0.45) }))
    .filter((r) => r.w > 0.1)
    .sort((a, b) => b.w - a.w)
  const rec = recs[0]
  const shadeSp = species || (rec && rec.sp)

  const W = 600, H = 84, padY = 12
  let body = <div className="tide-empty">No samples for this day.</div>
  if (pts.length >= 2) {
    const vs = pts.map((p) => p.v)
    const vmin = Math.min(...vs), vmax = Math.max(...vs)
    const X = (t) => ((t - d0) / (d1 - d0)) * W
    const Y = (v) => H - padY - ((v - vmin) / ((vmax - vmin) || 1)) * (H - 2 * padY)
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')
    const wins = shadeSp
      ? speciesWindows(tide, shadeSp).filter((w) => w.weight >= 0.6 && w.end >= d0 && w.start <= d1)
      : []
    body = (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="tide-svg">
        {wins.map((w, i) => {
          const x = Math.max(0, X(w.start)); const wd = Math.min(W, X(w.end)) - x
          return <rect key={i} x={x} y="0" width={Math.max(0, wd)} height={H}
            fill={shadeSp.color} opacity="0.16" />
        })}
        <path d={path} fill="none" stroke="#8fd0ff" strokeWidth="2" />
        {hilo.map((e, i) => <circle key={i} cx={X(e.t)} cy={Y(e.v)} r="3.5" fill="#fff" />)}
        <line x1={X(now)} y1="0" x2={X(now)} y2={H} stroke="#ffcf6b" strokeWidth="1.5" />
      </svg>
    )
  }

  const nw = species ? nextWindow(tide, species, now) : null
  const DAY = 86400000
  const goDay = (dir) => {
    const t = now + dir * DAY
    onRefTime(Math.min(Math.max(t, tide.start ?? t), tide.end ?? t))
  }
  const atStart = tide.start != null && now - DAY < tide.start
  const atEnd = tide.end != null && now + DAY > tide.end

  return (
    <div className="tide-strip">
      <div className="tide-head">
        <div className="tide-nav">
          <button onClick={() => goDay(-1)} disabled={atStart} aria-label="Previous day">‹</button>
          <span className="tide-date">
            {new Date(now).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <button onClick={() => goDay(1)} disabled={atEnd} aria-label="Next day">›</button>
        </div>
        {nw && <span className="tide-next" style={{ color: species.color }}>
          {nw.current ? 'Now: ' : 'Next: '}{nw.label.split(' — ')[0]} {fmtTime(nw.start)}–{fmtTime(nw.end)}
        </span>}
        <button className="spot-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      {body}

      <label className="tide-slider-label">Time of day</label>
      <input className="tide-slider" type="range" min={d0} max={d1} step={900000}
        value={Math.min(Math.max(now, d0), d1)}
        onChange={(e) => onRefTime(Number(e.target.value))} />

      <div className="tide-foot">
        <span className="tide-cursor">{fmtTime(now)}{phase ? ` · ${PHASE_LABEL[phase] || phase}` : ''}</span>
        {rec ? (
          <button className="tide-rec" style={{ color: rec.sp.color }}
            onClick={() => onPickSpecies(rec.sp.key)}>
            fish {rec.sp.label} now ›
          </button>
        ) : <span className="tide-rec-none">slack / off — wait for moving water</span>}
      </div>

      <div className="tide-hilo">
        {hilo.map((e, i) => <span key={i}>{e.type === 'high' ? 'H' : 'L'} {fmtTime(e.t)}</span>)}
      </div>
    </div>
  )
}
