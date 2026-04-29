"""Fetch soil map unit polygon geometries from the SDA tabular REST API."""

from __future__ import annotations

import sys
from typing import Any

import requests
from shapely import wkt as shapely_wkt
from shapely.geometry import mapping

_SDA_URL = "https://sdmdataaccess.nrcs.usda.gov/tabular/post.rest"
_DEFAULT_TIMEOUT = 15.0

_QUERY_TEMPLATE = """\
SELECT p.mukey, mu.muname, c.compname, c.comppct_r,
       p.mupolygon_geom.STAsText() AS wkt
FROM mupolygon p
INNER JOIN mapunit mu ON p.mukey = mu.mukey
LEFT JOIN component c ON mu.mukey = c.mukey AND c.majcompflag = 'Yes'
WHERE p.mupolygon_geom.STIntersects(
  geometry::STGeomFromText('{field_wkt}', 4326)
) = 1
ORDER BY c.comppct_r DESC"""


def fetch_soil_zones(
    field_wkt: str,
    timeout: float = _DEFAULT_TIMEOUT,
) -> list[dict[str, Any]]:
    """Return GeoJSON Feature dicts for soil map units intersecting field_wkt.

    Returns [] on any failure — never raises.
    """
    # Escape single quotes in WKT to prevent SQL injection
    safe_wkt = field_wkt.replace("'", "''")
    query = _QUERY_TEMPLATE.format(field_wkt=safe_wkt)
    try:
        resp = requests.post(
            _SDA_URL,
            data={"query": query, "format": "JSON+OBJECTS"},
            timeout=timeout,
        )
        resp.raise_for_status()
        payload = resp.json()
        table = payload.get("Table") or []
    except Exception as exc:
        print(f"[trialfield] soil zones fetch failed: {exc}", file=sys.stderr)
        return []

    features: list[dict[str, Any]] = []
    seen_mukeys: set[str] = set()

    for row in table:
        try:
            mukey = str(row[0])
            muname = str(row[1] or "")
            compname = str(row[2] or "")
            wkt_str = row[4]
        except (IndexError, TypeError):
            continue

        if mukey in seen_mukeys or not wkt_str:
            continue
        seen_mukeys.add(mukey)

        try:
            geom = shapely_wkt.loads(wkt_str)
            geojson_geom = mapping(geom)
        except Exception:
            continue

        features.append({
            "type": "Feature",
            "geometry": geojson_geom,
            "properties": {
                "mukey": mukey,
                "muname": muname,
                "compname": compname,
            },
        })

    return features
