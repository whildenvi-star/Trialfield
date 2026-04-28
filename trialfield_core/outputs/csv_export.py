"""Write the plots CSV with one row per plot including lat/lon corners and v-position from AB."""

from __future__ import annotations

import csv
from pathlib import Path

from trialfield_core.geometry.plots import PlotRecord
from trialfield_core.models.trial_design import TrialDesign


def write_plots_csv(
    plots: list[PlotRecord],
    trial: TrialDesign,
    trial_name: str,
    out_dir: Path,
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

    return out_path
