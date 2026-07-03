import { fmtDepth } from './proj.js'
import { rationale, tideHint, explain, liveScore, currentPlay } from '../scoring/score.js'
import { nextWindow, fmtTime, tideFitAt, SLACK_LAG_MIN } from '../tides/tides.js'

function Bar({ label, v }) {
  return (
    <div className="spot-bar">
      <span>{label}</span>
      <i><b style={{ width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%` }} /></i>
    </div>
  )
}

// Bottom-sheet card for a ranked spot: depth, timed tide window, rationale, tactic,
// an in/out-of-season badge, and the regs + not-for-nav caveats.
export default function SpotCard({ spot, species, units, tide, now, noRigger, onToggleRigger, onClose }) {
  const depthStr = fmtDepth(spot.depthM, units)
  const month = new Date(now || Date.now()).getMonth() + 1
  const inSeason = (species.seasonMonths || []).includes(month)

  // Downrigger-free tactic: prefer a mooch/jig/drift/cast method; if only a
  // rigger-troll is listed, keep it but add a "how to get deep" tip.
  const tactics = species.tactics || []
  const nonRig = tactics.find((t) => /mooch|jig|drift|cast|bucktail|float/i.test(`${t.method} ${t.summary}`))
  const tactic = noRigger && nonRig ? nonRig : tactics[0]
  const riggerTip = noRigger && !nonRig
    ? `No downrigger: reach ${depthStr} with a 4–16 oz trolling weight or a diving planer (Deep Six / Dipsy Diver), or motor-mooch a cut-plug herring down to it.`
    : null

  const nowMs = now || Date.now()
  const structPct = Math.round(spot.score * 100)
  const livePct = Math.min(99, Math.round(liveScore(spot.score, species, tide, nowMs) * 100))
  const fit = tide ? tideFitAt(tide, species, nowMs) : 1
  const fitWord = !tide ? null : fit >= 0.66 ? 'prime tide' : fit >= 0.33 ? 'fair tide' : 'slack / off-tide'
  const nw = tide ? nextWindow(tide, species, nowMs) : null
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
      <div className="spot-explain">{explain(species, spot)}</div>
      {currentPlay(species, spot) && (
        <div className="spot-current">
          <span className="k">Current play</span> {currentPlay(species, spot)}
          {nw ? ` Windows already allow the ~${SLACK_LAG_MIN} min current lag behind the tide table.` : ''}
        </div>
      )}
      <div className="spot-bars">
        <Bar label="Prominence" v={spot.comp.prom} />
        <Bar label="Drop-off" v={spot.comp.adj} />
        <Bar label="Slope" v={spot.comp.slope} />
      </div>

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

      <div className="spot-score">
        <b>{livePct}</b><span>/100 bite score now</span>
        {fitWord ? <em>· {fitWord}</em> : null}
      </div>
      <div className="spot-score-sub">
        Structure {structPct}/100{tide ? ' × the tide right now' : ''} · {Math.round(spot.rel * 100)}% of best in view.
        {tide ? ' Scrub the 🌊 time slider to see it change through the day.' : ''}
      </div>

      <div className="spot-note">
        ⚠ Not for navigation. Structure score compares zone-to-zone (same species); bite
        score also folds in the tide at the selected time.
        {species.regsNote ? ` Regs: ${species.regsNote.slice(0, 160)}…` : ' Verify current DFO regs before you fish.'}
      </div>
    </div>
  )
}
