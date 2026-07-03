#!/usr/bin/env python3
"""find_current_stations.py — probe DFO IWLS for CURRENT (not water-level) stations
near Hakai Passage.

The app currently infers current timing from tide *height* (with a fixed ~40 min
slack-lag correction). If IWLS carries real current predictions (time-series codes
like 'wcp' / 'wcs' — water current prediction/speed) for a station near the Pass,
we could replace the inference with measured predictions.

Run from anywhere with internet (e.g. the GitHub Actions runner — the dev sandbox
can't reach DFO). Read-only; prints a report, writes nothing.

Usage:
  python find_current_stations.py [--radius-km 150] [--max-stations 12]
"""

from __future__ import annotations

import argparse
import sys

import hakai_aoi as aoi

CURRENT_CODES = {"wcp", "wcs", "wcd", "wcsp", "wcp1", "wcp-slack"}  # known/guessed current-series codes


def _get(base: str, path: str, params: dict | None = None, timeout: int = 60):
    import requests
    r = requests.get(base + path, params=params or {}, timeout=timeout)
    r.raise_for_status()
    return r.json()


def pick_base() -> str:
    import requests
    for base in (aoi.IWLS_BASE, aoi.IWLS_BASE_MIRROR):
        try:
            requests.get(base + "/stations", timeout=20).raise_for_status()
            return base
        except Exception as e:  # noqa: BLE001
            print(f"[currents] base {base} unreachable: {e}", file=sys.stderr)
    raise SystemExit("No IWLS base reachable.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--radius-km", type=float, default=150.0)
    ap.add_argument("--max-stations", type=int, default=12)
    args = ap.parse_args()

    base = pick_base()
    stations = _get(base, "/stations")
    near = []
    for s in stations:
        lat, lon = s.get("latitude"), s.get("longitude")
        if lat is None or lon is None:
            continue
        km = aoi.haversine_km(aoi.PRUTH_BAY, (lat, lon))
        if km <= args.radius_km:
            near.append((km, s))
    near.sort(key=lambda x: x[0])
    print(f"[currents] {len(near)} station(s) within {args.radius_km:.0f} km of Pruth Bay; "
          f"checking series codes on the nearest {min(len(near), args.max_stations)}")

    hits = 0
    for km, s in near[: args.max_stations]:
        sid, name = s.get("id"), s.get("officialName")
        try:
            meta = _get(base, f"/stations/{sid}/metadata")
            codes = sorted({ts.get("code") for ts in meta.get("timeSeries", []) if ts.get("code")})
        except Exception as e:  # noqa: BLE001
            print(f"  {km:6.1f} km  {name}: metadata failed ({e})")
            continue
        cur = [c for c in codes if c in CURRENT_CODES or "wc" in (c or "")]
        flag = "  << CURRENT SERIES!" if cur else ""
        print(f"  {km:6.1f} km  {name} ({s.get('code')}): {codes}{flag}")
        hits += bool(cur)

    if hits:
        print(f"[currents] RESULT: {hits} nearby station(s) advertise current series — "
              f"worth wiring real current predictions into the app.")
    else:
        print("[currents] RESULT: no current-prediction series found nearby — the app's "
              "height-derived windows (with slack-lag correction) remain the best available.")


if __name__ == "__main__":
    main()
