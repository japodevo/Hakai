import { fmtDepth } from './proj.js'
import { rationale, tideHint } from '../scoring/score.js'
import { nextWindow, fmtTime } from '../tides/tides.js'

// Bottom-sheet card for a ranked spot: depth, timed tide window, rationale, tactic,
// an in/out-of-season badge, and the regs + not-for-nav caveats.
export default function SpotCard({ spot, species, units, tide, noRigger, onToggleRigger, onClose }) {
  const depthStr = fmtDepth(spot.depthM, units)
  const month = new Date().getMonth() + 1
  const inSeason = (species.seasonMonths || []).includes(month)

  // Downrigger-free tactic: prefer a mooch/jig/drift/cast method; if only a
  // rigger-troll is listed, keep it but add a "how to get deep" tip.
  const tactics = species.tactics || []
  const nonRig = tactics.find((t) => /mooch|jig|drift|cast|bucktail|float/i.test(`${t.method} ${t.summary}`))
  const tactic = noRigger && nonRig ? nonRig : tactics[0]
  const riggerTip = noRigger && !nonRig
    ? `No downrigger: reach ${depthStr} with a 4–16 oz trolling weight or a diving planer (Deep Six / Dipsy Diver), or motor-mooch a cut-plug herring down to it.`
    : null

  const nw = tide ? nextWindow(tide, species, Date.now()) : null
  const whenValue = nw
    ? `${nw.label.split(' — ')[0]} · ${fmtTime(nw.start)}–${fmtTime(nw.end)}${nw.current ? ' (now)' : ''}`
    : tideHint(species)

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
        <div><span className="k">{nw ? 'Best window' : 'Fish it on'}</span><b>{whenValue}</b></div>
      </div>

      <div className="spot-why">{rationale(species, spot, depthStr)}</div>

      {tactic && (
        <div className="spot-tactic">
          <span className="k">{tactic.method}</span> {tactic.summary}
          {tactic.depthNote ? <div className="spot-tacticsub">{tactic.depthNote}</div> : null}
          {riggerTip ? <div className="spot-tacticsub warn">{riggerTip}</div> : null}
        </div>
      )}

      <button className="rig-toggle" onClick={onToggleRigger}>
        Gear: <b>{noRigger ? 'no downriggers' : 'downriggers'}</b> · tap to switch
      </button>

      <div className="spot-note">
        ⚠ Not for navigation. Structure grade: {Math.round(spot.rel * 100)}% of the day's best.
        {species.regsNote ? ` Regs: ${species.regsNote.slice(0, 180)}…` : ' Verify current DFO regs before you fish.'}
      </div>
    </div>
  )
}
