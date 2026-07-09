/**
 * Seed 2026 CropConfig rows.
 *
 *   cd grain-tickets && node scripts/seed-2026-crop-config.js
 *
 * Ticket validation hard-rejects any crop without a CropConfig row for its
 * crop year, and 2026 had none — this unblocks all 2026 ticket entry.
 *
 * 1. Copies every 2025 row to 2026 (skips crops that already have a 2026 row,
 *    so hand-edited 2026 configs survive re-runs).
 * 2. Upserts "Organic Wheat" 2026 to the Cashton Farm Supply schedule:
 *    testWeight 60 lb/bu, base moisture 13%, shrink 1.5%/point over base
 *    (= 0.15% per 0.1%, matching their discount sheet exactly).
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SOURCE_YEAR = 2025;
const TARGET_YEAR = 2026;

async function main() {
  const sourceRows = await prisma.cropConfig.findMany({ where: { cropYear: SOURCE_YEAR } });
  const existing = await prisma.cropConfig.findMany({
    where: { cropYear: TARGET_YEAR },
    select: { cropName: true },
  });
  const have = new Set(existing.map((r) => r.cropName));

  let copied = 0;
  for (const row of sourceRows) {
    if (have.has(row.cropName)) continue;
    await prisma.cropConfig.create({
      data: {
        cropYear: TARGET_YEAR,
        cropName: row.cropName,
        registryCropId: row.registryCropId,
        testWeight: row.testWeight,
        moistureShrink: row.moistureShrink,
        discount: row.discount,
        tolerancePct: row.tolerancePct,
        toleranceLbs: row.toleranceLbs,
      },
    });
    copied++;
  }

  // Cashton Farm Supply organic wheat schedule (2025 wheat was TW 58, no shrink)
  const wheat = await prisma.cropConfig.upsert({
    where: { cropYear_cropName: { cropYear: TARGET_YEAR, cropName: 'Organic Wheat' } },
    update: { testWeight: 60, moistureShrink: 13, discount: 1.5 },
    create: {
      cropYear: TARGET_YEAR,
      cropName: 'Organic Wheat',
      testWeight: 60,
      moistureShrink: 13,
      discount: 1.5,
    },
  });

  const total = await prisma.cropConfig.count({ where: { cropYear: TARGET_YEAR } });
  console.log(`Copied ${copied} configs ${SOURCE_YEAR} -> ${TARGET_YEAR}; ${TARGET_YEAR} now has ${total} rows.`);
  console.log(`Organic Wheat ${TARGET_YEAR}: TW ${wheat.testWeight}, base ${wheat.moistureShrink}%, shrink ${wheat.discount}%/pt`);
}

main()
  .catch((e) => {
    console.error('SEED FAILED:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
