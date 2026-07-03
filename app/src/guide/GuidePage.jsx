import { SPECIES, CONTEXT } from '../scoring/species.js'
import './guide.css'

const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function months(list) {
  if (!list || !list.length) return '—'
  const s = [...list].sort((a, b) => a - b)
  // contiguous range → "Jun–Sep", else list
  const contiguous = s.every((m, i) => i === 0 || m === s[i - 1] + 1)
  return contiguous && s.length > 1 ? `${MON[s[0]]}–${MON[s[s.length - 1]]}` : s.map((m) => MON[m]).join(', ')
}

function Bar({ v }) {
  return <i className="gbar"><b style={{ width: `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%` }} /></i>
}

function SpeciesCard({ s }) {
  const d = s.depthBand
  return (
    <section className="guide-species" style={{ borderColor: s.color }}>
      <header>
        <span className="gdot" style={{ background: s.color }} />
        <div>
          <h2>{s.label}</h2>
          {s.localName ? <div className="glocal">{s.localName}</div> : null}
        </div>
      </header>

      <div className="grow"><span className="gk">Season</span><b>{months(s.seasonMonths)}</b></div>
      {s.seasonNote ? <p className="gnote">{s.seasonNote}</p> : null}

      <div className="grow"><span className="gk">Depth</span>
        <b>{d.minM}–{d.maxM} m · prime {d.primeM} m</b></div>
      {d.note ? <p className="gnote">{d.note}</p> : null}

      <div className="grow"><span className="gk">Tide</span>
        <b>{(s.tidePhase?.bestPhases || []).join(', ')}</b></div>
      {s.tidePhase?.why ? <p className="gnote">{s.tidePhase.why}</p> : null}

      {s.structurePref?.length ? (
        <div className="gstruct">
          <span className="gk">Structure</span>
          {s.structurePref.map((x) => (
            <div className="gstruct-row" key={x.type}>
              <span className="gstruct-name">{x.type}</span><Bar v={x.weight} />
            </div>
          ))}
        </div>
      ) : null}

      {s.tactics?.length ? (
        <div className="gtactics">
          <span className="gk">Tactics</span>
          {s.tactics.map((t, i) => (
            <div className="gtactic" key={i}>
              <b>{t.method}</b> — {t.summary}
              {t.gear ? <div className="gsub"><em>Gear:</em> {t.gear}</div> : null}
              {t.presentation ? <div className="gsub"><em>How:</em> {t.presentation}</div> : null}
              {t.depthNote ? <div className="gsub"><em>Depth:</em> {t.depthNote}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {s.regsNote ? (
        <details className="greg"><summary>Regulations & season notes</summary><p>{s.regsNote}</p></details>
      ) : null}
      {s.confidence ? <p className="gconf">Confidence: {s.confidence}</p> : null}
    </section>
  )
}

export default function GuidePage({ onClose }) {
  const c = CONTEXT || {}
  return (
    <div className="guide">
      <div className="guide-head">
        <div><b>Fishing guide</b><span> · Hakai Passage</span></div>
        <button className="spot-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <p className="guide-intro">
        Species profiles behind the scoring — researched and cross-checked across biology,
        tide/current, and regulations. Depths are to chart datum (positive-down).
      </p>

      {SPECIES.map((s) => <SpeciesCard key={s.key} s={s} />)}

      <section className="guide-context">
        <h2>Hakai notes</h2>
        {c.hakaiNotes ? <p className="gnote">{c.hakaiNotes}</p> : null}
        {c.tideWindowRules ? (
          <>
            <h3>How the tide windows are defined</h3>
            {c.tideWindowRules.slackDef ? <p className="gnote">{c.tideWindowRules.slackDef}</p> : null}
            {c.tideWindowRules.maxFlowDef ? <p className="gnote">{c.tideWindowRules.maxFlowDef}</p> : null}
            {c.tideWindowRules.movingWaterDef ? <p className="gnote">{c.tideWindowRules.movingWaterDef}</p> : null}
          </>
        ) : null}
        {c.rockfishConservationNote ? (
          <>
            <h3>Rockfish Conservation Areas</h3>
            <p className="gnote">{c.rockfishConservationNote}</p>
          </>
        ) : null}
        {c.regsCalendar?.length ? (
          <>
            <h3>Regulations calendar</h3>
            {c.regsCalendar.map((r, i) => (
              <p className="gnote" key={i}><b>{r.topic}</b>{r.months?.length ? ` (${months(r.months)})` : ''}: {r.detail}</p>
            ))}
          </>
        ) : null}
      </section>

      <p className="guide-disclaimer">
        ⚠️ Not for navigation. These are planning notes, not legal advice — always verify
        current DFO Pacific regulations, closures, and Rockfish Conservation Areas for your
        exact subarea before fishing.
      </p>
    </div>
  )
}
