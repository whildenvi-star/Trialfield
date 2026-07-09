#!/usr/bin/env python3
"""Backfill geometry from Supabase field_boundaries.geojson into farm-registry data.json.

Matches on registry_field_id (field.id in data.json == field_boundaries.registry_field_id).
Run once after shapefile import; re-run any time a boundary is redrawn.
"""

import json
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / '.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
DATA_JSON = Path(__file__).parent.parent.parent / 'farm-registry' / 'data' / 'data.json'

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

res = sb.table('field_boundaries') \
    .select('registry_field_id, geojson') \
    .like('registry_field_id', 'fld_%') \
    .execute()

boundaries = {
    row['registry_field_id']: row['geojson']
    for row in res.data
    if row.get('geojson') and row.get('registry_field_id')
}
print(f'Fetched {len(boundaries)} boundaries from Supabase')

data = json.loads(DATA_JSON.read_text())

updated = 0
skipped = 0
for field in data.get('fields', []):
    fid = field.get('id')
    if fid in boundaries:
        field['geometry'] = boundaries[fid]
        updated += 1
    else:
        skipped += 1

DATA_JSON.write_text(json.dumps(data, indent=2))
print(f'Updated {updated} fields, {skipped} fields have no boundary yet')
