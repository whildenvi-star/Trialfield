"""Fetch soil data from the SDA REST API with graceful fallback on any failure."""

from __future__ import annotations

import sys
from typing import Optional

import requests

from trialfield_core.models.soil import MajoritySoilZone, SSURGOComponent

_SDA_URL = "https://sdmdataaccess.nrcs.usda.gov/tabular/post.rest"
_DEFAULT_TIMEOUT = 10.0  # seconds

# Spatial query: map-unit components intersecting the AOI bounding box.
# Ordered descending by component percent so the dominant component is first.
_QUERY_TEMPLATE = """\
SELECT mu.mukey, c.compname, c.comppct_r, c.hydgrp, c.taxorder
FROM mapunit mu
INNER JOIN component c ON mu.mukey = c.mukey
WHERE mu.mukey IN (
  SELECT DISTINCT mukey FROM mupolygon
  WHERE mupolygon_geom.STIntersects(
    geometry::STGeomFromText(
      'POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))',
      4326
    )
  ) = 1
)
ORDER BY mu.mukey, c.comppct_r DESC"""


def _unavailable(reason: str) -> MajoritySoilZone:
    print(f"[trialfield] soil fetch skipped: {reason}", file=sys.stderr)
    return MajoritySoilZone(
        wkt="",
        components=[],
        source="unavailable",
        note=f"Soil data unavailable: {reason}",
    )


def fetch_soil(
    lon_min: float,
    lat_min: float,
    lon_max: float,
    lat_max: float,
    timeout: float = _DEFAULT_TIMEOUT,
) -> MajoritySoilZone:
    """Fetch dominant soil for a lat/lon bounding box from the SDA REST API.

    Returns a MajoritySoilZone with ``source='SDA'`` on success.
    On any failure — network, HTTP error, bad JSON, empty result, or schema
    change — logs one line to stderr and returns ``source='unavailable'``.
    Never raises.
    """
    query = _QUERY_TEMPLATE.format(
        w=lon_min, s=lat_min, e=lon_max, n=lat_max
    )
    try:
        resp = requests.post(
            _SDA_URL,
            data={"query": query, "format": "JSON+OBJECTS"},
            timeout=timeout,
        )
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        return _unavailable(f"request timed out after {timeout}s")
    except requests.exceptions.ConnectionError as exc:
        return _unavailable(f"connection error: {exc}")
    except requests.exceptions.HTTPError as exc:
        return _unavailable(f"HTTP {resp.status_code}: {exc}")
    except Exception as exc:
        return _unavailable(f"network error: {exc}")

    try:
        payload = resp.json()
    except Exception as exc:
        return _unavailable(f"JSON parse error: {exc}")

    try:
        table = payload["Table"]
    except (KeyError, TypeError):
        keys = list(payload.keys()) if isinstance(payload, dict) else type(payload).__name__
        return _unavailable(f"unexpected response schema (keys: {keys})")

    if not table:
        return _unavailable("empty result — no soil data for this area")

    try:
        components = [
            SSURGOComponent(
                mukey=str(row[0]),
                compname=str(row[1]),
                comppct_r=float(row[2]),
                hydgrp=row[3] or None,
                taxorder=row[4] or None,
            )
            for row in table
        ]
    except Exception as exc:
        return _unavailable(f"schema change in SDA response: {exc}")

    bbox_wkt = (
        f"POLYGON(({lon_min} {lat_min},{lon_max} {lat_min},"
        f"{lon_max} {lat_max},{lon_min} {lat_max},{lon_min} {lat_min}))"
    )
    return MajoritySoilZone(wkt=bbox_wkt, components=components, source="SDA")


def get_soil(
    soil_mode: str,
    lon_min: Optional[float] = None,
    lat_min: Optional[float] = None,
    lon_max: Optional[float] = None,
    lat_max: Optional[float] = None,
    timeout: float = _DEFAULT_TIMEOUT,
) -> MajoritySoilZone:
    """Return soil data according to soil_mode.

    soil_mode values:
    - ``"skip"``          → return unavailable immediately (user opted out)
    - ``"auto"``          → call SDA; fall back if it fails
    - ``"shapefile:path"``→ placeholder; treated as skip for now (future work)

    The bbox arguments are required when soil_mode is "auto".
    """
    if soil_mode == "skip":
        return MajoritySoilZone(
            wkt="",
            components=[],
            source="unavailable",
            note="Soil data skipped by user (--soil-mode skip).",
        )

    if soil_mode == "auto":
        if None in (lon_min, lat_min, lon_max, lat_max):
            return _unavailable("no field boundary provided — cannot query SDA")
        return fetch_soil(
            lon_min=lon_min,  # type: ignore[arg-type]
            lat_min=lat_min,  # type: ignore[arg-type]
            lon_max=lon_max,  # type: ignore[arg-type]
            lat_max=lat_max,  # type: ignore[arg-type]
            timeout=timeout,
        )

    if soil_mode.startswith("shapefile:"):
        # Shapefile-based soil constraint is deferred to a future step.
        return _unavailable(
            "shapefile-based soil constraint not yet implemented; "
            "run with --soil-mode skip to suppress this message"
        )

    return _unavailable(f"unknown soil_mode {soil_mode!r}")
