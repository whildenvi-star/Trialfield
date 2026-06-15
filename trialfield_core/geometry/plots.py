"""Generate plot polygons from a rep × treatment matrix positioned on the swath grid."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Optional

from shapely.geometry import Polygon as ShapelyPolygon

from trialfield_core.geometry.aligned_grid import strips_in_range
from trialfield_core.geometry.placement import RepBlock
from trialfield_core.geometry.uv_frame import UVFrame
from trialfield_core.models.trial_design import Treatment


@dataclass
class PlotRecord:
    """All attributes for one plot in the trial."""

    plot_id: str
    rep: int
    rep_position: str  # e.g. "NW"
    strip: int         # 1-based strip number within rep
    treatment: Treatment
    acres: float
    # UV frame coordinates (feet)
    v_south_ft: float
    v_north_ft: float
    u_west_ft: float
    u_east_ft: float
    # WGS84 corners (derived)
    sw_lon: float
    sw_lat: float
    ne_lon: float
    ne_lat: float
    # WGS84 polygon (4 corners, closed)
    polygon_wgs84: list[tuple[float, float]]  # [(lon, lat), ...]


FT2_PER_ACRE = 43560.0

# Tokens to strip when abbreviating a unit string for plot IDs
_STRIP_TOKENS = {
    "lb", "lbs", "pound", "pounds",
    "kg", "g", "mg", "oz",
    "gal", "gallon", "gallons", "l", "liter", "litre", "qt", "pt", "fl",
    "ac", "acre", "acres", "ha", "sqft",
    "per", "rate",
}


def _unit_abbrev(unit: str) -> str:
    """Extract the meaningful abbreviation from a unit string for plot IDs.

    "lb N/ac" → "N", "seeds/ac" → "seeds", "mph" → "mph", "" → ""
    """
    import re
    tokens = re.split(r"[\s/]+", unit.strip())
    kept = [t for t in tokens if t and t.lower() not in _STRIP_TOKENS]
    abbrev = "".join(kept)
    return abbrev[:8]  # cap length


def _plot_acres(width_ft: float, length_ft: float) -> float:
    return round(width_ft * length_ft / FT2_PER_ACRE, 3)


def generate_plots(
    blocks: list[RepBlock],
    treatment_assignments: dict[int, list[int]],
    treatments: list[Treatment],
    swath_width_ft: float,
    frame: UVFrame,
) -> list[PlotRecord]:
    """Generate one PlotRecord per plot from the placed rep-blocks.

    Parameters
    ----------
    blocks:
        Output of placement.place_trial().
    treatment_assignments:
        {rep_number: [treatment_index_for_strip_1, ..., treatment_index_for_strip_N]}
        where indices are 0-based into `treatments`.
    treatments:
        The ordered treatment list.
    swath_width_ft:
        Width of each strip in feet.
    frame:
        UVFrame for coordinate conversion.
    """
    records: list[PlotRecord] = []

    for block in blocks:
        t_order = treatment_assignments[block.rep]
        plot_length_ft = block.u_east - block.u_west

        for strip_idx, t_idx in enumerate(t_order):
            t = treatments[t_idx]
            strip_num = strip_idx + 1
            v_south = block.v_south + strip_idx * swath_width_ft
            v_north = v_south + swath_width_ft
            u_west = block.u_west
            u_east = block.u_east

            # Build WGS84 polygon (SW, SE, NE, NW, SW closed)
            sw_lon, sw_lat = frame.uv_to_wgs84(u_west, v_south)
            se_lon, se_lat = frame.uv_to_wgs84(u_east, v_south)
            ne_lon, ne_lat = frame.uv_to_wgs84(u_east, v_north)
            nw_lon, nw_lat = frame.uv_to_wgs84(u_west, v_north)
            polygon = [(sw_lon, sw_lat), (se_lon, se_lat), (ne_lon, ne_lat), (nw_lon, nw_lat), (sw_lon, sw_lat)]

            # Build Plot ID
            if not t.is_categorical:
                v = t.value
                v_str = str(int(v)) if isinstance(v, float) and v.is_integer() else str(v)
                suffix = _unit_abbrev(t.unit)
                rate_str = f"{v_str}{suffix}"
            else:
                rate_str = str(t.label).replace(" ", "")
            plot_id = f"R{block.rep}-S{strip_num}-{rate_str}"

            acres = _plot_acres(swath_width_ft, plot_length_ft)

            records.append(
                PlotRecord(
                    plot_id=plot_id,
                    rep=block.rep,
                    rep_position=block.label,
                    strip=strip_num,
                    treatment=t,
                    acres=acres,
                    v_south_ft=v_south,
                    v_north_ft=v_north,
                    u_west_ft=u_west,
                    u_east_ft=u_east,
                    sw_lon=sw_lon,
                    sw_lat=sw_lat,
                    ne_lon=ne_lon,
                    ne_lat=ne_lat,
                    polygon_wgs84=polygon,
                )
            )

    return records


def randomize_treatments(
    n_reps: int,
    n_treatments: int,
    seed: Optional[int] = None,
) -> dict[int, list[int]]:
    """Return a random treatment order for each rep.

    Each rep gets a permutation of 0..n_treatments-1.
    seed=None → non-deterministic; seed=int → reproducible.
    """
    rng = random.Random(seed)
    result: dict[int, list[int]] = {}
    for rep in range(1, n_reps + 1):
        order = list(range(n_treatments))
        rng.shuffle(order)
        result[rep] = order
    return result
