# app/ — Vite + React PWA (M2+)

Empty until **M2**. This is the installable, offline-first PWA that renders the real
bathymetry tiles from `pipeline/`, runs terrain analysis + scoring on device, shows tide
windows, and keeps a catch log.

Planned stack (see `CLAUDE.md`): Vite + React, `vite-plugin-pwa` / Workbox for
service-worker precache of shell + tiles, IndexedDB for the catch log,
`navigator.storage.persist()` on install, `navigator.geolocation` for the GPS marker.

M2 kickoff (next session, roughly):
```bash
cd app
npm create vite@latest . -- --template react
npm i -D vite-plugin-pwa
```
Then port the prototype's canvas renderer onto the real tiles + manifest and add
pan/zoom and the own-ship marker.
