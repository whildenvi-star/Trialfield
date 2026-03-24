#!/usr/bin/env npx tsx
/**
 * Glomalin Portal - Backfill Registry Field IDs
 *
 * Maps existing field_name strings in Supabase clu_records to farm-registry IDs
 * using case-insensitive, whitespace-normalized alias matching.
 *
 * Uses the Supabase service role key to bypass RLS and update all records.
 *
 * Usage:
 *   cd glomalin-portal
 *   npx tsx scripts/backfill-field-ids.ts           # dry-run (shows matches, writes report, no DB changes)
 *   npx tsx scripts/backfill-field-ids.ts --commit  # write registry_field_id to matched records in Supabase
 *
 * Requirements:
 *   - farm-registry must be running on port 3005
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in .env.local
 *
 * Output:
 *   - Console summary table (matched/unmatched/ambiguous/skipped counts)
 *   - glomalin-portal/scripts/backfill-report.json with detailed match results
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const REGISTRY_URL = 'http://localhost:3005/api/fields';
const REPORT_FILE = path.join(__dirname, 'backfill-report.json');
const COMMIT = process.argv.includes('--commit');
const BATCH_SIZE = 50; // batch updates to avoid rate limits

// Load .env.local from glomalin-portal directory
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

interface RegistryField {
  id: string;
  name: string;
  aliases?: string[];
  active?: boolean;
}

interface LookupEntry {
  fieldId: string;
  fieldName: string;
}

// Build lookup map: normalized string -> LookupEntry[]
function buildLookupMap(registryFields: RegistryField[]): Map<string, LookupEntry[]> {
  const map = new Map<string, LookupEntry[]>();

  for (const field of registryFields) {
    const keys = new Set<string>();
    keys.add(normalize(field.name));

    if (Array.isArray(field.aliases)) {
      for (const alias of field.aliases) {
        keys.add(normalize(alias));
      }
    }

    for (const key of keys) {
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ fieldId: field.id, fieldName: field.name });
    }
  }

  return map;
}

type MatchResult =
  | { status: 'matched'; id: string; fieldName: string; registryFieldId: string; registryFieldName: string }
  | { status: 'unmatched'; id: string; fieldName: string }
  | { status: 'ambiguous'; id: string; fieldName: string; candidates: LookupEntry[] }
  | { status: 'skipped'; id: string; fieldName: string; registryFieldId: string };

function matchRecord(id: string, fieldName: string | null, lookupMap: Map<string, LookupEntry[]>): MatchResult {
  const name = fieldName || '';
  const key = normalize(name);
  if (!key) return { status: 'unmatched', id, fieldName: name };

  const candidates = lookupMap.get(key);
  if (!candidates || candidates.length === 0) {
    return { status: 'unmatched', id, fieldName: name };
  }
  if (candidates.length === 1) {
    return {
      status: 'matched',
      id,
      fieldName: name,
      registryFieldId: candidates[0].fieldId,
      registryFieldName: candidates[0].fieldName,
    };
  }
  return { status: 'ambiguous', id, fieldName: name, candidates };
}

async function fetchRegistryFields(): Promise<RegistryField[]> {
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
  if (body && Array.isArray(body.fields)) return body.fields;
  console.error('ERROR: Unexpected response from farm-registry /api/fields');
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

  console.log('glomalin-portal backfill-field-ids.ts');
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

  // Fetch registry fields
  console.log(`Fetching fields from ${REGISTRY_URL}...`);
  const registryFields = await fetchRegistryFields();
  console.log(`  Found ${registryFields.length} registry fields`);
  const lookupMap = buildLookupMap(registryFields);
  console.log('');

  // Query clu_records where registry_field_id is null
  const { data: records, error: fetchError } = await supabase
    .from('clu_records')
    .select('id, field_name, registry_field_id')
    .is('registry_field_id', null);

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
    const result = matchRecord(record.id, record.field_name, lookupMap);
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
            .update({ registry_field_id: match.registryFieldId })
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
  console.log(`  Skipped:   ${report.cluRecords.skipped}  (already had registry_field_id)`);

  if (report.cluRecords.unmatched > 0) {
    const unmatched = report.cluRecords.results.filter(r => r.status === 'unmatched');
    const uniqueNames = [...new Set(unmatched.map(r => r.fieldName))].sort();
    console.log('\n  Unmatched field names (unique):');
    for (const name of uniqueNames) console.log(`    - "${name}"`);
  }
  if (report.cluRecords.ambiguous > 0) {
    const ambiguous = report.cluRecords.results.filter(
      (r): r is Extract<MatchResult, { status: 'ambiguous' }> => r.status === 'ambiguous'
    );
    const seenAmbig = new Set<string>();
    console.log('\n  Ambiguous field names:');
    for (const r of ambiguous) {
      if (seenAmbig.has(r.fieldName)) continue;
      seenAmbig.add(r.fieldName);
      const ids = r.candidates.map(c => `${c.fieldId} (${c.fieldName})`).join(', ');
      console.log(`    - "${r.fieldName}" -> candidates: ${ids}`);
    }
  }

  console.log('');
  const totalUnmatched = report.cluRecords.unmatched;
  const totalAmbiguous = report.cluRecords.ambiguous;
  if (totalUnmatched === 0 && totalAmbiguous === 0) {
    console.log('Coverage: 100% - all clu_records matched!');
  } else {
    console.log(`Coverage: ${totalUnmatched} unmatched, ${totalAmbiguous} ambiguous`);
    console.log('Fix workflow: add missing aliases to farm-registry, then re-run this script');
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
