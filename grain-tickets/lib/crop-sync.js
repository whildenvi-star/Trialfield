// Crop vocabulary sync — marketing (organic-cert) GrainVariant names are the
// source of truth for crop NAMES; CropConfig keeps the physical params
// (test weight, shrink, discounts) locally, editable per year in admin.
//
// One-directional pull: sync only CREATES missing CropConfig rows, never
// updates or deletes. The delivery push matches ticket crop -> GrainVariant
// by exact case-sensitive string, so names are copied verbatim.
const prisma = require('./db');
const Calc = require('../public/calc.js');

// Variants of these commodities are not proposed for the ticket dropdown —
// most canning loads already have matching rows; this just keeps sync from
// re-adding ones the owner never tickets. Existing rows are untouched.
const SKIP_COMMODITIES = new Set(['Sweet Corn', 'Lima Beans', 'Snap Beans', 'Peas']);

// Ticket-side bookkeeping rows that will never have a marketing variant —
// kept out of the "no marketing variant" drift warning.
const TICKET_ONLY = new Set(['bypassed', 'Prevent plant', 'Split crops', 'Hay']);

async function fetchMarketingVariants(cropYear) {
  const token = process.env.ECOSYSTEM_TOKEN || process.env.EMBED_TOKEN;
  if (!token) throw new Error('no ECOSYSTEM_TOKEN/EMBED_TOKEN configured');
  const certUrl = process.env.CERT_SERVICE_URL || 'http://localhost:3004';
  const resp = await fetch(`${certUrl}/api/marketing/grain-variants?cropYear=${cropYear}`, {
    headers: { 'x-ecosystem-token': token },
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) throw new Error(`grain-variants returned ${resp.status}`);
  const variants = await resp.json();
  // [{ name, cropYear, commodity: { name, symbol } }, ...]
  return variants;
}

async function computeCropDrift(cropYear, prefetchedVariants) {
  const [variants, configs] = await Promise.all([
    prefetchedVariants || fetchMarketingVariants(cropYear),
    prisma.cropConfig.findMany({ where: { cropYear }, select: { cropName: true } }),
  ]);
  const configNames = new Set(configs.map((c) => c.cropName));
  const variantNames = new Set(variants.map((v) => v.name));

  const missingInTickets = variants
    .filter((v) => !configNames.has(v.name) && !SKIP_COMMODITIES.has(v.commodity.name))
    .map((v) => ({ name: v.name, commodity: v.commodity.name }));
  const missingInMarketing = [...configNames]
    .filter((name) => !variantNames.has(name) && !TICKET_ONLY.has(name))
    .sort();

  return { cropYear, missingInTickets, missingInMarketing };
}

// Params for a newly-synced crop, in priority order:
//   1. same cropName in the previous crop year (January rollover = one click)
//   2. a same-commodity sibling already configured this year
//   3. USDA test weight for the commodity, no shrink/discount
async function paramsForNewCrop(variant, allVariants, cropYear) {
  const prior = await prisma.cropConfig.findUnique({
    where: { cropYear_cropName: { cropYear: cropYear - 1, cropName: variant.name } },
  });
  if (prior) {
    return {
      source: `copied from ${cropYear - 1}`,
      registryCropId: prior.registryCropId,
      testWeight: prior.testWeight,
      moistureShrink: prior.moistureShrink,
      discount: prior.discount,
      tolerancePct: prior.tolerancePct,
      toleranceLbs: prior.toleranceLbs,
    };
  }

  const siblingNames = allVariants
    .filter((v) => v.commodity.name === variant.commodity.name && v.name !== variant.name)
    .map((v) => v.name);
  if (siblingNames.length > 0) {
    const sibling = await prisma.cropConfig.findFirst({
      where: { cropYear, cropName: { in: siblingNames } },
    });
    if (sibling) {
      return {
        source: `copied from ${sibling.cropName}`,
        testWeight: sibling.testWeight,
        moistureShrink: sibling.moistureShrink,
        discount: sibling.discount,
        tolerancePct: sibling.tolerancePct,
        toleranceLbs: sibling.toleranceLbs,
      };
    }
  }

  const usda = Calc.USDA_TEST_WEIGHTS[variant.commodity.name.toLowerCase()] || 56;
  return { source: 'USDA defaults', testWeight: usda, moistureShrink: 0, discount: 0 };
}

async function syncCropsFromMarketing(cropYear) {
  const variants = await fetchMarketingVariants(cropYear);
  const drift = await computeCropDrift(cropYear, variants);
  const added = [];
  for (const missing of drift.missingInTickets) {
    const variant = variants.find((v) => v.name === missing.name);
    const { source, ...params } = await paramsForNewCrop(variant, variants, cropYear);
    await prisma.cropConfig.create({
      data: { cropYear, cropName: variant.name, ...params },
    });
    added.push({ name: variant.name, source });
  }
  return { cropYear, added, stillMissingInMarketing: drift.missingInMarketing };
}

module.exports = { fetchMarketingVariants, computeCropDrift, syncCropsFromMarketing };
