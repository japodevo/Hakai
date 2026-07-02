# Hakai Structure Finder — CLAUDE.md

Offline-first fishing app for the BC Central Coast (Hakai Passage / Calvert Island area).
Reads real bathymetry, auto-detects fish-holding structure (pinnacles, walls, benches,
shelf breaks), scores spots per target species, and pairs them with tide windows.
Everything must work with **zero connectivity** — data is cached before leaving dock.

A working prototype of the terrain-analysis + scoring + chart-rendering engine lives at
`prototype/hakai-structure-finder.jsx` (synthetic grid, React canvas). Port its logic;
don't rewrite it from scratch.

## Hard constraints

- **Offline is non-negotiable.** No cell service at Hakai. App shell + all data tiles +
  tide predictions cached ahead of time. Test in airplane mode before calling anything done.
- **Not for navigation.** CHS NONNA license is non-navigational use only. Show a
  persistent "Not for navigation" notice. Personal use is fine; productizing would
  require CHS licensing — out of scope.
- **Runs on iPhone in a boat**: big touch targets, high-contrast chart, works in
  bright light, GPS via `navigator.geolocation` (works offline — GPS ≠ cell).

## Stack

- **Vite + React PWA** (`vite-plugin-pwa` / Workbox). Fastest path from the prototype;
  installable to home screen; service worker precaches shell + tiles; IndexedDB for the
  catch log. Call `navigator.storage.persist()` on install.
  (Expo/React Native is the fallback if iOS PWA storage proves flaky — decide at M6, not before.)
- **Python 3.11+ / rasterio / GDAL** for the data pipeline (venv, pip).
- Dev machine: MacBook Air, **bash** (not zsh). GitHub: `japodevo`.

## Repo layout

```
hakai-fish/
  CLAUDE.md
  prototype/hakai-structure-finder.jsx   # reference implementation
  pipeline/            # Python: fetch + tile bathymetry, prefetch tides
  app/                 # Vite React PWA
  data/                # generated tiles + manifests (gitignored, committed manifest only)
```

## Data sources (all free, all Canadian government)

### Bathymetry — CHS NONNA-10 (10 m grid)
- Portal (free account required): https://data.chs-shc.ca
- Programmatic WCS endpoint (GeoServer):
  `https://nonna-geoserver.data.chs-shc.ca/geoserver/wcs?request=GetCapabilities`
  (WMS/WMTS also available on the same host)
- Formats: GeoTIFF (preferred), ASCII XYZ. Horizontal datum WGS84; depths to chart datum.
- **AOI bounding box:** 51.55°N–51.85°N, 128.35°W–127.85°W
  (covers Hakai Passage, Pruth Bay, Calvert/Hecate shorelines, adjacent banks).
- NONNA-10 tiles are 0.1° × 0.1°; expect coverage gaps (legacy surveys) — surface them
  in the app as "no modern survey" zones excluded from scoring, exactly like the prototype.

### Bottom composition
- CHS NONNA **Intensity** layer (same portal/GeoServer) — multibeam backscatter,
  proxy for hard rock vs soft sediment.
- CHS **Pacific Seafloor Classification Dataset** (polygons from ~140k samples) as a
  fallback where intensity coverage is missing. Request via chsinfo@dfo-mpo.gc.ca /
  charts.gc.ca data page if not directly downloadable.

### Tides — DFO IWLS REST API
- Base: `https://api-iwls.dfo-mpo.gc.ca` (Swagger at `/swagger-ui/index.html`;
  azure mirror `api.iwls-sine.azure.cloud-nuage.dfo-mpo.gc.ca/api/v1`)
- Resolve nearest station to Pruth Bay (~51.656, -128.123) via the `/stations` endpoint,
  then pull `wlp` (15-min predictions) and `wlp-hilo` (high/low events):
  `GET /api/v1/stations/{id}/data?time-series-code=wlp&from=...&to=...&resolution=FIFTEEN_MINUTES`
- Prefetch the full trip date range + 3 buffer days into a static JSON the app bundles.

## Pipeline spec (`pipeline/`)

1. `fetch_bathy.py` — WCS GetCoverage (or portal-downloaded GeoTIFFs in `data/raw/`)
   for the AOI. Mosaic, reproject to **UTM 9N**, resample to 10 m (offer `--res 20`
   to halve size).
2. `make_tiles.py` — quantize depth to Int16 decimeters, chunk into 512×512 binary
   tiles + `manifest.json` (origin, res, extent, nodata). Gzip. Budget: AOI at 10 m
   ≈ 20–25 MB raw, ~8–12 MB gzipped — fine for a PWA precache; 20 m halves it again.
   Emit a coverage/nodata mask per tile.
3. `fetch_intensity.py` — same flow for the intensity layer; classify to
   rock / gravel / soft thresholds (calibrate visually against known reefs).
4. `fetch_tides.py --from 2026-07-XX --to 2026-07-XX` — IWLS prefetch → `data/tides.json`.

## App spec (`app/`)

- **Chart renderer**: port the prototype's canvas renderer (depth tints, contours,
  hillshade, soundings, coverage hatching) onto real tiles; add pan/zoom
  (pointer events + canvas transform) and a GPS "own-ship" marker.
- **Terrain analysis on device** (port directly from prototype): slope, prominence
  (box-mean via summed-area table), adjacency-to-drop, per-cell bottom type.
  Compute per tile on load; cache results in memory.
- **Scoring engine**: species profiles (chinook / lingcod / rockfish / halibut) with
  weighted components — depth-band gaussian, prominence, slope, flatness, adjacency,
  bottom preference. Peak-picking with min-distance suppression → ranked spots with
  generated rationale + tactic. All already implemented in the prototype; keep the
  profile weights in one editable config file.
- **Tide windows**: strip chart of the day's curve; flag moving-water windows
  (± ~1 h around slack and max-flow periods); per-spot "fish it on X tide" hint
  combining feature type + tide phase.
- **Catch log**: one-tap entry (species, length, method/lure, auto GPS, auto
  tide-phase + depth-under-spot from tiles, timestamp). IndexedDB. Export CSV/JSON.
  Over time, overlay personal catches on the chart.
- **Trip prep screen**: shows what's cached (tiles ✓, tides through date ✓, storage
  persisted ✓) so it's obvious at the dock whether you're ready to go dark.

## Milestones (one Claude Code session each, roughly)

- **M1** Pipeline: real NONNA tiles for the AOI render in a throwaway HTML viewer.
- **M2** App shell: Vite PWA, chart renderer on real tiles, pan/zoom, GPS marker.
- **M3** Scoring on real data: species chips, ranked pins, spot cards, coverage gaps.
- **M4** Tides: prefetch script + window strip + spot×tide recommendations.
- **M5** Catch log + export.
- **M6** Offline hardening: precache manifest, `storage.persist()`, airplane-mode
  test checklist, home-screen install flow. Decide PWA vs Expo here if iOS misbehaves.

## Conventions

- bash-compatible scripts only (`#!/usr/bin/env bash`); Mac has bash as login shell.
- Python: venv at `pipeline/.venv`, `pip install rasterio numpy requests`.
- Keep this repo personal — no work email, no Match content.
- Commit the tile *manifest* but gitignore raw GeoTIFFs and generated tiles.
