# data/

Generated pipeline output. Most of this is **gitignored** (see `.gitignore`) — it's
regenerable from CHS/DFO sources and too heavy for git.

```
raw/            portal-downloaded / WCS-fetched GeoTIFFs           (gitignored)
derived/        mosaicked, reprojected UTM 9N rasters              (gitignored)
tiles/
  manifest.json tile grid + georeferencing metadata               (COMMITTED)
  *.bin.gz      Int16 decimetre depth tiles                        (gitignored)
  *.mask.gz     Uint8 coverage masks                               (gitignored)
tides.json      IWLS prefetch for the trip window                  (committed — small, static)
```

Committing the manifest (and tides.json) but not the tile binaries keeps the repo small
while still recording exactly what the app expects. Regenerate the binaries with
`pipeline/make_tiles.py`.
