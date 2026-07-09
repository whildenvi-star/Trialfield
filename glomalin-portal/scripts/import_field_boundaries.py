#!/usr/bin/env python3
"""
Import W. Hughes Farms field-boundary shapefiles into Glomalin.

Drive:       /Volumes/USB20FD/
Supabase:    reads credentials from ../.env.local

Buckets
  1 - Canonical field boundaries  → field_boundaries (geometry column)
  2 - Irrigation system zones     → management_zones (irrigated_default=True)
  3 - 2026 crop-specific zones    → management_zones + zone_year_attributes

Usage:
  python3 scripts/import_field_boundaries.py --dry-run   # report only, no DB writes
  python3 scripts/import_field_boundaries.py             # full import
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

import geopandas as gpd
from shapely.geometry import mapping
from shapely.ops import unary_union
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────

DRIVE = Path("/Volumes/USB20FD")
PROJECT_ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = PROJECT_ROOT.parent / "farm-registry" / "data" / "data.json"
ENV_PATH = PROJECT_ROOT / ".env.local"

TARGET_CRS = "EPSG:4326"
IMPORT_SOURCE = "shapefile_usb_2026"
ACREAGE_WARN_THRESHOLD = 2.0   # flag if PostGIS acres differ from registry by this much


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_env(path: Path) -> dict:
    env = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


def normalize(name: str) -> str:
    """Lowercase, strip apostrophes, commas, dots, collapse spaces."""
    name = name.lower()
    name = re.sub(r"[',\.]", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def build_registry_index(registry_path: Path):
    """
    Returns {normalized_name_or_alias: field_dict} from farm-registry data.json.
    Also returns the raw list for acreage comparisons.
    """
    data = json.loads(registry_path.read_text())
    fields = data.get("fields", [])
    index = {}
    for f in fields:
        if not f.get("active", True):
            continue
        for alias in [f["name"]] + f.get("aliases", []):
            key = normalize(alias)
            index[key] = f
    return index, fields


# Shapefile classification patterns ──────────────────────────────────────────

# Irrigation boundaries (center-pivot footprint)
IRR_RE = re.compile(r"^(.+?)irr_poly$", re.IGNORECASE)

# Year-stamped crop zones (e.g. Seed26, BlueCorn26, Peas26, OM1, OM2)
CROP_ZONE_RE = re.compile(
    r"^(.+?)(seed\d{2}|bluecorn\d{2}|peas\d{2}|om\d+)_poly$", re.IGNORECASE
)

# Canonical base boundary
BASE_RE = re.compile(r"^(.+?)_poly$", re.IGNORECASE)


def classify(stem: str):
    """
    Returns ('base'|'irr'|'crop_zone', base_name, crop_hint).
    base_name is the raw field name extracted from the filename.
    """
    s = stem.lower()

    # OmniOM1 and OmniOM2 are field names (fld_043, fld_044), not crop zones.
    # Override before CROP_ZONE_RE matches them.
    if s in ("omniom1_poly", "omniom2_poly"):
        return "base", stem.replace("_poly", "").replace("_Poly", ""), None

    if IRR_RE.match(stem):
        m = IRR_RE.match(stem)
        return "irr", m.group(1), None

    m = CROP_ZONE_RE.match(stem)
    if m:
        return "crop_zone", m.group(1), m.group(2).lower()

    m = BASE_RE.match(stem)
    if m:
        return "base", m.group(1), None

    return "unknown", stem, None


def infer_registry_field_id(raw_name: str, registry_index: dict):
    """
    Try a sequence of normalizations to match shapefile name → registry field.
    Returns (field_id, field_name) or (None, None).
    """
    raw_lower = raw_name.lower()

    # Explicit cross-walk overrides for ambiguous names
    OVERRIDES = {
        "airport": "fld_002",
        "avalonrd": "fld_003",
        "avalon": "fld_003",
        "bakke": "fld_005",
        "blues": "fld_006",
        "buchanan": "fld_007",
        "caravilla": "fld_008",
        "carrol": "fld_009",
        "cuff": "fld_010",
        "daun": "fld_011",
        "christopherson": "fld_013",
        "delongmeyer": "fld_014",
        "elwood": "fld_015",
        "fagan": "fld_016",
        "fletchercribben": "fld_017",
        "foxden": "fld_018",
        "foxkettle": "fld_019",
        "foxlemans": "fld_020",
        "gessert": "fld_021",
        "gessley": "fld_022",
        "glenerin": "fld_023",
        "omnigoatpasture": "fld_024",
        "goatpasture": "fld_024",
        "hoff": "fld_025",
        "home": "fld_026",
        "inmanconv": "fld_027",
        "inmanbrad": "fld_028",
        "jehovah": "fld_029",
        "jones": "fld_030",
        "juniors": "fld_031",
        "klugdavis": "fld_032",
        "koppeast": "fld_033",
        "lake": "fld_034",
        "larson": "fld_035",
        "murray": "fld_036",
        "newlife": "fld_037",
        "nossjeff": "fld_038",
        "nosssid": "fld_039",
        "nosstork": "fld_040",
        "nossjessie": "fld_041",
        "omni": "fld_042",
        "omniom1": "fld_043",
        "om1": "fld_043",
        "omniom2": "fld_044",
        "om2": "fld_044",
        "philhower": "fld_045",  # Phillhower East — West (fld_046) deferred
        "schultz": "fld_047",
        "schwallenbach": "fld_048",
        "simpsons": "fld_050",
        "simpson": "fld_050",
        "turkeydeer": "fld_052",
        "townlinerd": "fld_053",
        "townline": "fld_053",
        "twist": "fld_055",
        "wes": "fld_056",
        "omniyoss": "fld_057",
        "yoss": "fld_057",
        "knilansrd": "fld_058",
        "knilans": "fld_058",
        # OmniOM1/OM2 are field names captured by CROP_ZONE_RE raw_name extraction
        "omniom1": "fld_043",
        "omniom2": "fld_044",
        # Simp* seed zone base names extracted by CROP_ZONE_RE
        "simpnorth": "fld_050",
        "simpsouth": "fld_050",
        "simptrian": "fld_050",
    }

    key = re.sub(r"['\s,\.]", "", raw_lower)
    if key in OVERRIDES:
        fid = OVERRIDES[key]
        # Resolve name from registry
        for f in registry_index.values():
            if f["id"] == fid:
                return fid, f["name"]

    # Fallback: try normalized alias match
    norm = normalize(raw_name)
    if norm in registry_index:
        f = registry_index[norm]
        return f["id"], f["name"]

    return None, None


def geom_to_wkt(gdf):
    """Union all features, validate, return WKT string."""
    unified = unary_union(gdf.geometry)
    if not unified.is_valid:
        from shapely.validation import make_valid
        unified = make_valid(unified)
    return unified.wkt


def geom_to_geojson(gdf):
    """Union all features and return GeoJSON-compatible dict."""
    unified = unary_union(gdf.geometry)
    if not unified.is_valid:
        from shapely.validation import make_valid
        unified = make_valid(unified)
    return mapping(unified)


def calc_area_acres(gdf) -> float:
    """Compute area in acres via equal-area projection."""
    gdf_proj = gdf.to_crs("EPSG:6933")  # WGS84 equal-area
    return round(gdf_proj.geometry.area.sum() / 4046.856422, 2)


CROP_HINT_MAP = {
    "seed26": "corn",
    "bluecorn26": "corn",
    "peas26": "field peas",
    "om1": None,  # Organic Matter zone 1 — no specific crop
    "om2": None,
}


def infer_crop_from_hint(hint: str):
    for k, v in CROP_HINT_MAP.items():
        if hint.lower().startswith(k[:4]):
            return v
    return None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Import field boundaries from USB drive")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print cross-walk report without writing to database")
    parser.add_argument("--bucket", choices=["1", "2", "3", "all"], default="all",
                        help="Which bucket to import (default: all)")
    args = parser.parse_args()

    # Verify drive
    if not DRIVE.exists():
        print(f"ERROR: Drive not mounted at {DRIVE}")
        sys.exit(1)

    shapefiles = sorted(DRIVE.glob("*.shp"))
    if not shapefiles:
        print(f"ERROR: No .shp files found at {DRIVE}")
        sys.exit(1)

    print(f"\nFound {len(shapefiles)} shapefiles on {DRIVE}\n")

    # Load registry
    if not REGISTRY_PATH.exists():
        print(f"ERROR: farm-registry not found at {REGISTRY_PATH}")
        sys.exit(1)
    registry_index, registry_fields = build_registry_index(REGISTRY_PATH)
    registry_by_id = {f["id"]: f for f in registry_fields}

    # Classify all shapefiles
    bucket1, bucket2, bucket3, unknown = [], [], [], []
    for shp in shapefiles:
        stem = shp.stem
        kind, raw_name, crop_hint = classify(stem)
        field_id, field_name = infer_registry_field_id(raw_name, registry_index)

        entry = {
            "path": shp,
            "stem": stem,
            "kind": kind,
            "raw_name": raw_name,
            "crop_hint": crop_hint,
            "registry_field_id": field_id,
            "registry_field_name": field_name,
        }

        if kind == "base":
            bucket1.append(entry)
        elif kind == "irr":
            bucket2.append(entry)
        elif kind == "crop_zone":
            bucket3.append(entry)
        else:
            unknown.append(entry)

    # ── Cross-walk report ──────────────────────────────────────────────────
    print("=" * 70)
    print("BUCKET 1 — Canonical field boundaries")
    print("=" * 70)
    unmatched_b1 = []
    for e in bucket1:
        gdf = gpd.read_file(e["path"]).to_crs(TARGET_CRS)
        acres = calc_area_acres(gdf)
        valid = all(gdf.geometry.is_valid)
        match = e["registry_field_id"] or "UNMATCHED"
        reg_acres = registry_by_id.get(e["registry_field_id"], {}).get("reportingAcres", 0)
        diff = round(abs(acres - reg_acres), 2)
        flag = f"  ⚠ acreage diff {diff} ac" if diff > ACREAGE_WARN_THRESHOLD else ""
        geom_flag = "  ⚠ INVALID GEOM" if not valid else ""
        print(f"  {e['stem']:<35} → {match:<10}  {acres:>8.2f} ac  (registry {reg_acres:.2f} ac){flag}{geom_flag}")
        if not e["registry_field_id"]:
            unmatched_b1.append(e["stem"])
        e["gdf"] = gdf
        e["acres"] = acres

    print()
    print("=" * 70)
    print("BUCKET 2 — Irrigation system zones")
    print("=" * 70)
    for e in bucket2:
        gdf = gpd.read_file(e["path"]).to_crs(TARGET_CRS)
        acres = calc_area_acres(gdf)
        match = e["registry_field_id"] or "UNMATCHED"
        print(f"  {e['stem']:<35} → {match:<10}  {len(gdf)} polygon(s)  {acres:.2f} ac")
        e["gdf"] = gdf
        e["acres"] = acres

    print()
    print("=" * 70)
    print("BUCKET 3 — 2026 crop-specific zones")
    print("=" * 70)
    for e in bucket3:
        gdf = gpd.read_file(e["path"]).to_crs(TARGET_CRS)
        acres = calc_area_acres(gdf)
        match = e["registry_field_id"] or "UNMATCHED"
        crop = infer_crop_from_hint(e["crop_hint"] or "")
        print(f"  {e['stem']:<35} → {match:<10}  crop={crop}  {acres:.2f} ac")
        e["gdf"] = gdf
        e["acres"] = acres

    if unmatched_b1:
        print()
        print("⚠ UNMATCHED (Bucket 1):", unmatched_b1)

    # Registry fields with no shapefile
    matched_ids = {e["registry_field_id"] for e in bucket1 + bucket2 + bucket3
                   if e["registry_field_id"]}
    no_boundary = [f for f in registry_fields if f["active"] and f["id"] not in matched_ids]
    if no_boundary:
        print()
        print("Registry fields with no shapefile boundary:")
        for f in no_boundary:
            print(f"  {f['id']}  {f['name']}")

    if args.dry_run:
        print("\n[DRY RUN] No database writes performed.")
        return

    # ── Database writes ────────────────────────────────────────────────────
    env = load_env(ENV_PATH)
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
        sys.exit(1)

    db = create_client(supabase_url, service_key)
    print("\n[DB] Connected to Supabase\n")

    if args.bucket in ("1", "all"):
        print("=" * 70)
        print("IMPORTING BUCKET 1 — Canonical boundaries → field_boundaries")
        print("=" * 70)
        for e in bucket1:
            fid = e["registry_field_id"]
            if not fid:
                print(f"  SKIP {e['stem']} — no registry match")
                continue

            gdf = e["gdf"]
            # Validate each feature before union — unary_union can't handle invalid inputs
            from shapely.validation import make_valid as shp_make_valid
            valid_geoms = [shp_make_valid(g) if not g.is_valid else g for g in gdf.geometry]
            # Union all sub-polygons into one geometry
            merged = unary_union(valid_geoms)
            if not merged.is_valid:
                merged = shp_make_valid(merged)

            geojson_obj = mapping(merged)
            centroid = merged.centroid
            wkt = merged.wkt
            reg_name = e["registry_field_name"]

            # Individual sub-polygon management zones (for multi-feature files)
            sub_zones = []
            if len(gdf) > 1:
                for i, row in enumerate(gdf.itertuples(), 1):
                    sub_geom = row.geometry
                    if not sub_geom.is_valid:
                        sub_geom = shp_make_valid(sub_geom)
                    sub_zones.append({
                        "registry_field_id": fid,
                        "name": f"{reg_name} – Parcel {i}",
                        "geometry": f"SRID=4326;{sub_geom.wkt}",
                        "irrigated_default": False,
                        "organic_default": False,
                        "notes": f"Imported from {e['stem']} feature {i}",
                    })

            # Upsert field_boundaries using ST_GeomFromText via RPC is unavailable
            # — use the Supabase PostgREST geometry insert pattern:
            # geometry columns accept EWKT strings ("SRID=4326;...")
            row_data = {
                "registry_field_id": fid,
                "name": reg_name,
                "geojson": geojson_obj,
                "centroid_lat": centroid.y,
                "centroid_lng": centroid.x,
                "geometry": f"SRID=4326;{wkt}",
                "source": IMPORT_SOURCE,
            }

            try:
                res = (db.table("field_boundaries")
                       .upsert(row_data, on_conflict="registry_field_id")
                       .execute())
                acres = e["acres"]
                print(f"  ✓ {reg_name:<30} ({fid})  {acres:.2f} ac  {len(gdf)} feature(s)")

                # Insert sub-polygon management zones
                for sz in sub_zones:
                    db.table("management_zones").upsert(sz, on_conflict="").execute()
                if sub_zones:
                    print(f"    └─ {len(sub_zones)} sub-parcel management zones created")

            except Exception as exc:
                print(f"  ✗ {e['stem']}: {exc}")

    if args.bucket in ("2", "all"):
        print()
        print("=" * 70)
        print("IMPORTING BUCKET 2 — Irrigation zones → management_zones")
        print("=" * 70)
        for e in bucket2:
            fid = e["registry_field_id"]
            if not fid:
                print(f"  SKIP {e['stem']} — no registry match")
                continue

            gdf = e["gdf"]
            reg_name = e["registry_field_name"]

            from shapely.validation import make_valid as shp_make_valid
            for i, row in enumerate(gdf.itertuples(), 1):
                geom = row.geometry
                if not geom.is_valid:
                    geom = shp_make_valid(geom)

                suffix = f" {i}" if len(gdf) > 1 else ""
                zone_data = {
                    "registry_field_id": fid,
                    "name": f"{reg_name} – Irrigation{suffix}",
                    "geometry": f"SRID=4326;{geom.wkt}",
                    "irrigated_default": True,
                    "organic_default": False,
                    "notes": f"Irrigation system boundary from {e['stem']}",
                }
                try:
                    db.table("management_zones").insert(zone_data).execute()
                    print(f"  ✓ {zone_data['name']}")
                except Exception as exc:
                    print(f"  ✗ {e['stem']} feature {i}: {exc}")

    if args.bucket in ("3", "all"):
        print()
        print("=" * 70)
        print("IMPORTING BUCKET 3 — 2026 crop zones → management_zones + zone_year_attributes")
        print("=" * 70)
        for e in bucket3:
            fid = e["registry_field_id"]
            if not fid:
                print(f"  SKIP {e['stem']} — no registry match")
                continue

            gdf = e["gdf"]
            reg_name = e["registry_field_name"]
            crop = infer_crop_from_hint(e["crop_hint"] or "")
            hint_label = (e["crop_hint"] or "").upper()

            from shapely.validation import make_valid as shp_make_valid
            for i, row in enumerate(gdf.itertuples(), 1):
                geom = row.geometry
                if not geom.is_valid:
                    geom = shp_make_valid(geom)

                suffix = f" {i}" if len(gdf) > 1 else ""
                zone_name = f"{reg_name} – {hint_label}{suffix} 2026"
                zone_data = {
                    "registry_field_id": fid,
                    "name": zone_name,
                    "geometry": f"SRID=4326;{geom.wkt}",
                    "irrigated_default": False,
                    "organic_default": False,
                    "notes": f"2026 crop zone from {e['stem']}",
                }
                try:
                    res = db.table("management_zones").insert(zone_data).execute()
                    zone_id = res.data[0]["id"]

                    if crop:
                        attr_data = {
                            "zone_id": zone_id,
                            "crop_year": 2026,
                            "crop": crop,
                        }
                        db.table("zone_year_attributes").upsert(
                            attr_data, on_conflict="zone_id,crop_year"
                        ).execute()

                    print(f"  ✓ {zone_name}  crop={crop}")
                except Exception as exc:
                    print(f"  ✗ {e['stem']} feature {i}: {exc}")

    print("\n✅ Import complete.\n")
    print("Run verification queries:")
    print("  SELECT name, total_acres FROM field_boundaries WHERE geometry IS NOT NULL ORDER BY name;")
    print("  SELECT COUNT(*) FROM management_zones WHERE irrigated_default = true;")


if __name__ == "__main__":
    main()
