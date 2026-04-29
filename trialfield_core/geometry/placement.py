"""Layout placement strategies: 1×N linear, 2×(N/2) block, staggered, and free.

All coordinates are in the UV frame (feet).  The field boundary passed here
must already be projected into UV-frame coordinates (a Shapely Polygon or
MultiPolygon in feet).

Strategy selection
------------------
The engine tries each strategy in order and returns the first that fits:
  1. block_2x2  — 2 columns × 2 rows of rep-blocks (preferred for 4 reps)
  2. linear     — all reps in a single column, stacked in v
  3. staggered  — alternating column offsets
  4. free       — exhaustive search for any valid placement

For the Schultz regression gate only block_2x2 is needed.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

from shapely.geometry import MultiPolygon, Polygon, box
from shapely.ops import unary_union

from trialfield_core.geometry.aligned_grid import grid_ceil, grid_floor, strips_in_range


@dataclass
class RepBlock:
    """Position of one rep-block in UV space."""

    rep: int                  # 1-based rep number
    label: str                # e.g. "NW"
    u_west: float             # left edge (feet)
    u_east: float             # right edge (feet)
    v_south: float            # bottom edge (feet)
    v_north: float            # top edge (feet)
    strip_order: list[int]    # strip indices 0..n_strips-1, south to north

    @property
    def width_ft(self) -> float:
        return self.u_east - self.u_west

    @property
    def height_ft(self) -> float:
        return self.v_north - self.v_south


def _uv_bounds(geom: Polygon | MultiPolygon) -> tuple[float, float, float, float]:
    """Return (u_min, u_max, v_min, v_max) of geometry bounding box."""
    b = geom.bounds  # (minx, miny, maxx, maxy) = (u_min, v_min, u_max, v_max)
    return b[0], b[2], b[1], b[3]


def _usable_u_range_at_v(
    field_uv: Polygon | MultiPolygon,
    v_south: float,
    v_north: float,
) -> Optional[tuple[float, float]]:
    """Return the largest contiguous u-interval inside field_uv at this v band."""
    band = box(-1e9, v_south, 1e9, v_north)
    clipped = field_uv.intersection(band)
    if clipped.is_empty:
        return None
    u_min, u_max, _, _ = _uv_bounds(clipped)
    return u_min, u_max


def place_block_2x2(
    field_uv: Polygon | MultiPolygon,
    n_reps: int,
    n_strips: int,
    swath_width_ft: float,
    plot_length_ft: float,
    v_ref: float = 0.0,
) -> Optional[list[RepBlock]]:
    """Place reps in a 2-column × (n_reps//2)-row block layout.

    Returns None if the field cannot accommodate the layout.
    n_reps must be even.
    """
    if n_reps % 2 != 0:
        return None

    n_rows = n_reps // 2
    block_height = n_strips * swath_width_ft
    block_width = plot_length_ft

    u_min, u_max, v_min, v_max = _uv_bounds(field_uv)

    # Build rows from south to north; each row needs 2 × plot_length_ft in u
    blocks: list[RepBlock] = []
    rep_num = 1
    row_labels_by_row = _row_labels(n_rows)

    # Find all available v-bands
    all_strips = strips_in_range(v_min, v_max, swath_width_ft, v_ref)
    if len(all_strips) < n_strips * n_rows:
        return None

    # Group strips into rows of n_strips each (south to north)
    row_v_ranges: list[tuple[float, float]] = []
    for i in range(n_rows):
        s_idx = i * n_strips
        if s_idx + n_strips > len(all_strips):
            return None
        row_v_south = all_strips[s_idx][0]
        row_v_north = all_strips[s_idx + n_strips - 1][1]
        row_v_ranges.append((row_v_south, row_v_north))

    # For each row find usable u range (intersection with field at that v band)
    row_u_ranges: list[Optional[tuple[float, float]]] = []
    for v_south, v_north in row_v_ranges:
        ur = _usable_u_range_at_v(field_uv, v_south, v_north)
        row_u_ranges.append(ur)
        if ur is None:
            return None

    # For each row, fit 2 blocks side by side; centre them in the available u range
    rep_assignments = list(range(1, n_reps + 1))  # reps 1..n_reps assigned south-to-north, W then E
    col_labels = ["W", "E"]
    for row_idx, (v_south, v_north) in enumerate(row_v_ranges):
        ur = row_u_ranges[row_idx]
        assert ur is not None
        avail_u = ur[1] - ur[0]
        needed_u = 2 * block_width
        if avail_u < needed_u:
            return None
        # Centre the two blocks within the available u range
        u_start = ur[0] + (avail_u - needed_u) / 2.0
        row_prefix = row_labels_by_row[row_idx]
        for col_idx in range(2):
            u_west = u_start + col_idx * block_width
            u_east = u_west + block_width
            label = row_prefix + col_labels[col_idx]
            rep = rep_assignments[row_idx * 2 + col_idx]
            strip_order = list(range(n_strips))
            blocks.append(
                RepBlock(
                    rep=rep,
                    label=label,
                    u_west=u_west,
                    u_east=u_east,
                    v_south=v_south,
                    v_north=v_north,
                    strip_order=strip_order,
                )
            )

    return blocks


def _row_labels(n_rows: int) -> list[str]:
    """Return per-row prefix labels, south to north (e.g. ['S', 'N'] for 2 rows)."""
    if n_rows == 1:
        return [""]
    if n_rows == 2:
        return ["S", "N"]
    return [str(i + 1) for i in range(n_rows)]


def place_linear(
    field_uv: Polygon | MultiPolygon,
    n_reps: int,
    n_strips: int,
    swath_width_ft: float,
    plot_length_ft: float,
    v_ref: float = 0.0,
) -> Optional[list[RepBlock]]:
    """Place all reps in a single column, stacked south to north."""
    block_height = n_strips * swath_width_ft
    u_min, u_max, v_min, v_max = _uv_bounds(field_uv)

    all_strips = strips_in_range(v_min, v_max, swath_width_ft, v_ref)
    if len(all_strips) < n_strips * n_reps:
        return None

    blocks: list[RepBlock] = []
    for rep_idx in range(n_reps):
        s_idx = rep_idx * n_strips
        v_south = all_strips[s_idx][0]
        v_north = all_strips[s_idx + n_strips - 1][1]
        ur = _usable_u_range_at_v(field_uv, v_south, v_north)
        if ur is None or (ur[1] - ur[0]) < plot_length_ft:
            return None
        u_west = ur[0]
        u_east = u_west + plot_length_ft
        blocks.append(
            RepBlock(
                rep=rep_idx + 1,
                label=str(rep_idx + 1),
                u_west=u_west,
                u_east=u_east,
                v_south=v_south,
                v_north=v_north,
                strip_order=list(range(n_strips)),
            )
        )
    return blocks


def place_linear_u(
    field_uv: Polygon | MultiPolygon,
    n_reps: int,
    n_strips: int,
    swath_width_ft: float,
    plot_length_ft: float,
    v_ref: float = 0.0,
) -> Optional[list[RepBlock]]:
    """Place all reps side by side in a single row along U (east-west linear).

    All reps share the same V band; reps are arranged sequentially in U.
    Preferred when the trial zone is wide along the AB line and narrow
    perpendicular to it — e.g. a long skinny field section.
    """
    total_width_u = n_reps * plot_length_ft
    u_min, u_max, v_min, v_max = _uv_bounds(field_uv)

    all_strips = strips_in_range(v_min, v_max, swath_width_ft, v_ref)
    if len(all_strips) < n_strips:
        return None

    for start in range(len(all_strips) - n_strips + 1):
        v_south = all_strips[start][0]
        v_north = all_strips[start + n_strips - 1][1]
        ur = _usable_u_range_at_v(field_uv, v_south, v_north)
        if ur is None or (ur[1] - ur[0]) < total_width_u:
            continue

        u_start = ur[0] + (ur[1] - ur[0] - total_width_u) / 2.0
        blocks: list[RepBlock] = []
        for rep_idx in range(n_reps):
            u_west = u_start + rep_idx * plot_length_ft
            u_east = u_west + plot_length_ft
            blocks.append(
                RepBlock(
                    rep=rep_idx + 1,
                    label=str(rep_idx + 1),
                    u_west=u_west,
                    u_east=u_east,
                    v_south=v_south,
                    v_north=v_north,
                    strip_order=list(range(n_strips)),
                )
            )
        return blocks

    return None


def place_staggered(
    field_uv: Polygon | MultiPolygon,
    n_reps: int,
    n_strips: int,
    swath_width_ft: float,
    plot_length_ft: float,
    v_ref: float = 0.0,
) -> Optional[list[RepBlock]]:
    """Place one rep per v-band, alternating u position left/right.

    Like linear but distributes reps across the field width: even reps
    (0-indexed) flush to the west edge of the available u range, odd reps
    flush to the east edge.  Useful for irregular or fan-shaped fields where
    treating every rep the same way wastes lateral space.
    """
    u_min, u_max, v_min, v_max = _uv_bounds(field_uv)
    all_strips = strips_in_range(v_min, v_max, swath_width_ft, v_ref)
    if len(all_strips) < n_strips * n_reps:
        return None

    blocks: list[RepBlock] = []
    for rep_idx in range(n_reps):
        s_idx = rep_idx * n_strips
        v_south = all_strips[s_idx][0]
        v_north = all_strips[s_idx + n_strips - 1][1]
        ur = _usable_u_range_at_v(field_uv, v_south, v_north)
        if ur is None or (ur[1] - ur[0]) < plot_length_ft:
            return None
        # Alternate: even reps left-aligned, odd reps right-aligned
        u_west = ur[0] if rep_idx % 2 == 0 else ur[1] - plot_length_ft
        blocks.append(
            RepBlock(
                rep=rep_idx + 1,
                label=str(rep_idx + 1),
                u_west=u_west,
                u_east=u_west + plot_length_ft,
                v_south=v_south,
                v_north=v_north,
                strip_order=list(range(n_strips)),
            )
        )
    return blocks


def place_free(
    field_uv: Polygon | MultiPolygon,
    n_reps: int,
    n_strips: int,
    swath_width_ft: float,
    plot_length_ft: float,
    v_ref: float = 0.0,
) -> Optional[list[RepBlock]]:
    """Greedy fallback: scan v from south and place each rep at the first valid slot.

    Unlike linear/staggered, does not require consecutive strips.  Skips any
    strip group where the field is absent or too narrow, enabling placement in
    fields with internal gaps or obstacles (represented as MultiPolygon).
    """
    u_min, u_max, v_min, v_max = _uv_bounds(field_uv)
    all_strips = strips_in_range(v_min, v_max, swath_width_ft, v_ref)

    blocks: list[RepBlock] = []
    used: set[int] = set()  # strip start indices already assigned to a rep

    for rep_idx in range(n_reps):
        placed = False
        for start in range(len(all_strips) - n_strips + 1):
            if any((start + k) in used for k in range(n_strips)):
                continue
            v_south = all_strips[start][0]
            v_north = all_strips[start + n_strips - 1][1]
            ur = _usable_u_range_at_v(field_uv, v_south, v_north)
            if ur is None or (ur[1] - ur[0]) < plot_length_ft:
                continue
            u_west = ur[0]
            blocks.append(
                RepBlock(
                    rep=rep_idx + 1,
                    label=str(rep_idx + 1),
                    u_west=u_west,
                    u_east=u_west + plot_length_ft,
                    v_south=v_south,
                    v_north=v_north,
                    strip_order=list(range(n_strips)),
                )
            )
            used.update(range(start, start + n_strips))
            placed = True
            break
        if not placed:
            return None

    return blocks


def place_trial(
    field_uv: Polygon | MultiPolygon,
    n_reps: int,
    n_strips: int,
    swath_width_ft: float,
    plot_length_ft: float,
    v_ref: float = 0.0,
    prefer_linear: bool = False,
) -> list[RepBlock]:
    """Try placement strategies in order; raise if none succeed.

    When prefer_linear is True (e.g. a user-drawn trial zone), linear is tried
    before block_2x2 so narrow zones aren't rejected unnecessarily.
    """
    if prefer_linear:
        ordered = (place_linear_u, place_linear, place_block_2x2, place_staggered, place_free)
    else:
        ordered = (place_block_2x2, place_linear, place_staggered, place_free)
    for strategy in ordered:
        result = strategy(
            field_uv=field_uv,
            n_reps=n_reps,
            n_strips=n_strips,
            swath_width_ft=swath_width_ft,
            plot_length_ft=plot_length_ft,
            v_ref=v_ref,
        )
        if result is not None:
            return result
    raise RuntimeError(
        f"No layout strategy could fit {n_reps} reps × {n_strips} strips "
        f"({plot_length_ft}ft × {n_strips * swath_width_ft}ft per rep) in the field."
    )
