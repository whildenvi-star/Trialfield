"""Tests for the SDA soil-fetch module (all HTTP calls mocked)."""

from __future__ import annotations

import json
from io import StringIO
from unittest.mock import MagicMock, patch

import pytest
import requests

from trialfield_core.io.ssurgo import fetch_soil, get_soil
from trialfield_core.models.soil import MajoritySoilZone, SSURGOComponent

# ---------------------------------------------------------------------------
# Sample AOI bounding box (Schultz field vicinity)
# ---------------------------------------------------------------------------
LON_MIN, LAT_MIN = -89.12, 42.56
LON_MAX, LAT_MAX = -89.10, 42.57

# ---------------------------------------------------------------------------
# Helper: build a realistic SDA JSON response
# ---------------------------------------------------------------------------

_SAMPLE_TABLE = [
    ["123456", "Drummer silty clay loam", 75.0, "A/D", "Mollisols"],
    ["123456", "Flanagan silt loam", 20.0, "C", "Mollisols"],
    ["789012", "Sabina silt loam", 5.0, "C", "Alfisols"],
]


def _mock_response(table, status_code: int = 200):
    """Build a mock requests.Response with the given JSON table payload."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = {"Table": table}
    if status_code >= 400:
        resp.raise_for_status.side_effect = requests.exceptions.HTTPError(
            f"{status_code} Error", response=resp
        )
    else:
        resp.raise_for_status.return_value = None
    return resp


# ---------------------------------------------------------------------------
# Success path
# ---------------------------------------------------------------------------


def test_fetch_soil_success():
    """Happy-path: well-formed SDA response → MajoritySoilZone with source='SDA'."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.return_value = _mock_response(_SAMPLE_TABLE)
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert isinstance(result, MajoritySoilZone)
    assert result.source == "SDA"
    assert result.note is None
    assert len(result.components) == 3


def test_fetch_soil_components_parsed_correctly():
    """Component fields are correctly mapped from the table rows."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.return_value = _mock_response(_SAMPLE_TABLE)
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    dominant = result.components[0]
    assert dominant.mukey == "123456"
    assert dominant.compname == "Drummer silty clay loam"
    assert dominant.comppct_r == 75.0
    assert dominant.hydgrp == "A/D"
    assert dominant.taxorder == "Mollisols"


def test_fetch_soil_null_optional_fields():
    """Null hydgrp/taxorder in SDA rows are stored as None."""
    table = [["99999", "Unknown series", 100.0, None, None]]
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.return_value = _mock_response(table)
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert result.components[0].hydgrp is None
    assert result.components[0].taxorder is None


def test_fetch_soil_bbox_wkt_in_result():
    """The returned WKT encodes the queried bounding box."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.return_value = _mock_response(_SAMPLE_TABLE)
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert "POLYGON" in result.wkt
    assert str(LON_MIN) in result.wkt
    assert str(LAT_MIN) in result.wkt


def test_fetch_soil_request_includes_bbox():
    """The POST body contains the AOI bounding box in the SQL."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.return_value = _mock_response(_SAMPLE_TABLE)
        fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    call_kwargs = mock_post.call_args
    sent_query = call_kwargs.kwargs["data"]["query"]
    assert str(LON_MIN) in sent_query
    assert str(LAT_MAX) in sent_query


# ---------------------------------------------------------------------------
# Failure paths — all must log to stderr and return source='unavailable'
# ---------------------------------------------------------------------------


def _fetch_soil_unavailable(**kwargs) -> MajoritySoilZone:
    """Helper: call fetch_soil with all mock kwargs, return result."""
    with patch("trialfield_core.io.ssurgo.requests.post", **kwargs):
        return fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)


def test_network_error_returns_unavailable(capsys):
    """ConnectionError → source='unavailable', logs to stderr, does not raise."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.side_effect = requests.exceptions.ConnectionError("unreachable")
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert result.source == "unavailable"
    assert result.note is not None
    captured = capsys.readouterr()
    assert "[trialfield]" in captured.err


def test_timeout_returns_unavailable(capsys):
    """Request timeout → source='unavailable', logged."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.side_effect = requests.exceptions.Timeout("timed out")
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert result.source == "unavailable"
    assert "timed out" in result.note.lower() or "timeout" in result.note.lower()
    captured = capsys.readouterr()
    assert "[trialfield]" in captured.err


def test_http_error_returns_unavailable(capsys):
    """HTTP 500 → source='unavailable', logged."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.return_value = _mock_response([], status_code=500)
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert result.source == "unavailable"
    captured = capsys.readouterr()
    assert "[trialfield]" in captured.err


def test_bad_json_returns_unavailable(capsys):
    """Non-JSON response → source='unavailable', logged."""
    resp = MagicMock()
    resp.status_code = 200
    resp.raise_for_status.return_value = None
    resp.json.side_effect = ValueError("not JSON")

    with patch("trialfield_core.io.ssurgo.requests.post", return_value=resp):
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert result.source == "unavailable"
    captured = capsys.readouterr()
    assert "[trialfield]" in captured.err


def test_missing_table_key_returns_unavailable(capsys):
    """Response JSON lacks 'Table' key → source='unavailable', logged."""
    resp = MagicMock()
    resp.status_code = 200
    resp.raise_for_status.return_value = None
    resp.json.return_value = {"error": "internal error"}

    with patch("trialfield_core.io.ssurgo.requests.post", return_value=resp):
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert result.source == "unavailable"
    captured = capsys.readouterr()
    assert "[trialfield]" in captured.err


def test_empty_table_returns_unavailable(capsys):
    """Empty table (no rows) → source='unavailable', logged."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.return_value = _mock_response([])
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert result.source == "unavailable"
    captured = capsys.readouterr()
    assert "[trialfield]" in captured.err


def test_null_table_returns_unavailable(capsys):
    """Table key present but value is null → source='unavailable', logged."""
    resp = MagicMock()
    resp.status_code = 200
    resp.raise_for_status.return_value = None
    resp.json.return_value = {"Table": None}

    with patch("trialfield_core.io.ssurgo.requests.post", return_value=resp):
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert result.source == "unavailable"
    captured = capsys.readouterr()
    assert "[trialfield]" in captured.err


def test_schema_change_short_row_returns_unavailable(capsys):
    """Row with fewer columns than expected → source='unavailable', logged."""
    table = [["123456"]]  # only mukey, missing all other fields
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.return_value = _mock_response(table)
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert result.source == "unavailable"
    captured = capsys.readouterr()
    assert "[trialfield]" in captured.err


def test_fetch_soil_never_raises():
    """fetch_soil must not propagate any exception under any failure mode."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.side_effect = RuntimeError("unexpected crash")
        result = fetch_soil(LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)  # must not raise

    assert result.source == "unavailable"


# ---------------------------------------------------------------------------
# get_soil dispatcher
# ---------------------------------------------------------------------------


def test_get_soil_skip_mode():
    """soil_mode='skip' returns unavailable immediately without HTTP call."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        result = get_soil("skip")
    mock_post.assert_not_called()
    assert result.source == "unavailable"
    assert result.note is not None


def test_get_soil_auto_calls_fetch():
    """soil_mode='auto' with bbox delegates to fetch_soil."""
    with patch("trialfield_core.io.ssurgo.requests.post") as mock_post:
        mock_post.return_value = _mock_response(_SAMPLE_TABLE)
        result = get_soil("auto", LON_MIN, LAT_MIN, LON_MAX, LAT_MAX)

    assert result.source == "SDA"
    mock_post.assert_called_once()


def test_get_soil_auto_no_bbox_returns_unavailable(capsys):
    """soil_mode='auto' without bbox → unavailable (no boundary to query)."""
    result = get_soil("auto")
    assert result.source == "unavailable"
    captured = capsys.readouterr()
    assert "[trialfield]" in captured.err


def test_get_soil_shapefile_mode_returns_unavailable(capsys):
    """soil_mode='shapefile:...' returns unavailable (not yet implemented)."""
    result = get_soil("shapefile:/path/to/soil.zip")
    assert result.source == "unavailable"


def test_get_soil_unknown_mode_returns_unavailable(capsys):
    """Unknown soil_mode → unavailable, logged."""
    result = get_soil("something_else")
    assert result.source == "unavailable"
    captured = capsys.readouterr()
    assert "[trialfield]" in captured.err


# ---------------------------------------------------------------------------
# MajoritySoilZone model
# ---------------------------------------------------------------------------


def test_majority_soil_zone_roundtrip():
    """MajoritySoilZone serialises and deserialises correctly."""
    zone = MajoritySoilZone(
        wkt="POLYGON((0 0,1 0,1 1,0 1,0 0))",
        components=[
            SSURGOComponent(mukey="1", compname="Drummer", comppct_r=80.0, hydgrp="A")
        ],
        source="SDA",
    )
    data = zone.model_dump()
    zone2 = MajoritySoilZone.model_validate(data)
    assert zone2 == zone


def test_majority_soil_zone_unavailable_roundtrip():
    """unavailable zone serialises without components."""
    zone = MajoritySoilZone(
        wkt="", components=[], source="unavailable",
        note="Soil data unavailable: timed out"
    )
    data = zone.model_dump()
    zone2 = MajoritySoilZone.model_validate(data)
    assert zone2.source == "unavailable"
    assert zone2.components == []
