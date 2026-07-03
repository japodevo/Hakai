import { useState } from 'react'
import { fmtDepth } from '../chart/proj.js'
import { toCSV, download } from './db.js'

const SPECIES_OPTS = ['Chinook', 'Coho', 'Lingcod', 'Halibut', 'Rockfish', 'Other']
const METHOD_OPTS = ['Troll', 'Mooch', 'Jig', 'Drift', 'Cast', 'Other']

// Bottom-sheet catch log: list of logged catches (+ export), and a one-tap entry
// form that auto-captures GPS, depth-under-boat, and tide phase at the moment.
export default function CatchLog({ catches, defaultSpecies, getCapture, onSave, onDelete, units, onClose }) {
  const [mode, setMode] = useState(catches.length ? 'list' : 'form')
  const [snap, setSnap] = useState(null)
  const [form, setForm] = useState({ species: defaultSpecies || 'Chinook', length: '', method: 'Troll', lure: '', notes: '' })

  function startForm() {
    setSnap(getCapture())
    setForm((f) => ({ ...f, species: defaultSpecies || f.species, length: '', lure: '', notes: '' }))
    setMode('form')
  }
  function save() {
    onSave(form, snap)
    setMode('list')
  }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const cap = snap || {}
  const capDepth = cap.depthM != null ? fmtDepth(cap.depthM, units) : '—'

  return (
    <div className="catch-sheet">
      <div className="catch-head">
        <b>Catch log</b>
        <span className="catch-count">{catches.length} logged</span>
        <div className="catch-actions">
          {catches.length > 0 && (
            <>
              <button onClick={() => download('hakai-catches.csv', toCSV(catches), 'text/csv')}>CSV</button>
              <button onClick={() => download('hakai-catches.json', JSON.stringify(catches, null, 2), 'application/json')}>JSON</button>
            </>
          )}
          <button className="spot-x" onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>

      {mode === 'form' ? (
        <div className="catch-form">
          <div className="catch-auto">
            📍 {cap.lat != null ? `${cap.lat.toFixed(5)}, ${cap.lon.toFixed(5)}` : 'no GPS fix'}
            {' · '}depth {capDepth}{cap.tidePhase ? ` · ${cap.tidePhase}` : ''}
          </div>
          <div className="catch-fields">
            <label>Species
              <select value={form.species} onChange={set('species')}>
                {SPECIES_OPTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>Length (cm)
              <input type="number" inputMode="numeric" value={form.length} onChange={set('length')} placeholder="—" />
            </label>
            <label>Method
              <select value={form.method} onChange={set('method')}>
                {METHOD_OPTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>Lure / bait
              <input value={form.lure} onChange={set('lure')} placeholder="e.g. green-glow spoon" />
            </label>
          </div>
          <label className="catch-notes">Notes
            <input value={form.notes} onChange={set('notes')} placeholder="optional" />
          </label>
          <div className="catch-formbtns">
            <button onClick={() => setMode(catches.length ? 'list' : 'form')}>Cancel</button>
            <button className="primary" onClick={save}>Save catch</button>
          </div>
        </div>
      ) : (
        <>
          <button className="catch-new primary" onClick={startForm}>＋ Log a catch</button>
          <div className="catch-list">
            {catches.map((c) => (
              <div className="catch-row" key={c.id}>
                <div className="catch-main">
                  <b>{c.species}</b>{c.length ? ` · ${c.length} cm` : ''}
                  {c.method ? ` · ${c.method}` : ''}{c.lure ? ` · ${c.lure}` : ''}
                </div>
                <div className="catch-meta">
                  {new Date(c.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {c.depthM != null ? ` · ${fmtDepth(c.depthM, units)}` : ''}
                  {c.tidePhase ? ` · ${c.tidePhase}` : ''}
                </div>
                <button className="spot-x" onClick={() => onDelete(c.id)} aria-label="Delete">×</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
