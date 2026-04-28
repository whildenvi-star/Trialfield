"""Inward headland buffer computation, multipolygon-safe."""

from __future__ import annotations

from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union


def headland_buffer(
    field: Polygon | MultiPolygon,
    buffer_ft: float,
    simplify_tolerance_ft: float = 1.0,
) -> Polygon | MultiPolygon | None:
    """Return the field polygon eroded inward by buffer_ft feet.

    Accepts either a Polygon or MultiPolygon.  Returns the same type (or
    None if the buffer consumes the entire geometry).  Input coordinates must
    already be in a planar CRS where the unit is feet (i.e. convert to a
    UV frame or a metric CRS first, then scale).

    Parameters
    ----------
    field:
        Shapely geometry in planar coordinates (feet).
    buffer_ft:
        Inward erosion distance in feet.
    simplify_tolerance_ft:
        Douglas-Peucker simplification after buffering to reduce vertex count.
    """
    eroded = field.buffer(-buffer_ft)
    if eroded.is_empty:
        return None
    if simplify_tolerance_ft > 0:
        eroded = eroded.simplify(simplify_tolerance_ft, preserve_topology=True)
    return eroded
