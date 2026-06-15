"""Tests for Pydantic models: serialization roundtrips, validation, and defaults."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from trialfield_core.config import TrialRunConfig, load_config
from trialfield_core.models.geometry_inputs import ABLine, FieldBoundary, ImplementWidths
from trialfield_core.models.trial_design import (
    RepLayout,
    Treatment,
    TrialDesign,
    TrialType,
)

FIXTURES = Path(__file__).parent / "fixtures"


# ---------------------------------------------------------------------------
# Treatment
# ---------------------------------------------------------------------------


def test_treatment_numeric_roundtrip():
    t = Treatment(label="150", value=150.0, unit="lb N/ac")
    data = t.model_dump()
    t2 = Treatment.model_validate(data)
    assert t2 == t


def test_treatment_categorical_roundtrip():
    t = Treatment(label="Tank Mix A")
    assert t.is_categorical
    assert t.value is None
    data = t.model_dump()
    t2 = Treatment.model_validate(data)
    assert t2 == t
    assert t2.is_categorical


def test_treatment_numeric_string_coerced():
    """Numeric strings like "150" in YAML must be coerced to float."""
    t = Treatment.model_validate({"label": "150", "value": "150", "unit": "lb N/ac"})
    assert t.value == 150.0
    assert not t.is_categorical


def test_treatment_zero_is_valid():
    """Zero is a valid numeric rate (e.g. untreated check)."""
    t = Treatment(label="0", value=0.0, unit="lb N/ac")
    assert not t.is_categorical
    assert t.value == 0.0


def test_treatment_rejects_non_numeric_string():
    """A non-numeric string value should raise ValidationError."""
    with pytest.raises(ValidationError, match="Treatment value must be a number"):
        Treatment(label="Tank Mix A", value="A")


# ---------------------------------------------------------------------------
# TrialDesign
# ---------------------------------------------------------------------------


def test_trial_design_roundtrip_numeric():
    td = TrialDesign(
        name="N-rate test",
        trial_type=TrialType.fertility,
        treatments=[
            Treatment(label="0", value=0, unit="lb N/ac"),
            Treatment(label="100", value=100, unit="lb N/ac"),
            Treatment(label="200", value=200, unit="lb N/ac"),
        ],
        reps=4,
    )
    data = td.model_dump()
    td2 = TrialDesign.model_validate(data)
    assert td2.name == td.name
    assert td2.trial_type == td.trial_type
    assert td2.reps == td.reps
    assert len(td2.treatments) == 3
    assert td2.plot_length_ft == 400.0  # default for fertility
    assert not td2.categorical


def test_trial_design_roundtrip_categorical():
    td = TrialDesign(
        name="Tank mix comparison",
        trial_type=TrialType.spray,
        treatments=[
            Treatment(label="Tank Mix A"),
            Treatment(label="Tank Mix B"),
            Treatment(label="Untreated"),
        ],
        reps=4,
        plot_length_ft=300.0,
    )
    assert td.categorical
    data = td.model_dump()
    td2 = TrialDesign.model_validate(data)
    assert td2.categorical
    assert td2.n_treatments == 3
    assert all(t.is_categorical for t in td2.treatments)


def test_trial_design_json_roundtrip():
    td = TrialDesign(
        trial_type=TrialType.seeding,
        treatments=[
            Treatment(label="28k", value=28000, unit="seeds/ac"),
            Treatment(label="32k", value=32000, unit="seeds/ac"),
            Treatment(label="36k", value=36000, unit="seeds/ac"),
        ],
        reps=3,
    )
    j = td.model_dump_json()
    td2 = TrialDesign.model_validate_json(j)
    assert td2.reps == 3
    assert td2.plot_length_ft == 400.0  # seeding default
    assert td2.treatments[1].value == 32000.0


def test_plot_length_defaults():
    """Each trial type must produce the correct default plot length."""
    expected = {
        TrialType.fertility: 400.0,
        TrialType.seeding: 400.0,
        TrialType.spray: 300.0,
        TrialType.tillage: 600.0,
        TrialType.ground_speed: 800.0,
    }
    base_treatments = [
        Treatment(label="A", value=1),
        Treatment(label="B", value=2),
    ]
    for tt, length in expected.items():
        td = TrialDesign(trial_type=tt, treatments=base_treatments)
        assert td.plot_length_ft == length, f"{tt}: expected {length}, got {td.plot_length_ft}"


def test_trial_type_other_requires_plot_length():
    with pytest.raises(ValidationError, match="plot_length_ft is required"):
        TrialDesign(
            trial_type=TrialType.other,
            treatments=[Treatment(label="A", value=1), Treatment(label="B", value=2)],
        )


def test_trial_type_other_with_explicit_length():
    td = TrialDesign(
        trial_type=TrialType.other,
        treatments=[Treatment(label="A", value=1), Treatment(label="B", value=2)],
        plot_length_ft=500.0,
    )
    assert td.plot_length_ft == 500.0


def test_reps_out_of_range():
    with pytest.raises(ValidationError):
        TrialDesign(
            trial_type=TrialType.fertility,
            treatments=[Treatment(label="A", value=1), Treatment(label="B", value=2)],
            reps=1,
        )
    with pytest.raises(ValidationError):
        TrialDesign(
            trial_type=TrialType.fertility,
            treatments=[Treatment(label="A", value=1), Treatment(label="B", value=2)],
            reps=9,
        )


def test_mixed_categorical_numeric_rejected():
    with pytest.raises(ValidationError, match="all numeric or all categorical"):
        TrialDesign(
            trial_type=TrialType.spray,
            treatments=[
                Treatment(label="100", value=100, unit="lb/ac"),
                Treatment(label="Untreated"),  # categorical
            ],
        )


def test_minimum_two_treatments():
    with pytest.raises(ValidationError):
        TrialDesign(
            trial_type=TrialType.fertility,
            treatments=[Treatment(label="A", value=1)],
        )


# ---------------------------------------------------------------------------
# RepLayout
# ---------------------------------------------------------------------------


def test_rep_layout_roundtrip():
    rl = RepLayout(
        rep=1,
        label="NW",
        u_west_ft=-688.0,
        u_east_ft=-288.0,
        v_south_ft=690.0,
        v_north_ft=1050.0,
        treatment_order=[4, 1, 3, 5, 2, 0],
    )
    assert rl.plot_length_ft == 400.0
    assert rl.block_height_ft == 360.0
    data = rl.model_dump()
    rl2 = RepLayout.model_validate(data)
    assert rl2 == rl


# ---------------------------------------------------------------------------
# ABLine / ImplementWidths
# ---------------------------------------------------------------------------


def test_ab_line_distinct_check():
    with pytest.raises(ValidationError, match="must be distinct"):
        ABLine(a_lon=-89.1, a_lat=42.5, b_lon=-89.1, b_lat=42.5)


def test_ab_line_roundtrip():
    ab = ABLine(a_lon=-89.10575128, a_lat=42.56240918, b_lon=-89.11104903, b_lat=42.56250344, bearing_deg=271.38)
    data = ab.model_dump()
    ab2 = ABLine.model_validate(data)
    assert ab2 == ab


def test_implement_widths_roundtrip():
    iw = ImplementWidths(trial_swath_ft=60.0, combine_ft=30.0)
    data = iw.model_dump()
    iw2 = ImplementWidths.model_validate(data)
    assert iw2 == iw


def test_implement_widths_optional_combine():
    iw = ImplementWidths(trial_swath_ft=60.0)
    assert iw.combine_ft is None
    iw2 = ImplementWidths.model_validate(iw.model_dump())
    assert iw2.combine_ft is None


# ---------------------------------------------------------------------------
# Config / YAML loading
# ---------------------------------------------------------------------------


def test_load_schultz_config():
    """The Schultz YAML fixture must load and validate correctly."""
    config = load_config(FIXTURES / "schultz.yaml")
    assert isinstance(config, TrialRunConfig)
    td = config.to_trial_design()
    assert td.trial_type == TrialType.fertility
    assert td.n_treatments == 6
    assert td.reps == 4
    assert td.plot_length_ft == 400.0
    assert not td.categorical
    assert td.treatments[0].value == 0.0
    assert td.treatments[5].value == 250.0


def test_load_schultz_config_geometry():
    config = load_config(FIXTURES / "schultz.yaml")
    iw = config.to_implement_widths()
    assert iw.trial_swath_ft == 60.0
    assert iw.combine_ft is None
    assert config.geometry.soil_mode == "skip"
    assert "schultz.zip" in config.geometry.ab_line


def test_config_missing_file():
    with pytest.raises(FileNotFoundError):
        load_config("/nonexistent/path/trial.yaml")


def test_config_roundtrip_json():
    """TrialRunConfig can roundtrip through JSON (for API use)."""
    config = load_config(FIXTURES / "schultz.yaml")
    j = config.model_dump_json()
    config2 = TrialRunConfig.model_validate_json(j)
    assert config2.trial.name == config.trial.name
    assert len(config2.trial.treatments) == 6
