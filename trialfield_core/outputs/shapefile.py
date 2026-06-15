"""Write FieldView Rx shapefile zip and AB line shapefile zip."""

from __future__ import annotations

import os
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

import shapefile

from trialfield_core.geometry.plots import PlotRecord

_WGS84_PRJ = (
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",'
    'SPHEROID["WGS_1984",6378137.0,298.257223563]],'
    'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'
)


def _zip_shapefile(tmp_dir: str, stem: str, out_path: Path) -> None:
    """Bundle .shp/.dbf/.shx/.prj into a zip at out_path."""
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for ext in (".shp", ".dbf", ".shx", ".prj"):
            src = os.path.join(tmp_dir, stem + ext)
            if os.path.exists(src):
                zf.write(src, stem + ext)


def write_rx_shapefile(
    plots: list[PlotRecord],
    trial_name: str,
    out_dir: Path,
) -> Optional[Path]:
    """Write FieldView prescription shapefile zip.

    Returns None (and writes nothing) for categorical trials.
    Fields: Rate(N), Plot_ID(C), Rep(N), Rep_Pos(C), Strip(N), Acres(N), Notes(C).
    """
    if not plots or plots[0].treatment.is_categorical:
        return None

    out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{trial_name}_Rx_FieldView"
    out_path = out_dir / f"{stem}.zip"

    with tempfile.TemporaryDirectory() as tmp:
        w = shapefile.Writer(os.path.join(tmp, stem), shapeType=5)
        w.field("Rate", "N", 50, 0)
        w.field("Plot_ID", "C", 20)
        w.field("Rep", "N", 50, 0)
        w.field("Rep_Pos", "C", 4)
        w.field("Strip", "N", 50, 0)
        w.field("Acres", "N", 50, 3)
        w.field("Notes", "C", 80)

        for p in plots:
            pts = [[lon, lat] for lon, lat in p.polygon_wgs84]
            w.poly([pts])
            v = p.treatment.value
            rate_int = int(v) if v == int(v) else v  # type: ignore[arg-type]
            unit = p.treatment.unit or ""
            notes = f"Rep {p.rep} ({p.rep_position}) strip {p.strip}: {rate_int} {unit}".strip()
            w.record(
                rate_int,
                p.plot_id,
                p.rep,
                p.rep_position,
                p.strip,
                p.acres,
                notes,
            )
        w.close()

        with open(os.path.join(tmp, stem + ".prj"), "w") as fh:
            fh.write(_WGS84_PRJ)

        _zip_shapefile(tmp, stem, out_path)

    return out_path
