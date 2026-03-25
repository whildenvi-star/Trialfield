#!/usr/bin/env npx tsx
/**
 * Glomalin Portal - Backfill Registry Crop IDs
 *
 * Maps existing crop strings in Supabase clu_records to farm-registry crop IDs
 * using case-insensitive, whitespace-normalized alias matching.
 *
 * Uses the Supabase service role key to bypass RLS and update all records.
 *
 * Prerequisites:
 *   - Run migration 005-add-registry-crop-id.sql in Supabase before --commit
 *
 * Usage:
 *   cd glomalin-portal
 *   npx tsx scripts/backfill-crop-ids.ts           # dry-run (shows matches, writes report, no DB changes)
 *   npx tsx scripts/backfill-crop-ids.ts --commit  # write registry_crop_id to matched records in Supabase
 *
 * Requirements:
 *   - farm-registry must be running on port 3005
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in .env.local
 *
 * Output:
 *   - Console summary table (matched/unmatched/ambiguous/skipped counts)
 *   - glomalin-portal/scripts/backfill-crop-report.json with detailed match results
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const REGISTRY_URL = 'http://localhost:3005/api/crops';
const REPORT_FILE = path.join(__dirname, 'backfill-crop-report.json');
const COMMIT = process.argv.includes('--commit');
const BATCH_SIZE = 50; // batch updates to avoid rate limits

// Load .env.local then .env from glomalin-portal directory
function loadEnv(): void {
  const envFiles = ['.env.local', '.env'];
  const baseDir = path.join(__dirname, '..');
  for (const file of envFiles) {
    const envPath = path.join(baseDir, file);
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (match) {
          const key = match[1];
          const val = match[2].replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
      break;
    }
  }
}

// Normalize a string for comparison: trim, collapse multiple whitespace to single space, lowercase
function normalize(str: string | null | undefined): string {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
}

interface RegistryCrop {
  id: string;
  name: string;
  organic?: boolean;
  aliases?: string[];
  active?: boolean;
}

interface LookupEntry {
  cropId: string;
  cropName: string;
  organic: boolean;
}

// Build lookup map: normalized alias string -> LookupEntry[]
function buildLookupMap(crops: RegistryCrop[]): Map<string, LookupEntry[]> {
  const map = new Map<string, LookupEntry[]>();

  for (const crop of crops) {
    const keys = new Set<string>();
    keys.add(normalize(crop.name));

    if (Array.isArray(crop.aliases)) {
      for (const alias of crop.aliases) {
        keys.add(normalize(alias));
      }
    }

    for (const key of keys) {
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ cropId: crop.id, cropName: crop.name, organic: crop.organic || false });
    }
  }

  return map;
}

type MatchResult =
  | { status: 'matched'; id: string; crop: string; registryCropId: string; registryCropName: string; organic: boolean }
  | { status: 'unmatched'; id: string; crop: string }
  | { status: 'ambiguous'; id: string; crop: string; candidates: LookupEntry[] }
  | { status: 'skipped'; id: string; crop: string; registryCropId: string };

function matchRecord(id: string, crop: string | null, lookupMap: Map<string, LookupEntry[]>): MatchResult {
  const name = crop || '';
  const key = normalize(name);
  if (!key) return { status: 'unmatched', id, crop: name };

  const candidates = lookupMap.get(key);
  if (!candidates || candidates.length === 0) {
    return { status: 'unmatched', id, crop: name };
  }
  if (candidates.length === 1) {
    return {
      status: 'matched',
      id,
      crop: name,
      registryCropId: candidates[0].cropId,
      registryCropName: candidates[0].cropName,
      organic: candidates[0].organic,
    };
  }
  return { status: 'ambiguous', id, crop: name, candidates };
}

async function fetchRegistryCrops(): Promise<RegistryCrop[]> {
  let res: Response;
  try {
    res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(5000) });
  } catch (err: any) {
    console.error(`ERROR: Could not reach farm-registry at ${REGISTRY_URL}`);
    console.error(`  Make sure farm-registry is running on port 3005 (npm start in farm-registry/)`);
    console.error(`  Original error: ${err.message}`);
    process.exit(1);
  }

  if (!res!.ok) {
    console.error(`ERROR: farm-registry returned HTTP ${res!.status}`);
    process.exit(1);
  }

  const body = await res!.json();
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.crops)) return body.crops;
  console.error('ERROR: Unexpected response from farm-registry /api/crops');
  process.exit(1);
}

// Batch an array into chunks of size n
function chunk<T>(arr: T[], n: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    chunks.push(arr.slice(i, i + n));
  }
  return chunks;
}

async function main(): Promise<void> {
  loadEnv();

  console.log('glomalin-portal backfill-crop-ids.ts');
  console.log(`Mode: ${COMMIT ? '--commit (WILL UPDATE SUPABASE)' : 'dry-run (no changes)'}`);
  console.log('');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('ERROR: Missing required environment variables:');
    if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    if (!serviceRoleKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.error('Set these in glomalin-portal/.env.local');
    process.exit(1);
  }

  // Initialize Supabase with service role (bypasses RLS)
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Fetch registry crops
  console.log(`Fetching crops from ${REGISTRY_URL}...`);
  const registryCrops = await fetchRegistryCrops();
  console.log(`  Found ${registryCrops.length} registry crops`);
  const lookupMap = buildLookupMap(registryCrops);
  console.log('');

  // Query clu_records where registry_crop_id is null
  const { data: records, error: fetchError } = await supabase
    .from('clu_records')
    .select('id, crop, registry_crop_id')
    .is('registry_crop_id', null);

  if (fetchError) {
    console.error('ERROR: Failed to fetch clu_records from Supabase:', fetchError.message);
    process.exit(1);
  }

  // Count total and skipped
  const { count: totalCount, error: countError } = await supabase
    .from('clu_records')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('ERROR: Failed to count clu_records:', countError.message);
    process.exit(1);
  }

  const total = totalCount ?? 0;
  const skipped = total - (records?.length ?? 0);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: COMMIT ? 'commit' : 'dry-run',
    cluRecords: {
      total,
      matched: 0,
      unmatched: 0,
      ambiguous: 0,
      skipped,
      results: [] as MatchResult[],
    },
  };

  // Match each record
  for (const record of records ?? []) {
    const result = matchRecord(record.id, record.crop, lookupMap);
    report.cluRecords.results.push(result);

    if (result.status === 'matched') report.cluRecords.matched++;
    else if (result.status === 'unmatched') report.cluRecords.unmatched++;
    else if (result.status === 'ambiguous') report.cluRecords.ambiguous++;
  }

  // Apply updates in batches if --commit
  if (COMMIT) {
    const toUpdate = report.cluRecords.results.filter(
      (r): r is Extract<MatchResult, { status: 'matched' }> => r.status === 'matched'
    );

    if (toUpdate.length > 0) {
      console.log(`Updating ${toUpdate.length} clu_records in batches of ${BATCH_SIZE}...`);
      const batches = chunk(toUpdate, BATCH_SIZE);
      let updatedCount = 0;

      for (const batch of batches) {
        for (const match of batch) {
          const { error: updateError } = await supabase
            .from('clu_records')
            .update({ registry_crop_id: match.registryCropId })
            .eq('id', match.id);

          if (updateError) {
            console.error(`  ERROR updating record ${match.id}: ${updateError.message}`);
          } else {
            updatedCount++;
          }
        }
        if (batches.length > 1) {
          process.stdout.write(`  Batch complete (${updatedCount}/${toUpdate.length})\n`);
        }
      }
      console.log(`Done. Updated ${updatedCount} records.`);
    } else {
      console.log('No new matches to update.');
    }
    console.log('');
  }

  // Write report file
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  // Print summary
  console.log('=== CLU RECORDS SUMMARY ===');
  console.log(`  Total:     ${report.cluRecords.total}`);
  console.log(`  Matched:   ${report.cluRecords.matched}`);
  console.log(`  Unmatched: ${report.cluRecords.unmatched}`);
  console.log(`  Ambiguous: ${report.cluRecords.ambiguous}`);
  console.log(`  Skipped:   ${report.cluRecords.skipped}  (already had registry_crop_id)`);

  if (report.cluRecords.unmatched > 0) {
    const unmatched = report.cluRecords.results.filter(r => r.status === 'unmatched');
    const uniqueCrops = [...new Set(unmatched.map(r => r.crop))].sort();
    console.log('\n  Unmatched crop values (unique):');
    for (const crop of uniqueCrops) console.log(`    - "${crop}"`);
  }
  if (report.cluRecords.ambiguous > 0) {
    const ambiguous = report.cluRecords.results.filter(
      (r): r is Extract<MatchResult, { status: 'ambiguous' }> => r.status === 'ambiguous'
    );
    const seenAmbig = new Set<string>();
    console.log('\n  Ambiguous crop values:');
    for (const r of ambiguous) {
      if (seenAmbig.has(r.crop)) continue;
      seenAmbig.add(r.crop);
      const ids = r.candidates.map(c => `${c.cropId} (${c.cropName})`).join(', ');
      console.log(`    - "${r.crop}" -> candidates: ${ids}`);
    }
  }

  console.log('');
  const totalUnmatched = report.cluRecords.unmatched;
  const totalAmbiguous = report.cluRecords.ambiguous;
  if (totalUnmatched === 0 && totalAmbiguous === 0) {
    console.log('Coverage: 100% - all clu_records matched!');
  } else {
    console.log(`Coverage: ${totalUnmatched} unmatched, ${totalAmbiguous} ambiguous`);
    console.log('Fix workflow: add missing aliases to farm-registry /api/crops, then re-run this script');
  }
  console.log('');
  console.log(`Report written to: ${REPORT_FILE}`);

  if (!COMMIT && report.cluRecords.matched > 0) {
    console.log(`\nDry-run: ${report.cluRecords.matched} records would be updated. Run with --commit to apply.`);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
