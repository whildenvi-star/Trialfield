"""Snap plot edges to the AB swath grid — the critical geometric constraint.

The swath grid is the set of lines parallel to the AB line at spacings of
swath_width feet.  Grid lines are at  v = v_ref + n * swath_width  for all
integers n, where v_ref is an arbitrary reference that determines the phase
of the grid.

"Snapping" a v value means rounding it to the nearest grid line.
"Ceiling-snap" means rounding UP to the next grid line (used to find the
first valid plot start inside the buffered boundary).
"""

from __future__ import annotations

import math


def grid_ceil(v: float, swath_width: float, v_ref: float = 0.0) -> float:
    """Return the smallest grid line ≥ v."""
    offset = v - v_ref
    return v_ref + math.ceil(offset / swath_width) * swath_width


def grid_floor(v: float, swath_width: float, v_ref: float = 0.0) -> float:
    """Return the largest grid line ≤ v."""
    offset = v - v_ref
    return v_ref + math.floor(offset / swath_width) * swath_width


def grid_round(v: float, swath_width: float, v_ref: float = 0.0) -> float:
    """Return the nearest grid line to v."""
    offset = v - v_ref
    return v_ref + round(offset / swath_width) * swath_width


def strips_in_range(
    v_min: float,
    v_max: float,
    swath_width: float,
    v_ref: float = 0.0,
) -> list[tuple[float, float]]:
    """Return all (v_south, v_north) strip intervals fully contained in [v_min, v_max].

    Each interval is exactly swath_width wide with edges on the swath grid.
    """
    v_start = grid_ceil(v_min, swath_width, v_ref)
    strips = []
    v = v_start
    while v + swath_width <= v_max + 1e-6:
        strips.append((v, v + swath_width))
        v += swath_width
    return strips
