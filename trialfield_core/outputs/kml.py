"""Write KML file with plot polygons styled per treatment."""

from __future__ import annotations

import html
from pathlib import Path

from trialfield_core.geometry.plots import PlotRecord
from trialfield_core.models.trial_design import TrialDesign

# KML color strings in AABBGGRR format (50% opacity)
_PALETTE = [
    "7fcccccc",  # gray
    "7f0c8cff",  # orange
    "7fb47f1f",  # teal
    "7f2cca2c",  # green
    "7f8a4d0a",  # dark blue
    "7fbd6794",  # purple
    "7f00d4ff",  # yellow
    "7f3c14dc",  # red
]


def _style_id(treatment_idx: int) -> str:
    return f"t{treatment_idx}"


def _kml_coords(polygon: list[tuple[float, float]]) -> str:
    return " ".join(f"{lon},{lat},0" for lon, lat in polygon)


def write_kml(
    plots: list[PlotRecord],
    trial: TrialDesign,
    trial_name: str,
    out_dir: Path,
) -> Path:
    """Write a KML file with per-treatment styles and one Placemark per plot."""
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{trial_name}.kml"

    # Build treatment → style index mapping (sorted by value for numeric)
    if trial.categorical:
        t_keys = [t.label for t in trial.treatments]
        t_to_idx = {t.label: i for i, t in enumerate(trial.treatments)}
    else:
        sorted_treatments = sorted(trial.treatments, key=lambda t: t.value)  # type: ignore[arg-type]
        t_keys = [str(t.label) for t in sorted_treatments]
        t_to_idx = {t.label: i for i, t in enumerate(sorted_treatments)}

    n_reps = trial.reps
    block_ht = trial.n_treatments * 60  # approximate; not critical for KML description
    total_ac = sum(p.acres for p in plots)

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        "<Document>",
        f"<n>{html.escape(trial_name)}</n>",
        f"<description>{n_reps} reps × {trial.n_treatments} treatments</description>",
    ]

    # Styles — one per treatment
    for idx, key in enumerate(t_keys):
        color = _PALETTE[idx % len(_PALETTE)]
        lines.append(
            f'<Style id="{_style_id(idx)}">'
            f"<LineStyle><color>ff000000</color><width>1.5</width></LineStyle>"
            f"<PolyStyle><color>{color}</color></PolyStyle>"
            f"</Style>"
        )

    # Placemarks — one per plot
    for p in plots:
        idx = t_to_idx.get(p.treatment.label, 0)
        if trial.categorical:
            rate_str = p.treatment.label
        else:
            v = p.treatment.value
            rate_str = f"{int(v) if v == int(v) else v} {p.treatment.unit}".strip()  # type: ignore[arg-type]

        desc = (
            f"Rep {p.rep} ({p.rep_position}) · Strip {p.strip} · "
            f"{html.escape(rate_str)} · {p.acres} ac · "
            f"v={p.v_south_ft:.0f}-{p.v_north_ft:.0f}' from AB"
        )
        coords = _kml_coords(p.polygon_wgs84)
        lines += [
            "<Placemark>",
            f"<n>{html.escape(p.plot_id)}</n>",
            f"<description>{desc}</description>",
            f"<styleUrl>#{_style_id(idx)}</styleUrl>",
            "<Polygon><outerBoundaryIs><LinearRing>",
            f"<coordinates>{coords}</coordinates>",
            "</LinearRing></outerBoundaryIs></Polygon>",
            "</Placemark>",
        ]

    lines += ["</Document>", "</kml>"]

    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path
