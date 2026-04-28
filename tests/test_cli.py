"""CLI integration tests — Step 8."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
import yaml
from typer.testing import CliRunner

from trialfield_core.cli import app

PROJ_ROOT = Path(__file__).parent.parent
SCHULTZ_YAML = PROJ_ROOT / "tests" / "fixtures" / "schultz.yaml"

runner = CliRunner()

needs_key = pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set",
)


# ---------------------------------------------------------------------------
# Help and flag validation
# ---------------------------------------------------------------------------


def test_help():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "trialfield" in result.output.lower()


def test_design_help():
    result = runner.invoke(app, ["design", "--help"])
    assert result.exit_code == 0
    assert "--config" in result.output
    assert "--ab-line" in result.output
    assert "--trial-swath-ft" in result.output


def test_no_inputs_exits_nonzero():
    result = runner.invoke(app, ["design"])
    assert result.exit_code != 0


def test_missing_ab_line_exits_nonzero():
    result = runner.invoke(app, ["design", "--design-prose", "test", "--trial-swath-ft", "60"])
    assert result.exit_code != 0


def test_missing_swath_ft_exits_nonzero():
    result = runner.invoke(app, ["design", "--design-prose", "test", "--ab-line", "dummy.zip"])
    assert result.exit_code != 0


def test_config_not_found_exits_nonzero():
    result = runner.invoke(app, ["design", "--config", "nonexistent_totally_bogus.yaml"])
    assert result.exit_code != 0


# ---------------------------------------------------------------------------
# Schultz end-to-end (no API key needed — uses config path with soil_mode=skip)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not SCHULTZ_YAML.exists(), reason="Schultz fixture missing")
def test_schultz_end_to_end(tmp_path):
    """Full pipeline: 4 reps × 6 treatments = 24 plots, 7+ output files."""
    # Build a patched config with absolute paths and a temp output dir
    with SCHULTZ_YAML.open() as f:
        cfg = yaml.safe_load(f)

    cfg["geometry"]["ab_line"] = str(PROJ_ROOT / "reference" / "example_inputs" / "schultz.zip")
    cfg["geometry"]["field_boundary"] = str(PROJ_ROOT / "reference" / "example_inputs" / "schultz_poly.zip")
    cfg["output"]["dir"] = str(tmp_path)

    patched = tmp_path / "schultz_abs.yaml"
    with patched.open("w") as f:
        yaml.dump(cfg, f)

    result = runner.invoke(app, ["design", "--config", str(patched)])

    assert result.exit_code == 0, (
        f"CLI exited {result.exit_code}\n"
        f"output:\n{result.output}\n"
        f"exception: {result.exception}"
    )

    # stdout summary line
    assert "24 plots" in result.output
    assert "4 reps" in result.output
    assert "6 treatments" in result.output

    files = list(tmp_path.glob("*"))
    suffixes = {f.suffix for f in files}
    names = {f.name for f in files}

    assert ".csv" in suffixes, f"Missing plots CSV — files: {names}"
    assert ".kml" in suffixes, f"Missing KML — files: {names}"
    assert ".xlsx" in suffixes, f"Missing sample pins XLSX — files: {names}"
    assert ".md" in suffixes, f"Missing summary MD — files: {names}"
    assert ".png" in suffixes, f"Missing layout PNG — files: {names}"
    assert ".pdf" in suffixes, f"Missing field map PDF — files: {names}"

    # FieldView Rx zip (numeric trial → must be present)
    rx_zips = [f for f in files if "FieldView" in f.name and f.suffix == ".zip"]
    assert rx_zips, f"Missing FieldView Rx zip — files: {names}"

    # AB line zip
    ab_zips = [f for f in files if "AB_line" in f.name and f.suffix == ".zip"]
    assert ab_zips, f"Missing AB line zip — files: {names}"


@pytest.mark.skipif(not SCHULTZ_YAML.exists(), reason="Schultz fixture missing")
def test_schultz_seed_determinism(tmp_path):
    """Same seed → identical treatment-assignment CSV lines."""
    with SCHULTZ_YAML.open() as f:
        cfg = yaml.safe_load(f)

    cfg["geometry"]["ab_line"] = str(PROJ_ROOT / "reference" / "example_inputs" / "schultz.zip")
    cfg["geometry"]["field_boundary"] = str(PROJ_ROOT / "reference" / "example_inputs" / "schultz_poly.zip")

    out1 = tmp_path / "run1"
    out2 = tmp_path / "run2"

    for out_dir in (out1, out2):
        cfg["output"]["dir"] = str(out_dir)
        patched = tmp_path / f"{out_dir.name}.yaml"
        with patched.open("w") as f:
            yaml.dump(cfg, f)
        result = runner.invoke(app, ["design", "--config", str(patched), "--seed", "42"])
        assert result.exit_code == 0, result.output

    # Compare CSV treatment columns
    csv1 = next(out1.glob("*.csv"))
    csv2 = next(out2.glob("*.csv"))
    assert csv1.read_text() == csv2.read_text(), "Non-deterministic output with identical seed"


# ---------------------------------------------------------------------------
# Prose path (requires API key)
# ---------------------------------------------------------------------------


@needs_key
def test_prose_end_to_end(tmp_path):
    """Flag-based prose path produces ≥7 files."""
    ab_path = PROJ_ROOT / "reference" / "example_inputs" / "schultz.zip"
    result = runner.invoke(app, [
        "design",
        "--design-prose", "N-rate fertility trial: 0, 100, 200 lb N/ac, 3 reps",
        "--ab-line", str(ab_path),
        "--trial-swath-ft", "60",
        "--soil-mode", "skip",
        "--output", str(tmp_path),
    ])
    assert result.exit_code == 0, (
        f"CLI exited {result.exit_code}\n{result.output}\n{result.exception}"
    )
    files = list(tmp_path.glob("*"))
    assert len(files) >= 7, f"Expected ≥7 output files, got {len(files)}: {[f.name for f in files]}"
