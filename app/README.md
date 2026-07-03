# app/ — Vite + React PWA (M2)

The installable, offline-first chart app. Renders the pipeline's real bathy tiles,
pans/zooms, shows a GPS own-ship marker, and (next milestones) scores structure, shows
tide windows, and logs catches.

## Prerequisites

1. **Generate the data first** (see `../pipeline/`): `build_bathy.py` + `make_tiles.py`
   must have produced `../data/tiles/`. `sync-data.sh` copies it into `public/data/`.
2. **Node 18+**. Installing pulls ~200–300 MB of `node_modules` — make sure you have
   the disk headroom (the pipeline Mac was tight).

## Run

```bash
cd app
npm install
npm run dev            # http://localhost:5173  (also on your phone via the LAN URL Vite prints)
```

`npm run dev` runs `sync-data.sh` first, so regenerate + re-sync whenever the tiles
change. To test the **offline / installable** build:

```bash
npm run build && npm run preview
# open the preview URL, then toggle airplane mode / DevTools "Offline" — it still loads
```

## Deploy for offline use on the phone (GitHub Pages)

iOS only installs a PWA / caches for offline from an **HTTPS** origin — the Mac's
`http://192.168.x.x` LAN URL won't do it. GitHub Pages gives free HTTPS. The bathy
tiles are generated locally, so build+deploy from the Mac (CI has no tiles):

```bash
cd app
npm install           # first time (adds gh-pages)
npm run deploy        # builds (bundles tiles) + pushes dist/ to the gh-pages branch
```

One-time repo setup: **GitHub → repo Settings → Pages → Source: "Deploy from a
branch" → Branch: `gh-pages` / `/ (root)`**. After ~1 min the app is live at:

```
https://japodevo.github.io/Hakai/
```

On the iPhone: open that URL in **Safari → Share → Add to Home Screen**. The service
worker precaches the shell + all tiles; then toggle airplane mode to confirm it opens
offline. (`base: './'` keeps asset paths working under the `/Hakai/` subpath; if the
offline install misbehaves on iOS, switch to a root-domain host like Cloudflare Pages.)

## What's here (M2)

- `src/chart/ChartCanvas.jsx` — canvas renderer: pre-renders each tile, pans/zooms via
  pointer + wheel + pinch, draws the GPS marker, tap-to-read depth/position/source.
- `src/chart/proj.js` — UTM 9N ↔ WGS84 (verified round-trip) + depth colormap.
- `src/chart/tiles.js` — loads/gunzips tiles, applies low-confidence fill shading.
- `src/chart/useGeolocation.js` — GPS watch (works offline).
- PWA: `vite-plugin-pwa` precaches shell + all tiles; `storage.persist()` on load.

## Not yet (later milestones)

M3 scoring + spot pins, M4 tide windows, M5 catch log, M6 offline hardening + the
airplane-mode acceptance test. The richer renderer bits (hillshade, contours, soundings)
port from `../prototype/` once it's added.
