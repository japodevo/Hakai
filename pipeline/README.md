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
  python3 fetch_bathy.py --source local        # mosaic + reproject to UTM 9N @ 10 m
  # python3 fetch_bathy.py --source local --res 20   # half the size
  ```

- **WCS (no download, no account).** Confirmed working against the NONNA GeoServer,
  which serves NONNA-10 in EPSG:3857 (Web Mercator). List the layers, then fetch the
  whole AOI in one request:
  ```bash
  python3 fetch_bathy.py --list-coverages
  # -> nonna__NONNA 10 Coverage   (the 10 m grid)
  #    nonna__NONNA 100 Coverage  (coarser 100 m)
  python3 fetch_bathy.py --source wcs --coverage-id "nonna__NONNA 10 Coverage"
  ```
  Defaults assume the 3857 / `x`,`y` axis layout. If a differently-configured server
  rejects the request, inspect it with `--describe "<coverageId>"` and override
  `--native-epsg` / `--axis-x` / `--axis-y` / `--format image/geotiff`.

Output → `../data/derived/bathy_utm9n.tif` (Float32, metres, nodata −9999).

**2. Tile it.**
```bash
python3 make_tiles.py              # -> ../data/tiles/*.bin.gz + manifest.json
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
python3 fetch_intensity.py --source local    # -> ../data/derived/bottom_utm9n.tif
# thresholds auto-derive from the data; tune with --soft-max / --rock-min after
# eyeballing the output against reefs you already know.
```

## Tides (M4, but the fetch script lives here)

```bash
python3 fetch_tides.py --from 2026-07-10 --to 2026-07-18   # -> ../data/tides.json
```
Resolves the nearest IWLS station to Pruth Bay, pulls 15-min predictions (`wlp`) +
high/low events (`wlp-hilo`) for the range ± 3 buffer days.

## Notes

- Depths are to **chart datum** and **not for navigation** (CHS NONNA license).
- If `rasterio` tries to compile from source, install GDAL first (`brew install gdal`)
  or use conda-forge. Normally the wheels bundle GDAL and no extra step is needed.
