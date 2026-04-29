"""Render the two-panel trial layout map as PNG and PDF using matplotlib."""

from __future__ import annotations

from pathlib import Path

from trialfield_core.geometry.plots import PlotRecord
from trialfield_core.models.trial_design import TrialDesign

# Matches the KML palette (converted to matplotlib RGBA)
_MPL_COLORS = [
    "#cccccc",  # gray
    "#ff8c0c",  # orange
    "#1f7fb4",  # teal
    "#2cca2c",  # green
    "#0a4d8a",  # dark blue
    "#9467bd",  # purple
    "#ffd400",  # yellow
    "#dc143c",  # red
]


def _label_key(t_label: str, categorical: bool) -> str:
    return t_label


def write_map(
    plots: list[PlotRecord],
    trial: TrialDesign,
    trial_name: str,
    out_dir: Path,
    *,
    field_wgs84=None,
    field_uv=None,
) -> tuple[Path, Path]:
    """Render a two-panel layout map and return (png_path, pdf_path)."""
    import matplotlib
    matplotlib.use("Agg")  # non-interactive backend; must be set before pyplot import
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.patches import Polygon as MplPolygon
    from matplotlib.collections import PatchCollection

    out_dir.mkdir(parents=True, exist_ok=True)
    png_path = out_dir / f"{trial_name}_layout.png"
    pdf_path = out_dir / f"{trial_name}_field_map.pdf"

    # Build treatment → color index mapping
    if trial.categorical:
        t_to_idx = {t.label: i for i, t in enumerate(trial.treatments)}
    else:
        sorted_t = sorted(trial.treatments, key=lambda t: t.value)  # type: ignore[arg-type]
        t_to_idx = {t.label: i for i, t in enumerate(sorted_t)}

    fig, (ax_uv, ax_geo) = plt.subplots(1, 2, figsize=(16, 9))
    fig.suptitle(trial_name, fontsize=13, y=0.98)

    legend_patches = []
    seen_labels: set[str] = set()

    # Left panel: UV frame (u = east, v = north)
    for p in plots:
        idx = t_to_idx.get(p.treatment.label, 0)
        color = _MPL_COLORS[idx % len(_MPL_COLORS)]
        rect = mpatches.FancyBboxPatch(
            (p.u_west_ft, p.v_south_ft),
            p.u_east_ft - p.u_west_ft,
            p.v_north_ft - p.v_south_ft,
            boxstyle="square,pad=0",
            facecolor=color,
            edgecolor="black",
            linewidth=0.5,
            alpha=0.75,
        )
        ax_uv.add_patch(rect)

        # Label each plot with treatment label
        cx = (p.u_west_ft + p.u_east_ft) / 2
        cy = (p.v_south_ft + p.v_north_ft) / 2
        ax_uv.text(cx, cy, p.treatment.label, ha="center", va="center", fontsize=6)

        if p.treatment.label not in seen_labels:
            seen_labels.add(p.treatment.label)
            if not trial.categorical:
                v = p.treatment.value
                lbl = f"{int(v) if v == int(v) else v} {p.treatment.unit}".strip()  # type: ignore[arg-type]
            else:
                lbl = p.treatment.label
            legend_patches.append(mpatches.Patch(facecolor=color, edgecolor="black", label=lbl))

    if field_uv is not None:
        try:
            xy_uv = list(field_uv.exterior.coords)
            uv_patch = MplPolygon(xy_uv, closed=True, facecolor="none",
                                  edgecolor="#444444", linewidth=1.2,
                                  linestyle="--", zorder=0)
            ax_uv.add_patch(uv_patch)
        except AttributeError:
            pass  # MultiPolygon or other geometry — skip outline

    if plots:
        all_u = [p.u_west_ft for p in plots] + [p.u_east_ft for p in plots]
        all_v = [p.v_south_ft for p in plots] + [p.v_north_ft for p in plots]
        if field_uv is not None:
            try:
                bu, bv = field_uv.exterior.xy
                all_u += list(bu)
                all_v += list(bv)
            except AttributeError:
                pass
        margin_u = (max(all_u) - min(all_u)) * 0.08
        margin_v = (max(all_v) - min(all_v)) * 0.08
        ax_uv.set_xlim(min(all_u) - margin_u, max(all_u) + margin_u)
        ax_uv.set_ylim(min(all_v) - margin_v, max(all_v) + margin_v)

    ax_uv.set_xlabel("u along AB (ft) → east")
    ax_uv.set_ylabel("v past AB (ft) → north")
    ax_uv.set_title("Trial close-up — swath-aligned layout")
    ax_uv.set_aspect("equal")
    ax_uv.legend(handles=sorted(legend_patches, key=lambda p: p.get_label()),
                 loc="upper right", fontsize=7, title="Treatment")

    # Right panel: WGS84 (lon, lat)
    for p in plots:
        idx = t_to_idx.get(p.treatment.label, 0)
        color = _MPL_COLORS[idx % len(_MPL_COLORS)]
        xy = [(lon, lat) for lon, lat in p.polygon_wgs84[:-1]]  # drop closing pt
        patch = MplPolygon(xy, closed=True, facecolor=color, edgecolor="black",
                           linewidth=0.5, alpha=0.75)
        ax_geo.add_patch(patch)

    if field_wgs84 is not None:
        try:
            xy_geo = list(field_wgs84.exterior.coords)
            geo_patch = MplPolygon(xy_geo, closed=True, facecolor="none",
                                   edgecolor="#444444", linewidth=1.2,
                                   linestyle="--", zorder=0)
            ax_geo.add_patch(geo_patch)
        except AttributeError:
            pass

    if plots:
        all_lons = [lon for p in plots for lon, _ in p.polygon_wgs84]
        all_lats = [lat for p in plots for _, lat in p.polygon_wgs84]
        if field_wgs84 is not None:
            try:
                blons, blats = field_wgs84.exterior.xy
                all_lons += list(blons)
                all_lats += list(blats)
            except AttributeError:
                pass
        margin_lon = (max(all_lons) - min(all_lons)) * 0.12
        margin_lat = (max(all_lats) - min(all_lats)) * 0.12
        ax_geo.set_xlim(min(all_lons) - margin_lon, max(all_lons) + margin_lon)
        ax_geo.set_ylim(min(all_lats) - margin_lat, max(all_lats) + margin_lat)

    ax_geo.set_xlabel("Longitude")
    ax_geo.set_ylabel("Latitude")
    ax_geo.set_title("Field context — plot locations (WGS84)")
    ax_geo.set_aspect("equal")

    plt.tight_layout(rect=(0, 0, 1, 0.96))
    fig.savefig(png_path, dpi=150, bbox_inches="tight")
    fig.savefig(pdf_path, bbox_inches="tight")
    plt.close(fig)

    return png_path, pdf_path
