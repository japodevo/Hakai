#!/usr/bin/env python3
"""fetch_intensity.py — CHS NONNA Intensity (backscatter) -> bottom-type raster.

Backscatter intensity is a proxy for bottom hardness: high return ≈ rock, low ≈ soft
sediment. This mirrors fetch_bathy.py (same local/WCS input paths, same mosaic +
reproject to UTM 9N) and then classifies each cell into:

    0 = no data     1 = soft (mud/sand)     2 = gravel/mixed     3 = rock/hard

Thresholds are placeholders — CLAUDE.md says calibrate visually against known reefs.
Tune --soft-max / --rock-min after eyeballing the output over spots you already fish.

Output: single-band Uint8 GeoTIFF in UTM 9N, nodata = 0. Tile it with make_tiles.py
using a bottom-type variant, or consume directly in the app's per-cell bottom step.

Requires: rasterio, numpy, requests
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

import hakai_aoi as aoi
# Reuse the exact WCS discovery + fetch machinery from the bathy script.
from fetch_bathy import (list_coverages, describe_coverage, fetch_wcs)

CLASS_NODATA, CLASS_SOFT, CLASS_GRAVEL, CLASS_ROCK = 0, 1, 2, 3


def classify(intensity: np.ndarray, src_nodata: float,
             soft_max: float, rock_min: float) -> np.ndarray:
    out = np.full(intensity.shape, CLASS_NODATA, dtype=np.uint8)
    valid = np.isfinite(intensity) & (intensity != src_nodata)
    v = intensity
    out[valid & (v <= soft_max)] = CLASS_SOFT
    out[valid & (v > soft_max) & (v < rock_min)] = CLASS_GRAVEL
    out[valid & (v >= rock_min)] = CLASS_ROCK
    return out


def build(rasters: list[Path], out_path: Path, res_m: float,
          soft_max: float, rock_min: float) -> None:
    import rasterio
    from rasterio.merge import merge
    from rasterio.warp import calculate_default_transform, reproject, Resampling

    if not rasters:
        raise SystemExit("No intensity rasters. Use --source local (data/raw/) "
                         "or --source wcs with --coverage-id.")

    srcs = [rasterio.open(p) for p in rasters]
    try:
        mosaic, mtransform = merge(srcs, nodata=srcs[0].nodata)
        src_crs, src_nodata = srcs[0].crs, srcs[0].nodata
        band = mosaic[0]
        h, w = band.shape
    finally:
        for s in srcs:
            s.close()

    dst_crs = rasterio.crs.CRS.from_epsg(aoi.UTM_9N_EPSG)
    left, top = mtransform.c, mtransform.f
    right, bottom = left + mtransform.a * w, top + mtransform.e * h
    dst_transform, dw, dh = calculate_default_transform(
        src_crs, dst_crs, w, h, left, bottom, right, top, resolution=res_m)

    warped = np.full((dh, dw), np.nan, dtype="float32")
    reproject(source=band.astype("float32"), destination=warped,
              src_transform=mtransform, src_crs=src_crs, src_nodata=src_nodata,
              dst_transform=dst_transform, dst_crs=dst_crs, dst_nodata=np.nan,
              resampling=Resampling.bilinear)

    classes = classify(warped, np.nan, soft_max, rock_min)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    profile = {"driver": "GTiff", "dtype": "uint8", "count": 1,
               "width": dw, "height": dh, "crs": dst_crs,
               "transform": dst_transform, "nodata": CLASS_NODATA,
               "compress": "deflate", "tiled": True}
    with rasterio.open(out_path, "w", **profile) as d:
        d.write(classes, 1)

    n = classes.size
    for name, val in [("soft", CLASS_SOFT), ("gravel", CLASS_GRAVEL),
                      ("rock", CLASS_ROCK)]:
        pct = 100.0 * int((classes == val).sum()) / n if n else 0.0
        print(f"[intensity] {name:6s} {pct:5.1f}%")
    print(f"[done] {out_path}  {dw}x{dh} @ {res_m} m")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["local", "wcs"], default="local")
    ap.add_argument("--res", type=float, default=aoi.DEFAULT_RES_M)
    ap.add_argument("--raw-dir", type=Path, default=aoi.DATA_DIR / "raw/intensity")
    ap.add_argument("--out", type=Path, default=aoi.DATA_DIR / "derived/bottom_utm9n.tif")
    ap.add_argument("--wcs-url", default=aoi.NONNA_WCS_URL)
    ap.add_argument("--coverage-id", default=None)
    ap.add_argument("--native-epsg", type=int, default=3857)
    ap.add_argument("--axis-x", default="x")
    ap.add_argument("--axis-y", default="y")
    ap.add_argument("--format", dest="fmt", default="image/tiff")
    ap.add_argument("--list-coverages", action="store_true")
    ap.add_argument("--describe", metavar="COVERAGE_ID", default=None)
    ap.add_argument("--soft-max", type=float, default=None,
                    help="intensity <= this => soft (default: 33rd percentile)")
    ap.add_argument("--rock-min", type=float, default=None,
                    help="intensity >= this => rock (default: 66th percentile)")
    args = ap.parse_args()

    if args.list_coverages:
        for cid in list_coverages(args.wcs_url):
            print(cid)
        return
    if args.describe:
        print(describe_coverage(args.wcs_url, args.describe))
        return

    if args.source == "wcs":
        if not args.coverage_id:
            raise SystemExit("--source wcs needs --coverage-id (try --list-coverages).")
        rasters = fetch_wcs(args.wcs_url, args.coverage_id, args.raw_dir,
                            args.native_epsg, args.axis_x, args.axis_y, args.fmt)
    else:
        rasters = sorted(args.raw_dir.glob("*.tif")) + sorted(args.raw_dir.glob("*.tiff"))
        print(f"[local] {len(rasters)} intensity GeoTIFF(s) in {args.raw_dir}")

    # If thresholds weren't given, derive data-driven defaults from the mosaic so the
    # first run produces *something* sensible to eyeball. Do it lazily here to avoid a
    # second mosaic pass in the common (explicit-threshold) case.
    if args.soft_max is None or args.rock_min is None:
        import rasterio
        from rasterio.merge import merge
        if not rasters:
            raise SystemExit("No intensity rasters to derive thresholds from.")
        srcs = [rasterio.open(p) for p in rasters]
        try:
            mosaic, _ = merge(srcs, nodata=srcs[0].nodata)
            nod = srcs[0].nodata
        finally:
            for s in srcs:
                s.close()
        vals = mosaic[0].astype("float32")
        finite = vals[np.isfinite(vals) & (vals != (nod if nod is not None else np.nan))]
        if finite.size:
            p33, p66 = np.percentile(finite, [33, 66])
            if args.soft_max is None:
                args.soft_max = float(p33)
            if args.rock_min is None:
                args.rock_min = float(p66)
            print(f"[intensity] auto thresholds soft<= {args.soft_max:.1f}, "
                  f"rock>= {args.rock_min:.1f} (33rd/66th pct)")
        else:
            args.soft_max = args.soft_max or 0.0
            args.rock_min = args.rock_min or 1.0

    build(rasters, args.out, args.res, args.soft_max, args.rock_min)


if __name__ == "__main__":
    main()
