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


def fetch_wcs(wcs_url: str, coverage_id: str, raw_dir: Path, native_epsg: int,
              axis_x: str, axis_y: str, fmt: str) -> list[Path]:
    """GetCoverage the whole AOI in one request, in the coverage's native CRS.

    One request (not 24 subtiles): the AOI is small (~55x33 km), so a single window
    is fewer round trips and less intermediate disk — reprojection to UTM 9N happens
    locally in build_raster().
    """
    raw_dir.mkdir(parents=True, exist_ok=True)
    xmin, ymin, xmax, ymax = aoi_in_native(native_epsg)
    out = raw_dir / "nonna10_aoi.tif"
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
def build_raster(rasters: list[Path], out_path: Path, res_m: float) -> None:
    import numpy as np
    import rasterio
    from rasterio.merge import merge
    from rasterio.warp import calculate_default_transform, reproject, Resampling

    if not rasters:
        raise SystemExit(
            "No input rasters. Put NONNA-10 GeoTIFFs in data/raw/ (--source local) "
            "or fetch via --source wcs. Nothing to mosaic.")

    srcs = [rasterio.open(p) for p in rasters]
    try:
        # 1) Mosaic in whatever CRS the inputs use (WCS = EPSG:3857; portal export
        #    may be WGS84). Reprojection to UTM 9N happens below regardless.
        mosaic, mosaic_transform = merge(srcs, nodata=srcs[0].nodata)
        src_crs = srcs[0].crs
        src_nodata = srcs[0].nodata
        band = mosaic[0]
        h, w = band.shape
    finally:
        for s in srcs:
            s.close()

    # 2) Compute the UTM 9N transform at the requested ground resolution.
    dst_crs = rasterio.crs.CRS.from_epsg(aoi.UTM_9N_EPSG)
    left = mosaic_transform.c
    top = mosaic_transform.f
    right = left + mosaic_transform.a * w
    bottom = top + mosaic_transform.e * h
    dst_transform, dst_w, dst_h = calculate_default_transform(
        src_crs, dst_crs, w, h, left, bottom, right, top, resolution=res_m)

    dst = np.full((dst_h, dst_w), OUT_NODATA, dtype="float32")
    reproject(
        source=band.astype("float32"),
        destination=dst,
        src_transform=mosaic_transform, src_crs=src_crs,
        src_nodata=src_nodata,
        dst_transform=dst_transform, dst_crs=dst_crs,
        dst_nodata=OUT_NODATA,
        resampling=Resampling.bilinear,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    profile = {
        "driver": "GTiff", "dtype": "float32", "count": 1,
        "width": dst_w, "height": dst_h,
        "crs": dst_crs, "transform": dst_transform,
        "nodata": OUT_NODATA, "compress": "deflate", "predictor": 2,
        "tiled": True, "blockxsize": 512, "blockysize": 512,
    }
    with rasterio.open(out_path, "w", **profile) as d:
        d.write(dst, 1)

    valid = dst[dst != OUT_NODATA]
    cov = 100.0 * valid.size / dst.size if dst.size else 0.0
    print(f"[done] {out_path}  {dst_w}x{dst_h} @ {res_m} m  UTM9N")
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
    ap.add_argument("--raw-dir", type=Path, default=Path("data/raw"))
    ap.add_argument("--out", type=Path, default=Path("data/derived/bathy_utm9n.tif"))
    ap.add_argument("--wcs-url", default=aoi.NONNA_WCS_URL)
    ap.add_argument("--coverage-id", default=None,
                    help="WCS coverageId (discover via --list-coverages)")
    ap.add_argument("--native-epsg", type=int, default=3857,
                    help="coverage native CRS (NONNA GeoServer = 3857 Web Mercator)")
    ap.add_argument("--axis-x", default="x", help="WCS subset axis label for easting")
    ap.add_argument("--axis-y", default="y", help="WCS subset axis label for northing")
    ap.add_argument("--format", dest="fmt", default="image/tiff",
                    help="WCS output format (try image/geotiff if image/tiff is rejected)")
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
        rasters = fetch_wcs(args.wcs_url, args.coverage_id, args.raw_dir,
                            args.native_epsg, args.axis_x, args.axis_y, args.fmt)
    else:
        rasters = sorted(args.raw_dir.glob("*.tif")) + sorted(args.raw_dir.glob("*.tiff"))
        print(f"[local] {len(rasters)} GeoTIFF(s) in {args.raw_dir}")

    build_raster(rasters, args.out, args.res)


if __name__ == "__main__":
    main()
