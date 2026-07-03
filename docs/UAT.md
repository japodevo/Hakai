# Hakai Structure Finder — UAT checklist

User acceptance test. Run on the deployed app (`https://japodevo.github.io/Hakai/`)
after `npm run deploy`. Mark each ✅/❌ and note anything off — the calibration items
(★) are where your local knowledge tunes the app.

## 0. Deploy / data
- [ ] `gh-pages` branch has ~138 `.gz` tiles + `manifest.json` + `tides.json`.
- [ ] Site loads over HTTPS; no console errors on load.

## 1. Chart / base map
- [ ] Hakai bathymetry renders with **relief shading** (channels/banks look 3-D).
- [ ] **Depth contours** visible; **finer blue ramp** shows shallow structure.
- [ ] Pan (drag), zoom (pinch/scroll/double-tap), **⤢ fit**, **+/−** all work.
- [ ] Tap open water → readout shows lat/lon + depth (matches the legend colour).
- [ ] **m/ft** toggle flips depths (downrigger-free anglers want ft).
- [ ] **◎** drops GPS boat position (green when locked); accuracy ring shows.
- [ ] Scale bar (bottom-left) updates with zoom.

## 2. Scoring / spots  ★
- [ ] Tap **Chinook / Coho / Lingcod** → numbered pins appear.
- [ ] ★ **Lingcod #1** lands on a pinnacle/reef you know holds ling.
- [ ] ★ **Chinook** pins sit on kelp-edges / breaks / points you'd actually troll.
- [ ] ★ **Coho** pins skew shallower / more open than lingcod.
- [ ] Zoom into a bay → pins **re-rank to that zone** (#1 = best in view).
- [ ] Zoom to a sparse area → **Rescore zone** surfaces local spots (dashed pins).
- [ ] Tap a pin → card shows depth, structure, **why** (drivers + bars), and an
      **absolute score** (compare the same species across two zones).
- [ ] **Heat** chip → score field overlay; hot areas match where the pins are.

## 3. Tides  ★
- [ ] 🌊 shows today's curve (Pruth Bay), hi/lo times, "now" line.
- [ ] ★ Hi/lo times match a known BC tide table for the date (±minutes).
- [ ] Spot card shows a **timed window** ("Flood · 1:45–3:45 PM"), not just a phase.

## 4. Game plan
- [ ] **Plan** → time-ordered day; NOW / NEXT badges; lingcod on slack, salmon on flood/ebb.
- [ ] Tap a plan line → jumps to that spot + opens its card.
- [ ] With no tide data it degrades to a ranked spot list (n/a once tides are loaded).

## 5. Catch log
- [ ] 🎣 → **＋ Log a catch** auto-captures GPS + depth-under-boat + tide phase.
- [ ] Saved catch shows an amber marker on the chart and a row in the log.
- [ ] CSV + JSON export download.
- [ ] Reload the app → the catch is still there (IndexedDB persisted).

## 6. Gear / no-downriggers
- [ ] Spot card **"Gear"** toggle flips downriggers on/off; tactic + depth advice adapt;
      setting sticks after reload.

## 7. Offline (the real acceptance test)  ★
- [ ] Add to Home Screen (iPhone Safari → Share → Add to Home Screen).
- [ ] Open from the icon once with signal (caches shell + tiles + tides).
- [ ] **Airplane mode → reopen**: chart, pins, Plan, tides, catch log all work.
- [ ] GPS ◎ still places the boat with no cell signal.

## Known limitations (expected, not bugs)
- Land vs. "no modern survey" both show dark — no coastline layer yet.
- Bottom hardness (rock/sand) not yet scored — structure proxies it.
- Scoring weights + tide-window edges are first-principles, uncalibrated.
- Tide *current* slack lags the water-level turn ~20–60 min in the passage.
