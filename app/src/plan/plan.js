// The capstone synthesis: fuse ranked spots (where + structure + depth) × species
// × tide windows (when) into one time-ordered game plan for a day. Each tide window
// is matched to the species it suits and that species' best spot.
import { speciesWindows, dayBounds, referenceNow } from '../tides/tides.js'
import { lightFit, lightBand } from '../tides/sun.js'

function inSeason(species, monthIdx) {
  return (species.seasonMonths || []).includes(monthIdx)
}

// spotsBySpecies: { chinook: [...spots], coho: [...], lingcod: [...] }
// Returns { day, windows: [{start,end,label,phase,center,picks:[{species,spot,score}]}], noTide, spotsOnly }
export function buildPlan(spotsBySpecies, tide, speciesList, opts = {}) {
  const ref = opts.now != null ? opts.now : (tide ? referenceNow(tide) : Date.now())
  const month = new Date(ref).getMonth() + 1

  // No tide data → fall back to a ranked spot list per in-season species.
  if (!tide || !tide.hilo || tide.hilo.length < 2) {
    const spotsOnly = speciesList
      .map((s) => ({ species: s, inSeason: inSeason(s, month), spots: (spotsBySpecies[s.key] || []).slice(0, 3) }))
      .filter((r) => r.spots.length)
    return { day: ref, windows: [], noTide: true, spotsOnly }
  }

  const [d0, d1] = dayBounds(ref)
  const groups = new Map()
  for (const s of speciesList) {
    const spots = spotsBySpecies[s.key] || []
    if (!spots.length) continue
    const best = spots[0]
    for (const w of speciesWindows(tide, s)) {
      if (w.weight < 0.6 || w.end < d0 || w.start > d1) continue
      const key = Math.round(w.center / 60000)
      // dawn/dusk windows carry the prime-light tag and outrank equal midday tides
      const band = lightBand(w.center)
      const label = w.label + (band === 'lowLight' ? ' · ☀ prime light' : band === 'night' ? ' · dark' : '')
      const g = groups.get(key) || { start: w.start, end: w.end, center: w.center, label, phase: w.phase, picks: [] }
      // direction-aware: a flood-collecting spot outranks on flood windows, etc.
      const dirAff = w.phase === 'flood' ? (best.floodAff ?? 1) : w.phase === 'ebb' ? (best.ebbAff ?? 1) : 1
      g.picks.push({ species: s, spot: best, score: w.weight * best.rel * lightFit(s, w.center) * dirAff, weight: w.weight, inSeason: inSeason(s, month) })
      groups.set(key, g)
    }
  }
  const windows = [...groups.values()].sort((a, b) => a.start - b.start)
  for (const g of windows) {
    // in-season picks win ties; otherwise by score
    g.picks.sort((a, b) => (b.inSeason - a.inSeason) || (b.score - a.score))
  }
  return { day: ref, windows, noTide: false, spotsOnly: null }
}
