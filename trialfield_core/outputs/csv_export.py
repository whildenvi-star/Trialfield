"""Write the plots CSV with one row per plot including lat/lon corners and v-position from AB."""

from __future__ import annotations

import csv
from pathlib import Path

from trialfield_core.geometry.placement import RepBlock
from trialfield_core.geometry.plots import PlotRecord
from trialfield_core.geometry.uv_frame import UVFrame
from trialfield_core.models.trial_design import TrialDesign


def _nav_urls(lat: float, lon: float, label: str) -> tuple[str, str]:
    lat_r, lon_r = round(lat, 7), round(lon, 7)
    gmaps = f"https://www.google.com/maps?q={lat_r},{lon_r}"
    amaps = f"https://maps.apple.com/?ll={lat_r},{lon_r}&q={label.replace(' ', '%20')}"
    return gmaps, amaps


def write_plots_csv(
    plots: list[PlotRecord],
    trial: TrialDesign,
    trial_name: str,
    out_dir: Path,
    blocks: list[RepBlock] | None = None,
    frame: UVFrame | None = None,
) -> Path:
    """Write one CSV row per plot; return the output path."""
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{trial_name}_plots.csv"

    if trial.categorical:
        rate_col = "Treatment_Label"
    else:
        unit = trial.treatments[0].unit if trial.treatments else ""
        unit_slug = unit.replace(" ", "").replace("/", "_") if unit else ""
        rate_col = f"Rate_{unit_slug}" if unit_slug else "Rate"

    with out_path.open("w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow([
            "Plot_ID", "Rep", "Rep_Position", "Strip",
            rate_col, "Acres",
            "v_south_ft", "v_north_ft", "u_west_ft", "u_east_ft",
            "SW_Lat", "SW_Lon", "NE_Lat", "NE_Lon",
        ])
        for p in plots:
            rate = p.treatment.label if trial.categorical else p.treatment.value
            writer.writerow([
                p.plot_id, p.rep, p.rep_position, p.strip,
                rate, p.acres,
                p.v_south_ft, p.v_north_ft, p.u_west_ft, p.u_east_ft,
                p.sw_lat, p.sw_lon, p.ne_lat, p.ne_lon,
            ])

        if blocks and frame:
            _write_exterior_corners(writer, blocks, frame)
            _write_replication_corners(writer, blocks, frame)

    return out_path


def _write_exterior_corners(
    writer: csv.writer,
    blocks: list[RepBlock],
    frame: UVFrame,
) -> None:
    u_min = min(b.u_west for b in blocks)
    u_max = max(b.u_east for b in blocks)
    v_min = min(b.v_south for b in blocks)
    v_max = max(b.v_north for b in blocks)

    corners = [
        ("SW Corner", u_min, v_min),
        ("SE Corner", u_max, v_min),
        ("NE Corner", u_max, v_max),
        ("NW Corner", u_min, v_max),
    ]

    writer.writerow([])
    writer.writerow(["TRIAL EXTERIOR CORNERS"])
    writer.writerow(["Corner", "Lat", "Lon", "Google_Maps", "Apple_Maps"])
    for label, u, v in corners:
        lon, lat = frame.uv_to_wgs84(u, v)
        gmaps, amaps = _nav_urls(lat, lon, label)
        writer.writerow([label, round(lat, 7), round(lon, 7), gmaps, amaps])


def _write_replication_corners(
    writer: csv.writer,
    blocks: list[RepBlock],
    frame: UVFrame,
) -> None:
    writer.writerow([])
    writer.writerow(["REPLICATION CORNERS"])
    writer.writerow(["Rep", "Position", "Corner", "Lat", "Lon", "Google_Maps", "Apple_Maps"])
    for block in sorted(blocks, key=lambda b: b.rep):
        corners = [
            ("SW", block.u_west, block.v_south),
            ("SE", block.u_east, block.v_south),
            ("NE", block.u_east, block.v_north),
            ("NW", block.u_west, block.v_north),
        ]
        for corner_name, u, v in corners:
            lon, lat = frame.uv_to_wgs84(u, v)
            label = f"Rep {block.rep} {corner_name}"
            gmaps, amaps = _nav_urls(lat, lon, label)
            writer.writerow([block.rep, block.label, corner_name, round(lat, 7), round(lon, 7), gmaps, amaps])
