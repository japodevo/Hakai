import { buildPlan } from './plan.js'
import { fmtTime } from '../tides/tides.js'
import { fmtDepth } from '../chart/proj.js'

// The unified "game plan": time-ordered tide windows, each matched to the species it
// favours and that species' best spot (depth + structure). Tap a pick to jump to it.
export default function PlanSheet({ allSpots, tide, speciesList, units, building, onPick, onClose }) {
  const plan = buildPlan(allSpots, tide, speciesList)
  const now = Date.now()

  const pickRow = (p, w, cls) => (
    <button className={`plan-pick ${cls || ''}`} onClick={() => onPick(p.species, p.spot)}>
      <span className="plan-dot" style={{ background: p.species.color }} />
      <span className="plan-sp">{p.species.label}</span>
      <span className="plan-struct">{p.spot.structure}</span>
      <b className="plan-depth">{fmtDepth(p.spot.depthM, units)}</b>
      {!p.inSeason && <span className="plan-off">off-season</span>}
    </button>
  )

  return (
    <div className="plan-sheet">
      <div className="catch-head">
        <b>Game plan</b>
        <span className="catch-count">
          {tide ? new Date(plan.day).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) : 'spots (load tides for timing)'}
        </span>
        <button className="spot-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      {building && <div className="plan-building">scoring all species…</div>}

      {!building && plan.noTide && (
        <div className="plan-list">
          <div className="plan-hint">No tide prefetch — showing top structure per species.
            Run <code>fetch_tides.py</code> for timed windows.</div>
          {plan.spotsOnly.map((r) => (
            <div className="plan-window" key={r.species.key}>
              <div className="plan-when"><span className="plan-dot" style={{ background: r.species.color }} />
                {r.species.label}{!r.inSeason && <span className="plan-off"> off-season</span>}</div>
              {r.spots.map((sp) => (
                <button className="plan-pick" key={sp.rank} onClick={() => onPick(r.species, sp)}>
                  <span className="plan-rank">#{sp.rank}</span>
                  <span className="plan-struct">{sp.structure}</span>
                  <b className="plan-depth">{fmtDepth(sp.depthM, units)}</b>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {!building && !plan.noTide && (
        <div className="plan-list">
          {plan.windows.length === 0 && <div className="plan-hint">No strong windows today.</div>}
          {plan.windows.map((w, i) => {
            const isNow = now >= w.start && now <= w.end
            const isNext = !isNow && w.start > now && !plan.windows.slice(0, i).some((x) => x.start > now)
            return (
              <div className={`plan-window ${isNow ? 'now' : ''} ${isNext ? 'next' : ''}`} key={i}>
                <div className="plan-when">
                  <span className="plan-time">{fmtTime(w.start)}–{fmtTime(w.end)}</span>
                  <span className="plan-phase">{w.label}</span>
                  {isNow && <span className="plan-badge">NOW</span>}
                  {isNext && <span className="plan-badge next">NEXT</span>}
                </div>
                {w.picks.slice(0, 2).map((p, j) => pickRow(p, w, j === 0 ? 'top' : 'alt'))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
