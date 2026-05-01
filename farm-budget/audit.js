'use strict';

// Budget Audit Engine
// Runs math verification, anomaly detection, missing data, and config checks
// against the farm-budget calc engine and data store.

function generateAuditId() {
  return 'aud_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// --- Helpers ---

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce(function (s, v) { return s + v; }, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  var m = mean(arr);
  var variance = arr.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / arr.length;
  return Math.sqrt(variance);
}

// Absolute sanity bounds by crop keyword
var YIELD_BOUNDS = {
  corn: { min: 50, max: 350 },
  soybeans: { min: 20, max: 100 },
  soybean: { min: 20, max: 100 },
  wheat: { min: 20, max: 120 },
  oats: { min: 30, max: 150 },
  barley: { min: 30, max: 130 }
};

function getYieldBounds(cropName) {
  if (!cropName) return null;
  var lower = cropName.toLowerCase();
  var keys = Object.keys(YIELD_BOUNDS);
  for (var i = 0; i < keys.length; i++) {
    if (lower.indexOf(keys[i]) >= 0) return YIELD_BOUNDS[keys[i]];
  }
  return null;
}

// --- Core Audit ---

function runAudit(store, Calc, getRefs) {
  var alerts = [];
  var refs = getRefs();
  var settings = store.settings || {};
  var fields = store.fields || [];
  var enterprises = store.enterprises || [];

  // Build enterprise lookup
  var entMap = {};
  enterprises.forEach(function (e) { entMap[e.id] = e; });

  // Compute budgets for all fields
  var fieldBudgets = fields.map(function (f) {
    return { field: f, budget: Calc.computeFieldBudget(f, refs, settings) };
  });

  // --- 1. MATH VERIFICATION ---
  fieldBudgets.forEach(function (fb) {
    var f = fb.field;
    var b = fb.budget;
    var ent = entMap[f.enterpriseId];
    var entName = ent ? (ent.shortName || ent.name) : 'unassigned';

    function addAlert(code, severity, message, detail) {
      alerts.push({
        id: generateAuditId(),
        fieldId: f.id,
        fieldName: f.name || 'unnamed',
        enterprise: entName,
        category: 'math',
        severity: severity,
        code: code,
        message: message,
        detail: detail || {},
        createdAt: new Date().toISOString(),
        resolved: false
      });
    }

    // MATH_EXPTOTAL: expTotal == sum of line-item totals
    var expectedExp = round2(
      (b.rentTotal || 0) +
      (b.totalFertCost || 0) +
      (b.seedTotal || 0) +
      (b.machineryTotal || 0) +
      (b.laborTotal || 0) +
      (b.overheadTotal || 0) +
      (b.fuelTotal || 0) +
      (b.dryingTotal || 0) +
      (b.interestTotal || 0) +
      (b.cropInsuranceTotal || 0)
    );
    if (Math.abs((b.expTotal || 0) - expectedExp) > 0.02) {
      addAlert('MATH_EXPTOTAL', 'error',
        f.name + ': expTotal $' + (b.expTotal || 0).toFixed(2) + ' != sum of line items $' + expectedExp.toFixed(2) + ' (diff $' + Math.abs(b.expTotal - expectedExp).toFixed(2) + ')',
        { expected: expectedExp, actual: b.expTotal, diff: round2(Math.abs(b.expTotal - expectedExp)) });
    }

    // MATH_EXPEACRE: expPerAcre == expTotal / effectiveAcres
    if ((b.effectiveAcres || 0) > 0) {
      var expectedExpPerAcre = round2(b.expTotal / b.effectiveAcres);
      if (Math.abs((b.expPerAcre || 0) - expectedExpPerAcre) > 0.02) {
        addAlert('MATH_EXPEACRE', 'error',
          f.name + ': expPerAcre $' + (b.expPerAcre || 0).toFixed(2) + ' != $' + expectedExpPerAcre.toFixed(2) + ' (expTotal/acres)',
          { expected: expectedExpPerAcre, actual: b.expPerAcre });
      }
    }

    // MATH_PROFIT: profitPerAcre == cropIncomePerAcre - expPerAcre
    var expectedProfit = round2((b.cropIncomePerAcre || 0) - (b.expPerAcre || 0));
    if (Math.abs((b.profitPerAcre || 0) - expectedProfit) > 0.02) {
      addAlert('MATH_PROFIT', 'error',
        f.name + ': profitPerAcre $' + (b.profitPerAcre || 0).toFixed(2) + ' != income $' + (b.cropIncomePerAcre || 0).toFixed(2) + ' - exp $' + (b.expPerAcre || 0).toFixed(2),
        { expected: expectedProfit, actual: b.profitPerAcre });
    }

    // MATH_COP: cop == expTotal / totalYield
    if ((b.totalYield || 0) > 0) {
      var expectedCop = round2(b.expTotal / b.totalYield);
      if (Math.abs((b.cop || 0) - expectedCop) > 0.02) {
        addAlert('MATH_COP', 'error',
          f.name + ': COP $' + (b.cop || 0).toFixed(2) + '/bu != $' + expectedCop.toFixed(2) + '/bu (expTotal/yield)',
          { expected: expectedCop, actual: b.cop });
      }
    }

    // MATH_FERTCOST: totalFertCost == sum of inputDetails[].totalCost
    // Tolerance scales with input count — each round2 can introduce ±0.005
    if (b.inputDetails && b.inputDetails.length > 0) {
      var expectedFert = round2(b.inputDetails.reduce(function (s, d) { return s + (d.totalCost || 0); }, 0));
      var fertTolerance = Math.max(0.05, b.inputDetails.length * 0.02);
      if (Math.abs((b.totalFertCost || 0) - expectedFert) > fertTolerance) {
        addAlert('MATH_FERTCOST', 'error',
          f.name + ': totalFertCost $' + (b.totalFertCost || 0).toFixed(2) + ' != sum of inputs $' + expectedFert.toFixed(2),
          { expected: expectedFert, actual: b.totalFertCost });
      }
    }

    // MATH_INCOME: cropIncomeTotal == yieldPerAcre * pricePerUnit * effectiveAcres
    if ((b.effectiveAcres || 0) > 0 && (b.pricePerUnit || 0) > 0) {
      var expectedIncome = round2((b.yieldPerAcre || 0) * b.pricePerUnit * b.effectiveAcres);
      if (Math.abs((b.cropIncomeTotal || 0) - expectedIncome) > 0.10) {
        addAlert('MATH_INCOME', 'error',
          f.name + ': cropIncome $' + (b.cropIncomeTotal || 0).toFixed(2) + ' != yield * price * acres $' + expectedIncome.toFixed(2),
          { expected: expectedIncome, actual: b.cropIncomeTotal });
      }
    }
  });

  // --- 2. ANOMALY DETECTION ---

  // Group by crop for peer comparison
  var cropGroups = {};
  fieldBudgets.forEach(function (fb) {
    var crop = fb.field.crop || 'Unknown';
    if (!cropGroups[crop]) cropGroups[crop] = [];
    cropGroups[crop].push(fb);
  });

  Object.keys(cropGroups).forEach(function (crop) {
    var group = cropGroups[crop];
    // Need at least 3 peers for statistical checks
    if (group.length < 3) return;

    var yields = group.map(function (fb) { return fb.budget.yieldPerAcre || 0; });
    var rents = group.map(function (fb) { return fb.budget.rentPerAcre || 0; });
    var exps = group.map(function (fb) { return fb.budget.expPerAcre || 0; });
    var ferts = group.map(function (fb) { return fb.budget.totalFertPerAcre || 0; });

    var yieldMean = mean(yields), yieldStd = stddev(yields);
    var rentMean = mean(rents), rentStd = stddev(rents);
    var expMean = mean(exps), expStd = stddev(exps);
    var fertMean = mean(ferts), fertStd = stddev(ferts);

    group.forEach(function (fb) {
      var f = fb.field;
      var b = fb.budget;
      var ent = entMap[f.enterpriseId];
      var entName = ent ? (ent.shortName || ent.name) : 'unassigned';

      function addAnomaly(code, message, detail) {
        alerts.push({
          id: generateAuditId(),
          fieldId: f.id,
          fieldName: f.name || 'unnamed',
          enterprise: entName,
          category: 'anomaly',
          severity: 'warning',
          code: code,
          message: message,
          detail: detail || {},
          createdAt: new Date().toISOString(),
          resolved: false
        });
      }

      // Yield outliers
      if (yieldStd > 0 && (b.yieldPerAcre || 0) > yieldMean + 2 * yieldStd) {
        addAnomaly('ANOMALY_YIELD_HIGH',
          f.name + ': yield ' + (b.yieldPerAcre || 0).toFixed(1) + ' bu/ac is unusually high for ' + crop + ' (avg ' + yieldMean.toFixed(1) + ')',
          { value: b.yieldPerAcre, mean: round2(yieldMean), stddev: round2(yieldStd) });
      }
      if (yieldStd > 0 && (b.yieldPerAcre || 0) > 0 && (b.yieldPerAcre || 0) < yieldMean - 2 * yieldStd) {
        addAnomaly('ANOMALY_YIELD_LOW',
          f.name + ': yield ' + (b.yieldPerAcre || 0).toFixed(1) + ' bu/ac is unusually low for ' + crop + ' (avg ' + yieldMean.toFixed(1) + ')',
          { value: b.yieldPerAcre, mean: round2(yieldMean), stddev: round2(yieldStd) });
      }

      // Rent outlier
      if (rentStd > 0 && (b.rentPerAcre || 0) > rentMean + 2 * rentStd) {
        addAnomaly('ANOMALY_RENT_HIGH',
          f.name + ': rent $' + (b.rentPerAcre || 0).toFixed(2) + '/ac is unusually high for ' + crop + ' (avg $' + rentMean.toFixed(2) + ')',
          { value: b.rentPerAcre, mean: round2(rentMean), stddev: round2(rentStd) });
      }

      // Expense outlier
      if (expStd > 0 && (b.expPerAcre || 0) > expMean + 2 * expStd) {
        addAnomaly('ANOMALY_EXP_HIGH',
          f.name + ': expenses $' + (b.expPerAcre || 0).toFixed(2) + '/ac is unusually high for ' + crop + ' (avg $' + expMean.toFixed(2) + ')',
          { value: b.expPerAcre, mean: round2(expMean), stddev: round2(expStd) });
      }

      // Fertilizer outlier
      if (fertStd > 0 && (b.totalFertPerAcre || 0) > fertMean + 2 * fertStd) {
        addAnomaly('ANOMALY_FERT_HIGH',
          f.name + ': fertilizer $' + (b.totalFertPerAcre || 0).toFixed(2) + '/ac is unusually high for ' + crop + ' (avg $' + fertMean.toFixed(2) + ')',
          { value: b.totalFertPerAcre, mean: round2(fertMean), stddev: round2(fertStd) });
      }
    });
  });

  // Absolute thresholds (all fields)
  fieldBudgets.forEach(function (fb) {
    var f = fb.field;
    var b = fb.budget;
    var ent = entMap[f.enterpriseId];
    var entName = ent ? (ent.shortName || ent.name) : 'unassigned';

    function addAnomaly(code, message, detail) {
      alerts.push({
        id: generateAuditId(),
        fieldId: f.id,
        fieldName: f.name || 'unnamed',
        enterprise: entName,
        category: 'anomaly',
        severity: 'warning',
        code: code,
        message: message,
        detail: detail || {},
        createdAt: new Date().toISOString(),
        resolved: false
      });
    }

    // Negative profit threshold
    if ((b.profitPerAcre || 0) < -50) {
      addAnomaly('ANOMALY_PROFIT_NEGATIVE',
        f.name + ': losing $' + Math.abs(b.profitPerAcre).toFixed(2) + '/ac — recommend investigating cost structure',
        { value: b.profitPerAcre });
    }

    // Yield sanity bounds
    var bounds = getYieldBounds(f.crop);
    if (bounds && (b.yieldPerAcre || 0) > 0) {
      if (b.yieldPerAcre > bounds.max) {
        addAnomaly('ANOMALY_YIELD_BOUNDS',
          f.name + ': yield ' + b.yieldPerAcre + ' bu/ac exceeds max expected ' + bounds.max + ' for ' + f.crop,
          { value: b.yieldPerAcre, max: bounds.max });
      }
      if (b.yieldPerAcre < bounds.min) {
        addAnomaly('ANOMALY_YIELD_BOUNDS',
          f.name + ': yield ' + b.yieldPerAcre + ' bu/ac below min expected ' + bounds.min + ' for ' + f.crop,
          { value: b.yieldPerAcre, min: bounds.min });
      }
    }

    // Rent sanity
    if ((b.rentPerAcre || 0) > 500) {
      addAnomaly('ANOMALY_RENT_BOUNDS',
        f.name + ': rent $' + b.rentPerAcre.toFixed(2) + '/ac exceeds $500 threshold',
        { value: b.rentPerAcre });
    }

    // Expense sanity
    if ((b.expPerAcre || 0) > 1500) {
      addAnomaly('ANOMALY_EXP_BOUNDS',
        f.name + ': expenses $' + b.expPerAcre.toFixed(2) + '/ac exceeds $1500 threshold',
        { value: b.expPerAcre });
    }
  });

  // --- 3. MISSING DATA ---
  fieldBudgets.forEach(function (fb) {
    var f = fb.field;
    var b = fb.budget;
    var ent = entMap[f.enterpriseId];
    var entName = ent ? (ent.shortName || ent.name) : 'unassigned';

    function addMissing(code, message) {
      alerts.push({
        id: generateAuditId(),
        fieldId: f.id,
        fieldName: f.name || 'unnamed',
        enterprise: entName,
        category: 'missing',
        severity: 'warning',
        code: code,
        message: message,
        detail: {},
        createdAt: new Date().toISOString(),
        resolved: false
      });
    }

    if (!f.crop) addMissing('MISSING_CROP', f.name + ': no crop assigned');
    if (!(f.acres > 0)) addMissing('MISSING_ACRES', f.name + ': acres is 0 or missing');
    if (!(b.yieldPerAcre > 0)) addMissing('MISSING_YIELD', f.name + ': projected yield is 0 — budget cannot forecast income');
    if ((b.pricePerUnit || 0) === 0 && f.crop) addMissing('MISSING_PRICE', f.name + ': no crop pricing for ' + f.crop + ' — income will be $0');
    if (!f.inputs || f.inputs.length === 0) addMissing('MISSING_INPUTS', f.name + ': no inputs (fertilizer/chemical) planned');
    var hasSeeds = (f.seeds && f.seeds.length > 0) || f.seed;
    if (!hasSeeds) addMissing('MISSING_SEED', f.name + ': no seed variety assigned');
    if (!f.machinery || f.machinery.length === 0) addMissing('MISSING_MACHINERY', f.name + ': no machinery operations planned');
    if (!f.buyerId) addMissing('MISSING_BUYER', f.name + ': no buyer/delivery destination set');
    if (!f.enterpriseId || !entMap[f.enterpriseId]) addMissing('MISSING_ENTERPRISE', f.name + ': not assigned to a valid enterprise');
  });

  // --- 4. CONFIG CONSISTENCY ---
  var productNames = {};
  (store.products || []).forEach(function (p) { productNames[(p.name || '').trim().toLowerCase()] = true; });
  var implNames = {};
  (store.implements || []).forEach(function (im) { implNames[(im.name || '').trim().toLowerCase()] = true; });
  var seedVarieties = {};
  (store.seeds || []).forEach(function (s) { seedVarieties[(s.variety || '').trim().toLowerCase()] = true; });

  fields.forEach(function (f) {
    var ent = entMap[f.enterpriseId];
    var entName = ent ? (ent.shortName || ent.name) : 'unassigned';

    function addConfig(code, message) {
      alerts.push({
        id: generateAuditId(),
        fieldId: f.id,
        fieldName: f.name || 'unnamed',
        enterprise: entName,
        category: 'config',
        severity: 'info',
        code: code,
        message: message,
        detail: {},
        createdAt: new Date().toISOString(),
        resolved: false
      });
    }

    (f.inputs || []).forEach(function (inp) {
      if (inp.productName && !productNames[(inp.productName || '').trim().toLowerCase()]) {
        addConfig('CONFIG_INPUT_UNKNOWN', f.name + ': input "' + inp.productName + '" not found in products list');
      }
    });

    (f.machinery || []).forEach(function (m) {
      if (m.implementName && !implNames[(m.implementName || '').trim().toLowerCase()]) {
        addConfig('CONFIG_IMPL_UNKNOWN', f.name + ': implement "' + m.implementName + '" not found in implements list');
      }
    });

    var fieldSeeds = (f.seeds && f.seeds.length > 0) ? f.seeds : (f.seed ? [f.seed] : []);
    fieldSeeds.forEach(function (fs) {
      if (fs.variety && !seedVarieties[(fs.variety || '').trim().toLowerCase()]) {
        addConfig('CONFIG_SEED_UNKNOWN', f.name + ': seed variety "' + fs.variety + '" not found in seed list');
      }
    });
  });

  // --- Build summary ---
  var summary = { errors: 0, warnings: 0, info: 0, byCategory: { math: 0, anomaly: 0, missing: 0, config: 0 } };
  alerts.forEach(function (a) {
    if (a.severity === 'error') summary.errors++;
    else if (a.severity === 'warning') summary.warnings++;
    else summary.info++;
    if (summary.byCategory[a.category] !== undefined) summary.byCategory[a.category]++;
  });

  return {
    runAt: new Date().toISOString(),
    durationMs: 0,
    fieldsAudited: fields.length,
    alerts: alerts,
    summary: summary
  };
}

module.exports = { runAudit: runAudit };
