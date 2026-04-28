"""Orchestrates the trialfield-core geometry pipeline for the API layer."""

from __future__ import annotations

import io
import re
import tempfile
import zipfile
from pathlib import Path

from shapely.geometry import MultiPolygon, Polygon, box
from shapely.geometry import shape as shapely_shape

from trialfield_core.geometry.headland import headland_buffer
from trialfield_core.geometry.placement import place_trial
from trialfield_core.geometry.plots import generate_plots, randomize_treatments
from trialfield_core.geometry.uv_frame import UVFrame
from trialfield_core.io.abline import write_ab_line
from trialfield_core.io.ssurgo import get_soil
from trialfield_core.models.geometry_inputs import ABLine
from trialfield_core.models.trial_design import Treatment, TrialDesign
from trialfield_core.outputs.csv_export import write_plots_csv
from trialfield_core.outputs.kml import write_kml
from trialfield_core.outputs.map_render import write_map
from trialfield_core.outputs.sample_pins import write_sample_pins
from trialfield_core.outputs.shapefile import write_rx_shapefile
from trialfield_core.outputs.summary import write_summary

from ..schemas.request import DesignRequest, DesignSource


def _safe_name(name: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^a-zA-Z0-9]", "_", name.strip())).strip("_")


def _polygon_to_uv(frame: UVFrame, poly: Polygon) -> Polygon:
    exterior = [frame.wgs84_to_uv(lon, lat) for lon, lat in poly.exterior.coords]
    holes = [
        [frame.wgs84_to_uv(lon, lat) for lon, lat in ring.coords]
        for ring in poly.interiors
    ]
    return Polygon(exterior, holes)


def _field_to_uv(frame: UVFrame, geom: Polygon | MultiPolygon) -> Polygon | MultiPolygon:
    if isinstance(geom, MultiPolygon):
        return MultiPolygon([_polygon_to_uv(frame, p) for p in geom.geoms])
    return _polygon_to_uv(frame, geom)


def _build_trial_design(src: DesignSource) -> TrialDesign:
    if src.prose is not None:
        from trialfield_core.io.design_parser import parse_prose
        return parse_prose(src.prose)

    treatments = [
        Treatment(label=t.label, value=t.value, unit=t.unit)
        for t in src.treatments  # type: ignore[union-attr]
    ]
    return TrialDesign(
        name=src.name,
        trial_type=src.trial_type,
        treatments=treatments,
        reps=src.reps,
        plot_length_ft=src.plot_length_ft,
    )


def run_design_to_zip(req: DesignRequest) -> tuple[bytes, str]:
    """Run the full design pipeline; return (zip_bytes, safe_trial_name).

    Runs synchronously — FastAPI will dispatch to a thread pool when the route
    handler is declared as a plain `def` (not `async def`).
    """
    with tempfile.TemporaryDirectory() as tmp:
        out_dir = Path(tmp)
        trial_name = _run_pipeline(req, out_dir)
        zip_bytes = _assemble_zip(out_dir)
    return zip_bytes, trial_name


def _run_pipeline(req: DesignRequest, out_dir: Path) -> str:
    trial = _build_trial_design(req.design)

    g = req.geometry
    ab = ABLine(a_lon=g.a_lon, a_lat=g.a_lat, b_lon=g.b_lon, b_lat=g.b_lat)
    frame = UVFrame.from_ab_wgs84(ab.a_lon, ab.a_lat, ab.b_lon, ab.b_lat)

    # Field boundary: GeoJSON dict → Shapely geometry
    field_wgs84: Polygon | MultiPolygon | None = None
    if g.field_boundary_geojson is not None:
        try:
            field_wgs84 = shapely_shape(g.field_boundary_geojson)
        except Exception as exc:
            raise ValueError(f"invalid field_boundary_geojson: {exc}") from exc

    if field_wgs84 is not None:
        field_uv = _field_to_uv(frame, field_wgs84)
        headland_ft = 2.0 * g.trial_swath_ft
        buffered = headland_buffer(field_uv, headland_ft)
        field_uv = buffered if buffered is not None else field_uv
    else:
        n_strips = trial.n_treatments
        v_needed = trial.reps * n_strips * g.trial_swath_ft * 2.0
        u_needed = trial.plot_length_ft * 4.0
        field_uv = box(-u_needed / 2, g.trial_swath_ft, u_needed / 2, v_needed)

    v_ref = field_uv.bounds[1]

    blocks = place_trial(
        field_uv=field_uv,
        n_reps=trial.reps,
        n_strips=trial.n_treatments,
        swath_width_ft=g.trial_swath_ft,
        plot_length_ft=trial.plot_length_ft,
        v_ref=v_ref,
    )

    assignments = randomize_treatments(trial.reps, trial.n_treatments, seed=req.seed)
    plots = generate_plots(
        blocks=blocks,
        treatment_assignments=assignments,
        treatments=trial.treatments,
        swath_width_ft=g.trial_swath_ft,
        frame=frame,
    )

    if field_wgs84 is not None:
        lon_min, lat_min, lon_max, lat_max = field_wgs84.bounds
        soil = get_soil(req.soil_mode, lon_min, lat_min, lon_max, lat_max)
    else:
        soil = get_soil(req.soil_mode)

    trial_name = _safe_name(trial.name)
    out_dir.mkdir(parents=True, exist_ok=True)

    write_plots_csv(plots, trial, trial_name, out_dir)
    write_rx_shapefile(plots, trial_name, out_dir)
    write_ab_line(ab, out_dir / f"{trial_name}_AB_line.zip")
    write_kml(plots, trial, trial_name, out_dir)
    write_sample_pins(plots, trial_name, out_dir)
    write_summary(trial, plots, blocks, soil, ab, trial_name, out_dir)
    write_map(plots, trial, trial_name, out_dir)

    return trial_name


def _assemble_zip(out_dir: Path) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(out_dir.iterdir()):
            zf.write(path, path.name)
    return buf.getvalue()
