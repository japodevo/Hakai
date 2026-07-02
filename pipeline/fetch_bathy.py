#!/usr/bin/env python3
"""fetch_bathy.py — build the AOI bathymetry raster for Hakai Structure Finder.

Two input paths (pick with --source):

  --source local  (default, most reliable)
      Drop portal-downloaded GeoTIFFs into data/raw/ (from https://data.chs-shc.ca,
      NONNA-10, GeoTIFF export). This script mosaics them, reprojects to UTM 9N, and
      resamples to the target resolution. This is the path that always works — the
      portal export needs a free account but no scripting.

  --source wcs   (best-effort, no account, no manual download)
      Programmatic GetCoverage against the NONNA GeoServer, subtiled on the native
      0.1° grid across the AOI. The exact coverageId and subset axis labels vary by
      GeoServer config, so discover them first:

          python fetch_bathy.py --list-coverages
          python fetch_bathy.py --describe <coverageId>

      then re-run with --coverage-id / --axis-lon / --axis-lat as needed.

Output: a single-band Float32 GeoTIFF in UTM 9N, depths in metres (positive down to
chart datum, matching NONNA), nodata = -9999. Feed it to make_tiles.py.

Requires: rasterio, numpy, requests  (see requirements.txt)
"""

from __future__ import annotations

import argparse
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import hakai_aoi as aoi

OUT_NODATA = -9999.0


# --------------------------------------------------------------------------- #
# WCS discovery + fetch (best-effort)                                         #
# --------------------------------------------------------------------------- #
def _get(url: str, params: dict, timeout: int = 120):
    import requests
    r = requests.get(url, params=params, timeout=timeout)
    r.raise_for_status()
    return r


def list_coverages(wcs_url: str) -> list[str]:
    """Print + return coverage ids advertised by GetCapabilities."""
    r = _get(wcs_url, {"service": "WCS", "version": "2.0.1",
                       "request": "GetCapabilities"})
    root = ET.fromstring(r.content)
    ids: list[str] = []
    # CoverageId lives under wcs:Contents/wcs:CoverageSummary/wcs:CoverageId,
    # namespace-agnostic match so we don't hard-code the GeoServer NS URIs.
    for el in root.iter():
        if el.tag.rsplit("}", 1)[-1] == "CoverageId" and el.text:
            ids.append(el.text.strip())
    return ids


def describe_coverage(wcs_url: str, coverage_id: str) -> str:
    r = _get(wcs_url, {"service": "WCS", "version": "2.0.1",
                       "request": "DescribeCoverage", "coverageId": coverage_id})
    return r.text


def aoi_in_native(native_epsg: int) -> tuple[float, float, float, float]:
    """Project the AOI lon/lat corners into the coverage's native CRS.

    The NONNA GeoServer serves NONNA-10 in EPSG:3857 (Web Mercator, axes 'x y'
    in metres), so WCS subsets have to be given in native metres, not lat/long.
    """
    from rasterio.warp import transform
    b = aoi.aoi_bbox()
    xs, ys = transform(f"EPSG:{aoi.WGS84_EPSG}", f"EPSG:{native_epsg}",
                       [b.lon_min, b.lon_max, b.lon_min, b.lon_max],
                       [b.lat_min, b.lat_min, b.lat_max, b.lat_max])
    return min(xs), min(ys), max(xs), max(ys)


def fetch_wcs(wcs_url: str, coverage_id: str, out_path: Path, native_epsg: int,
              axis_x: str, axis_y: str, fmt: str) -> list[Path]:
    """GetCoverage the whole AOI in one request, in the coverage's native CRS.

    One request (not 24 subtiles): the AOI is small (~55x33 km), so a single window
    is fewer round trips and less intermediate disk — reprojection to UTM 9N happens
    locally in build_raster().
    """
    out = out_path
    out.parent.mkdir(parents=True, exist_ok=True)
    xmin, ymin, xmax, ymax = aoi_in_native(native_epsg)
    if out.exists() and out.stat().st_size > 0:
        print(f"[wcs] reusing cached {out} ({out.stat().st_size/1e6:.1f} MB) — "
              f"delete it to re-fetch")
        return [out]
    params = {
        "service": "WCS", "version": "2.0.1", "request": "GetCoverage",
        "coverageId": coverage_id, "format": fmt,
        # Native-CRS trim: values are EPSG:3857 metres, axis labels 'x'/'y'.
        "subset": [f"{axis_x}({xmin},{xmax})", f"{axis_y}({ymin},{ymax})"],
    }
    print(f"[wcs] GetCoverage {coverage_id} over AOI "
          f"x[{xmin:.0f},{xmax:.0f}] y[{ymin:.0f},{ymax:.0f}] EPSG:{native_epsg}")
    r = _get(wcs_url, params)
    ctype = r.headers.get("content-type", "")
    if "xml" in ctype.lower() or "html" in ctype.lower():
        # GeoServer returns an ExceptionReport (XML) on error — surface it.
        raise SystemExit(f"[wcs] GeoServer error:\n{r.text[:1200]}")
    out.write_bytes(r.content)
    print(f"[wcs] wrote {out} ({len(r.content)/1e6:.1f} MB)")
    return [out]


# --------------------------------------------------------------------------- #
# Mosaic + reproject + resample                                               #
# --------------------------------------------------------------------------- #
def _normalized_source(path, np, rasterio):
    """Open a raster and return an in-memory copy whose nodata is a *representable*
    sentinel (OUT_NODATA).

    The NONNA WCS coverage tags nodata as FLT_MAX (3.4e38), which rasterio.merge
    refuses to handle ("cannot safely be represented in float32") and silently
    zeroes the whole mosaic. We mask nodata ourselves — FLT_MAX, the declared
    nodata, and any non-finite — and rewrite it to OUT_NODATA before merging.
    """
    from rasterio.io import MemoryFile
    with rasterio.open(path) as src:
        a = src.read(1).astype("float32")
        profile = src.profile
    mask = ~np.isfinite(a) | (np.abs(a) >= 1e30)
    nd = profile.get("nodata")
    if nd is not None and abs(nd) < 1e30:
        mask |= (a == np.float32(nd))
    a[mask] = OUT_NODATA
    profile.update(dtype="float32", nodata=OUT_NODATA, count=1)
    memfile = MemoryFile()
    ds = memfile.open(**profile)
    ds.write(a, 1)
    return memfile, ds


def aoi_utm_grid(res_m: float):
    """Canonical UTM 9N target grid for the AOI, snapped to the resolution.

    Every source reprojects onto *this exact grid* so tiers line up cell-for-cell
    and the output extent is deterministic (independent of each source's own extent).
    Returns (transform, width, height, crs).
    """
    import math
    import rasterio
    from rasterio.transform import Affine
    from rasterio.warp import transform_bounds
    dst_crs = rasterio.crs.CRS.from_epsg(aoi.UTM_9N_EPSG)
    left, bottom, right, top = transform_bounds(
        f"EPSG:{aoi.WGS84_EPSG}", dst_crs,
        aoi.AOI_LON_MIN, aoi.AOI_LAT_MIN, aoi.AOI_LON_MAX, aoi.AOI_LAT_MAX)
    left = math.floor(left / res_m) * res_m
    bottom = math.floor(bottom / res_m) * res_m
    right = math.ceil(right / res_m) * res_m
    top = math.ceil(top / res_m) * res_m
    w = int(round((right - left) / res_m))
    h = int(round((top - bottom) / res_m))
    return Affine(res_m, 0, left, 0, -res_m, top), w, h, dst_crs


def warp_to_grid(rasters: list[Path], grid, sign: str = "auto"):
    """Normalize + mosaic + sign-fix a set of source rasters, reprojected onto ``grid``.

    Returns a float32 array (nodata = OUT_NODATA) with positive-down depth.
    """
    import numpy as np
    import rasterio
    from rasterio.merge import merge
    from rasterio.warp import reproject, Resampling
    dst_transform, dst_w, dst_h, dst_crs = grid

    handles = [_normalized_source(p, np, rasterio) for p in rasters]
    memfiles = [m for m, _ in handles]
    srcs = [d for _, d in handles]
    try:
        mosaic, mosaic_transform = merge(srcs, nodata=OUT_NODATA)
        src_crs = srcs[0].crs
        band = mosaic[0].astype("float32")
    finally:
        for s in srcs:
            s.close()
        for m in memfiles:
            m.close()

    # Sign convention: NONNA WCS returns *elevation* (negative = below datum); the app
    # wants positive-down depth. 'auto' flips when the surveyed median is negative.
    valid = band != OUT_NODATA
    if valid.any():
        med = float(np.median(band[valid]))
        if sign == "elevation" or (sign == "auto" and med < 0):
            band[valid] = -band[valid]
            print(f"[bathy] flipped elevation->depth (median was {med:.1f} m)")

    dst = np.full((dst_h, dst_w), OUT_NODATA, dtype="float32")
    reproject(source=band, destination=dst,
              src_transform=mosaic_transform, src_crs=src_crs, src_nodata=OUT_NODATA,
              dst_transform=dst_transform, dst_crs=dst_crs, dst_nodata=OUT_NODATA,
              resampling=Resampling.bilinear)
    return dst


def write_gtiff(path: Path, arr, transform, crs, dtype="float32", nodata=OUT_NODATA):
    import rasterio
    path.parent.mkdir(parents=True, exist_ok=True)
    profile = {"driver": "GTiff", "dtype": dtype, "count": 1,
               "width": arr.shape[1], "height": arr.shape[0],
               "crs": crs, "transform": transform, "nodata": nodata,
               "compress": "deflate", "tiled": True,
               "blockxsize": 512, "blockysize": 512}
    with rasterio.open(path, "w", **profile) as d:
        d.write(arr.astype(dtype), 1)


def build_raster(rasters: list[Path], out_path: Path, res_m: float,
                 sign: str = "auto") -> None:
    if not rasters:
        raise SystemExit(
            "No input rasters. Put NONNA-10 GeoTIFFs in data/raw/ (--source local) "
            "or fetch via --source wcs. Nothing to mosaic.")
    grid = aoi_utm_grid(res_m)
    dst = warp_to_grid(rasters, grid, sign)
    transform, w, h, crs = grid
    write_gtiff(out_path, dst, transform, crs)

    valid = dst[dst != OUT_NODATA]
    cov = 100.0 * valid.size / dst.size if dst.size else 0.0
    print(f"[done] {out_path}  {w}x{h} @ {res_m} m  UTM9N")
    if valid.size:
        print(f"[done] depth range {valid.min():.1f}..{valid.max():.1f} m, "
              f"coverage {cov:.1f}% of AOI (rest = no modern survey)")
    else:
        print("[warn] no valid depth cells — check inputs / nodata handling")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["local", "wcs"], default="local")
    ap.add_argument("--res", type=float, default=aoi.DEFAULT_RES_M,
                    help="output resolution in metres (10 default, 20 halves size)")
    ap.add_argument("--raw-dir", type=Path, default=aoi.DATA_DIR / "raw")
    ap.add_argument("--out", type=Path, default=aoi.DATA_DIR / "derived/bathy_utm9n.tif")
    ap.add_argument("--wcs-url", default=aoi.NONNA_WCS_URL)
    ap.add_argument("--coverage-id", default=None,
                    help="WCS coverageId (discover via --list-coverages)")
    ap.add_argument("--native-epsg", type=int, default=3857,
                    help="coverage native CRS (NONNA GeoServer = 3857 Web Mercator)")
    ap.add_argument("--axis-x", default="x", help="WCS subset axis label for easting")
    ap.add_argument("--axis-y", default="y", help="WCS subset axis label for northing")
    ap.add_argument("--format", dest="fmt", default="image/tiff",
                    help="WCS output format (try image/geotiff if image/tiff is rejected)")
    ap.add_argument("--sign", choices=["auto", "depth", "elevation"], default="auto",
                    help="'elevation' (NONNA WCS, negative=underwater) is flipped to "
                         "positive-down depth; 'depth' left as-is; 'auto' decides by "
                         "the sign of the median")
    ap.add_argument("--list-coverages", action="store_true")
    ap.add_argument("--describe", metavar="COVERAGE_ID", default=None)
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
            raise SystemExit("--source wcs needs --coverage-id "
                             "(run --list-coverages first).")
        rasters = fetch_wcs(args.wcs_url, args.coverage_id,
                            args.raw_dir / "nonna10_aoi.tif",
                            args.native_epsg, args.axis_x, args.axis_y, args.fmt)
    else:
        rasters = sorted(args.raw_dir.glob("*.tif")) + sorted(args.raw_dir.glob("*.tiff"))
        print(f"[local] {len(rasters)} GeoTIFF(s) in {args.raw_dir}")

    build_raster(rasters, args.out, args.res, args.sign)


if __name__ == "__main__":
    main()
