'use strict';

// DeLong discount schedules — the grading rules that turn a contract price
// into a check. Encoded from the printed schedules the operator supplied
// (2025-2026 DG-DSB-DN, effective 9/20/2025); a new sheet each September gets
// appended here with its own effective date, and the calculator picks the one
// in force on the delivery date.
//
// INTERPRETATION NOTES (the sheet's shorthand, read the standard elevator
// way — validate against a real settlement before trusting to the penny):
// - Tiered $/bu-per-point tables (test weight, damage, FM): the tier the
//   measured value lands in sets the rate, applied to every point past the
//   free allowance. TW 51.5 corn = 2.5 pts below 54 at the 50.1-52.0 tier's
//   $0.05 = $0.125/bu.
// - Corn drying/shrink apply together on sold wet corn: drying $/bu per half
//   point over base, AND weight shrunk to base at the stated factor.
// - Bean moisture is a WEIGHT shrink (1.25%/half-pt 13.1-15, 2.5%/half-pt
//   over 15), not a $/bu charge; bean FM over 1% also comes off the weight.
// - Flat quality flags (musty/sour/COFO/infested) apply only when the
//   settlement says so — tickets don't carry them; pass via opts.flags.

const SCHEDULES = [
  {
    buyer: 'DELONG',
    effective: '2025-09-20',
    expires: '2026-09-30',
    crops: {
      corn: {
        moistureBase: { sold: 15, stored: 14 },
        dryingPerHalfPoint: 0.03,
        shrinkFactorPerPoint: 1.5,      // % of weight per point over base
        shrinkFactorOver25: 1.6,
        testWeightBase: 54,
        testWeightTiers: [               // measured TW falls in a tier → rate/pt below base
          { min: 52.1, rate: 0.02 },
          { min: 50.1, rate: 0.05 },
          { min: -Infinity, rate: 0.10 }
        ],
        damageFree: 5.0,
        damageTiers: [
          { max: 7.0, rate: 0.02 },
          { max: 10.0, rate: 0.04 },
          { max: Infinity, rate: 0.05 }
        ],
        fmFree: 3.0,
        fmTiers: [
          { max: 5.0, rate: 0.03 },
          { max: Infinity, rate: 0.05 }
        ],
        flat: { musty: 0.20, sour: 0.20, cofo: 0.20, infested: 0.20 }
      },
      soybeans: {
        moistureBase: { sold: 13, stored: 13 },
        moistureShrinkPerHalfPoint: [    // % of weight per half point, by band
          { max: 15.0, pct: 1.25 },
          { max: Infinity, pct: 2.50 }
        ],
        testWeightBase: 54,
        testWeightTiers: [{ min: -Infinity, rate: 0.01 }],
        fmWeightDockOverPct: 1.0,        // FM over 1% deducted from gross weight
        damageFree: 2.0,
        damageTiers: [
          { max: 7.0, rate: 0.01 },
          { max: Infinity, rate: 0.02 }
        ],
        splitsFree: 10.0,
        splitsRate: 0.01,
        flat: { musty: 0.30, sour: 0.50, cofo: 1.00 }   // infested = rejection
      }
    }
  }
];

function norm(s) { return String(s == null ? '' : s).toLowerCase(); }

// Map the farm's crop names onto the schedule's two crops. Anything else
// (wheat, rye, canning) has no DeLong schedule on file — returns null and the
// caller shows "no schedule" rather than a wrong number.
function scheduleCropFor(cropName) {
  const c = norm(cropName);
  if (/corn/.test(c) && !/seed|sweet/.test(c)) return 'corn';
  if (/soy|bean/.test(c) && !/snap|lima|food bean|navy|natto/.test(c)) return 'soybeans';
  return null;
}

function scheduleFor(buyerCode, dateISO) {
  const d = dateISO || new Date().toISOString().slice(0, 10);
  return SCHEDULES.find(s =>
    s.buyer === String(buyerCode || '').toUpperCase() &&
    s.effective <= d && d <= s.expires
  ) || null;
}

function tierRateByValue(tiers, value) {
  for (const t of tiers) if (value >= t.min) return t.rate;
  return tiers[tiers.length - 1].rate;
}

function tierRateByBand(tiers, value) {
  for (const t of tiers) if (value <= t.max) return t.rate;
  return tiers[tiers.length - 1].rate;
}

const r4 = n => Math.round(n * 10000) / 10000;
const r2 = n => Math.round(n * 100) / 100;

// The heart: itemized expected deductions for one load.
//   input: { crop, bushels, moisture, testWeight, fm, damage, splits,
//            flags: ['musty',...], disposition: 'sold'|'stored', date }
// Returns { ok, schedule, items: [{label, perBu?, dollars, bushels?}],
//           shrinkBushels, netBushels, totalDollars, perBuTotal } or
// { ok:false, reason } when no schedule covers it.
function expectedDeductions(input) {
  const sched = scheduleFor(input.buyer || 'DELONG', input.date);
  if (!sched) return { ok: false, reason: 'no schedule in force for ' + (input.date || 'today') };
  const cropKey = scheduleCropFor(input.crop);
  if (!cropKey) return { ok: false, reason: 'no DeLong schedule on file for "' + input.crop + '"' };
  const c = sched.crops[cropKey];

  const disp = input.disposition === 'stored' ? 'stored' : 'sold';
  const bushels = Number(input.bushels) || 0;
  const items = [];
  let shrinkPct = 0;

  const moisture = input.moisture != null ? Number(input.moisture) : null;
  const base = c.moistureBase[disp];

  if (cropKey === 'corn') {
    if (moisture != null && moisture > base) {
      const over = moisture - base;
      const halves = over / 0.5;
      const dryPerBu = r4(halves * c.dryingPerHalfPoint);
      items.push({ label: 'Drying ' + moisture + '% → ' + base + '%', perBu: dryPerBu });
      const factor = moisture > 25 ? c.shrinkFactorOver25 : c.shrinkFactorPerPoint;
      shrinkPct += over * factor;
      items.push({ label: 'Shrink ' + over.toFixed(1) + ' pt × ' + factor + '%', shrinkPct: r4(over * factor) });
    }
    if (input.testWeight != null && Number(input.testWeight) < c.testWeightBase) {
      const tw = Number(input.testWeight);
      const pts = c.testWeightBase - tw;
      const rate = tierRateByValue(c.testWeightTiers, tw);
      items.push({ label: 'Test weight ' + tw + ' (' + pts.toFixed(1) + ' pt below ' + c.testWeightBase + ')', perBu: r4(pts * rate) });
    }
    if (input.fm != null && Number(input.fm) > c.fmFree) {
      const pts = Number(input.fm) - c.fmFree;
      const rate = tierRateByBand(c.fmTiers, Number(input.fm));
      items.push({ label: 'FM ' + input.fm + '% (' + pts.toFixed(1) + ' pt over ' + c.fmFree + '%)', perBu: r4(pts * rate) });
    }
  } else { // soybeans
    if (moisture != null && moisture > base) {
      const over = moisture - base;
      const band = c.moistureShrinkPerHalfPoint.find(b => moisture <= b.max) || c.moistureShrinkPerHalfPoint[1];
      const pct = r4((over / 0.5) * band.pct);
      shrinkPct += pct;
      items.push({ label: 'Moisture shrink ' + moisture + '% → ' + base + '%', shrinkPct: pct });
    }
    if (input.testWeight != null && Number(input.testWeight) < c.testWeightBase) {
      const pts = c.testWeightBase - Number(input.testWeight);
      items.push({ label: 'Test weight ' + input.testWeight, perBu: r4(pts * c.testWeightTiers[0].rate) });
    }
    if (input.fm != null && Number(input.fm) > c.fmWeightDockOverPct) {
      const pct = r4(Number(input.fm) - c.fmWeightDockOverPct);
      shrinkPct += pct;
      items.push({ label: 'FM ' + input.fm + '% (weight dock over ' + c.fmWeightDockOverPct + '%)', shrinkPct: pct });
    }
    if (input.splits != null && Number(input.splits) > c.splitsFree) {
      const pts = Number(input.splits) - c.splitsFree;
      items.push({ label: 'Splits ' + input.splits + '%', perBu: r4(pts * c.splitsRate) });
    }
  }

  if (input.damage != null && Number(input.damage) > c.damageFree) {
    const pts = Number(input.damage) - c.damageFree;
    const rate = tierRateByBand(c.damageTiers, Number(input.damage));
    items.push({ label: 'Damage ' + input.damage + '%', perBu: r4(pts * rate) });
  }
  (input.flags || []).forEach(f => {
    const rate = c.flat && c.flat[norm(f)];
    if (rate) items.push({ label: norm(f) + ' (flat)', perBu: rate });
  });

  const shrinkBushels = r2(bushels * shrinkPct / 100);
  const netBushels = r2(bushels - shrinkBushels);
  const perBuTotal = r4(items.reduce((s, i) => s + (i.perBu || 0), 0));
  // $/bu charges apply to the post-shrink bushels; the shrink itself is paid
  // in bushels, not dollars, so it is reported separately.
  const totalDollars = r2(perBuTotal * (netBushels || bushels));

  return {
    ok: true,
    schedule: sched.buyer + ' eff. ' + sched.effective,
    crop: cropKey,
    disposition: disp,
    items,
    shrinkPct: r4(shrinkPct),
    shrinkBushels,
    netBushels,
    perBuTotal,
    totalDollars
  };
}

module.exports = { expectedDeductions, scheduleFor, scheduleCropFor, SCHEDULES };
