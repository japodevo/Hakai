import { fmtDepth } from './proj.js'
import { rationale, tideHint } from '../scoring/score.js'

// Bottom-sheet card for a ranked spot: depth, tide phase, rationale, tactic,
// an in/out-of-season badge, and the regs + not-for-nav caveats.
export default function SpotCard({ spot, species, units, onClose }) {
  const depthStr = fmtDepth(spot.depthM, units)
  const tactic = species.tactics && species.tactics[0]
  const month = new Date().getMonth() + 1
  const inSeason = (species.seasonMonths || []).includes(month)

  return (
    <div className="spot-card">
      <div className="spot-head">
        <span className="spot-rank" style={{ background: species.color }}>{spot.rank}</span>
        <div className="spot-headtext">
          <div className="spot-title">{species.label} · {spot.structure}</div>
          <div className="spot-sub">{spot.lat.toFixed(5)}, {spot.lon.toFixed(5)}</div>
        </div>
        <span className={`spot-season ${inSeason ? 'in' : 'out'}`}>
          {inSeason ? 'in season' : 'off season'}
        </span>
        <button className="spot-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="spot-grid">
        <div><span className="k">Depth</span><b>{depthStr}</b></div>
        <div><span className="k">Fish it on</span><b>{tideHint(species)}</b></div>
      </div>

      <div className="spot-why">{rationale(species, spot, depthStr)}</div>

      {tactic && (
        <div className="spot-tactic">
          <span className="k">{tactic.method}</span> {tactic.summary}
          {tactic.depthNote ? <div className="spot-tacticsub">{tactic.depthNote}</div> : null}
        </div>
      )}

      <div className="spot-note">
        ⚠ Not for navigation. Structure grade: {Math.round(spot.rel * 100)}% of the day's best.
        {species.regsNote ? ` Regs: ${species.regsNote.slice(0, 180)}…` : ' Verify current DFO regs before you fish.'}
      </div>
    </div>
  )
}
