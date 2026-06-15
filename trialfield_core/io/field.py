"""Read field boundary shapefiles, validate geometry, and handle holes and exclusion zones."""

from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path

import shapefile
from shapely.geometry import MultiPolygon, Polygon, shape
from shapely.ops import unary_union


def read_field_boundary(path: str | Path) -> Polygon | MultiPolygon:
    """Read a field boundary shapefile and return a unified Shapely polygon.

    Accepts .zip archives or bare shapefile stems.  Multiple polygon records
    are unioned together (handles split-field inputs).  The result is always
    in WGS84 (the input is assumed to be WGS84; no CRS reprojection is done
    here — CRS conversion happens in the geometry engine).

    Raises FileNotFoundError if the shapefile cannot be found.
    Raises ValueError if no valid polygon geometry is found.
    """
    p = Path(path)
    if p.suffix.lower() == ".zip":
        tmp = tempfile.mkdtemp()
        with zipfile.ZipFile(p) as z:
            z.extractall(tmp)
        shps = list(Path(tmp).rglob("*.shp"))
        if not shps:
            raise FileNotFoundError(f"No .shp found in {p}")
        sf = shapefile.Reader(str(shps[0].with_suffix("")))
    else:
        sf = shapefile.Reader(str(p))

    polygons: list[Polygon | MultiPolygon] = []
    for sr in sf.shapeRecords():
        geojson = sr.shape.__geo_interface__
        geom = shape(geojson)
        if geom.is_empty:
            continue
        if not isinstance(geom, (Polygon, MultiPolygon)):
            raise ValueError(f"Expected polygon geometry, got {type(geom).__name__}")
        polygons.append(geom)

    if not polygons:
        raise ValueError(f"No polygon geometry found in {p}")

    result = unary_union(polygons)
    if not result.is_valid:
        result = result.buffer(0)  # standard fix for self-intersection
    return result
