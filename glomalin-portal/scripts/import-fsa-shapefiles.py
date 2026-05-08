#!/usr/bin/env python3
"""
Import Rock County FSA CLU shapefiles → Supabase clu_boundaries table.

Pure Python — no external packages needed (only stdlib).
Parses ESRI Shapefile format directly (Polygon type = 5).
Reprojects NAD83 UTM Zone 16N → WGS84.

Usage:
    python3 scripts/import-fsa-shapefiles.py
    python3 scripts/import-fsa-shapefiles.py --dry-run
    python3 scripts/import-fsa-shapefiles.py --year 2026
    python3 scripts/import-fsa-shapefiles.py --farm 14904
"""

import sys
import os
import struct
import json
import math
import urllib.request
import urllib.error
import re

# ── CLI flags ────────────────────────────────────────────────────────────────

args = sys.argv[1:]
DRY_RUN = '--dry-run' in args
CROP_YEAR = 2025
ONLY_FARM = None

for i, a in enumerate(args):
    if a == '--year' and i + 1 < len(args):
        CROP_YEAR = int(args[i + 1])
    if a == '--farm' and i + 1 < len(args):
        ONLY_FARM = args[i + 1]

# ── Env ──────────────────────────────────────────────────────────────────────

def load_env(path):
    if not os.path.exists(path):
        return {}
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            eq = line.find('=')
            if eq == -1:
                continue
            k = line[:eq].strip()
            v = line[eq+1:].strip().strip('"\'')
            env[k] = v
    return env

script_dir = os.path.dirname(os.path.abspath(__file__))
env_file = os.path.join(script_dir, '../.env.local')
env = load_env(env_file)

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or env.get('NEXT_PUBLIC_SUPABASE_URL') or env.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('SUPABASE_SERVICE_ROLE_KEY', '')

if not DRY_RUN and (not SUPABASE_URL or not SUPABASE_KEY):
    print('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
    sys.exit(1)

# ── Reprojection: NAD83 UTM Zone 16N → WGS84 ────────────────────────────────
# NAD83 ≈ WGS84 at sub-meter precision for CONUS. Use WGS84 ellipsoid.

DEG = math.pi / 180
a = 6378137.0
f = 1.0 / 298.257222101
b = a * (1 - f)
e2 = 1 - (b * b) / (a * a)
k0 = 0.9996
E0 = 500000.0
lon0 = -87.0 * DEG  # Zone 16N central meridian


def utm_to_wgs84(easting, northing):
    x = easting - E0
    y = northing  # N0 = 0 for northern hemisphere

    M = y / k0
    e = math.sqrt(e2)
    mu = M / (a * (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256))

    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu
        + (3*e1/2 - 27*e1**3/32) * math.sin(2*mu)
        + (21*e1**2/16 - 55*e1**4/32) * math.sin(4*mu)
        + (151*e1**3/96) * math.sin(6*mu)
        + (1097*e1**4/512) * math.sin(8*mu))

    sin_p = math.sin(phi1)
    cos_p = math.cos(phi1)
    tan_p = math.tan(phi1)

    N1 = a / math.sqrt(1 - e2 * sin_p**2)
    T1 = tan_p**2
    C1 = e2 / (1 - e2) * cos_p**2
    R1 = a * (1 - e2) / (1 - e2 * sin_p**2)**1.5
    D = x / (N1 * k0)

    lat = phi1 - (N1 * tan_p / R1) * (
        D**2/2
        - (5 + 3*T1 + 10*C1 - 4*C1**2 - 9*e2/(1-e2)) * D**4/24
        + (61 + 90*T1 + 298*C1 + 45*T1**2 - 252*e2/(1-e2) - 3*C1**2) * D**6/720
    )
    lon = lon0 + (
        D
        - (1 + 2*T1 + C1) * D**3/6
        + (5 - 2*C1 + 28*T1 - 3*C1**2 + 8*e2/(1-e2) + 24*T1**2) * D**5/120
    ) / cos_p

    return (lon / DEG, lat / DEG)  # [lng, lat]


def reproject_ring(ring):
    return [list(utm_to_wgs84(x, y)) for x, y in ring]


# ── DBF parser ────────────────────────────────────────────────────────────────

def parse_dbf(path):
    """Return list of dicts, one per record."""
    with open(path, 'rb') as f:
        header = f.read(32)
        num_records = struct.unpack('<I', header[4:8])[0]
        header_size = struct.unpack('<H', header[8:10])[0]
        record_size = struct.unpack('<H', header[10:12])[0]

        fields = []
        while True:
            fd = f.read(32)
            if fd[0] == 0x0D:
                break
            name = fd[:11].split(b'\x00')[0].decode('latin-1', errors='replace').strip()
            ftype = chr(fd[11])
            length = fd[16]
            decimal = fd[17]
            fields.append((name, ftype, length, decimal))

        f.seek(header_size)
        records = []
        for _ in range(num_records):
            raw = f.read(record_size)
            if not raw or raw[0] == 0x2A:  # 0x2A = deleted record
                continue
            raw = raw[1:]  # skip deletion flag
            rec = {}
            pos = 0
            for name, ftype, length, decimal in fields:
                chunk = raw[pos:pos+length].decode('latin-1', errors='replace').strip()
                if ftype == 'N':
                    try:
                        rec[name] = float(chunk) if '.' in chunk else int(chunk) if chunk else 0
                    except ValueError:
                        rec[name] = chunk
                else:
                    rec[name] = chunk
                pos += length
            records.append(rec)
    return records


# ── SHP parser (Polygon type = 5) ─────────────────────────────────────────────

def read_le_int(f):
    return struct.unpack('<i', f.read(4))[0]

def read_be_int(f):
    return struct.unpack('>i', f.read(4))[0]

def read_le_double(f):
    return struct.unpack('<d', f.read(8))[0]


def parse_shp(path):
    """Return list of GeoJSON Polygon geometries (WGS84), one per record."""
    geoms = []
    with open(path, 'rb') as f:
        # File header (100 bytes)
        f.seek(100)

        while True:
            rec_header = f.read(8)
            if len(rec_header) < 8:
                break

            _rec_num = struct.unpack('>i', rec_header[0:4])[0]
            content_length = struct.unpack('>i', rec_header[4:8])[0] * 2  # in bytes

            shape_type = struct.unpack('<i', f.read(4))[0]
            content_length -= 4

            if shape_type == 0:
                # Null shape
                geoms.append(None)
                continue

            if shape_type == 5:  # Polygon
                # Bounding box (4 doubles = 32 bytes)
                f.read(32)
                content_length -= 32

                num_parts = struct.unpack('<i', f.read(4))[0]
                num_points = struct.unpack('<i', f.read(4))[0]
                content_length -= 8

                parts = [struct.unpack('<i', f.read(4))[0] for _ in range(num_parts)]
                content_length -= 4 * num_parts

                points = []
                for _ in range(num_points):
                    x = struct.unpack('<d', f.read(8))[0]
                    y = struct.unpack('<d', f.read(8))[0]
                    points.append((x, y))
                content_length -= 16 * num_points

                # Skip any remaining bytes for this record
                if content_length > 0:
                    f.read(content_length)

                # Build rings
                rings = []
                for i, start in enumerate(parts):
                    end = parts[i+1] if i+1 < num_parts else num_points
                    ring = points[start:end]
                    rings.append(reproject_ring(ring))

                geoms.append({'type': 'Polygon', 'coordinates': rings})
            else:
                # Skip unknown shape types
                f.read(content_length - 4)
                geoms.append(None)

    return geoms


# ── Supabase REST upsert ──────────────────────────────────────────────────────

def supabase_upsert(rows, batch_size=50):
    url = f'{SUPABASE_URL}/rest/v1/clu_boundaries'
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
    }

    written = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        data = json.dumps(batch).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                written += len(batch)
                sys.stdout.write(f'\r  Written: {written}/{len(rows)}   ')
                sys.stdout.flush()
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='replace')
            print(f'\n  Batch {i//batch_size + 1} HTTP error {e.code}: {body[:200]}')
        except Exception as e:
            print(f'\n  Batch {i//batch_size + 1} error: {e}')

    return written


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    shp_dir = os.path.join(script_dir, '../../fsa-acres/Rock ShapeFiles')

    print('FSA Shapefile Import')
    print(f'  Source    : {shp_dir}')
    print(f'  Crop year : {CROP_YEAR}')
    print(f'  Dry run   : {DRY_RUN}')
    if ONLY_FARM:
        print(f'  Farm      : {ONLY_FARM}')
    print()

    shp_files = sorted([
        f for f in os.listdir(shp_dir)
        if f.endswith('.shp') and (not ONLY_FARM or f.replace('.shp', '') == ONLY_FARM)
    ])

    all_rows = []
    total_errors = 0

    for shp_file in shp_files:
        farm_number = shp_file.replace('.shp', '')
        shp_path = os.path.join(shp_dir, shp_file)
        dbf_path = os.path.join(shp_dir, shp_file.replace('.shp', '.dbf'))

        if not os.path.exists(dbf_path):
            print(f'  SKIP {farm_number}: no .dbf')
            continue

        sys.stdout.write(f'  Farm {farm_number} ... ')
        sys.stdout.flush()

        try:
            geoms = parse_shp(shp_path)
            records = parse_dbf(dbf_path)
        except Exception as e:
            print(f'PARSE ERROR: {e}')
            total_errors += 1
            continue

        count = 0
        errors = 0
        for props, geom in zip(records, geoms):
            if geom is None:
                errors += 1
                continue

            clu_label = str(int(props.get('CLUNBR', 0))) if props.get('CLUNBR', '') != '' else ''
            tract_number = str(int(props.get('TRACTNBR', 0))) if props.get('TRACTNBR', '') != '' else ''
            calc_acres = float(props.get('CALCACRES', 0) or 0)
            fsa_acres = float(props.get('FSA_ACRES', 0) or 0)

            all_rows.append({
                'crop_year': CROP_YEAR,
                'farm_number': farm_number,
                'tract_number': tract_number,
                'clu_label': clu_label,
                'geometry': json.dumps(geom),  # GeoJSON string for PostGIS
                'fsa_acres': calc_acres or fsa_acres or None,
                'fsa_attributes': props,
                'source_file': shp_file,
            })
            count += 1

        total_errors += errors
        print(f'{count} CLUs' + (f' ({errors} errs)' if errors else ''))

    print()
    print(f'Parsed: {len(all_rows)} CLUs, {total_errors} parse errors')

    if DRY_RUN:
        print()
        print('Dry run — first 3 rows:')
        for row in all_rows[:3]:
            geom = json.loads(row['geometry'])
            coord = geom['coordinates'][0][0]
            print(f"  Farm {row['farm_number']} Tract {row['tract_number']} CLU {row['clu_label']} "
                  f"— {row['fsa_acres']} ac  [{coord[0]:.4f}, {coord[1]:.4f}]")
        return

    print()
    print('Writing to Supabase...')
    written = supabase_upsert(all_rows)
    print()
    print()
    print(f'Done. {written} rows upserted into clu_boundaries (crop_year={CROP_YEAR}).')


if __name__ == '__main__':
    main()
