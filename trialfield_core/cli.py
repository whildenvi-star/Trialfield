"""CLI entry point for trialfield-core."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

import typer
from shapely.geometry import MultiPolygon, Polygon, box

from trialfield_core.config import load_config
from trialfield_core.geometry.headland import headland_buffer
from trialfield_core.geometry.placement import place_trial
from trialfield_core.geometry.plots import generate_plots, randomize_treatments
from trialfield_core.geometry.uv_frame import UVFrame
from trialfield_core.io.abline import read_ab_line, write_ab_line
from trialfield_core.io.field import read_field_boundary
from trialfield_core.io.ssurgo import get_soil
from trialfield_core.models.geometry_inputs import ABLine
from trialfield_core.models.soil import MajoritySoilZone
from trialfield_core.models.trial_design import TrialDesign
from trialfield_core.outputs.csv_export import write_plots_csv
from trialfield_core.outputs.kml import write_kml
from trialfield_core.outputs.map_render import write_map
from trialfield_core.outputs.sample_pins import write_sample_pins
from trialfield_core.outputs.shapefile import write_rx_shapefile
from trialfield_core.outputs.summary import write_summary

app = typer.Typer(name="trialfield", help="On-farm trial designer — geometry engine and CLI.")


def _safe_name(name: str) -> str:
    """Convert a trial name to a filesystem-safe prefix."""
    return re.sub(r"_+", "_", re.sub(r"[^a-zA-Z0-9]", "_", name.strip())).strip("_")


def _polygon_to_uv(frame: UVFrame, poly: Polygon) -> Polygon:
    exterior = [frame.wgs84_to_uv(lon, lat) for lon, lat in poly.exterior.coords]
    holes = [
        [frame.wgs84_to_uv(lon, lat) for lon, lat in ring.coords]
        for ring in poly.interiors
    ]
    return Polygon(exterior, holes)


def _field_to_uv(frame: UVFrame, geom: Polygon | MultiPolygon) -> Polygon | MultiPolygon:
    """Re-project a WGS84 Shapely geometry into the UV frame (feet)."""
    if isinstance(geom, MultiPolygon):
        return MultiPolygon([_polygon_to_uv(frame, p) for p in geom.geoms])
    return _polygon_to_uv(frame, geom)


def _run_design(
    trial: TrialDesign,
    ab: ABLine,
    swath_ft: float,
    soil_mode: str,
    out_dir: Path,
    field_path: Optional[str],
    seed: int = 42,
) -> None:
    """Core pipeline: geometry → plots → soil → write all outputs."""
    frame = UVFrame.from_ab_wgs84(ab.a_lon, ab.a_lat, ab.b_lon, ab.b_lat)

    # Field boundary → UV frame
    field_wgs84 = None
    if field_path:
        try:
            field_wgs84 = read_field_boundary(field_path)
        except Exception as exc:
            typer.echo(f"[trialfield] warning: could not read field boundary: {exc}", err=True)

    if field_wgs84 is not None:
        field_uv = _field_to_uv(frame, field_wgs84)
        headland_ft = 2.0 * swath_ft
        buffered = headland_buffer(field_uv, headland_ft)
        if buffered is None:
            typer.echo("[trialfield] warning: headland buffer consumed entire field; using unbuffered", err=True)
            buffered = field_uv
        field_uv = buffered
    else:
        # No boundary: generate a generous synthetic field in UV space
        n_strips = trial.n_treatments
        v_needed = trial.reps * n_strips * swath_ft * 2.0
        u_needed = trial.plot_length_ft * 4.0
        field_uv = box(-u_needed / 2, swath_ft, u_needed / 2, v_needed)

    # v_ref: align the swath grid to the south edge of the usable field
    v_ref = field_uv.bounds[1]  # miny of buffered field

    # Placement
    blocks = place_trial(
        field_uv=field_uv,
        n_reps=trial.reps,
        n_strips=trial.n_treatments,
        swath_width_ft=swath_ft,
        plot_length_ft=trial.plot_length_ft,
        v_ref=v_ref,
    )

    # Treatment randomisation (deterministic with fixed seed)
    assignments = randomize_treatments(trial.reps, trial.n_treatments, seed=seed)

    # Plot generation
    plots = generate_plots(
        blocks=blocks,
        treatment_assignments=assignments,
        treatments=trial.treatments,
        swath_width_ft=swath_ft,
        frame=frame,
    )

    # Soil
    if field_wgs84 is not None:
        lon_min, lat_min, lon_max, lat_max = field_wgs84.bounds
        soil: MajoritySoilZone = get_soil(soil_mode, lon_min, lat_min, lon_max, lat_max)
    else:
        soil = get_soil(soil_mode)

    # Write outputs
    trial_name = _safe_name(trial.name)
    out_dir.mkdir(parents=True, exist_ok=True)

    write_plots_csv(plots, trial, trial_name, out_dir)
    write_rx_shapefile(plots, trial_name, out_dir)
    write_ab_line(ab, out_dir / f"{trial_name}_AB_line.zip")
    write_kml(plots, trial, trial_name, out_dir)
    write_sample_pins(plots, trial_name, out_dir)
    write_summary(trial, plots, blocks, soil, ab, trial_name, out_dir)
    write_map(plots, trial, trial_name, out_dir)

    n_files = len(list(out_dir.iterdir()))
    typer.echo(
        f"✓ {trial_name}: {len(plots)} plots · {trial.reps} reps · "
        f"{trial.n_treatments} treatments · {n_files} files → {out_dir}"
    )


@app.callback()
def _root() -> None:
    """On-farm trial designer."""


@app.command()
def design(
    config: Optional[str] = typer.Option(None, "--config", help="Path to trial YAML config file."),
    design_prose: Optional[str] = typer.Option(None, "--design-prose", help="Free-text trial description."),
    design_doc: Optional[str] = typer.Option(None, "--design-doc", help="Path to PDF or docx trial document."),
    field: Optional[str] = typer.Option(None, "--field", help="Field boundary shapefile zip (optional)."),
    ab_line: Optional[str] = typer.Option(None, "--ab-line", help="AB line shapefile (required unless --config)."),
    trial_swath_ft: Optional[float] = typer.Option(None, "--trial-swath-ft", help="Trial swath width in feet."),
    combine_ft: Optional[float] = typer.Option(None, "--combine-ft", help="Combine header width in feet (optional)."),
    soil_mode: str = typer.Option("auto", "--soil-mode", help="Soil mode: auto | shapefile:<path> | skip."),
    output: str = typer.Option("./out/", "--output", help="Output directory."),
    seed: int = typer.Option(42, "--seed", help="Random seed for treatment assignment (for reproducibility)."),
) -> None:
    """Design a strip trial and produce the output file bundle."""
    # --- Config-file path ---
    if config is not None:
        try:
            cfg = load_config(config)
        except FileNotFoundError:
            typer.echo(f"Error: config file not found: {config}", err=True)
            raise typer.Exit(1)
        except Exception as exc:
            typer.echo(f"Error loading config: {exc}", err=True)
            raise typer.Exit(1)

        trial = cfg.to_trial_design()
        ab = read_ab_line(cfg.geometry.ab_line)
        swath = cfg.geometry.trial_swath_ft
        field_p = cfg.geometry.field_boundary
        out_p = Path(cfg.output.dir)
        s_mode = cfg.geometry.soil_mode
        _run_design(trial, ab, swath, s_mode, out_p, field_p, seed=seed)
        return

    # --- Flag-based path ---
    if design_prose is None and design_doc is None:
        typer.echo(
            "Error: provide --config, --design-prose, or --design-doc.",
            err=True,
        )
        raise typer.Exit(1)

    if ab_line is None:
        typer.echo("Error: --ab-line is required when not using --config.", err=True)
        raise typer.Exit(1)

    if trial_swath_ft is None:
        typer.echo("Error: --trial-swath-ft is required when not using --config.", err=True)
        raise typer.Exit(1)

    # Parse trial design from prose or document
    if design_prose is not None:
        from trialfield_core.io.design_parser import parse_prose
        try:
            trial = parse_prose(design_prose)
        except Exception as exc:
            typer.echo(f"Error parsing design prose: {exc}", err=True)
            raise typer.Exit(1)
    else:
        doc_path = Path(design_doc)  # type: ignore[arg-type]
        if doc_path.suffix.lower() == ".pdf":
            from trialfield_core.io.design_parser import parse_pdf
            try:
                trial = parse_pdf(doc_path)
            except Exception as exc:
                typer.echo(f"Error parsing PDF: {exc}", err=True)
                raise typer.Exit(1)
        else:
            from trialfield_core.io.design_parser import parse_docx
            try:
                trial = parse_docx(doc_path)
            except Exception as exc:
                typer.echo(f"Error parsing docx: {exc}", err=True)
                raise typer.Exit(1)

    ab = read_ab_line(ab_line)
    _run_design(trial, ab, trial_swath_ft, soil_mode, Path(output), field, seed=seed)


if __name__ == "__main__":
    app()
