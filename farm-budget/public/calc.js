// Farm Enterprise Budget Calculation Engine
// UMD module — works in Node.js (server) and browser (client)
(function (exports) {
  'use strict';

  // --- Helpers ---

  function findByName(arr, name) {
    if (!name) return null;
    var n = name.trim().toLowerCase();
    for (var i = 0; i < arr.length; i++) {
      if ((arr[i].name || '').trim().toLowerCase() === n) return arr[i];
    }
    return null;
  }

  function findBySystemCode(arr, code) {
    if (!code) return null;
    var c = code.trim().toLowerCase();
    for (var i = 0; i < arr.length; i++) {
      if ((arr[i].systemCode || '').trim().toLowerCase() === c) return arr[i];
    }
    return null;
  }

  function findByCrop(arr, crop) {
    if (!crop) return null;
    var c = crop.trim().toLowerCase();
    for (var i = 0; i < arr.length; i++) {
      if ((arr[i].crop || '').trim().toLowerCase() === c) return arr[i];
    }
    return null;
  }

  function findSeedByVariety(seeds, variety) {
    if (!variety) return null;
    var v = variety.trim().toLowerCase();
    for (var i = 0; i < seeds.length; i++) {
      if ((seeds[i].variety || '').trim().toLowerCase() === v) return seeds[i];
    }
    return null;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function round4(n) {
    return Math.round(n * 10000) / 10000;
  }

  // Compute tiered moisture discount from buyer's discount schedule
  // Returns total discount per bushel based on moisture above threshold
  function computeMoistureDiscount(harvestMoisture, discountSchedule, threshold) {
    if (!discountSchedule || !discountSchedule.length || !harvestMoisture) return 0;
    var baseThreshold = threshold || 15;
    if (harvestMoisture <= baseThreshold) return 0;
    var totalDiscount = 0;
    var remainingPoints = harvestMoisture - baseThreshold;
    // Sort schedule by fromMoisture ascending
    var sorted = discountSchedule.slice().sort(function (a, b) {
      return (a.fromMoisture || 0) - (b.fromMoisture || 0);
    });
    for (var i = 0; i < sorted.length && remainingPoints > 0; i++) {
      var tier = sorted[i];
      var tierFrom = (tier.fromMoisture || 0) - baseThreshold;
      var tierTo = (tier.toMoisture || 100) - baseThreshold;
      if (tierFrom < 0) tierFrom = 0;
      var pointsInTier = Math.min(remainingPoints, tierTo - tierFrom);
      if (pointsInTier > 0) {
        totalDiscount += pointsInTier * (tier.discountPerPoint || 0);
        remainingPoints -= pointsInTier;
      }
    }
    return round4(totalDiscount);
  }

  // Find buyer by ID
  function findById(arr, id) {
    if (!id) return null;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) return arr[i];
    }
    return null;
  }

  // perf: cache crop pricing lookups — cleared when refs change
  var _cropPricingCache = {};

  function clearCropPricingCache() {
    _cropPricingCache = {};
  }

  // --- Resolve crop pricing from crop types hierarchy ---
  function resolveCropPricing(cropName, refs, buyer) {
    if (!cropName) return { pricePerUnit: 0, dryingRate: 0, interestRate: 0.06 };
    var cacheKey = (cropName || '').trim().toLowerCase();
    if (_cropPricingCache[cacheKey]) return _cropPricingCache[cacheKey];
    var key = cropName.trim().toLowerCase();
    var cropTypes = refs.cropTypes || [];
    for (var i = 0; i < cropTypes.length; i++) {
      var ct = cropTypes[i];
      var subs = ct.subCrops || [];
      for (var j = 0; j < subs.length; j++) {
        if (subs[j].name.toLowerCase() === key) {
          var sc = subs[j];
          var effectivePrice;
          if (sc.pricingMode === 'cbot') {
            // CBOT price + basis (buyer-specific or default)
            var basis = sc.basisDefault || 0;
            if (buyer && buyer.cropBasis && buyer.cropBasis[cropName] !== undefined) {
              basis = buyer.cropBasis[cropName];
            }
            effectivePrice = (ct.cbotPrice || 0) + basis;
          } else {
            effectivePrice = sc.pricePerUnit || 0;
          }
          var result = {
            pricePerUnit: effectivePrice,
            dryingRate: sc.dryingRate !== undefined ? sc.dryingRate : (ct.dryingRate || 0),
            interestRate: ct.interestRate || 0.06,
            defaultMoisture: ct.defaultMoisture || 0,
            cropType: ct,
            subCrop: sc
          };
          _cropPricingCache[cacheKey] = result;
          return result;
        }
      }
    }
    // Fallback: legacy cropPricing lookup
    var legacy = findByCrop(refs.cropPricing || [], cropName);
    if (legacy) {
      _cropPricingCache[cacheKey] = legacy;
      return legacy;
    }
    var fallback = { pricePerUnit: 0, dryingRate: 0, interestRate: 0.06 };
    _cropPricingCache[cacheKey] = fallback;
    return fallback;
  }

  // --- Application price calculation ---
  // appPrice = unitBilledPrice / conversionRate (purchase price converted to per-application-unit)
  function computeApplicationPrice(product) {
    if (!product || !product.conversionRate) return 0;
    return product.unitBilledPrice / product.conversionRate;
  }

  // --- Per-Field Budget Calculation ---
  // field: the field object from data.json
  // refs: { products, implements, cropPricing, laborOverhead, seeds }
  // settings: the global settings object
  function computeFieldBudget(field, refs, settings, options) {
    var result = {};
    // Two acre concepts: rent basis (full field) vs crop basis (planted/operating)
    // Rent uses field.acres (total field — landlord obligation)
    // Inputs, seed, machinery, etc. use plantedAcres when set (crop allocation)
    var rentAcres = field.acres || 0;
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    result.rentAcres = rentAcres;
    result.effectiveAcres = acres;
    var opts = options || {};

    // --- CROP TYPE MULTIPLIER ---
    // SINGLE CROP = 1.0, DBL CROP = 0.5 rent
    var cropTypeMultiplier = 1;
    if ((field.cropType || '').toUpperCase().indexOf('DBL') >= 0) {
      cropTypeMultiplier = 0.5;
    }

    // --- RENT (uses rentAcres — landlord obligation on total field) ---
    result.rentPerAcre = round2((field.rentPerAcre || 0) * cropTypeMultiplier);
    result.rentTotal = round2(result.rentPerAcre * rentAcres);
    // Effective rent per crop acre: when planted acres < field acres, the full rent
    // obligation gets spread over fewer crop acres, raising the effective rate.
    // This must match what expPerAcre includes so displayed subtotals add up.
    result.rentPerCropAcre = acres > 0 ? round2(result.rentTotal / acres) : result.rentPerAcre;

    // --- FERTILIZER / CHEMICAL INPUTS ---
    var springFert = 0;
    var fallFert = 0;
    var unassignedFert = 0;
    result.inputDetails = (field.inputs || []).map(function (inp) {
      var product = findByName(refs.products, inp.productName);
      var appPrice = product ? computeApplicationPrice(product) : 0;
      var costPerAcre = (inp.quantity || 0) * appPrice;
      if ((inp.season || '').toLowerCase() === 'spring') springFert += costPerAcre;
      else if ((inp.season || '').toLowerCase() === 'fall') fallFert += costPerAcre;
      else unassignedFert += costPerAcre;
      return {
        productName: inp.productName,
        quantity: inp.quantity || 0,
        unit: product ? product.unit : '',
        applicationPrice: round4(appPrice),
        costPerAcre: round2(costPerAcre),
        totalCost: round2(costPerAcre * acres),
        season: inp.season || ''
      };
    });
    result.springFertPerAcre = round2(springFert);
    result.springFertTotal = round2(springFert * acres);
    result.fallFertPerAcre = round2(fallFert);
    result.fallFertTotal = round2(fallFert * acres);
    result.unassignedFertPerAcre = round2(unassignedFert);
    result.totalFertPerAcre = round2(springFert + fallFert + unassignedFert);
    result.totalFertCost = round2((springFert + fallFert + unassignedFert) * acres);

    // --- SEED (supports multiple varieties with per-variety acres) ---
    result.seedCostPerAcre = 0;
    result.seedTotal = 0;
    var fieldSeeds = field.seeds && field.seeds.length > 0
      ? field.seeds
      : (field.seed ? [field.seed] : []);
    if (fieldSeeds.length > 0 && acres > 0) {
      var totalSeedCost = 0;
      fieldSeeds.forEach(function (fs) {
        var seedInfo = findSeedByVariety(refs.seeds, fs.variety);
        if (seedInfo && seedInfo.seedsPerUnit > 0 && fs.population) {
          var unitsNeeded = fs.population / seedInfo.seedsPerUnit;
          var costPerAcre = unitsNeeded * seedInfo.pricePerUnit;
          var seedAcres = fs.acres > 0 ? fs.acres : acres;
          totalSeedCost += costPerAcre * seedAcres;
        }
      });
      result.seedTotal = round2(totalSeedCost);
      result.seedCostPerAcre = round2(totalSeedCost / acres);
    }

    // --- MACHINERY + LABOR (single pass) ---
    // Combined loop: computes cost, fuel, AND labor hours in one pass.
    // Before: 2 separate loops over machinery, each calling findByName. After: 1 loop.
    var machCostPerAcre = 0;
    var fuelGallonsPerAcre = 0;
    var laborHours = 0;
    result.machineryDetails = (field.machinery || []).map(function (m) {
      var impl = findByName(refs.implements, m.implementName);
      var passes = m.passes || 1;
      var useHire = m.useHire !== undefined ? m.useHire :
        (impl && impl.defaultMode === 'hire' && impl.customHireRate > 0);
      var cost, fuel;
      if (useHire && impl && impl.customHireRate > 0) {
        cost = impl.customHireRate * passes;
        fuel = 0; // custom hire includes fuel
      } else {
        cost = impl ? impl.costPerAcre * passes : 0;
        fuel = impl ? impl.fuelGalPerAcre * passes : 0;
      }
      machCostPerAcre += cost;
      fuelGallonsPerAcre += fuel;
      // Accumulate labor hours in same pass (was a separate loop before)
      if (impl && impl.laborHoursPerAcre > 0) {
        laborHours += impl.laborHoursPerAcre * passes;
      }
      return {
        implementName: m.implementName,
        costPerAcre: round2(cost),
        fuelGalPerAcre: round2(fuel),
        passes: passes,
        isHire: !!useHire
      };
    });

    var rawMachPerAcre = settings.useFixedMachineryRate ? (settings.fixedMachineryRate || 100) : machCostPerAcre;
    result.machineryPerAcre = round2(rawMachPerAcre);
    result.machineryTotal = round2(rawMachPerAcre * acres);

    // --- LABOR & OVERHEAD ---
    var lo = findBySystemCode(refs.laborOverhead, field.systemCode);
    result.laborHoursPerAcre = round4(laborHours);
    // Use hours-based labor if any implements have labor hours; otherwise fall back to flat rate
    var rawLaborPerAcre = laborHours > 0 ? (laborHours * (settings.wageRate || 25)) : (lo ? lo.laborPerAcre : 0);
    result.laborPerAcre = round2(rawLaborPerAcre);
    result.laborTotal = round2(rawLaborPerAcre * acres);
    var rawOverheadPerAcre = (lo ? lo.overheadPerAcre : 0) * cropTypeMultiplier;
    result.overheadPerAcre = rawOverheadPerAcre;
    result.overheadTotal = round2(rawOverheadPerAcre * acres);
    result.laborOverheadTotal = round2((rawLaborPerAcre + rawOverheadPerAcre) * acres);

    // --- FUEL ---
    var fuelPrice = settings.fuelPricePerGal || 5;
    result.fuelGallonsPerAcre = round2(fuelGallonsPerAcre);
    var rawFuelPerAcre = fuelGallonsPerAcre * fuelPrice;
    result.fuelPerAcre = round2(rawFuelPerAcre);
    result.fuelTotal = round2(rawFuelPerAcre * acres);

    // --- PRICING & DRYING ---
    var buyer = field.buyerId && refs.buyers ? findById(refs.buyers, field.buyerId) : null;
    var pricing = resolveCropPricing(field.crop, refs, buyer);
    var dryingRate = pricing ? pricing.dryingRate : 0;
    // --- YIELD RESOLUTION (projected vs actual) ---
    var resolvedYield = field.yieldPerAcre || 0;
    var yieldSource = 'projected';

    if (opts.yieldMode === 'actual' && field._fieldops && field._fieldops.yieldHistory) {
      var targetSeason = String((settings.year || 2026) - 1);
      var fieldCrop = (field.crop || '').trim().toLowerCase();
      for (var yi = 0; yi < field._fieldops.yieldHistory.length; yi++) {
        var yh = field._fieldops.yieldHistory[yi];
        var yhCrop = (yh.crop || '').trim().toLowerCase();
        // Match: exact, or field crop contains history crop, or vice versa
        // e.g. "Yellow Corn" contains "corn", or "Corn" matches "ORG Seed Corn"
        var cropMatch = fieldCrop === yhCrop ||
          fieldCrop.indexOf(yhCrop) !== -1 ||
          yhCrop.indexOf(fieldCrop) !== -1;
        if (yh.season === targetSeason && cropMatch) {
          if (yh.yieldPerAcre > 0) {
            resolvedYield = yh.yieldPerAcre;
            yieldSource = 'actual';
          }
          break;
        }
      }
    }

    result.yieldPerAcre = resolvedYield;
    result.yieldSource = yieldSource;
    // Moisture-based drying: if field has harvestMoisture and buyer has discount schedule, use tiered calc
    result.harvestMoisture = field.harvestMoisture || 0;
    var rawDryingPerAcre;
    if (field.harvestMoisture > 0 && buyer && buyer.discountSchedule && buyer.discountSchedule.length > 0) {
      var moistureDiscount = computeMoistureDiscount(field.harvestMoisture, buyer.discountSchedule, buyer.threshold || 15);
      rawDryingPerAcre = result.yieldPerAcre * moistureDiscount;
      result.dryingMethod = 'moisture';
    } else {
      rawDryingPerAcre = result.yieldPerAcre * dryingRate;
      result.dryingMethod = 'flat';
    }
    result.dryingPerAcre = round2(rawDryingPerAcre);
    result.dryingTotal = round2(rawDryingPerAcre * acres);

    // --- INTEREST ---
    // Configurable carry period: carryMonths / 12 replaces the old hardcoded 0.6 (≈7.2 months/12)
    var interestRate = pricing ? pricing.interestRate : 0.06;
    var carryFraction = (settings.carryMonths || 6) / 12;
    var interestBase = (
      (result.rentPerCropAcre * 0.5) +
      result.springFertPerAcre +
      result.seedCostPerAcre +
      ((result.laborPerAcre + result.overheadPerAcre + result.fuelPerAcre) * 0.5)
    );
    var rawInterestPerAcre = interestBase * interestRate * carryFraction;
    result.interestPerAcre = round2(rawInterestPerAcre);
    result.interestTotal = round2(rawInterestPerAcre * acres);

    // --- CROP INSURANCE ---
    var rawCropInsPerAcre = field.cropInsurancePerAcre || 0;
    result.cropInsurancePerAcre = rawCropInsPerAcre;
    result.cropInsuranceTotal = round2(rawCropInsPerAcre * acres);

    // --- TOTAL EXPENSE (sum individual totals — rent may use different acre base) ---
    result.expTotal = round2(
      result.rentTotal +
      result.totalFertCost +
      result.seedTotal +
      result.machineryTotal +
      result.laborTotal +
      result.overheadTotal +
      result.fuelTotal +
      result.dryingTotal +
      result.interestTotal +
      result.cropInsuranceTotal
    );
    result.expPerAcre = acres > 0 ? round2(result.expTotal / acres) : 0;

    // --- YIELD ---
    result.yieldUnit = field.yieldUnit || 'Bu';
    result.totalYield = round2(result.yieldPerAcre * acres);

    // --- INCOME ---
    var pricePerUnit = pricing ? pricing.pricePerUnit : 0;
    result.pricePerUnit = pricePerUnit;
    var rawCropIncomePerAcre = result.yieldPerAcre * pricePerUnit;
    result.cropIncomePerAcre = round2(rawCropIncomePerAcre);
    result.cropIncomeTotal = round2(rawCropIncomePerAcre * acres);

    // --- INSURANCE INCOME ---
    result.insuranceIncomePerAcre = field.insuranceIncomePerAcre || 0;
    result.insuranceIncomeTotal = round2(result.insuranceIncomePerAcre * acres);

    // --- AUX PAYMENTS ---
    var auxPayments = field.auxPayments || [];
    var auxTotalPerAcre = 0;
    auxPayments.forEach(function (ap) {
      auxTotalPerAcre += ap.perAcre || 0;
    });
    result.auxPayments = auxPayments;
    result.auxTotalPerAcre = round2(auxTotalPerAcre);
    // Backward compat: also populate legacy fields
    result.govPaymentsPerAcre = round2(auxTotalPerAcre);
    result.totalGovPayments = round2(auxTotalPerAcre * acres);

    // --- INCOME + PAYMENTS ---
    result.incomeWithPayments = round2(
      result.cropIncomeTotal + result.insuranceIncomeTotal + result.totalGovPayments
    );

    // --- PROFIT ---
    // Core profit = crop revenue − expenses (excludes insurance claims + aux/gov payments)
    result.profitPerAcre = round2(result.cropIncomePerAcre - result.expPerAcre);
    result.profitFarmWithoutPayments = round2(
      result.cropIncomeTotal - result.expTotal
    );
    result.profitFarmWithPayments = round2(
      result.cropIncomeTotal + result.insuranceIncomeTotal + result.totalGovPayments - result.expTotal
    );

    // --- COP (Cost of Production per unit) ---
    result.cop = result.totalYield > 0 ? round2(result.expTotal / result.totalYield) : 0;

    return result;
  }

  // --- Enterprise Summary ---
  function computeEnterpriseSummary(fields, refs, settings, options) {
    var totals = {
      acres: 0, rent: 0, springFert: 0, fallFert: 0, fert: 0, seed: 0, machinery: 0,
      laborOverhead: 0, fuel: 0, drying: 0, interest: 0,
      insurance: 0, expTotal: 0, cropIncome: 0, insIncome: 0,
      govPayments: 0, coreIncome: 0, incomeWithPayments: 0,
      cropProfit: 0, profitWithoutPayments: 0, profitWithPayments: 0,
      totalYield: 0
    };

    var budgets = fields.map(function (f) {
      var b = computeFieldBudget(f, refs, settings, options);
      totals.acres += b.effectiveAcres;
      totals.rent += b.rentTotal;
      totals.springFert += b.springFertTotal;
      totals.fallFert += b.fallFertTotal;
      totals.fert += b.totalFertCost;
      totals.seed += b.seedTotal;
      totals.machinery += b.machineryTotal;
      totals.laborOverhead += b.laborOverheadTotal;
      totals.fuel += b.fuelTotal;
      totals.drying += b.dryingTotal;
      totals.interest += b.interestTotal;
      totals.insurance += b.cropInsuranceTotal;
      totals.expTotal += b.expTotal;
      totals.cropIncome += b.cropIncomeTotal;
      totals.insIncome += b.insuranceIncomeTotal;
      totals.govPayments += b.totalGovPayments;
      totals.coreIncome += b.cropIncomeTotal;
      totals.incomeWithPayments += b.incomeWithPayments;
      totals.cropProfit += b.cropIncomeTotal - b.expTotal;
      totals.profitWithoutPayments += b.profitFarmWithoutPayments;
      totals.profitWithPayments += b.profitFarmWithPayments;
      totals.totalYield += b.totalYield;
      return { field: f, budget: b };
    });

    // Weighted averages
    // Core KPI: crop revenue − expenses (pure farming performance)
    totals.avgProfitPerAcre = totals.acres > 0
      ? round2(totals.cropProfit / totals.acres) : 0;
    totals.avgExpPerAcre = totals.acres > 0
      ? round2(totals.expTotal / totals.acres) : 0;
    totals.cop = totals.totalYield > 0
      ? round2(totals.expTotal / totals.totalYield) : 0;

    return { budgets: budgets, totals: totals };
  }

  // --- Dashboard: by crop within enterprise ---
  // Accepts optional precomputed budgets to avoid recomputing.
  // Before: recomputed every field budget (N calls). After: reuses from summary (0 calls).
  function computeDashboardByCrop(fields, refs, settings, options, precomputedBudgets) {
    // Build a field-id → budget map from precomputed data if available
    var budgetMap = {};
    if (precomputedBudgets) {
      precomputedBudgets.forEach(function (fb) {
        budgetMap[fb.field.id] = fb.budget;
      });
    }

    // Group fields by crop name
    var byCrop = {};
    fields.forEach(function (f) {
      var crop = f.crop || 'Unknown';
      if (!byCrop[crop]) byCrop[crop] = [];
      byCrop[crop].push(f);
    });

    var rows = [];
    Object.keys(byCrop).forEach(function (crop) {
      var cropFields = byCrop[crop];
      var totalAcres = 0;
      var sumYieldTimesAcres = 0;
      var sumProfitTimesAcres = 0;
      var sumMachTimesAcres = 0;
      var totalProjected = 0;
      var totalExpense = 0;
      var totalYield = 0;
      var actualCount = 0;
      var totalCount = 0;

      cropFields.forEach(function (f) {
        // Reuse precomputed budget if available; otherwise compute fresh
        var b = budgetMap[f.id] || computeFieldBudget(f, refs, settings, options);
        var a = b.effectiveAcres !== undefined ? b.effectiveAcres : ((f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0);
        totalAcres += a;
        sumYieldTimesAcres += b.yieldPerAcre * a;
        sumProfitTimesAcres += b.profitPerAcre * a;
        sumMachTimesAcres += b.machineryPerAcre * a;
        totalProjected += b.totalYield;
        totalExpense += b.expTotal;
        totalYield += b.totalYield;
        totalCount++;
        if (b.yieldSource === 'actual') actualCount++;
      });

      var avgYield = totalAcres > 0 ? round2(sumYieldTimesAcres / totalAcres) : 0;
      var avgProfit = totalAcres > 0 ? round2(sumProfitTimesAcres / totalAcres) : 0;
      var avgMach = totalAcres > 0 ? round2(sumMachTimesAcres / totalAcres) : 0;
      var cop = totalYield > 0 ? round2(totalExpense / totalYield) : 0;
      var unit = cropFields[0] ? (cropFields[0].yieldUnit || 'Bu') : 'Bu';

      rows.push({
        crop: crop,
        acres: round2(totalAcres),
        avgYield: avgYield,
        projectedTotal: round2(totalProjected),
        avgMachinery: avgMach,
        profitPerAcre: avgProfit,
        cop: cop,
        unit: unit,
        actualCount: actualCount,
        totalCount: totalCount
      });
    });

    return rows;
  }

  // --- Full Dashboard ---
  function computeDashboard(allFields, enterprises, refs, settings, options) {
    var result = { conventional: [], organic: [], enterpriseSummaries: [] };
    result.yieldMode = (options && options.yieldMode) || 'projected';

    enterprises.forEach(function (ent) {
      var entFields = allFields.filter(function (f) { return f.enterpriseId === ent.id; });
      var summary = computeEnterpriseSummary(entFields, refs, settings, options);
      summary.enterprise = ent;

      // Pass precomputed budgets to avoid recomputing every field budget.
      // Before: 2N computeFieldBudget calls per enterprise. After: N calls total.
      var cropRows = computeDashboardByCrop(entFields, refs, settings, options, summary.budgets);

      var entry = {
        enterprise: ent,
        cropRows: cropRows,
        totals: summary.totals
      };

      // Mixed enterprises (system codes with both CON and ORG) split fields
      // into separate dashboard entries so each crop lands in the right section.
      var hasCon = ent.systemCodes && ent.systemCodes.some(function (c) { return /\bCON\b/i.test(c); });
      var hasOrg = ent.systemCodes && ent.systemCodes.some(function (c) { return /\bORG\b/i.test(c); });
      var isMixed = hasCon && hasOrg;

      if (isMixed) {
        var orgFields = entFields.filter(function (f) { return /\bORG\b/i.test(f.systemCode || ''); });
        var conFields = entFields.filter(function (f) { return !/\bORG\b/i.test(f.systemCode || ''); });

        if (conFields.length > 0) {
          var conSummary = computeEnterpriseSummary(conFields, refs, settings, options);
          var conCropRows = computeDashboardByCrop(conFields, refs, settings, options, conSummary.budgets);
          var conEnt = Object.assign({}, ent, { name: ent.shortName + ' (Conv)', category: 'conventional' });
          result.conventional.push({ enterprise: conEnt, cropRows: conCropRows, totals: conSummary.totals });
        }
        if (orgFields.length > 0) {
          var orgSummary = computeEnterpriseSummary(orgFields, refs, settings, options);
          var orgCropRows = computeDashboardByCrop(orgFields, refs, settings, options, orgSummary.budgets);
          var orgEnt = Object.assign({}, ent, { name: ent.shortName + ' (Org)', category: 'organic' });
          result.organic.push({ enterprise: orgEnt, cropRows: orgCropRows, totals: orgSummary.totals });
        }
      } else if (ent.category === 'organic') {
        result.organic.push(entry);
      } else {
        result.conventional.push(entry);
      }

      result.enterpriseSummaries.push(entry);
    });

    // Grand totals
    var grand = {
      acres: 0, rent: 0, springFert: 0, fallFert: 0, fert: 0, seed: 0, machinery: 0,
      laborOverhead: 0, fuel: 0, drying: 0, interest: 0,
      insurance: 0, expTotal: 0, cropIncome: 0, insIncome: 0,
      govPayments: 0, incomeWithPayments: 0, cropProfit: 0, profitWithPayments: 0
    };
    result.enterpriseSummaries.forEach(function (es) {
      var t = es.totals;
      grand.acres += t.acres;
      grand.rent += t.rent;
      grand.springFert += t.springFert;
      grand.fallFert += t.fallFert;
      grand.fert += t.fert;
      grand.seed += t.seed;
      grand.machinery += t.machinery;
      grand.laborOverhead += t.laborOverhead;
      grand.fuel += t.fuel;
      grand.drying += t.drying;
      grand.interest += t.interest;
      grand.insurance += t.insurance;
      grand.expTotal += t.expTotal;
      grand.cropIncome += t.cropIncome;
      grand.insIncome += t.insIncome;
      grand.govPayments += t.govPayments;
      grand.incomeWithPayments += t.incomeWithPayments;
      grand.cropProfit += t.cropProfit;
      grand.profitWithPayments += t.profitWithPayments;
    });
    result.grandTotals = grand;

    return result;
  }

  // --- Exports ---
  exports.computeFieldBudget = computeFieldBudget;
  exports.computeEnterpriseSummary = computeEnterpriseSummary;
  exports.computeDashboardByCrop = computeDashboardByCrop;
  exports.computeDashboard = computeDashboard;
  exports.computeApplicationPrice = computeApplicationPrice;
  exports.computeMoistureDiscount = computeMoistureDiscount;
  exports.clearCropPricingCache = clearCropPricingCache;
  exports.round2 = round2;
  exports.round4 = round4;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.Calc = {}));
