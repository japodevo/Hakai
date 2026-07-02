#!/usr/bin/env python3
"""make_tiles.py — quantize the AOI bathymetry raster into gzipped binary tiles.

Reads the UTM 9N GeoTIFF produced by fetch_bathy.py and emits, under data/tiles/:

  <id>.bin.gz    row-major Int16 little-endian, depth in DECIMETRES (metres * 10),
                 nodata = -32768 (no modern survey). 512 x 512 cells per tile.
  <id>.mask.gz   row-major Uint8, 1 = surveyed cell, 0 = no data. (Redundant with the
                 sentinel but cheap, and lets the renderer draw coverage hatching
                 without scanning the whole depth array.)
  manifest.json  origin, resolution, extent, tile grid, nodata, per-tile metadata.

The manifest is committed; the *.bin.gz / *.mask.gz are gitignored (regenerable).

Budget (from CLAUDE.md): AOI at 10 m ≈ 20–25 MB raw, ~8–12 MB gzipped. 20 m halves it.

Requires: rasterio, numpy
"""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path

import numpy as np

import hakai_aoi as aoi


def quantize(depth: np.ndarray, src_nodata: float) -> np.ndarray:
    """metres (float) -> decimetres (Int16) with the tile nodata sentinel."""
    out = np.full(depth.shape, aoi.DEPTH_NODATA_I16, dtype=np.int16)
    valid = np.isfinite(depth) & (depth != src_nodata)
    dm = np.rint(depth[valid] * aoi.DEPTH_SCALE)
    # Clamp to the Int16 range but keep the sentinel reserved.
    dm = np.clip(dm, aoi.DEPTH_NODATA_I16 + 1, 32767)
    out[valid] = dm.astype(np.int16)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in", dest="inp", type=Path,
                    default=Path("data/derived/bathy_utm9n.tif"))
    ap.add_argument("--out-dir", type=Path, default=Path("data/tiles"))
    ap.add_argument("--tile", type=int, default=aoi.TILE_PX)
    ap.add_argument("--layer", default="bathy", help="manifest layer name")
    args = ap.parse_args()

    import rasterio

    if not args.inp.exists():
        raise SystemExit(f"Input raster not found: {args.inp}. Run fetch_bathy.py first.")

    with rasterio.open(args.inp) as src:
        depth = src.read(1).astype("float32")
        transform = src.transform
        crs = src.crs
        src_nodata = src.nodata if src.nodata is not None else -9999.0
        H, W = src.height, src.width

    res_x = transform.a
    res_y = -transform.e            # positive metres/pixel
    origin_x = transform.c          # UTM easting of top-left corner
    origin_y = transform.f          # UTM northing of top-left corner

    q = quantize(depth, src_nodata)
    mask = (q != aoi.DEPTH_NODATA_I16).astype(np.uint8)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    T = args.tile
    n_cols = (W + T - 1) // T
    n_rows = (H + T - 1) // T

    tiles_meta = []
    total_bytes = 0
    for r in range(n_rows):
        for c in range(n_cols):
            y0, y1 = r * T, min((r + 1) * T, H)
            x0, x1 = c * T, min((c + 1) * T, W)
            sub = q[y0:y1, x0:x1]
            sub_mask = mask[y0:y1, x0:x1]
            surveyed = int(sub_mask.sum())
            if surveyed == 0:
                continue  # skip fully-empty tiles — no point precaching blank ocean

            tid = f"{args.layer}_{c}_{r}"
            bin_path = args.out_dir / f"{tid}.bin.gz"
            mask_path = args.out_dir / f"{tid}.mask.gz"
            # little-endian Int16, row-major; tobytes() is C-order (row-major).
            with gzip.open(bin_path, "wb", compresslevel=9) as f:
                f.write(sub.astype("<i2").tobytes())
            with gzip.open(mask_path, "wb", compresslevel=9) as f:
                f.write(sub_mask.tobytes())
            total_bytes += bin_path.stat().st_size + mask_path.stat().st_size

            tiles_meta.append({
                "id": tid, "col": c, "row": r,
                "w": int(x1 - x0), "h": int(y1 - y0),
                # UTM top-left corner of this tile:
                "x": round(origin_x + x0 * res_x, 3),
                "y": round(origin_y - y0 * res_y, 3),
                "surveyed": surveyed,
                "coverage": round(surveyed / sub.size, 4),
                "bin": bin_path.name, "mask": mask_path.name,
            })

    manifest = {
        "layer": args.layer,
        "crs": f"EPSG:{crs.to_epsg()}" if crs and crs.to_epsg() else str(crs),
        "res": [round(res_x, 4), round(res_y, 4)],
        "tileSize": T,
        "grid": {"cols": n_cols, "rows": n_rows},
        "full": {"width": W, "height": H},
        # AOI extent in UTM (top-left origin, y decreases downward):
        "origin": [round(origin_x, 3), round(origin_y, 3)],
        "extent": {
            "xmin": round(origin_x, 3),
            "ymax": round(origin_y, 3),
            "xmax": round(origin_x + W * res_x, 3),
            "ymin": round(origin_y - H * res_y, 3),
        },
        "depth": {"scale": aoi.DEPTH_SCALE, "unit": "decimetre",
                  "nodata": aoi.DEPTH_NODATA_I16, "dtype": "int16-le"},
        "aoiWgs84": {
            "latMin": aoi.AOI_LAT_MIN, "latMax": aoi.AOI_LAT_MAX,
            "lonMin": aoi.AOI_LON_MIN, "lonMax": aoi.AOI_LON_MAX,
        },
        "tiles": tiles_meta,
    }
    (args.out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    surveyed_cells = int(mask.sum())
    print(f"[tiles] {len(tiles_meta)} non-empty tiles, "
          f"{total_bytes/1e6:.1f} MB gzipped")
    print(f"[tiles] coverage {100*surveyed_cells/(H*W):.1f}% of AOI "
          f"({surveyed_cells:,}/{H*W:,} cells surveyed)")
    print(f"[tiles] manifest -> {args.out_dir/'manifest.json'}")


if __name__ == "__main__":
    main()
