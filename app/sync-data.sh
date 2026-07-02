#!/usr/bin/env bash
# Copy the pipeline's generated tiles (+ tides) into the app's public/ so Vite
# serves them in dev and the PWA precaches them in the build. The data is
# gitignored and regenerable — run the pipeline (build_bathy.py + make_tiles.py)
# first. Invoked automatically by `npm run dev` / `npm run build`.
set -euo pipefail
cd "$(dirname "$0")"

SRC="../data"
DST="public/data"
mkdir -p "$DST"

if [ -d "$SRC/tiles" ]; then
  rm -rf "$DST/tiles"
  cp -R "$SRC/tiles" "$DST/tiles"
  n=$(ls "$DST/tiles" | wc -l | tr -d ' ')
  echo "[sync-data] tiles -> $DST/tiles ($n files)"
else
  echo "[sync-data] WARNING: $SRC/tiles missing — run build_bathy.py + make_tiles.py" >&2
fi

if [ -f "$SRC/tides.json" ]; then
  cp "$SRC/tides.json" "$DST/tides.json"
  echo "[sync-data] tides.json synced"
fi
