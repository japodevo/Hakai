#!/usr/bin/env python3
"""build_bathy.py — tiered best-available bathymetry for the AOI.

Stacks bathymetry sources by fidelity onto one canonical UTM 9N grid. Each cell
takes the highest-fidelity source that has data; a parallel 'source' raster records
which source won, so the app can flag low-confidence fill and the scoring engine can
restrict structure detection to the high-res tier.

Tiers (highest fidelity first):
  1  NONNA-10   (~10 m)   resolves structure; the only tier scoring should trust
  2  NONNA-100  (~100 m)  coarse fill so gaps aren't black holes (LOW confidence)
  (CHS ENC charted soundings/contours will slot in between these in a later pass.)

Both source layers come from the same CHS NONNA GeoServer (WCS), so no extra account
or license beyond what NONNA-10 already needs. Run fetch_bathy.py's WCS path once and
this reuses the cached NONNA-10 download; NONNA-100 is fetched here if missing.

Outputs (feed make_tiles.py):
  data/derived/bathy_utm9n.tif         Float32 depth (m, positive down), nodata -9999
  data/derived/bathy_source_utm9n.tif  Uint8 source per cell (0 none / 1 NONNA-10 / 2 NONNA-100)

Requires: rasterio, numpy, requests
"""

from __future__ import annotations

import argparse
from pathlib import Path

import hakai_aoi as aoi
from fetch_bathy import (fetch_wcs, aoi_utm_grid, warp_to_grid, write_gtiff,
                         OUT_NODATA)

# Per-cell source codes (also written into the manifest legend by make_tiles.py).
SRC_NONE, SRC_NONNA10, SRC_NONNA100 = 0, 1, 2

TIERS = [
    {"code": SRC_NONNA10, "name": "NONNA-10", "conf": "high",
     "coverage": "nonna__NONNA 10 Coverage",
     "raw": aoi.DATA_DIR / "raw" / "nonna10_aoi.tif"},
    {"code": SRC_NONNA100, "name": "NONNA-100", "conf": "low",
     "coverage": "nonna__NONNA 100 Coverage",
     "raw": aoi.DATA_DIR / "raw" / "nonna100_aoi.tif"},
]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--res", type=float, default=aoi.DEFAULT_RES_M,
                    help="output resolution in metres (10 default, 20 halves size)")
    ap.add_argument("--wcs-url", default=aoi.NONNA_WCS_URL)
    ap.add_argument("--out", type=Path,
                    default=aoi.DATA_DIR / "derived/bathy_utm9n.tif")
    ap.add_argument("--source-out", type=Path,
                    default=aoi.DATA_DIR / "derived/bathy_source_utm9n.tif")
    args = ap.parse_args()

    import numpy as np

    grid = aoi_utm_grid(args.res)
    transform, w, h, crs = grid
    depth = np.full((h, w), OUT_NODATA, dtype="float32")
    source = np.zeros((h, w), dtype="uint8")

    # Fill from LOWEST fidelity to HIGHEST so higher tiers overwrite the coarse fill.
    for tier in reversed(TIERS):
        raw: Path = tier["raw"]
        if not (raw.exists() and raw.stat().st_size > 0):
            print(f"[build] fetching {tier['name']} via WCS -> {raw.name}")
            fetch_wcs(args.wcs_url, tier["coverage"], raw,
                      3857, "x", "y", "image/tiff")
        arr = warp_to_grid([raw], grid, sign="auto")
        m = arr != OUT_NODATA
        depth[m] = arr[m]
        source[m] = tier["code"]
        print(f"[build] {tier['name']:9s} ({tier['conf']:>4} conf) "
              f"covers {100 * m.mean():.1f}% of the AOI grid")

    write_gtiff(args.out, depth, transform, crs)
    write_gtiff(args.source_out, source, transform, crs, dtype="uint8", nodata=0)

    filled = source > 0
    hi = source == SRC_NONNA10
    fill = filled & ~hi
    print(f"[build] final coverage {100 * filled.mean():.1f}%  "
          f"= {100 * hi.mean():.1f}% NONNA-10 (structure-grade) "
          f"+ {100 * fill.mean():.1f}% NONNA-100 fill (low conf)")
    dv = depth[filled]
    if dv.size:
        print(f"[build] depth range {dv.min():.1f}..{dv.max():.1f} m")
    print(f"[build] depth  -> {args.out}")
    print(f"[build] source -> {args.source_out}")


if __name__ == "__main__":
    main()
