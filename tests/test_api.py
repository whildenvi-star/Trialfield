"""Integration tests for the FastAPI sidecar (trialfield_api).

Uses FastAPI's synchronous TestClient so no real HTTP server is needed.
All tests run with soil_mode="skip" to avoid network calls.
"""

from __future__ import annotations

import json
import zipfile
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from trialfield_api.main import app

FIXTURES = Path(__file__).parent / "fixtures"

client = TestClient(app)

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

SCHULTZ_TREATMENTS = [
    {"label": "0",   "value": 0,   "unit": "lb N/ac"},
    {"label": "50",  "value": 50,  "unit": "lb N/ac"},
    {"label": "100", "value": 100, "unit": "lb N/ac"},
    {"label": "150", "value": 150, "unit": "lb N/ac"},
    {"label": "200", "value": 200, "unit": "lb N/ac"},
    {"label": "250", "value": 250, "unit": "lb N/ac"},
]

SCHULTZ_GEOMETRY = {
    "a_lon": -89.10575128,
    "a_lat": 42.56240918,
    "b_lon": -89.11104903,
    "b_lat": 42.56250344,
    "trial_swath_ft": 60,
}

SCHULTZ_PAYLOAD = {
    "design": {
        "name": "Schultz N-rate 2026",
        "trial_type": "fertility",
        "treatments": SCHULTZ_TREATMENTS,
        "reps": 4,
        "plot_length_ft": 400,
    },
    "geometry": SCHULTZ_GEOMETRY,
    "soil_mode": "skip",
    "seed": 42,
}


def _unzip_response(resp) -> zipfile.ZipFile:
    return zipfile.ZipFile(BytesIO(resp.content))


# ---------------------------------------------------------------------------
# Happy path — structured treatments, no field boundary
# ---------------------------------------------------------------------------

def test_design_returns_200_zip():
    resp = client.post("/design", json=SCHULTZ_PAYLOAD)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"


def test_design_zip_contains_expected_files():
    resp = client.post("/design", json=SCHULTZ_PAYLOAD)
    zf = _unzip_response(resp)
    names = zf.namelist()
    assert any(n.endswith("_plots.csv") for n in names)
    assert any(n.endswith("_Rx_FieldView.zip") for n in names)
    assert any(n.endswith(".kml") for n in names)
    assert any(n.endswith("_summary.md") for n in names)
    assert any(n.endswith("_soil_sample_pins.xlsx") for n in names)
    assert any(n.endswith("_layout.png") for n in names)
    assert any(n.endswith("_field_map.pdf") for n in names)
    assert any(n.endswith("_AB_line.zip") for n in names)
    assert any(n.endswith("_Rx_ISOXML.zip") for n in names)
    assert any(n.endswith("_Rx_AgX.json") for n in names)
    assert len(names) == 10


def test_design_csv_has_24_plots():
    resp = client.post("/design", json=SCHULTZ_PAYLOAD)
    zf = _unzip_response(resp)
    csv_name = next(n for n in zf.namelist() if n.endswith("_plots.csv"))
    lines = zf.read(csv_name).decode().strip().splitlines()
    assert len(lines) == 25  # 1 header + 24 data rows


def test_design_csv_columns():
    resp = client.post("/design", json=SCHULTZ_PAYLOAD)
    zf = _unzip_response(resp)
    csv_name = next(n for n in zf.namelist() if n.endswith("_plots.csv"))
    header = zf.read(csv_name).decode().splitlines()[0]
    for col in ("Plot_ID", "Rep", "Rep_Position", "Strip", "Acres", "SW_Lat", "SW_Lon"):
        assert col in header, f"missing column: {col}"


def test_design_csv_all_six_rates_present():
    resp = client.post("/design", json=SCHULTZ_PAYLOAD)
    zf = _unzip_response(resp)
    csv_name = next(n for n in zf.namelist() if n.endswith("_plots.csv"))
    body = zf.read(csv_name).decode()
    for rate in ("0.0", "50.0", "100.0", "150.0", "200.0", "250.0"):
        assert rate in body, f"rate {rate} missing from CSV"


def test_design_seed_determinism():
    r1 = client.post("/design", json=SCHULTZ_PAYLOAD)
    r2 = client.post("/design", json=SCHULTZ_PAYLOAD)
    assert r1.content == r2.content


def test_design_content_disposition_header():
    resp = client.post("/design", json=SCHULTZ_PAYLOAD)
    cd = resp.headers.get("content-disposition", "")
    assert "attachment" in cd
    assert ".zip" in cd


# ---------------------------------------------------------------------------
# Happy path — with Schultz field boundary
# ---------------------------------------------------------------------------

def test_design_with_field_boundary_returns_200():
    boundary = json.loads((FIXTURES / "schultz_boundary.json").read_text())
    payload = {
        **SCHULTZ_PAYLOAD,
        "geometry": {**SCHULTZ_GEOMETRY, "field_boundary_geojson": boundary},
    }
    resp = client.post("/design", json=payload)
    assert resp.status_code == 200
    zf = _unzip_response(resp)
    csv_name = next(n for n in zf.namelist() if n.endswith("_plots.csv"))
    lines = zf.read(csv_name).decode().strip().splitlines()
    assert len(lines) >= 2  # at least a header + one plot


def test_design_with_boundary_plot_count_matches_no_boundary():
    boundary = json.loads((FIXTURES / "schultz_boundary.json").read_text())
    with_boundary = {
        **SCHULTZ_PAYLOAD,
        "geometry": {**SCHULTZ_GEOMETRY, "field_boundary_geojson": boundary},
    }
    r_with = client.post("/design", json=with_boundary)
    r_without = client.post("/design", json=SCHULTZ_PAYLOAD)

    def _plot_count(resp):
        zf = _unzip_response(resp)
        csv_name = next(n for n in zf.namelist() if n.endswith("_plots.csv"))
        return len(zf.read(csv_name).decode().strip().splitlines()) - 1

    assert _plot_count(r_with) == _plot_count(r_without)


# ---------------------------------------------------------------------------
# Validation errors → 422
# ---------------------------------------------------------------------------

def test_missing_treatments_and_prose_returns_422():
    payload = {
        "design": {"name": "X", "trial_type": "fertility", "reps": 4},
        "geometry": SCHULTZ_GEOMETRY,
        "soil_mode": "skip",
        "seed": 42,
    }
    resp = client.post("/design", json=payload)
    assert resp.status_code == 422


def test_single_treatment_returns_422():
    payload = {
        **SCHULTZ_PAYLOAD,
        "design": {
            **SCHULTZ_PAYLOAD["design"],
            "treatments": [{"label": "0", "value": 0, "unit": "lb N/ac"}],
        },
    }
    resp = client.post("/design", json=payload)
    assert resp.status_code == 422


def test_identical_ab_points_returns_422():
    payload = {
        **SCHULTZ_PAYLOAD,
        "geometry": {
            "a_lon": -89.10575128,
            "a_lat": 42.56240918,
            "b_lon": -89.10575128,
            "b_lat": 42.56240918,
            "trial_swath_ft": 60,
        },
    }
    resp = client.post("/design", json=payload)
    assert resp.status_code in (422, 500)


def test_invalid_field_boundary_geojson_returns_422():
    payload = {
        **SCHULTZ_PAYLOAD,
        "geometry": {
            **SCHULTZ_GEOMETRY,
            "field_boundary_geojson": {"type": "NotAGeometry", "coordinates": []},
        },
    }
    resp = client.post("/design", json=payload)
    assert resp.status_code in (422, 500)


def test_reps_out_of_range_returns_422():
    payload = {
        **SCHULTZ_PAYLOAD,
        "design": {**SCHULTZ_PAYLOAD["design"], "reps": 1},
    }
    resp = client.post("/design", json=payload)
    assert resp.status_code == 422


def test_zero_swath_returns_422():
    payload = {
        **SCHULTZ_PAYLOAD,
        "geometry": {**SCHULTZ_GEOMETRY, "trial_swath_ft": 0},
    }
    resp = client.post("/design", json=payload)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Categorical trial (no Rx shapefile)
# ---------------------------------------------------------------------------

def test_categorical_trial_no_rx_shapefile():
    payload = {
        "design": {
            "name": "Hybrid test",
            "trial_type": "seeding",
            "treatments": [
                {"label": "HybridA", "value": None, "unit": ""},
                {"label": "HybridB", "value": None, "unit": ""},
                {"label": "HybridC", "value": None, "unit": ""},
            ],
            "reps": 2,
            "plot_length_ft": 300,
        },
        "geometry": SCHULTZ_GEOMETRY,
        "soil_mode": "skip",
        "seed": 42,
    }
    resp = client.post("/design", json=payload)
    assert resp.status_code == 200
    zf = _unzip_response(resp)
    assert not any("Rx_FieldView" in n for n in zf.namelist())


def test_categorical_trial_plot_count():
    payload = {
        "design": {
            "name": "Hybrid test",
            "trial_type": "seeding",
            "treatments": [
                {"label": "HybridA", "value": None, "unit": ""},
                {"label": "HybridB", "value": None, "unit": ""},
            ],
            "reps": 3,
            "plot_length_ft": 300,
        },
        "geometry": SCHULTZ_GEOMETRY,
        "soil_mode": "skip",
        "seed": 7,
    }
    resp = client.post("/design", json=payload)
    zf = _unzip_response(resp)
    csv_name = next(n for n in zf.namelist() if n.endswith("_plots.csv"))
    lines = zf.read(csv_name).decode().strip().splitlines()
    assert len(lines) == 7  # header + 2 treatments × 3 reps


# ---------------------------------------------------------------------------
# Trial name is reflected in output filenames
# ---------------------------------------------------------------------------

def test_output_filenames_reflect_trial_name():
    payload = {**SCHULTZ_PAYLOAD, "design": {**SCHULTZ_PAYLOAD["design"], "name": "My Custom Trial"}}
    resp = client.post("/design", json=payload)
    zf = _unzip_response(resp)
    assert any("My_Custom_Trial" in n for n in zf.namelist())
