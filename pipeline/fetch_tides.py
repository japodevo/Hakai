#!/usr/bin/env python3
"""fetch_tides.py — prefetch DFO IWLS tide predictions into data/tides.json.

Resolves the nearest IWLS station to Pruth Bay, then pulls:
  * wlp       15-minute water-level predictions (the strip-chart curve)
  * wlp-hilo  high/low events (slack markers)
for the trip date range plus a buffer, and writes one static JSON the app bundles so
tides work with zero connectivity.

Usage:
  python fetch_tides.py --from 2026-07-10 --to 2026-07-18
  python fetch_tides.py --from 2026-07-10 --to 2026-07-18 --buffer 3 --station-id 5cebf1e...

Requires: requests
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import hakai_aoi as aoi


def _iso_z(d: dt.datetime) -> str:
    return d.replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def _get(base: str, path: str, params: dict | None = None, timeout: int = 60):
    import requests
    r = requests.get(base + path, params=params or {}, timeout=timeout)
    r.raise_for_status()
    return r.json()


def pick_base() -> str:
    """Return the first IWLS base that answers /stations, primary then azure mirror."""
    import requests
    for base in (aoi.IWLS_BASE, aoi.IWLS_BASE_MIRROR):
        try:
            requests.get(base + "/stations", timeout=20).raise_for_status()
            return base
        except Exception as e:  # noqa: BLE001
            print(f"[tides] base {base} unreachable: {e}", file=sys.stderr)
    raise SystemExit("No IWLS base reachable. Check connectivity and try again.")


def nearest_station(base: str) -> dict:
    stations = _get(base, "/stations")
    best, best_km = None, 1e9
    for s in stations:
        lat, lon = s.get("latitude"), s.get("longitude")
        if lat is None or lon is None:
            continue
        d = aoi.haversine_km(aoi.PRUTH_BAY, (lat, lon))
        if d < best_km:
            best, best_km = s, d
    if not best:
        raise SystemExit("No stations returned coordinates from IWLS.")
    print(f"[tides] nearest station to Pruth Bay: "
          f"{best.get('officialName')} ({best.get('code')}) "
          f"id={best.get('id')} @ {best_km:.1f} km")
    return best


def station_series_codes(base: str, station_id: str) -> set[str]:
    """Codes available for a station (best-effort; empty set if metadata shape varies)."""
    try:
        meta = _get(base, f"/stations/{station_id}/metadata")
        return {ts.get("code") for ts in meta.get("timeSeries", []) if ts.get("code")}
    except Exception:  # noqa: BLE001
        return set()


def fetch_series(base: str, station_id: str, code: str,
                 start: dt.datetime, end: dt.datetime,
                 resolution: str | None) -> list[dict]:
    """Pull a time series in <=7-day chunks (IWLS caps the per-request window)."""
    out: list[dict] = []
    cur = start
    step = dt.timedelta(days=7)
    while cur < end:
        chunk_end = min(cur + step, end)
        params = {"time-series-code": code,
                  "from": _iso_z(cur), "to": _iso_z(chunk_end)}
        if resolution:
            params["resolution"] = resolution
        try:
            data = _get(base, f"/stations/{station_id}/data", params)
            for row in data:
                t = row.get("eventDate") or row.get("timestamp")
                v = row.get("value")
                if t is not None and v is not None:
                    out.append({"t": t, "v": v})
        except Exception as e:  # noqa: BLE001
            print(f"[tides] {code} {_iso_z(cur)}..{_iso_z(chunk_end)} failed: {e}",
                  file=sys.stderr)
        cur = chunk_end
    return out


def mark_hilo(hilo: list[dict]) -> list[dict]:
    """Tag each hi/lo event as 'high' or 'low' by comparing to its neighbours."""
    for i, e in enumerate(hilo):
        prev_v = hilo[i - 1]["v"] if i > 0 else None
        next_v = hilo[i + 1]["v"] if i < len(hilo) - 1 else None
        neigh = [x for x in (prev_v, next_v) if x is not None]
        e["type"] = "high" if neigh and e["v"] >= max(neigh) else "low"
    return hilo


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--from", dest="date_from", required=True, help="YYYY-MM-DD")
    ap.add_argument("--to", dest="date_to", required=True, help="YYYY-MM-DD")
    ap.add_argument("--buffer", type=int, default=3, help="buffer days each side")
    ap.add_argument("--station-id", default=None, help="skip nearest-station lookup")
    ap.add_argument("--out", type=Path, default=aoi.DATA_DIR / "tides.json")
    args = ap.parse_args()

    d0 = dt.datetime.strptime(args.date_from, "%Y-%m-%d")
    d1 = dt.datetime.strptime(args.date_to, "%Y-%m-%d") + dt.timedelta(days=1)
    start = d0 - dt.timedelta(days=args.buffer)
    end = d1 + dt.timedelta(days=args.buffer)

    base = pick_base()
    if args.station_id:
        station = {"id": args.station_id, "code": None, "officialName": None,
                   "latitude": None, "longitude": None}
    else:
        station = nearest_station(base)
    sid = station["id"]

    codes = station_series_codes(base, sid)
    if codes and "wlp" not in codes:
        print(f"[tides] warning: station advertises {sorted(codes)} — 'wlp' not listed; "
              f"trying anyway.", file=sys.stderr)

    print(f"[tides] range {_iso_z(start)} .. {_iso_z(end)}")
    wlp = fetch_series(base, sid, "wlp", start, end, "FIFTEEN_MINUTES")
    hilo = mark_hilo(fetch_series(base, sid, "wlp-hilo", start, end, None))

    payload = {
        "station": {"id": sid, "code": station.get("code"),
                    "name": station.get("officialName"),
                    "lat": station.get("latitude"), "lon": station.get("longitude")},
        "datum": "chart datum (predicted water level, metres)",
        "from": _iso_z(start), "to": _iso_z(end),
        "tripFrom": args.date_from, "tripTo": args.date_to,
        "predictions": wlp,   # 15-min curve
        "hilo": hilo,         # high/low events
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload))
    print(f"[tides] {len(wlp)} predictions, {len(hilo)} hi/lo events -> {args.out} "
          f"({args.out.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
