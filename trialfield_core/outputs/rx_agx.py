"""Write AgX (Ag Data Exchange) JSON prescription.

Produces a GeoJSON-compatible file accepted by AgLeader and Precision Planting.
Returns None for categorical trials.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from trialfield_core.geometry.plots import PlotRecord


def write_rx_agx(
    plots: list[PlotRecord],
    trial_name: str,
    out_dir: Path,
) -> Optional[Path]:
    """Write AgX prescription JSON file.

    Returns None (and writes nothing) for categorical trials.
    Output: {trial_name}_Rx_AgX.json — a GeoJSON FeatureCollection.
    """
    if not plots or plots[0].treatment.is_categorical:
        return None

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{trial_name}_Rx_AgX.json"

    unit = plots[0].treatment.unit or ""
    features = []

    for p in plots:
        v = p.treatment.value
        rate = int(v) if v == int(v) else v  # type: ignore[arg-type]
        coords = [[lon, lat] for lon, lat in p.polygon_wgs84]
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords],
            },
            "properties": {
                "Rate": rate,
                "Unit": unit,
                "Plot_ID": p.plot_id,
                "Rep": p.rep,
                "Strip": p.strip,
                "Acres": round(p.acres, 3),
            },
        })

    fc = {
        "type": "FeatureCollection",
        "name": trial_name,
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
    }

    out_path.write_text(json.dumps(fc, indent=2), encoding="utf-8")
    return out_path
