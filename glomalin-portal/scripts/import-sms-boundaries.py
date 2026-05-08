#!/usr/bin/env python3
"""
Import SMS farm boundary shapefiles as management_zones for 2026.

Reads *_poly.shp from a directory, parses WGS84 polygon geometry using
stdlib struct module only (no shapefile library required), and calls
the insert_management_zone Supabase RPC for each field.

Naming conventions detected from filename stem:
  - "Irr" anywhere  → irrigated_default = True
  - "Omni" prefix   → organic_default   = True
  - "26" suffix      → 2026-specific boundary (still inserted, crop_year=2026)

Usage:
  python3 scripts/import-sms-boundaries.py [/path/to/boundary/files]
"""

import os
import sys
import struct
import json
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL     = "https://hmjmrdhwrzltckzuoaoh.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtam1yZGh3cnpsdGNrenVvYW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjcyMDEwMiwiZXhwIjoyMDg4Mjk2MTAyfQ.kIC2tM4swMmKGsNxR8DySp0CcwTijNQHGnMSf7JFDng"
CROP_YEAR        = 2026

DEFAULT_DIR      = "/Users/glomalinguild/Desktop/WHughes Farms boundary files"

# ── Shapefile parser (stdlib only) ────────────────────────────────────────────

def parse_shp(path: str):
    """
    Parse a .shp file and return a list of GeoJSON geometry dicts.
    Handles shape type 5 (Polygon) and 15 (PolygonZ).
    Each polygon is returned as a GeoJSON Polygon or MultiPolygon.
    """
    with open(path, "rb") as f:
        data = f.read()

    # File header: 100 bytes
    # Byte 0-3: file code (big-endian) = 9994
    # Byte 24-27: file length in 16-bit words (big-endian)
    # Byte 28-31: version (little-endian) = 1000
    # Byte 32-35: shape type (little-endian)

    file_code = struct.unpack_from(">i", data, 0)[0]
    if file_code != 9994:
        raise ValueError(f"Not a valid shapefile: {path}")

    shape_type = struct.unpack_from("<i", data, 32)[0]
    if shape_type not in (5, 15):  # Polygon, PolygonZ
        raise ValueError(f"Unsupported shape type {shape_type} in {path} (expected 5=Polygon or 15=PolygonZ)")

    geometries = []
    offset = 100  # start of record data

    while offset < len(data):
        if offset + 8 > len(data):
            break

        # Record header: record number (big-endian), content length in 16-bit words (big-endian)
        rec_num     = struct.unpack_from(">i", data, offset)[0]
        content_len = struct.unpack_from(">i", data, offset + 4)[0]  # in 16-bit words
        offset += 8

        content_bytes = content_len * 2
        content_end   = offset + content_bytes

        if content_end > len(data):
            break

        # Record content: shape type (little-endian 4 bytes) + shape data
        rec_type = struct.unpack_from("<i", data, offset)[0]

        if rec_type in (5, 15):
            geom = parse_polygon_record(data, offset, rec_type)
            if geom:
                geometries.append(geom)

        offset = content_end

    return geometries


def parse_polygon_record(data: bytes, offset: int, shape_type: int):
    """
    Parse one Polygon (5) or PolygonZ (15) record starting at offset.
    Returns a GeoJSON geometry dict.
    """
    # After shape type (4 bytes): bounding box 4 doubles (32 bytes)
    # Then: num_parts (4 bytes), num_points (4 bytes)
    # Then: parts array [num_parts × 4 bytes]  — index of first point in each ring
    # Then: points array [num_points × 16 bytes]  — (X, Y) pairs as doubles

    base = offset + 4  # skip shape type

    # bbox: 4 × 8 = 32 bytes (Xmin, Ymin, Xmax, Ymax)
    base += 32

    num_parts  = struct.unpack_from("<i", data, base)[0];  base += 4
    num_points = struct.unpack_from("<i", data, base)[0];  base += 4

    # Parts array
    parts = []
    for _ in range(num_parts):
        parts.append(struct.unpack_from("<i", data, base)[0])
        base += 4

    # Points array
    points = []
    for _ in range(num_points):
        x = struct.unpack_from("<d", data, base)[0];  base += 8
        y = struct.unpack_from("<d", data, base)[0];  base += 8
        points.append([x, y])

    # Build rings
    rings = []
    for i, start in enumerate(parts):
        end = parts[i + 1] if i + 1 < len(parts) else num_points
        ring = points[start:end]
        # Ensure ring is closed
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])
        rings.append(ring)

    if len(rings) == 0:
        return None

    if len(rings) == 1:
        return {"type": "Polygon", "coordinates": rings}
    else:
        # Multiple rings: first ring is outer, rest are holes (or multiple polygons)
        # Shapefile spec: outer ring is clockwise in screen coords (but GeoJSON uses
        # counter-clockwise for outer ring). SMS exports from precision ag platforms
        # typically have one outer ring per field — treat each ring as its own polygon
        # to avoid winding-order issues, then wrap as MultiPolygon.
        polygons = [[ring] for ring in rings]
        return {"type": "MultiPolygon", "coordinates": polygons}


# ── DBF parser (stdlib only) ──────────────────────────────────────────────────

def parse_dbf_first_record(path: str) -> dict:
    """
    Parse the first data record from a DBF file.
    Returns a dict of {field_name: value}.
    """
    with open(path, "rb") as f:
        data = f.read()

    # Header: version (1), date (3), num_records (4 LE), header_size (2 LE), record_size (2 LE)
    num_records = struct.unpack_from("<I", data, 4)[0]
    header_size = struct.unpack_from("<H", data, 8)[0]
    record_size = struct.unpack_from("<H", data, 10)[0]

    if num_records == 0:
        return {}

    # Field descriptors start at byte 32, each 32 bytes, terminated by 0x0D
    fields = []
    pos = 32
    while pos < header_size - 1 and data[pos] != 0x0D:
        name_bytes = data[pos:pos+11]
        name       = name_bytes.split(b'\x00')[0].decode('ascii', errors='replace').strip()
        ftype      = chr(data[pos + 11])
        flength    = data[pos + 16]
        fields.append((name, ftype, flength))
        pos += 32

    # First data record starts at header_size; byte 0 is deletion flag
    rec_start = header_size
    rec_data  = data[rec_start : rec_start + record_size]

    result = {}
    col    = 1  # skip deletion flag byte
    for name, ftype, flength in fields:
        raw   = rec_data[col : col + flength]
        value = raw.decode('ascii', errors='replace').strip()
        result[name] = value
        col += flength

    return result


# ── Supabase RPC call ──────────────────────────────────────────────────────────

def call_rpc(payload: dict) -> dict:
    """Call insert_management_zone RPC via Supabase REST API."""
    url  = f"{SUPABASE_URL}/rest/v1/rpc/insert_management_zone"
    body = json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type":  "application/json",
            "apikey":        SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Prefer":        "return=representation",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ── Name detection helpers ────────────────────────────────────────────────────

def detect_flags(stem: str):
    """
    Given a filename stem like 'GessertIrr_poly', return (zone_name, is_irrigated, is_organic).
    Strip '_poly' suffix first.
    """
    base = stem.replace("_poly", "")

    is_irrigated = "Irr" in base
    is_organic   = base.startswith("Omni")

    # Human-readable zone name: keep as-is (SMS uses real field names)
    zone_name = base

    return zone_name, is_irrigated, is_organic


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    boundary_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DIR

    shp_files = sorted([
        f for f in os.listdir(boundary_dir) if f.endswith("_poly.shp")
    ])

    if not shp_files:
        print(f"No *_poly.shp files found in {boundary_dir}")
        sys.exit(1)

    print(f"Found {len(shp_files)} shapefile(s) in {boundary_dir}")
    print(f"Importing as management_zones for crop_year={CROP_YEAR}\n")

    created = 0
    skipped = 0
    errors  = 0

    for shp_file in shp_files:
        stem     = shp_file[:-4]   # remove .shp
        shp_path = os.path.join(boundary_dir, shp_file)
        dbf_path = os.path.join(boundary_dir, stem + ".dbf")

        zone_name, is_irrigated, is_organic = detect_flags(stem)

        # Try to get Bnd_Name from DBF for a cleaner label (fallback to stem)
        bnd_name = None
        if os.path.exists(dbf_path):
            try:
                attrs = parse_dbf_first_record(dbf_path)
                bnd_name = attrs.get("Bnd_Name") or attrs.get("Field") or None
                if bnd_name:
                    bnd_name = bnd_name.strip()
                    if not bnd_name:
                        bnd_name = None
            except Exception as e:
                pass  # fallback to stem-derived name

        display_name = bnd_name if bnd_name else zone_name

        try:
            geometries = parse_shp(shp_path)
        except Exception as e:
            print(f"  [ERROR] {shp_file}: parse failed — {e}")
            errors += 1
            continue

        if not geometries:
            print(f"  [SKIP]  {shp_file}: no geometry found")
            errors += 1
            continue

        # Use the first (and typically only) geometry
        geom     = geometries[0]
        geojson  = json.dumps(geom)

        try:
            result = call_rpc({
                "p_name":              display_name,
                "p_geojson":           geojson,
                "p_organic_default":   is_organic,
                "p_irrigated_default": is_irrigated,
                "p_crop_year":         CROP_YEAR,
                "p_crop":              None,
                "p_notes":             f"Imported from SMS boundary file: {shp_file}",
            })
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            print(f"  [ERROR] {display_name}: HTTP {e.code} — {body[:200]}")
            errors += 1
            continue
        except Exception as e:
            print(f"  [ERROR] {display_name}: {e}")
            errors += 1
            continue

        action = result.get("action", "?") if isinstance(result, dict) else "?"
        tag    = "[SKIP] " if action == "skipped" else "[OK]   "
        flags  = ("organic " if is_organic else "") + ("irrigated" if is_irrigated else "")
        print(f"  {tag} {display_name:<30} {flags}")

        if action == "created":
            created += 1
        else:
            skipped += 1

    print(f"\nDone. created={created}  skipped={skipped}  errors={errors}")


if __name__ == "__main__":
    main()
