# Hakai Structure Finder

Offline-first fishing app for the BC Central Coast (Hakai Passage / Calvert Island).
Reads real bathymetry, auto-detects fish-holding structure, scores spots per target
species, and pairs them with tide windows — all designed to work with **zero
connectivity**, because there's no cell service at Hakai.

> **⚠️ Not for navigation.** Built on CHS NONNA data (non-navigational license) and
> DFO tide predictions. Personal use only.

See [`CLAUDE.md`](./CLAUDE.md) for the full spec, constraints, and data sources.

## Layout

```
CLAUDE.md          project spec (source of truth)
prototype/         reference implementation (terrain analysis + scoring + renderer)
pipeline/          Python: fetch + tile bathymetry, prefetch tides   <-- M1 lives here
app/               Vite + React PWA (M2+)
data/              generated tiles + manifests (mostly gitignored)
```

## Status

| Milestone | Scope | State |
|-----------|-------|-------|
| **M1** | Pipeline: real NONNA tiles render in a throwaway HTML viewer | **✅ done** — WCS fetch → UTM 9N mosaic → 46 gzip tiles (3497×3380 @ 10 m) render in the viewer; ~59% modern-survey coverage of the AOI (rest = land / no survey) |
| **M2** | App shell: Vite PWA, chart renderer, pan/zoom, GPS marker | **in progress** — Vite+React PWA scaffolded; canvas renderer (pan/zoom/pinch), GPS own-ship marker, tap-to-read depth/source, `storage.persist()`. Needs `npm install` + run on the Mac |
| **M3** | Scoring on real data: species chips, ranked pins, spot cards | **in progress** — verified chinook/coho/lingcod profiles → on-device terrain analysis (slope/prominence/adjacency) → scoring engine → ranked spot pins + depth/tide/tactic cards. Needs a run on the Mac to tune |
| **M4** | Tides: prefetch + window strip + spot×tide recs | **in progress** — tide engine (slack / moving-water windows from IWLS prefetch), day tide-strip chart, spot cards show timed windows ("Flood · 1:45–3:45 PM"). Needs `fetch_tides.py --from … --to …` run for your trip dates |
| M5 | Catch log + export | not started |
| M6 | Offline hardening + airplane-mode acceptance test | not started |

## M1 quick start

```bash
# from the repo root, after cloning + checking out the branch:
cd pipeline && ./bootstrap.sh && source .venv/bin/activate
# put NONNA-10 GeoTIFFs (AOI 51.55–51.85 N, 128.35–127.85 W) in ../data/raw/
python3 fetch_bathy.py --source local
python3 make_tiles.py
cd .. && python3 -m http.server 8000   # open http://localhost:8000/pipeline/viewer/
```

See [`pipeline/README.md`](./pipeline/README.md) for the WCS path and full details.

## Open item

The reference prototype (`prototype/hakai-structure-finder.jsx`) is **not yet in the
repo** — drop it in before starting M2, since M2/M3 port its renderer and scoring
logic rather than rewriting them. See [`prototype/README.md`](./prototype/README.md).
