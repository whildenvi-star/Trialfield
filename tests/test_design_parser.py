"""Tests for the design parser (LLM-based). Skipped when ANTHROPIC_API_KEY is absent."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

REFERENCE = Path(__file__).parent.parent / "reference" / "example_inputs"
FOTR_DOCX = REFERENCE / "FOTR_Plot_Map_Option.docx"

needs_key = pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set",
)


# ---------------------------------------------------------------------------
# Prose inputs — the critical v2 entry path
# ---------------------------------------------------------------------------


@needs_key
def test_prose_n_rate_three():
    """'I want to test 0/50/100 lb N' → fertility, 3 treatments."""
    from trialfield_core.io.design_parser import parse_prose
    from trialfield_core.models.trial_design import TrialType

    td = parse_prose("I want to test 0/50/100 lb N")
    assert td.trial_type == TrialType.fertility
    assert td.n_treatments == 3
    values = sorted(t.value for t in td.treatments)
    assert values == [0.0, 50.0, 100.0]
    assert not td.categorical


@needs_key
def test_prose_seeding_rates():
    """'compare seeding rates 28k 30k 32k 34k 36k' → seeding, 5 treatments."""
    from trialfield_core.io.design_parser import parse_prose
    from trialfield_core.models.trial_design import TrialType

    td = parse_prose("compare seeding rates 28k 30k 32k 34k 36k")
    assert td.trial_type == TrialType.seeding
    assert td.n_treatments == 5
    values = sorted(t.value for t in td.treatments)
    assert values == [28000.0, 30000.0, 32000.0, 34000.0, 36000.0]
    assert not td.categorical


@needs_key
def test_prose_tank_mix_categorical():
    """'tank mix A vs tank mix B vs untreated control' → spray, all categorical."""
    from trialfield_core.io.design_parser import parse_prose
    from trialfield_core.models.trial_design import TrialType

    td = parse_prose("tank mix A vs tank mix B vs untreated control")
    assert td.trial_type == TrialType.spray
    assert td.n_treatments == 3
    assert td.categorical
    assert all(t.is_categorical for t in td.treatments)


# ---------------------------------------------------------------------------
# FOTR docx — image containing a plot map with 6 N rates × 4 reps
# ---------------------------------------------------------------------------


@needs_key
@pytest.mark.skipif(not FOTR_DOCX.exists(), reason="FOTR docx fixture not found")
def test_fotr_docx_n_rate_six():
    """FOTR plot map → fertility, 6 treatments (0/50/100/150/200/250), 4 reps."""
    from trialfield_core.io.design_parser import parse_docx
    from trialfield_core.models.trial_design import TrialType

    td = parse_docx(FOTR_DOCX)
    assert td.trial_type == TrialType.fertility
    assert td.n_treatments == 6
    assert td.reps == 4
    assert not td.categorical
    values = sorted(t.value for t in td.treatments)
    assert values == [0.0, 50.0, 100.0, 150.0, 200.0, 250.0]
    # Image says ~400 ft; fertility default is 400 ft either way
    assert td.plot_length_ft == 400.0


# ---------------------------------------------------------------------------
# parse_design dispatcher
# ---------------------------------------------------------------------------


@needs_key
def test_parse_design_prose_dispatch():
    """parse_design(prose=...) routes correctly to the prose path."""
    from trialfield_core.io.design_parser import parse_design
    from trialfield_core.models.trial_design import TrialType

    td = parse_design(prose="I want to test 0/100/200 lb N")
    assert td.trial_type == TrialType.fertility
    assert td.n_treatments == 3
    values = sorted(t.value for t in td.treatments)
    assert values == [0.0, 100.0, 200.0]


def test_parse_design_no_inputs():
    """parse_design() with no arguments raises ValueError."""
    from trialfield_core.io.design_parser import parse_design

    with pytest.raises(ValueError, match="At least one of"):
        parse_design()


def test_parse_docx_missing_file():
    from trialfield_core.io.design_parser import parse_docx

    with pytest.raises(FileNotFoundError):
        parse_docx("/nonexistent/file.docx")


def test_parse_pdf_missing_file():
    from trialfield_core.io.design_parser import parse_pdf

    with pytest.raises(FileNotFoundError):
        parse_pdf("/nonexistent/file.pdf")
