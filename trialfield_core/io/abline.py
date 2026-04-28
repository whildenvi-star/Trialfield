"""Read and write AB line shapefiles; compute bearing and length."""

from __future__ import annotations

import math
import os
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

import shapefile

from trialfield_core.models.geometry_inputs import ABLine


def _open_reader(path: str | Path) -> shapefile.Reader:
    """Open a shapefile from a .zip or directory/stem path."""
    p = Path(path)
    if p.suffix.lower() == ".zip":
        tmp = tempfile.mkdtemp()
        with zipfile.ZipFile(p) as z:
            z.extractall(tmp)
        # find the .shp inside
        shps = list(Path(tmp).rglob("*.shp"))
        if not shps:
            raise FileNotFoundError(f"No .shp found in {p}")
        return shapefile.Reader(str(shps[0].with_suffix("")))
    return shapefile.Reader(str(p))


def read_ab_line(path: str | Path) -> ABLine:
    """Read an AB line shapefile and return an ABLine model.

    Supports .zip archives and bare shapefile stems.  The shapefile must
    contain exactly one polyline record with at least two vertices.

    Attribute fields 'AB_Heading' or 'heading' (case-insensitive) are used
    to populate bearing_deg if present.
    """
    sf = _open_reader(path)
    if sf.shapeType not in (3, 13, 23):  # POLYLINE variants
        raise ValueError(f"Expected POLYLINE shapefile, got shape type {sf.shapeType}")
    if len(sf) != 1:
        raise ValueError(f"AB line shapefile must have exactly 1 record, got {len(sf)}")

    rec = sf.shapeRecords()[0]
    pts = rec.shape.points
    if len(pts) < 2:
        raise ValueError("AB line must have at least 2 vertices")

    a_lon, a_lat = pts[0]
    b_lon, b_lat = pts[-1]

    # Try to read bearing from attribute fields
    bearing: Optional[float] = None
    fields_lower = {f[0].lower(): f[0] for f in sf.fields if isinstance(f, list)}
    record_dict = rec.record.as_dict()
    for candidate in ("ab_heading", "heading", "bearing"):
        if candidate in fields_lower:
            raw = record_dict.get(fields_lower[candidate])
            if raw is not None:
                try:
                    bearing = float(raw)
                except (ValueError, TypeError):
                    pass
            break

    if bearing is None:
        # Compute from geometry
        de = b_lon - a_lon
        dn = b_lat - a_lat
        bearing = math.degrees(math.atan2(de, dn)) % 360.0

    return ABLine(a_lon=a_lon, a_lat=a_lat, b_lon=b_lon, b_lat=b_lat, bearing_deg=bearing)


def write_ab_line(ab: ABLine, path: str | Path) -> None:
    """Write an ABLine to a zipped shapefile at path (must end in .zip)."""
    p = Path(path)
    stem = p.stem
    tmp = tempfile.mkdtemp()
    w = shapefile.Writer(os.path.join(tmp, stem), shapeType=3)
    w.field("bearing_deg", "N", decimal=4)
    w.line([[[ab.a_lon, ab.a_lat], [ab.b_lon, ab.b_lat]]])
    w.record(ab.bearing_deg or 0.0)
    w.close()

    # Write .prj
    prj_path = os.path.join(tmp, stem + ".prj")
    with open(prj_path, "w") as fh:
        fh.write(
            'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",'
            'SPHEROID["WGS_1984",6378137.0,298.257223563]],'
            'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'
        )

    with zipfile.ZipFile(p, "w", zipfile.ZIP_DEFLATED) as zf:
        for ext in (".shp", ".dbf", ".shx", ".prj"):
            src = os.path.join(tmp, stem + ext)
            if os.path.exists(src):
                zf.write(src, stem + ext)
