/* FSA Acres Calc Engine — UMD */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var TILLAGE_CODES = {
    'A': 'No Till',
    'B': 'Strip Till',
    'C': 'Fall Vertical',
    'D': 'Spring Vertical',
    'E': 'Fall Field Cultivation',
    'E2': 'Spring Field Cultivation',
    'F': 'Disk Ripper',
    'G': 'Reduced Till'
  };

  function round2(n) { return Math.round(n * 100) / 100; }

  // ===== Rollups =====

  function rollupByFarm(records) {
    var map = {};
    records.forEach(function (r) {
      var key = r.farmNumber || 'Unknown';
      if (!map[key]) map[key] = { farmNumber: key, farmName: r.farmName || '', totalAcres: 0, dryAcres: 0, irrigatedAcres: 0, organicAcres: 0 };
      var ac = r.fsaAcres || 0;
      map[key].totalAcres += ac;
      if (r.irrigated) map[key].irrigatedAcres += ac;
      else map[key].dryAcres += ac;
      if (r.organic) map[key].organicAcres += ac;
      if (!map[key].farmName && r.farmName) map[key].farmName = r.farmName;
    });
    var result = [];
    Object.keys(map).forEach(function (k) {
      var e = map[k];
      e.totalAcres = round2(e.totalAcres);
      e.dryAcres = round2(e.dryAcres);
      e.irrigatedAcres = round2(e.irrigatedAcres);
      e.organicAcres = round2(e.organicAcres);
      result.push(e);
    });
    return result.sort(function (a, b) { return b.totalAcres - a.totalAcres; });
  }

  function rollupByCrop(records) {
    var map = {};
    records.forEach(function (r) {
      var crop = r.crop || '(no crop)';
      if (!map[crop]) map[crop] = { crop: crop, dryAcres: 0, irrigatedAcres: 0, organicAcres: 0, totalAcres: 0 };
      var ac = r.fsaAcres || 0;
      map[crop].totalAcres += ac;
      if (r.irrigated) map[crop].irrigatedAcres += ac;
      else map[crop].dryAcres += ac;
      if (r.organic) map[crop].organicAcres += ac;
    });
    var result = [];
    Object.keys(map).forEach(function (k) {
      var e = map[k];
      e.totalAcres = round2(e.totalAcres);
      e.dryAcres = round2(e.dryAcres);
      e.irrigatedAcres = round2(e.irrigatedAcres);
      e.organicAcres = round2(e.organicAcres);
      result.push(e);
    });
    return result.sort(function (a, b) { return b.totalAcres - a.totalAcres; });
  }

  function rollupByField(records, farmNumber) {
    var filtered = farmNumber ? records.filter(function (r) { return r.farmNumber === farmNumber; }) : records;
    var map = {};
    filtered.forEach(function (r) {
      var key = r.fieldName || '(unnamed)';
      if (!map[key]) map[key] = { fieldName: key, farmNumber: r.farmNumber, crops: {}, totalAcres: 0 };
      var crop = r.crop || '(no crop)';
      if (!map[key].crops[crop]) map[key].crops[crop] = { crop: crop, dryAcres: 0, irrigatedAcres: 0, totalAcres: 0 };
      var ac = r.fsaAcres || 0;
      map[key].crops[crop].totalAcres += ac;
      map[key].totalAcres += ac;
      if (r.irrigated) map[key].crops[crop].irrigatedAcres += ac;
      else map[key].crops[crop].dryAcres += ac;
    });
    var result = [];
    Object.keys(map).sort().forEach(function (k) {
      var e = map[k];
      e.totalAcres = round2(e.totalAcres);
      var cropArr = [];
      Object.keys(e.crops).forEach(function (c) {
        var ce = e.crops[c];
        ce.totalAcres = round2(ce.totalAcres);
        ce.dryAcres = round2(ce.dryAcres);
        ce.irrigatedAcres = round2(ce.irrigatedAcres);
        cropArr.push(ce);
      });
      e.crops = cropArr;
      result.push(e);
    });
    return result;
  }

  function rollupByTract(records, farmNumber) {
    var filtered = farmNumber ? records.filter(function (r) { return r.farmNumber === farmNumber; }) : records;
    var map = {};
    filtered.forEach(function (r) {
      var key = r.tractNumber || '(unknown)';
      if (!map[key]) map[key] = { tractNumber: key, farmNumber: r.farmNumber, totalAcres: 0, dryAcres: 0, irrigatedAcres: 0 };
      var ac = r.fsaAcres || 0;
      map[key].totalAcres += ac;
      if (r.irrigated) map[key].irrigatedAcres += ac;
      else map[key].dryAcres += ac;
    });
    var result = [];
    Object.keys(map).sort().forEach(function (k) {
      var e = map[k];
      e.totalAcres = round2(e.totalAcres);
      e.dryAcres = round2(e.dryAcres);
      e.irrigatedAcres = round2(e.irrigatedAcres);
      result.push(e);
    });
    return result;
  }

  function tillageSummary(records, year) {
    var field = year === 2024 ? 'tillage2024' : 'tillage2025';
    var ntField = year === 2024 ? 'ntAdoption2024' : 'ntAdoption2025';
    var ccField = year === 2024 ? 'ccAdoption2024' : 'ccAdoption2025';
    var map = {};
    records.forEach(function (r) {
      var code = r[field];
      if (!code) return;
      if (!map[code]) map[code] = { code: code, name: TILLAGE_CODES[code] || code, totalAcres: 0, newPracticeAcres: 0, earlyAdopterAcres: 0 };
      var ac = r.fsaAcres || 0;
      map[code].totalAcres += ac;
      var nt = r[ntField] || '';
      if (nt === 'New Practice') map[code].newPracticeAcres += ac;
      else if (nt === 'Early adopter') map[code].earlyAdopterAcres += ac;
    });
    var result = [];
    Object.keys(map).sort().forEach(function (k) {
      var e = map[k];
      e.totalAcres = round2(e.totalAcres);
      e.newPracticeAcres = round2(e.newPracticeAcres);
      e.earlyAdopterAcres = round2(e.earlyAdopterAcres);
      result.push(e);
    });
    return result;
  }

  function coverCropSummary(records, year) {
    var field = year === 2024 ? 'cc2024' : year === 2023 ? 'cc2023Species' : 'cc2025';
    var map = {};
    records.forEach(function (r) {
      var species = r[field];
      if (!species) return;
      var key = species.toLowerCase().trim();
      if (!map[key]) map[key] = { species: species, acres: 0 };
      map[key].acres += (r.fsaAcres || 0);
    });
    var result = [];
    Object.keys(map).sort().forEach(function (k) {
      map[k].acres = round2(map[k].acres);
      result.push(map[k]);
    });
    return result.sort(function (a, b) { return b.acres - a.acres; });
  }

  function summaryMetrics(records) {
    var total = 0, organic = 0, irrigated = 0, coverCropped = 0, reported = 0;
    records.forEach(function (r) {
      var ac = r.fsaAcres || 0;
      total += ac;
      if (r.organic) organic += ac;
      if (r.irrigated) irrigated += ac;
      if (r.coverCrop || r.cc2024 || r.cc2025) coverCropped += ac;
      if (r.reported) reported += ac;
    });
    return {
      totalAcres: round2(total),
      organicAcres: round2(organic),
      irrigatedAcres: round2(irrigated),
      coverCroppedAcres: round2(coverCropped),
      reportedAcres: round2(reported),
      recordCount: records.length,
      farmCount: Object.keys(records.reduce(function (m, r) { m[r.farmNumber] = 1; return m; }, {})).length
    };
  }

  // ===== Insurance =====

  function findPrice(pricing, crop) {
    if (!crop) return null;
    var lc = crop.toLowerCase().trim();
    for (var i = 0; i < pricing.length; i++) {
      if (pricing[i].crop.toLowerCase().trim() === lc) return pricing[i];
    }
    return null;
  }

  function computeInsurancePolicy(policy, cluRecords, pricing) {
    // Sum FSA acres for matching crop from CLU records, scoped by farmNumber if set
    var fsaAcres = 0;
    if (policy.crop) {
      var lc = policy.crop.toLowerCase().trim();
      var hasFarm = policy.farmNumber && policy.farmNumber.trim();
      cluRecords.forEach(function (r) {
        if (r.crop && r.crop.toLowerCase().trim() === lc) {
          if (hasFarm && r.farmNumber !== policy.farmNumber) return;
          fsaAcres += (r.fsaAcres || 0);
        }
      });
    }
    if (policy.fsaAcresManual) fsaAcres = policy.fsaAcresManual;

    var price = findPrice(pricing, policy.crop);
    var springPrice = price ? price.springPrice : 0;
    var fallPrice = price ? price.fallPrice : 0;
    var highestPrice = Math.max(springPrice, fallPrice);

    var guarantee = policy.guarantee || 0;
    var actual = policy.actual || 0;
    var plantedAcres = policy.plantedAcres || 0;
    var coverageLevel = policy.coverageLevel || 75;
    var effectiveGuarantee = round2(guarantee * (coverageLevel / 100));
    var shortfall = Math.max(0, effectiveGuarantee - actual);
    var dollarGuarantee = round2(effectiveGuarantee * highestPrice * plantedAcres);
    var indemnity = round2(shortfall * highestPrice * plantedAcres);
    var totalPremium = round2((policy.premiumPerAcre || 0) * plantedAcres);

    var claimStatus = policy.claimStatus || 'none';
    // Auto-detect potential claims if not already filed/paid
    if (claimStatus === 'none' && shortfall > 0 && plantedAcres > 0 && highestPrice > 0) {
      claimStatus = 'potential';
    }

    return {
      fsaAcres: round2(fsaAcres),
      springPrice: springPrice,
      fallPrice: fallPrice,
      highestPrice: highestPrice,
      effectiveGuarantee: effectiveGuarantee,
      dollarGuarantee: dollarGuarantee,
      shortfall: shortfall,
      indemnity: indemnity,
      claimStatus: claimStatus,
      coverageLevel: coverageLevel,
      totalPremium: totalPremium
    };
  }

  // ===== Reporting Progress =====

  function reportingProgress(records) {
    var map = {};
    records.forEach(function (r) {
      var fn = r.farmNumber || 'Unknown';
      if (!map[fn]) map[fn] = { farmNumber: fn, total: 0, reported: 0, unreported: 0, totalAcres: 0, reportedAcres: 0, unreportedAcres: 0 };
      map[fn].total++;
      var ac = r.fsaAcres || 0;
      map[fn].totalAcres += ac;
      if (r.reported) { map[fn].reported++; map[fn].reportedAcres += ac; }
      else { map[fn].unreported++; map[fn].unreportedAcres += ac; }
    });
    var result = [];
    Object.keys(map).sort().forEach(function (k) {
      var e = map[k];
      e.pct = e.total > 0 ? Math.round(e.reported / e.total * 100) : 0;
      e.totalAcres = round2(e.totalAcres);
      e.reportedAcres = round2(e.reportedAcres);
      e.unreportedAcres = round2(e.unreportedAcres);
      result.push(e);
    });
    return result;
  }

  // ===== Validation =====

  function validateRecords(records, pricing, policies) {
    var warnings = [];

    // Missing crop
    var noCrop = records.filter(function (r) { return !r.crop || !r.crop.trim(); });
    if (noCrop.length > 0) {
      warnings.push({ type: 'missing-crop', severity: 'warning',
        message: noCrop.length + ' record' + (noCrop.length > 1 ? 's have' : ' has') + ' no crop assigned',
        filter: { crop: '' }, count: noCrop.length });
    }

    // Missing plant date (has crop but no date)
    var noDate = records.filter(function (r) { return r.crop && r.crop.trim() && (!r.grainPlantDate || !r.grainPlantDate.trim()); });
    if (noDate.length > 0) {
      warnings.push({ type: 'missing-date', severity: 'info',
        message: noDate.length + ' record' + (noDate.length > 1 ? 's' : '') + ' missing plant date',
        filter: { reported: '' }, count: noDate.length });
    }

    // Missing prices — crops in CLU that have no pricing entry
    var cropSet = {};
    records.forEach(function (r) { if (r.crop && r.crop.trim()) cropSet[r.crop.trim()] = 1; });
    var pricedCrops = {};
    (pricing || []).forEach(function (p) { if (p.crop) pricedCrops[p.crop.toLowerCase().trim()] = 1; });
    var unpriced = [];
    Object.keys(cropSet).forEach(function (c) {
      if (!pricedCrops[c.toLowerCase().trim()]) unpriced.push(c);
    });
    if (unpriced.length > 0) {
      warnings.push({ type: 'missing-price', severity: 'warning',
        message: 'No price for: ' + unpriced.join(', '),
        count: unpriced.length });
    }

    // Insurance gaps — crops with significant acreage but no policy
    var cropAcres = {};
    records.forEach(function (r) {
      if (r.crop && r.crop.trim()) {
        var key = r.crop.trim().toLowerCase();
        cropAcres[key] = (cropAcres[key] || 0) + (r.fsaAcres || 0);
      }
    });
    var insuredCrops = {};
    (policies || []).forEach(function (p) {
      if (p.crop && p.crop.trim()) insuredCrops[p.crop.trim().toLowerCase()] = 1;
    });
    var uninsured = [];
    Object.keys(cropAcres).forEach(function (c) {
      if (!insuredCrops[c] && cropAcres[c] >= 10) {
        uninsured.push({ crop: c, acres: round2(cropAcres[c]) });
      }
    });
    if (uninsured.length > 0) {
      var totalUninsuredAc = 0;
      uninsured.forEach(function (u) { totalUninsuredAc += u.acres; });
      warnings.push({ type: 'no-insurance', severity: 'warning',
        message: round2(totalUninsuredAc) + ' acres across ' + uninsured.length + ' crop' + (uninsured.length > 1 ? 's' : '') + ' have no insurance policy',
        details: uninsured, count: uninsured.length });
    }

    // Unreported records
    var unreported = records.filter(function (r) { return !r.reported; });
    if (unreported.length > 0) {
      var unreportedAcres = 0;
      unreported.forEach(function (r) { unreportedAcres += (r.fsaAcres || 0); });
      warnings.push({ type: 'unreported', severity: 'info',
        message: unreported.length + ' record' + (unreported.length > 1 ? 's' : '') + ' (' + round2(unreportedAcres) + ' acres) still unreported',
        filter: { reported: 'false' }, count: unreported.length });
    }

    return warnings;
  }

  // ===== GCS =====

  function gcsSummary(enrollments) {
    var cc340 = 0, rt345 = 0, nt329 = 0;
    enrollments.forEach(function (e) {
      cc340 += (e.cc340Acres || 0);
      rt345 += (e.rt345Acres || 0);
      nt329 += (e.nt329Acres || 0);
    });
    return {
      cc340Acres: round2(cc340),
      rt345Acres: round2(rt345),
      nt329Acres: round2(nt329),
      totalEnrollments: enrollments.length
    };
  }

  return {
    TILLAGE_CODES: TILLAGE_CODES,
    rollupByFarm: rollupByFarm,
    rollupByCrop: rollupByCrop,
    rollupByField: rollupByField,
    rollupByTract: rollupByTract,
    tillageSummary: tillageSummary,
    coverCropSummary: coverCropSummary,
    summaryMetrics: summaryMetrics,
    computeInsurancePolicy: computeInsurancePolicy,
    gcsSummary: gcsSummary,
    findPrice: findPrice,
    reportingProgress: reportingProgress,
    validateRecords: validateRecords
  };
});
