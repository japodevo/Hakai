# pipeline/ — bathymetry + tides data prep

Python 3.11+ pipeline that turns CHS NONNA bathymetry + DFO IWLS tides into the static,
offline-ready assets the PWA bundles. Runs on the MacBook Air (bash), not on the boat.

## Setup

```bash
cd pipeline
./bootstrap.sh                     # creates .venv, installs rasterio/numpy/requests
source .venv/bin/activate
```

## M1 flow — bathymetry → tiles → viewer

**1. Get the raster.** Two options:

- **Portal (most reliable).** Log in to https://data.chs-shc.ca (free account),
  export NONNA-10 GeoTIFFs covering the AOI (51.55–51.85 N, 128.35–127.85 W) into
  `../data/raw/`, then:
  ```bash
  python fetch_bathy.py --source local        # mosaic + reproject to UTM 9N @ 10 m
  # python fetch_bathy.py --source local --res 20   # half the size
  ```

- **WCS (no download, best-effort).** The GeoServer coverage id / axis labels vary,
  so discover them first:
  ```bash
  python fetch_bathy.py --list-coverages
  python fetch_bathy.py --describe <coverageId>
  python fetch_bathy.py --source wcs --coverage-id <coverageId> \
      --axis-lat Lat --axis-lon Long
  ```

Output → `../data/derived/bathy_utm9n.tif` (Float32, metres, nodata −9999).

**2. Tile it.**
```bash
python make_tiles.py               # -> ../data/tiles/*.bin.gz + manifest.json
```
Int16 decimetre tiles, 512×512, gzipped, with a per-tile coverage mask. Manifest is
committed; the binaries are gitignored.

**3. View it (M1 acceptance).** From the **repo root**:
```bash
python3 -m http.server 8000
# open http://localhost:8000/pipeline/viewer/
```
You should see the real Hakai seafloor: depth tints where surveyed, hatching where
there's no modern survey. **This is the M1 check** — confirm coverage is real multibeam
over your actual fishing water before building M2+.

## Bottom composition (feeds scoring)

```bash
python fetch_intensity.py --source local     # -> ../data/derived/bottom_utm9n.tif
# thresholds auto-derive from the data; tune with --soft-max / --rock-min after
# eyeballing the output against reefs you already know.
```

## Tides (M4, but the fetch script lives here)

```bash
python fetch_tides.py --from 2026-07-10 --to 2026-07-18   # -> ../data/tides.json
```
Resolves the nearest IWLS station to Pruth Bay, pulls 15-min predictions (`wlp`) +
high/low events (`wlp-hilo`) for the range ± 3 buffer days.

## Notes

- Depths are to **chart datum** and **not for navigation** (CHS NONNA license).
- If `rasterio` tries to compile from source, install GDAL first (`brew install gdal`)
  or use conda-forge. Normally the wheels bundle GDAL and no extra step is needed.
