#!/usr/bin/env node
/**
 * backfill-clu-registry.js — fill clu_records.registry_field_id (the two-lens
 * hierarchy crosswalk: FSA Farm#→Tract→CLU ↔ Entity→Farm→Field).
 *
 * Match order, per clu_record of the target crop year:
 *   1. NAME  — normalized clu_records.field_name (and farm_name) against
 *              farm-registry field names + aliases
 *   2. SPATIAL — centroid of the CLU boundary (clu_boundaries_geo, joined on
 *              farm/tract/clu) inside exactly one registry field polygon
 * Ambiguous or unmatched rows are left null for the batch CLU editor.
 *
 * Usage:  node scripts/backfill-clu-registry.js [--dry] [--year 2026]
 */
const fs = require('fs');
const path = require('path');

// fsa-acres/.env still carries a disabled legacy service key (legacy keys were
// turned off 2026-08-06) — prefer it only if it's a new-format sb_secret_ key,
// else fall back to glomalin-portal/.env.local which has the new keys.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
if (!/^sb_secret_/.test(process.env.SUPABASE_SERVICE_ROLE_KEY || '')) {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  require('dotenv').config({ path: path.join(__dirname, '..', '..', 'glomalin-portal', '.env.local') });
}
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const DRY = process.argv.includes('--dry');
const yearArg = process.argv.indexOf('--year');
const CROP_YEAR = yearArg !== -1 ? parseInt(process.argv[yearArg + 1], 10) : 2026;
const REGISTRY_DATA = path.join(__dirname, '..', '..', 'farm-registry', 'data', 'data.json');

const HEADERS = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Word-order-insensitive key: "Noss, Jeff" and "jeff noss" → "jeff|noss"
function tokenKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/).filter(Boolean).sort().join('|');
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

async function rest(pathQ, opts) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + pathQ, Object.assign({ headers: HEADERS }, opts));
  if (!res.ok) throw new Error(pathQ.split('?')[0] + ' → ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return opts && opts.method === 'PATCH' ? null : res.json();
}

// Centroid of the first/outer ring — approximation is fine for matching
function centroid(geometry) {
  let ring = null;
  if (geometry.type === 'Polygon') ring = geometry.coordinates[0];
  else if (geometry.type === 'MultiPolygon') ring = geometry.coordinates[0] && geometry.coordinates[0][0];
  if (!ring || !ring.length) return null;
  let sx = 0, sy = 0;
  ring.forEach(c => { sx += c[0]; sy += c[1]; });
  return [sx / ring.length, sy / ring.length];
}

// Ray casting, outer rings only (registry field polygons have no meaningful holes)
function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > pt[1]) !== (yj > pt[1]) &&
        pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInGeometry(pt, geometry) {
  if (!geometry || !geometry.coordinates) return false;
  if (geometry.type === 'Polygon') return pointInRing(pt, geometry.coordinates[0]);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(poly => poly[0] && pointInRing(pt, poly[0]));
  }
  return false;
}

(async () => {
  // Registry fields: names, aliases, geometry
  const registry = JSON.parse(fs.readFileSync(REGISTRY_DATA, 'utf8'));
  const regFields = registry.fields || [];
  const nameLookup = {};  // normalized name → [fieldId]
  const tokenLookup = {}; // token-sorted name → [fieldId]
  regFields.forEach(f => {
    [f.name].concat(f.aliases || []).forEach(n => {
      const k = norm(n);
      if (!k) return;
      (nameLookup[k] = nameLookup[k] || []).push(f.id);
      const tk = tokenKey(n);
      if (tk) (tokenLookup[tk] = tokenLookup[tk] || []).push(f.id);
    });
  });
  const nameKeys = Object.keys(nameLookup);

  const cluRecords = await rest(
    `clu_records?crop_year=eq.${CROP_YEAR}&select=id,farm_number,tract_number,clu,field_name,farm_name,registry_field_id&limit=2000`
  );
  const boundaries = await rest(
    `clu_boundaries_geo?crop_year=eq.${CROP_YEAR}&select=farm_number,tract_number,clu_label,geojson&limit=2000`
  );
  const boundaryKey = b => [b.farm_number, b.tract_number, norm(b.clu_label)].join('|');
  const boundsMap = {};
  boundaries.forEach(b => { boundsMap[boundaryKey(b)] = b.geojson; });

  const matches = {};   // fieldId → [cluRecordId]
  const report = { already: 0, byName: 0, bySpatial: 0, ambiguous: [], unmatched: [] };

  for (const rec of cluRecords) {
    if (rec.registry_field_id) { report.already++; continue; }

    // 1. name match — exact normalized, then token-sorted (word order),
    //    then unique fuzzy (edit distance ≤ 2, e.g. buchanan → Buchanon)
    let ids = null;
    for (const candidate of [rec.field_name, rec.farm_name]) {
      const hit = nameLookup[norm(candidate)] || tokenLookup[tokenKey(candidate)];
      if (hit) { ids = [...new Set(hit)]; break; }
    }
    if (!ids) {
      const k = norm(rec.field_name || rec.farm_name);
      if (k.length >= 4) {
        const close = nameKeys.filter(nk => levenshtein(k, nk) <= 2);
        if (close.length === 1) ids = [...new Set(nameLookup[close[0]])];
      }
    }
    if (ids && ids.length === 1) {
      (matches[ids[0]] = matches[ids[0]] || []).push(rec.id);
      report.byName++;
      continue;
    }
    if (ids && ids.length > 1) {
      report.ambiguous.push({ id: rec.id, name: rec.field_name, reason: 'name→' + ids.join(',') });
      continue;
    }

    // 2. spatial match — CLU centroid inside exactly one registry polygon
    const geo = boundsMap[[rec.farm_number, rec.tract_number, norm(rec.clu)].join('|')];
    const c = geo ? centroid(geo) : null;
    if (c) {
      const containing = regFields.filter(f => f.geometry && pointInGeometry(c, f.geometry));
      if (containing.length === 1) {
        (matches[containing[0].id] = matches[containing[0].id] || []).push(rec.id);
        report.bySpatial++;
        continue;
      }
      if (containing.length > 1) {
        report.ambiguous.push({ id: rec.id, name: rec.field_name, reason: 'spatial→' + containing.map(f => f.name).join(',') });
        continue;
      }
    }
    report.unmatched.push({ id: rec.id, farm: rec.farm_number, tract: rec.tract_number, clu: rec.clu, name: rec.field_name });
  }

  const total = Object.values(matches).reduce((s, a) => s + a.length, 0);
  console.log(`\n[${DRY ? 'DRY RUN' : 'APPLY'}] clu_records crop_year=${CROP_YEAR}: ${cluRecords.length} rows`);
  console.log(`  already linked: ${report.already}`);
  console.log(`  match by name:  ${report.byName}`);
  console.log(`  match spatial:  ${report.bySpatial}`);
  console.log(`  ambiguous:      ${report.ambiguous.length}`);
  console.log(`  unmatched:      ${report.unmatched.length}`);
  console.log(`  → writing ${total} links across ${Object.keys(matches).length} registry fields`);

  if (report.ambiguous.length) {
    console.log('\nAmbiguous (left for batch CLU editor):');
    report.ambiguous.slice(0, 20).forEach(a => console.log('  -', a.name || '(unnamed)', a.reason));
  }
  if (report.unmatched.length) {
    console.log('\nUnmatched (left for batch CLU editor):');
    report.unmatched.slice(0, 30).forEach(u => console.log(`  - farm ${u.farm} tract ${u.tract} clu ${u.clu} "${u.name || ''}"`));
  }

  if (DRY) { console.log('\nDry run — nothing written.'); return; }

  for (const [fieldId, recIds] of Object.entries(matches)) {
    for (let i = 0; i < recIds.length; i += 50) {
      const batch = recIds.slice(i, i + 50);
      await rest(`clu_records?id=in.(${batch.join(',')})`, {
        method: 'PATCH',
        headers: Object.assign({}, HEADERS, { Prefer: 'return=minimal' }),
        body: JSON.stringify({ registry_field_id: fieldId }),
      });
    }
  }
  console.log('\nDone — crosswalk written.');
})().catch(e => { console.error(e); process.exit(1); });
