import { speciesWindows, nextWindow, fmtTime, referenceNow, dayBounds } from './tides.js'

// Day tide strip: the curve, high/low markers, the active species' good windows
// shaded, and a "now" line. Text lives in HTML (not stretched SVG) for crispness.
export default function TideStrip({ tide, species, onClose }) {
  if (!tide) {
    return (
      <div className="tide-strip empty">
        <span>No tide data yet — run <code>fetch_tides.py --from … --to …</code> for your
          trip dates and redeploy.</span>
        <button className="spot-x" onClick={onClose} aria-label="Close">×</button>
      </div>
    )
  }

  const ref = referenceNow(tide)
  const [d0, d1] = dayBounds(ref)
  const pts = tide.pred.filter((p) => p.t >= d0 && p.t <= d1)
  const hilo = tide.hilo.filter((e) => e.t >= d0 && e.t <= d1)
  const now = Date.now()

  const W = 600, H = 84, padY = 12
  let body = <div className="tide-empty">No samples for this day.</div>
  if (pts.length >= 2) {
    const vs = pts.map((p) => p.v)
    const vmin = Math.min(...vs), vmax = Math.max(...vs)
    const X = (t) => ((t - d0) / (d1 - d0)) * W
    const Y = (v) => H - padY - ((v - vmin) / ((vmax - vmin) || 1)) * (H - 2 * padY)
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')
    const wins = species
      ? speciesWindows(tide, species).filter((w) => w.weight >= 0.6 && w.end >= d0 && w.start <= d1)
      : []
    body = (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="tide-svg">
        {wins.map((w, i) => {
          const x = Math.max(0, X(w.start))
          const wd = Math.min(W, X(w.end)) - x
          return <rect key={i} x={x} y="0" width={Math.max(0, wd)} height={H}
            fill={species ? species.color : '#8fd0ff'} opacity="0.16" />
        })}
        <path d={path} fill="none" stroke="#8fd0ff" strokeWidth="2" />
        {hilo.map((e, i) => <circle key={i} cx={X(e.t)} cy={Y(e.v)} r="3.5" fill="#fff" />)}
        {now >= d0 && now <= d1 &&
          <line x1={X(now)} y1="0" x2={X(now)} y2={H} stroke="#ffcf6b" strokeWidth="1.5" />}
      </svg>
    )
  }

  const nw = species ? nextWindow(tide, species, now) : null

  return (
    <div className="tide-strip">
      <div className="tide-head">
        <span className="tide-date">
          Tide · {new Date(ref).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          {tide.station?.name ? ` · ${tide.station.name}` : ''}
        </span>
        {species && nw && (
          <span className="tide-next" style={{ color: species.color }}>
            {nw.current ? 'Now: ' : 'Next: '}{nw.label.split(' — ')[0]} {fmtTime(nw.start)}–{fmtTime(nw.end)}
          </span>
        )}
        <button className="spot-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      {body}
      <div className="tide-hilo">
        {hilo.map((e, i) => (
          <span key={i}>{e.type === 'high' ? 'H' : 'L'} {fmtTime(e.t)}</span>
        ))}
      </div>
    </div>
  )
}
