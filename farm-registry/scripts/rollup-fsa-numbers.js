#!/usr/bin/env node
/**
 * rollup-fsa-numbers.js — derive the FSA lens from the CLU crosswalk.
 * Fills farm.fsaTractNumbers (tracts of the farm's fields' CLUs) and
 * grower.fsaFarmNumbers (farm numbers across the entity's farms) from
 * clu_records.registry_field_id. Re-run after batch CLU edits.
 *
 * Run with the farm-registry server STOPPED (writes data.json directly).
 * Usage: node scripts/rollup-fsa-numbers.js [--year 2026]
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', 'glomalin-portal', '.env.local') });
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) { console.error('Missing Supabase env'); process.exit(1); }

const yearArg = process.argv.indexOf('--year');
const CROP_YEAR = yearArg !== -1 ? parseInt(process.argv[yearArg + 1], 10) : 2026;
const DATA_FILE = path.join(__dirname, '..', 'data', 'data.json');

(async () => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/clu_records?crop_year=eq.${CROP_YEAR}&registry_field_id=not.is.null&select=registry_field_id,farm_number,tract_number&limit=2000`,
    { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }
  );
  if (!res.ok) throw new Error('clu_records → ' + res.status);
  const rows = await res.json();

  const store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const byField = {};
  rows.forEach(r => { (byField[r.registry_field_id] = byField[r.registry_field_id] || []).push(r); });

  const farmTracts = {};   // farmId → Set(tract)
  const growerFarmNums = {}; // growerId → Set(farm_number)
  store.fields.forEach(f => {
    (byField[f.id] || []).forEach(r => {
      if (f.farmId) (farmTracts[f.farmId] = farmTracts[f.farmId] || new Set()).add(r.tract_number);
      const gid = f.growerId || 'grw_001';
      (growerFarmNums[gid] = growerFarmNums[gid] || new Set()).add(r.farm_number);
    });
  });

  let farmsTouched = 0;
  (store.farms || []).forEach(fm => {
    const tracts = [...(farmTracts[fm.id] || [])].sort();
    if (JSON.stringify(tracts) !== JSON.stringify(fm.fsaTractNumbers || [])) {
      fm.fsaTractNumbers = tracts;
      farmsTouched++;
    }
  });
  (store.growers || []).forEach(g => {
    g.fsaFarmNumbers = [...(growerFarmNums[g.id] || [])].sort((a, b) => Number(a) - Number(b));
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  console.log(`Rolled up crop year ${CROP_YEAR}: ${rows.length} linked CLUs → ${farmsTouched} farms updated;` +
    ` grower farm numbers: ${(store.growers || []).map(g => g.name + ' [' + (g.fsaFarmNumbers || []).join(', ') + ']').join('; ')}`);
})().catch(e => { console.error(e); process.exit(1); });
