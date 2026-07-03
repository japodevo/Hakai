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

### Tiered fill (NONNA-10 + NONNA-100)

NONNA-10 is patchy (~59% of the AOI here). To stop gaps being black holes, build a
**best-available mosaic** — NONNA-10 wins per cell, NONNA-100 fills the rest — with a
per-cell *source* layer so coarse fill is flagged low-confidence and kept out of
structure scoring:

```bash
python3 build_bathy.py             # -> derived/bathy_utm9n.tif + bathy_source_utm9n.tif
python3 make_tiles.py              # now also emits *.src.gz + a source legend
```

`build_bathy.py` reuses the cached NONNA-10 download and fetches NONNA-100 from the
same WCS (no extra account). The viewer desaturates NONNA-100 cells and the hover
readout names the source + confidence. Higher-fidelity gap fill (CHS ENC charted
soundings/contours) is the planned next tier.

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

## Base map — coastline + place labels (optional)

```bash
python3 fetch_coastline.py     # -> ../data/coastline.json + ../data/places.json
```
Pulls OSM `natural=coastline` ways + named place/natural nodes for the AOI (Overpass
API). The app draws the shoreline outline + labels if these files are present, so land
is distinguishable from "no modern survey" water. Re-run + redeploy to refresh.

## Notes

- Depths are to **chart datum** and **not for navigation** (CHS NONNA license).
- If `rasterio` tries to compile from source, install GDAL first (`brew install gdal`)
  or use conda-forge. Normally the wheels bundle GDAL and no extra step is needed.
