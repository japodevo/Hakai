import { SPECIES, CONTEXT } from '../scoring/species.js'
import './guide.css'

const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Plain-language glossary — every term the app or guide uses, for non-pros.
const GLOSSARY = [
  ['Structure', 'Any change in the bottom shape — a hump, ledge, drop, or reef — that concentrates bait and fish. The whole app is a structure finder.'],
  ['Pinnacle', 'An underwater peak or spire that rises sharply from deeper water. Prime lingcod and rockfish ground; bait stacks on it.'],
  ['Hump / high spot', 'A rounded rise on the bottom, shallower than the water around it. Holds fish like a pinnacle but gentler.'],
  ['Wall / drop-off', 'A steep face where the bottom falls away fast. Fish sit along the edge and ambush bait swept past it.'],
  ['Shelf break', 'Where a flatter shelf rolls over into deeper water — a softer version of a drop-off. Good travel lane for salmon.'],
  ['Bench / flat', 'A flatter terrace, often at a set depth. Halibut and feeding salmon cruise these.'],
  ['Prominence', 'How much a spot stands proud of the bottom around it (in metres of relief). Higher = more of a pinnacle/hump.'],
  ['Slope', 'How steeply the bottom tilts at a point. Steep slope = wall or broken rock; flat = a bench.'],
  ['Adjacency-to-drop', 'Whether a steep drop sits right next to the spot — fish hold on structure but feed on the edge of the drop.'],
  ['Slack', 'The pause when the current stops and turns, around each high and low tide. Bait scatters and fish relax — a key bite window, especially for lingcod.'],
  ['Flood', 'The incoming (rising) tide — water pushing in.'],
  ['Ebb', 'The outgoing (falling) tide — water draining out.'],
  ['Tide change', 'The transition around a high or low when current is turning. Salmon often feed hardest here.'],
  ['Max flow / moving water', 'The middle of a tide, halfway between high and low, when current runs hardest. It sweeps bait onto structure.'],
  ['Slack lag', 'In a strong passage the water keeps moving after the tide height turns — current slack arrives ~40 min after the high/low in the tide table. The app shifts all its windows to current time for you.'],
  ['Spring / neap tides', 'Around full and new moon (springs) the tide range is big and currents rip; at quarter moons (neaps) both are gentle. The app scores a big spring push higher than a soft neap one.'],
  ['First light / low light', 'The grey band around dawn and dusk when salmon feed hardest. The bite score peaks then, drops in flat midday sun, and drops harder in full dark; the tide chart shades night. Lingcod care less — they hunt by sight all day.'],
  ['Rugosity', 'How rough/broken the bottom is. The app measures fine texture in the depth data as a stand-in for rock (rough) vs sand/mud (smooth) — lingcod demand rock, so smooth-bottom spots score down for them. Confirm on your sounder.'],
  ['Chart datum', 'The zero line depths are measured from (roughly the lowest tide). Real water is usually deeper than the number by the tide height.'],
  ['Mooching', 'Slow-trolling or drifting a weighted, cut-bait or whole herring so it spins — a classic no-downrigger salmon method.'],
  ['Jigging', 'Dropping a heavy metal lure to the bottom and working it up-and-down. Deadly on lingcod and rockfish over structure.'],
  ['Bucktailing', 'Trolling a feathered fly (a "bucktail") fast and shallow just behind the boat — a top surface tactic for coho.'],
  ['Drift', 'Cutting the motor and letting wind/current carry you across a spot while you fish straight down. Good over pinnacles.'],
  ['Cast & retrieve', 'Throwing a lure out and reeling it back — used for coho busting bait near the surface.'],
  ['Downrigger', 'A winch with a heavy lead ball that pulls your line to an exact depth while trolling. This app gives feet + rod-tip pulls so you can fish deep without one.'],
  ['Sounder / fish finder', 'Your boat’s depth sonar. Use it to confirm bait and fish over the structure the app points you to.'],
  ['Chinook / spring', 'Same fish, two names — the big king salmon this app is tuned for.'],
  ['Coho', 'Silver salmon — aggressive, often higher in the water column than chinook.'],
  ['Lingcod', 'A big bottom ambush predator that lives right on rock, pinnacles, and walls.'],
  ['RCA', 'Rockfish Conservation Area — a zone closed to protect rockfish. Check before you fish; see the notes below.'],
  ['Not for navigation', 'This chart is for finding fish, not for steering the boat. Use your certified chartplotter to navigate.'],
]

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

// Long note tucked behind a one-tap disclosure so the card stays scannable.
function Note({ label, children }) {
  if (!children) return null
  return <details className="gdetails"><summary>{label}</summary><p>{children}</p></details>
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
      <Note label="season notes">{s.seasonNote}</Note>

      <div className="grow"><span className="gk">Depth</span>
        <b>{d.minM}–{d.maxM} m · prime {d.primeM} m</b></div>
      <Note label="depth notes">{d.note}</Note>

      <div className="grow"><span className="gk">Tide</span>
        <b>{(s.tidePhase?.bestPhases || []).join(', ')}</b></div>
      <Note label="tide notes">{s.tidePhase?.why}</Note>

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

      <section className="guide-howto">
        <h2>How to use it</h2>
        <ol>
          <li><b>Plan</b> (bottom-right) → a time-ordered day: which species, which spot,
            what depth, and the tide window to be there. Tap a line to jump to it.</li>
          <li><b>Species chips</b> (Chinook / Coho / Lingcod) → numbered pins on the best
            structure. <b>Zoom into a bay</b> and the pins re-rank to that zone; use
            <b> Rescore zone</b> to score an area with no pins.</li>
          <li><b>Tap a pin</b> → depth, structure, why it scored, the tactic, and the
            timed tide window. <b>Heat</b> shows the whole score field.</li>
          <li><b>🌊 Tides</b> → the day's curve. Use <b>‹ ›</b> to change day and drag the
            <b> slider</b> to any time. The number in each pin is a <b>“bite score now”</b> —
            the spot's structure times how well the tide <b>and the light</b> (first light /
            dusk beats midday; night shades dark on the chart) suit that species then —
            so it <b>rises in a good window and drops at slack / off-tide</b>, and the pins
            brighten and dim with it. (Spot <i>locations</i> are fixed structure — the tide
            changes <i>when</i> to be there, not where.)</li>
          <li><b>Tap open water</b> → depth readout. <b>m/ft</b> toggles units (feet for
            downriggers). On a spot card, flip <b>Gear</b> if you don't run downriggers.</li>
          <li><b>🎣 Catch log</b> → one tap saves species/length/lure with auto GPS, depth,
            and tide phase; export CSV/JSON. Your catches plot on the chart.</li>
          <li><b>◎</b> = GPS boat position, <b>⤢</b> = fit, <b>↻</b> = refresh/update.</li>
          <li><b>Offline:</b> Add to Home Screen, open once on signal, then it works in
            airplane mode. GPS still works with no cell service.</li>
        </ol>
        <p className="gnote">Not for navigation. It finds structure + depth + tide timing —
          it can't see bait, temperature, or fish. Confirm bait on your sounder.</p>
      </section>

      <details className="guide-glossary">
        <summary>📖 Glossary — what the words mean</summary>
        <dl>
          {GLOSSARY.map(([term, def]) => (
            <div className="gloss-row" key={term}>
              <dt>{term}</dt>
              <dd>{def}</dd>
            </div>
          ))}
        </dl>
      </details>

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
