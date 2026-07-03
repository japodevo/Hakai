#!/usr/bin/env python3
"""fetch_coastline.py — OSM coastline + place labels for the AOI (offline base map).

Queries the public Overpass API for `natural=coastline` ways and named place/natural
nodes inside the AOI, and writes two small optional layers the app draws if present:

  data/coastline.json  { "lines": [ [[lon,lat],...], ... ] }   shoreline polylines
  data/places.json     { "places": [ {name,lon,lat,kind}, ... ] }

This distinguishes land from "no modern survey" on the chart and adds orientation
labels (Hakai Passage, Pruth Bay, …). Run on the Mac (needs internet), then redeploy.

Requires: requests
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import hakai_aoi as aoi

OVERPASS = "https://overpass-api.de/api/interpreter"


def _query(q: str, timeout: int = 90):
    import requests
    r = requests.post(OVERPASS, data={"data": q}, timeout=timeout)
    r.raise_for_status()
    return r.json()


def fetch_coastline(b) -> list[list[list[float]]]:
    bbox = f"{b.lat_min},{b.lon_min},{b.lat_max},{b.lon_max}"
    q = f'[out:json][timeout:80];(way["natural"="coastline"]({bbox}););out geom;'
    data = _query(q)
    lines = []
    for el in data.get("elements", []):
        if el.get("type") == "way" and el.get("geometry"):
            lines.append([[round(p["lon"], 6), round(p["lat"], 6)] for p in el["geometry"]])
    return lines


def fetch_places(b) -> list[dict]:
    bbox = f"{b.lat_min},{b.lon_min},{b.lat_max},{b.lon_max}"
    q = ('[out:json][timeout:80];('
         f'node["place"]({bbox});'
         f'node["natural"~"^(bay|cape|peninsula|strait|reef|rock)$"]["name"]({bbox});'
         ');out;')
    data = _query(q)
    out = []
    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        nm = tags.get("name")
        if nm and el.get("lat") is not None:
            out.append({"name": nm, "lon": round(el["lon"], 6), "lat": round(el["lat"], 6),
                        "kind": tags.get("place") or tags.get("natural") or "place"})
    return out


def main() -> None:
    b = aoi.aoi_bbox()
    print(f"[coast] querying Overpass for AOI {b} …")
    try:
        lines = fetch_coastline(b)
    except Exception as e:  # noqa: BLE001
        print(f"[coast] coastline fetch failed: {e}", file=sys.stderr)
        lines = []
    try:
        places = fetch_places(b)
    except Exception as e:  # noqa: BLE001
        print(f"[coast] places fetch failed: {e}", file=sys.stderr)
        places = []

    aoi.DATA_DIR.mkdir(parents=True, exist_ok=True)
    (aoi.DATA_DIR / "coastline.json").write_text(json.dumps({"lines": lines}))
    (aoi.DATA_DIR / "places.json").write_text(json.dumps({"places": places}))
    print(f"[coast] {len(lines)} coastline segments -> data/coastline.json")
    print(f"[coast] {len(places)} named places -> data/places.json")
    if not lines:
        print("[coast] no coastline returned — try again (Overpass is rate-limited) "
              "or check the AOI.", file=sys.stderr)


if __name__ == "__main__":
    main()
