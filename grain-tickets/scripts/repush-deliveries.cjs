/**
 * Re-push every buyer-bound ticket to the marketing module.
 *
 * The live push (pushDeliveryToMarketing in server.js) only fires on ticket
 * create/update/delete, so tickets that predate the hook — or that were skipped
 * before their crop had a GrainVariant — never reach marketing. The ingest
 * endpoint is idempotent (upsert by [grain-ticket:<id>] marker), so re-pushing
 * everything is safe: existing deliveries update, missing ones are created,
 * manual contract applications are preserved.
 *
 *   cd /srv/farm-ops/grain-tickets && node scripts/repush-deliveries.cjs
 *
 * Payload mirrors server.js pushDeliveryToMarketing — keep the two in sync.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const prisma = require(path.join(__dirname, '..', 'lib', 'db.js'));
const Calc = require(path.join(__dirname, '..', 'public', 'calc.js'));

const CERT_URL = process.env.CERT_SERVICE_URL || 'http://localhost:3004';
const TOKEN = process.env.ECOSYSTEM_TOKEN || process.env.EMBED_TOKEN;

// Keep the admin "never reached marketing" banner accurate (see server.js
// recordPushSkip — the table is the current orphan set, not a log).
async function recordSkip(t, reason) {
  const data = { cropName: t.crop, cropYear: t.cropYear, buyerName: t.buyer ? t.buyer.name : null, reason };
  await prisma.marketingPushSkip.upsert({
    where: { ticketId: t.id },
    update: data,
    create: { ticketId: t.id, ...data },
  }).catch((e) => console.warn(`recordSkip ticket ${t.id}:`, e.message));
}

async function buildCropConfigObject(cropYear) {
  const rows = await prisma.cropConfig.findMany({ where: { cropYear } });
  const config = {};
  rows.forEach(r => {
    config[r.cropName] = {
      discount: r.discount,
      testWeight: r.testWeight,
      moistureShrink: r.moistureShrink
    };
  });
  return config;
}

async function main() {
  if (!TOKEN) {
    console.error('No ECOSYSTEM_TOKEN/EMBED_TOKEN in env — aborting');
    process.exitCode = 1;
    return;
  }

  const tickets = await prisma.ticket.findMany({
    where: { buyerId: { not: null } },
    include: { buyer: true },
    orderBy: { id: 'asc' }
  });
  console.log(`Re-pushing ${tickets.length} buyer-bound tickets to ${CERT_URL} ...\n`);

  const cropConfigByYear = {};
  const outcomes = [];

  for (const t of tickets) {
    if (!cropConfigByYear[t.cropYear]) {
      cropConfigByYear[t.cropYear] = await buildCropConfigObject(t.cropYear);
    }
    const json = {
      date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date,
      netWeight: t.netWeight,
      moisture: t.moisture,
      fm: t.fm || 0,
      testWeight: t.testWeight || null,
      crop: t.crop,
      cropYear: t.cropYear
    };
    const computed = Calc.computeTicket(json, cropConfigByYear[t.cropYear]);
    if (!computed.netBU || computed.netBU <= 0) {
      outcomes.push({ ticket: t.id, crop: t.crop, outcome: `skipped locally (netBU ${computed.netBU})` });
      continue;
    }

    const payload = {
      action: 'upsert',
      grainTicketId: t.id,
      scaleTicketNum: t.ticketNo || null,
      deliveryDate: json.date,
      netWeightLbs: t.netWeight,
      netBushels: Math.round(computed.netBU * 100) / 100,
      moisturePercent: t.moisture || null,
      foreignMatterPct: t.fm || null,
      testWeightLbs: t.testWeight || computed.testWeight || null,
      buyerName: t.buyer.name,
      cropName: t.crop,
      cropYear: t.cropYear,
      notes: `${t.farm || ''}`.trim() || null
    };

    try {
      const res = await fetch(CERT_URL + '/api/marketing/ingest-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ecosystem-token': TOKEN },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        outcomes.push({ ticket: t.id, crop: t.crop, outcome: `http-${res.status} ${result.error || ''}` });
        await recordSkip(t, `http-${res.status}: ${result.error || 'error'}`);
      } else if (result.status === 'skipped') {
        outcomes.push({ ticket: t.id, crop: t.crop, outcome: `skipped (${result.reason}: "${result.cropName}" ${result.cropYear})` });
        await recordSkip(t, result.reason || 'skipped');
      } else {
        outcomes.push({
          ticket: t.id,
          crop: t.crop,
          outcome: `${result.status} (${result.applyOutcome || 'n/a'}, ${result.appliedBushels || 0} bu applied)`
        });
        await prisma.marketingPushSkip.deleteMany({ where: { ticketId: t.id } }).catch(() => {});
      }
    } catch (e) {
      outcomes.push({ ticket: t.id, crop: t.crop, outcome: `error: ${e.message}` });
      await recordSkip(t, `push-failed: ${e.message}`);
    }
  }

  for (const o of outcomes) {
    console.log(`  ticket ${String(o.ticket).padStart(4)}  ${o.crop.padEnd(16)} ${o.outcome}`);
  }

  const tally = {};
  for (const o of outcomes) {
    const key = o.outcome.split(' ')[0];
    tally[key] = (tally[key] || 0) + 1;
  }
  console.log('\nSummary:', JSON.stringify(tally));
}

main()
  .catch((e) => {
    console.error('REPUSH FAILED:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
