"""Shared constants and helpers for the Hakai Structure Finder pipeline.

Everything here is source-of-truth for the AOI, projection, and the CHS/DFO
endpoints so the individual fetch scripts stay consistent. Keep it dependency-light
(stdlib + a couple of small helpers) — the heavy geo deps live in the scripts that
actually need them.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# --- Area of interest (from CLAUDE.md) --------------------------------------
# Hakai Passage, Pruth Bay, Calvert/Hecate shorelines, adjacent banks.
#   51.55°N–51.85°N, 128.35°W–127.85°W
AOI_LAT_MIN = 51.55
AOI_LAT_MAX = 51.85
AOI_LON_MIN = -128.35
AOI_LON_MAX = -127.85

# Pruth Bay dock-ish anchor, used to resolve the nearest tide station.
PRUTH_BAY = (51.656, -128.123)  # (lat, lon)

# NONNA-10 native tiling is 0.1° x 0.1°; we subtile WCS requests on the same grid
# to keep individual GetCoverage responses small and to line up with survey seams.
NONNA_TILE_DEG = 0.1

# --- Projection -------------------------------------------------------------
# UTM zone 9N covers ~132°W–126°W — correct for the BC Central Coast.
UTM_9N_EPSG = 32609
WGS84_EPSG = 4326

# Default output raster resolution in metres (CLI can override to 20 to halve size).
DEFAULT_RES_M = 10.0

# --- Depth quantization (make_tiles) ----------------------------------------
# Depths are stored as Int16 decimetres. Sentinel for no-data / no-survey cells.
DEPTH_SCALE = 10          # metres -> decimetres
DEPTH_NODATA_I16 = -32768  # reserved; never a real sounding
TILE_PX = 512              # 512 x 512 cells per tile

# --- Endpoints --------------------------------------------------------------
NONNA_WCS_URL = "https://nonna-geoserver.data.chs-shc.ca/geoserver/wcs"
IWLS_BASE = "https://api-iwls.dfo-mpo.gc.ca/api/v1"
# Azure mirror if the primary is flaky:
IWLS_BASE_MIRROR = "https://api.iwls-sine.azure.cloud-nuage.dfo-mpo.gc.ca/api/v1"


@dataclass(frozen=True)
class BBox:
    """A lon/lat bounding box (WGS84)."""
    lon_min: float
    lat_min: float
    lon_max: float
    lat_max: float

    def __str__(self) -> str:
        return (f"{self.lat_min:.3f}..{self.lat_max:.3f}N, "
                f"{self.lon_min:.3f}..{self.lon_max:.3f}E")


def aoi_bbox() -> BBox:
    return BBox(AOI_LON_MIN, AOI_LAT_MIN, AOI_LON_MAX, AOI_LAT_MAX)


def subtile_bboxes(bbox: BBox, step_deg: float = NONNA_TILE_DEG) -> list[BBox]:
    """Split an AOI into a grid of ``step_deg`` cells, snapped to the 0.1° graticule.

    Snapping to the graticule means adjacent AOIs (or re-runs) reuse the exact same
    request footprints, which keeps the on-disk raw cache stable.
    """
    def snap_down(v: float) -> float:
        return math.floor(v / step_deg) * step_deg

    def snap_up(v: float) -> float:
        return math.ceil(v / step_deg) * step_deg

    lon0, lon1 = snap_down(bbox.lon_min), snap_up(bbox.lon_max)
    lat0, lat1 = snap_down(bbox.lat_min), snap_up(bbox.lat_max)

    out: list[BBox] = []
    lat = lat0
    # Use integer stepping to avoid float drift accumulating across the grid.
    n_lon = round((lon1 - lon0) / step_deg)
    n_lat = round((lat1 - lat0) / step_deg)
    for j in range(n_lat):
        for i in range(n_lon):
            a = BBox(
                lon_min=round(lon0 + i * step_deg, 6),
                lat_min=round(lat0 + j * step_deg, 6),
                lon_max=round(lon0 + (i + 1) * step_deg, 6),
                lat_max=round(lat0 + (j + 1) * step_deg, 6),
            )
            out.append(a)
    return out


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance in km between (lat, lon) points."""
    lat1, lon1 = a
    lat2, lon2 = b
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    h = (math.sin(dphi / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(h))
