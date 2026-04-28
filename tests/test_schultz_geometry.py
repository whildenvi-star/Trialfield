"""Regression tests: Schultz N-rate trial geometry must reproduce reference outputs.

This is the primary regression gate for trialfield-core.
If any assertion here fails, do NOT proceed to the next build step.

Ground truth is the reference data in reference/example_outputs/.
Tolerance: plot corner coordinates within 1 metre (≈ 3.28 ft at 42.56°N).
"""

from __future__ import annotations

import csv
import math
import tempfile
import zipfile
from pathlib import Path

import pytest
import shapefile

from trialfield_core.geometry.plots import PlotRecord, generate_plots
from trialfield_core.geometry.placement import RepBlock
from trialfield_core.geometry.uv_frame import UVFrame
from trialfield_core.io.abline import read_ab_line
from trialfield_core.io.field import read_field_boundary
from trialfield_core.models.trial_design import Treatment, TrialDesign, TrialType

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO = Path(__file__).parent.parent
REF_AB = REPO / "reference/example_inputs/schultz.zip"
REF_POLY = REPO / "reference/example_inputs/schultz_poly.zip"
REF_CSV = REPO / "reference/example_outputs/Schultz_N_trial_plots.csv"
REF_SHP = REPO / "reference/example_outputs/Schultz_N_Rx_FieldView.zip"

# ---------------------------------------------------------------------------
# Known Schultz trial parameters (derived from reference outputs)
# ---------------------------------------------------------------------------
SCHULTZ_TREATMENTS = [
    Treatment(label="0",   value=0,   unit="lb N/ac"),
    Treatment(label="50",  value=50,  unit="lb N/ac"),
    Treatment(label="100", value=100, unit="lb N/ac"),
    Treatment(label="150", value=150, unit="lb N/ac"),
    Treatment(label="200", value=200, unit="lb N/ac"),
    Treatment(label="250", value=250, unit="lb N/ac"),
]

SWATH_FT = 60.0

# Treatment-index order per rep (0-indexed into SCHULTZ_TREATMENTS), strip 1..6
# Derived from reference CSV: rep → [t_idx_strip1, ..., t_idx_strip6]
SCHULTZ_TREATMENT_ASSIGNMENT: dict[int, list[int]] = {
    1: [4, 1, 3, 5, 2, 0],  # rates: 200, 50, 150, 250, 100, 0
    2: [5, 2, 0, 1, 3, 4],  # rates: 250, 100,   0,  50, 150, 200
    3: [0, 3, 5, 2, 4, 1],  # rates:   0, 150, 250, 100, 200,  50
    4: [1, 4, 2, 0, 3, 5],  # rates:  50, 200, 100,   0, 150, 250
}

# Block positions (feet in UV frame), exactly as in the reference CSV
SCHULTZ_BLOCKS = [
    RepBlock(rep=1, label="NW", u_west=-688.0, u_east=-288.0, v_south=690.0,  v_north=1050.0, strip_order=list(range(6))),
    RepBlock(rep=2, label="NE", u_west=-288.0, u_east= 112.0, v_south=690.0,  v_north=1050.0, strip_order=list(range(6))),
    RepBlock(rep=3, label="SW", u_west=-439.0, u_east= -39.0, v_south=330.0,  v_north= 690.0, strip_order=list(range(6))),
    RepBlock(rep=4, label="SE", u_west= -39.0, u_east= 361.0, v_south=330.0,  v_north= 690.0, strip_order=list(range(6))),
]

TOLERANCE_M = 1.0  # 1 metre tolerance


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in metres between two WGS84 points."""
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _load_ref_csv() -> dict[str, dict]:
    """Load reference CSV keyed by Plot_ID."""
    rows: dict[str, dict] = {}
    with open(REF_CSV, newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows[row["Plot_ID"]] = row
    return rows


def _load_ref_shapefile() -> dict[str, list[tuple[float, float]]]:
    """Load reference Rx shapefile keyed by Plot_ID → list of (lon, lat) vertices."""
    tmp = tempfile.mkdtemp()
    with zipfile.ZipFile(REF_SHP) as z:
        z.extractall(tmp)
    shps = list(Path(tmp).rglob("*.shp"))
    sf = shapefile.Reader(str(shps[0].with_suffix("")))
    result: dict[str, list[tuple[float, float]]] = {}
    for sr in sf.shapeRecords():
        pid = sr.record["Plot_ID"]
        result[pid] = [(pt[0], pt[1]) for pt in sr.shape.points]
    return result


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_ab_line_reader():
    """AB line reads to expected A/B coordinates and heading."""
    ab = read_ab_line(REF_AB)
    assert abs(ab.a_lon - (-89.10575128)) < 1e-7
    assert abs(ab.a_lat - 42.56240918) < 1e-7
    assert abs(ab.b_lon - (-89.11104903)) < 1e-7
    assert abs(ab.b_lat - 42.56250344) < 1e-7
    assert ab.bearing_deg is not None
    assert abs(ab.bearing_deg - 271.38) < 0.5  # within half a degree


def test_uv_frame_ab_endpoints():
    """A and B points must lie on the v=0 axis, ±half AB length in u."""
    frame = UVFrame.from_ab_wgs84(-89.10575128, 42.56240918, -89.11104903, 42.56250344)
    u_a, v_a = frame.wgs84_to_uv(-89.10575128, 42.56240918)
    u_b, v_b = frame.wgs84_to_uv(-89.11104903, 42.56250344)
    assert abs(v_a) < 0.1, f"A.v should be ~0, got {v_a}"
    assert abs(v_b) < 0.1, f"B.v should be ~0, got {v_b}"
    assert abs(u_a - frame.ab_length_ft / 2) < 0.5
    assert abs(u_b + frame.ab_length_ft / 2) < 0.5


def test_uv_roundtrip():
    """uv_to_wgs84(wgs84_to_uv(pt)) recovers original point to <0.01 ft."""
    frame = UVFrame.from_ab_wgs84(-89.10575128, 42.56240918, -89.11104903, 42.56250344)
    test_pts = [
        (-89.1108916, 42.5643945),
        (-89.1094019, 42.5645327),
        (-89.1085154, 42.5633642),
    ]
    for lon, lat in test_pts:
        u, v = frame.wgs84_to_uv(lon, lat)
        lon2, lat2 = frame.uv_to_wgs84(u, v)
        dist = _haversine_m(lat, lon, lat2, lon2)
        assert dist < 0.01, f"Roundtrip error {dist:.4f}m for ({lat}, {lon})"


def test_field_boundary_reader():
    """Field boundary reads as a valid non-empty Shapely polygon."""
    from shapely.geometry import MultiPolygon, Polygon
    field = read_field_boundary(REF_POLY)
    assert isinstance(field, (Polygon, MultiPolygon))
    assert not field.is_empty
    assert field.is_valid


def test_plot_uv_coordinates_match_csv():
    """Generated plots must match reference CSV UV coordinates exactly."""
    frame = UVFrame.from_ab_wgs84(-89.10575128, 42.56240918, -89.11104903, 42.56250344)
    plots = generate_plots(
        blocks=SCHULTZ_BLOCKS,
        treatment_assignments=SCHULTZ_TREATMENT_ASSIGNMENT,
        treatments=SCHULTZ_TREATMENTS,
        swath_width_ft=SWATH_FT,
        frame=frame,
    )
    ref = _load_ref_csv()
    assert len(plots) == 24

    for p in plots:
        row = ref[p.plot_id]
        assert abs(p.v_south_ft - float(row["v_south_ft"])) < 0.1, f"{p.plot_id}: v_south"
        assert abs(p.v_north_ft - float(row["v_north_ft"])) < 0.1, f"{p.plot_id}: v_north"
        assert abs(p.u_west_ft  - float(row["u_west_ft"]))  < 0.1, f"{p.plot_id}: u_west"
        assert abs(p.u_east_ft  - float(row["u_east_ft"]))  < 0.1, f"{p.plot_id}: u_east"


def test_plot_corners_match_csv_latlon():
    """SW and NE corners must match reference CSV lat/lon to within 1 m."""
    frame = UVFrame.from_ab_wgs84(-89.10575128, 42.56240918, -89.11104903, 42.56250344)
    plots = generate_plots(
        blocks=SCHULTZ_BLOCKS,
        treatment_assignments=SCHULTZ_TREATMENT_ASSIGNMENT,
        treatments=SCHULTZ_TREATMENTS,
        swath_width_ft=SWATH_FT,
        frame=frame,
    )
    ref = _load_ref_csv()

    for p in plots:
        row = ref[p.plot_id]
        sw_dist = _haversine_m(
            float(row["SW_Lat"]), float(row["SW_Lon"]),
            p.sw_lat, p.sw_lon,
        )
        ne_dist = _haversine_m(
            float(row["NE_Lat"]), float(row["NE_Lon"]),
            p.ne_lat, p.ne_lon,
        )
        assert sw_dist <= TOLERANCE_M, f"{p.plot_id} SW corner {sw_dist:.3f}m off"
        assert ne_dist <= TOLERANCE_M, f"{p.plot_id} NE corner {ne_dist:.3f}m off"


def test_plot_corners_match_reference_shapefile():
    """All four polygon corners must match the reference Rx shapefile to within 1 m."""
    frame = UVFrame.from_ab_wgs84(-89.10575128, 42.56240918, -89.11104903, 42.56250344)
    plots = generate_plots(
        blocks=SCHULTZ_BLOCKS,
        treatment_assignments=SCHULTZ_TREATMENT_ASSIGNMENT,
        treatments=SCHULTZ_TREATMENTS,
        swath_width_ft=SWATH_FT,
        frame=frame,
    )
    ref_shp = _load_ref_shapefile()

    for p in plots:
        ref_pts = ref_shp[p.plot_id]
        # ref_pts is a closed polygon (first == last), skip the closing repeat
        ref_corners = ref_pts[:4]
        gen_corners = p.polygon_wgs84[:4]  # SW, SE, NE, NW

        # Match each generated corner to the nearest reference corner
        for gen_lon, gen_lat in gen_corners:
            min_dist = min(
                _haversine_m(ref_lat, ref_lon, gen_lat, gen_lon)
                for ref_lon, ref_lat in ref_corners
            )
            assert min_dist <= TOLERANCE_M, (
                f"{p.plot_id}: corner ({gen_lat:.6f},{gen_lon:.6f}) "
                f"is {min_dist:.3f}m from nearest reference corner"
            )


def test_plot_ids_match_reference():
    """All 24 Plot_IDs must exactly match the reference CSV."""
    frame = UVFrame.from_ab_wgs84(-89.10575128, 42.56240918, -89.11104903, 42.56250344)
    plots = generate_plots(
        blocks=SCHULTZ_BLOCKS,
        treatment_assignments=SCHULTZ_TREATMENT_ASSIGNMENT,
        treatments=SCHULTZ_TREATMENTS,
        swath_width_ft=SWATH_FT,
        frame=frame,
    )
    ref = _load_ref_csv()
    generated_ids = {p.plot_id for p in plots}
    reference_ids = set(ref.keys())
    assert generated_ids == reference_ids, (
        f"Missing: {reference_ids - generated_ids}\n"
        f"Extra:   {generated_ids - reference_ids}"
    )


def test_plot_acres():
    """Each plot must be 0.551 acres (60 ft × 400 ft / 43560)."""
    frame = UVFrame.from_ab_wgs84(-89.10575128, 42.56240918, -89.11104903, 42.56250344)
    plots = generate_plots(
        blocks=SCHULTZ_BLOCKS,
        treatment_assignments=SCHULTZ_TREATMENT_ASSIGNMENT,
        treatments=SCHULTZ_TREATMENTS,
        swath_width_ft=SWATH_FT,
        frame=frame,
    )
    for p in plots:
        assert abs(p.acres - 0.551) < 0.001, f"{p.plot_id}: acres={p.acres}"
