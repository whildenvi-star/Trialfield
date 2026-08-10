/**
 * Pull missing marketing GrainVariant names into CropConfig for a crop year.
 *
 *   cd grain-tickets && node scripts/sync-crops-from-marketing.cjs [year] [--dry-run]
 *
 * Marketing (organic-cert) is the source of truth for crop NAMES; this only
 * CREATES missing CropConfig rows (params from prior year / commodity sibling /
 * USDA defaults) — never updates or deletes. --dry-run prints the drift only.
 * January rollover: run this once and the new year's dropdown is populated.
 */
require('dotenv').config();
const prisma = require('../lib/db');
const cropSync = require('../lib/crop-sync');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const yearArg = args.find((a) => /^\d{4}$/.test(a));
const cropYear = yearArg ? parseInt(yearArg, 10) : new Date().getFullYear();

async function main() {
  const drift = await cropSync.computeCropDrift(cropYear);
  if (drift.missingInTickets.length === 0) {
    console.log(`${cropYear}: ticket crops already cover all marketing variants.`);
  } else {
    console.log(`${cropYear}: ${drift.missingInTickets.length} marketing crop(s) missing from ticket entry:`);
    drift.missingInTickets.forEach((m) => console.log(`  - ${m.name} (${m.commodity})`));
  }
  if (drift.missingInMarketing.length) {
    console.log(`Ticket crops with no marketing variant (deliveries won't count against contracts):`);
    drift.missingInMarketing.forEach((n) => console.log(`  - ${n}`));
  }

  if (dryRun || drift.missingInTickets.length === 0) return;

  const result = await cropSync.syncCropsFromMarketing(cropYear);
  console.log(`Added ${result.added.length} crop config(s):`);
  result.added.forEach((a) => console.log(`  + ${a.name} (${a.source})`));
}

main()
  .catch((e) => {
    console.error('SYNC FAILED:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
