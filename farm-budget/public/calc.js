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

  // Snapshot entry for a crop line: refs.marketingPrices.byCrop keyed by the
  // lower-cased farm-budget crop name (price-source.js writes it, server keeps it).
  function marketingEntryFor(cropName, refs) {
    var snap = refs && refs.marketingPrices;
    if (!snap || !snap.byCrop) return null;
    return snap.byCrop[(cropName || '').trim().toLowerCase()] || null;
  }

  // --- Explain where a field's $/unit price comes from (UI hint, no math change) ---
  // Reads the same resolution computeFieldBudget uses, then describes it:
  //   cbot     → CBOT <contract> $X ± basis (default or buyer-specific)
  //   flat     → fixed price typed in Reference Data
  //   contract → contracted price typed in Reference Data
  //   legacy   → old cropPricing table
  //   none     → nothing found for this crop name
  // `futures` is the /api/futures-config list (optional) — used only to label
  // the CBOT contract ("DEC 26"). Basis is derived as price − CBOT so the text
  // always agrees with the number the budget actually used.
  function explainCropPrice(field, refs, futures) {
    var crop = (field && field.crop) || '';
    var out = { price: 0, mode: 'none', cbot: 0, basis: 0, basisSource: '', contract: '',
                cropType: '', subCrop: '', text: '', short: '' };
    if (!crop) { out.text = 'No crop set on this field'; out.short = 'no crop'; return out; }
    var buyer = field.buyerId && refs.buyers ? findById(refs.buyers, field.buyerId) : null;
    var pricing = resolveCropPricing(crop, refs, buyer) || {};
    out.price = pricing.pricePerUnit || 0;
    var ct = pricing.cropType, sc = pricing.subCrop;
    var m2 = function (v) { return '$' + (Math.round(v * 100) / 100).toFixed(2); };
    if (sc) {
      out.cropType = ct.name || '';
      out.subCrop = sc.name || '';
      var mode = sc.pricingMode || 'flat';
      out.mode = mode;
      out.priceSource = pricing.priceSource || 'reference';
      out.referencePrice = pricing.referencePrice != null ? pricing.referencePrice : out.price;
      var where = ' · Reference Data › ' + out.cropType + ' › ' + out.subCrop;
      if (out.priceSource === 'marketing') {
        var mk = pricing.marketing || {};
        var isBlend = mk.blendDollars > 0 && Math.abs(mk.blendDollars - out.price) < 0.005;
        var bits = [];
        if (mk.soldBu > 0) {
          bits.push((mk.pctSold != null ? Math.round(mk.pctSold * 100) + '% sold' : 'sold bu') +
            (mk.wapDollars > 0 ? ' at WAP ' + m2(mk.wapDollars) : ''));
          if (isBlend) bits.push('rest at ' + (mk.cbotContract ? mk.cbotContract + ' ' : 'futures ') + m2(mk.cbot || 0) + ' + projected basis');
        } else if (isBlend) {
          bits.push('nothing sold yet — all at ' + (mk.cbotContract ? mk.cbotContract + ' ' : 'futures ') + m2(mk.cbot || 0) + ' + projected basis');
        } else {
          bits.push('pooled WAP + premium');
        }
        var asOf = '';
        if (pricing.marketingAsOf) {
          var d = new Date(pricing.marketingAsOf);
          var hrs = (Date.now() - d.getTime()) / 36e5;
          asOf = ' · as of ' + d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) +
            (hrs > 24 ? ' (STALE)' : '');
        }
        out.mode = 'marketing';
        out.text = 'Marketing ' + (isBlend ? 'blend (F-IT) ' : 'pooled price ') + m2(out.price) +
          ' · ' + (mk.commodity || '') + ' pool › ' + (mk.variant || '') + ': ' + bits.join(', ') + asOf +
          ' · Ref Data would be ' + m2(out.referencePrice);
        out.short = 'marketing ' + (isBlend ? 'blend (F-IT)' : 'pooled') + (asOf.indexOf('STALE') >= 0 ? ' · STALE' : '');
        return out;
      }
      var wanted = sc.priceSource === 'marketing' ? ' · marketing price unavailable, using Ref Data' : '';
      if (mode === 'cbot') {
        out.cbot = ct.cbotPrice || 0;
        out.basis = round4(out.price - out.cbot);
        var buyerBasis = buyer && buyer.cropBasis && buyer.cropBasis[crop] !== undefined;
        out.basisSource = buyerBasis ? (buyer.name || 'buyer') : 'default';
        var fc = null;
        (futures || []).forEach(function (c) {
          if (fc) return;
          var k = (c.key || '').toLowerCase();
          var sym = (ct.cbotSymbol || '').toUpperCase();
          if ((ct.name || '').toLowerCase() === k || (sym && (c.symbol || '').toUpperCase().indexOf(sym) === 0)) fc = c;
        });
        out.contract = fc ? (fc.contract || '') : '';
        var sign = out.basis < 0 ? '−' : '+';
        var basisStr = sign + ' ' + m2(Math.abs(out.basis)) + ' basis' +
          (buyerBasis ? ' (' + out.basisSource + ')' : '');
        out.text = 'CBOT ' + (out.contract ? out.contract + ' ' : '') + m2(out.cbot) + ' ' + basisStr +
          ' = ' + m2(out.price) + where + wanted;
        out.short = 'CBOT ' + m2(out.cbot) + ' ' + basisStr;
      } else if (mode === 'contract') {
        out.text = 'Contract price ' + m2(out.price) + ' entered by hand' + where + wanted;
        out.short = 'contract price · Ref Data';
      } else {
        out.text = 'Flat ' + m2(out.price) + ' entered by hand' + where + wanted;
        out.short = 'flat price · Ref Data';
      }
      return out;
    }
    if (out.price > 0) {
      out.mode = 'legacy';
      out.text = m2(out.price) + ' from the legacy crop pricing table (not in Crop Types)';
      out.short = 'legacy pricing table';
      return out;
    }
    out.text = 'No price found for "' + crop + '" — add it under Reference Data › Crop Types';
    out.short = 'no price set';
    return out;
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
          // Marketing override (owner decision 2026-09-14, "option 1"): price
          // the field at the marketing blend — sold bushels at their WAP plus
          // the unsold remainder at live futures + projected basis (F-IT) —
          // from the snapshot the browser saves off the portal rollup.
          //   sc.priceSource: 'auto' (default) → marketing when the crop is a
          //                   futures-tier variant with a live blend
          //                   'marketing'      → marketing whenever a blend
          //                                      (or pooled price) exists
          //                   'reference'      → always the price above
          // Falls back to the Reference Data price whenever the snapshot has
          // nothing usable, so a dead portal never zeroes income.
          var mk = marketingEntryFor(cropName, refs);
          var src = sc.priceSource || 'auto';
          var mkPrice = null;
          if (mk && src !== 'reference') {
            if (mk.blendDollars > 0 && (src === 'marketing' || mk.tier === 'futures')) mkPrice = mk.blendDollars;
            else if (src === 'marketing' && mk.pooledDollars > 0) mkPrice = mk.pooledDollars;
          }
          var result = {
            pricePerUnit: mkPrice != null ? mkPrice : effectivePrice,
            referencePrice: effectivePrice,
            priceSource: mkPrice != null ? 'marketing' : 'reference',
            priceSourceSetting: src,
            marketing: mk || null,
            marketingAsOf: refs.marketingPrices ? refs.marketingPrices.updatedAt : null,
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

  // --- Invoice quantity -> as-applied rate ---
  // Invoice totals are entered in the product's PURCHASE unit (Gal, Ton), but
  // quantity/actualQuantity are per-acre in the APPLICATION unit (OZ, Quart, Lbs).
  // conversionRate is application-units-per-purchase-unit, so the purchase-unit
  // total must be multiplied by it before dividing by acres. Returns null when
  // the rate can't be computed.
  function invoiceRatePerAcre(product, qtyTotal, acres, enteredUnit) {
    var qty = parseFloat(qtyTotal);
    var ac = parseFloat(acres);
    if (!(qty > 0) || !(ac > 0)) return null;
    var convRate = (product && product.conversionRate) || 1;
    var appUnit = product ? (product.unit || '') : '';
    var norm = function (u) { return (u || '').trim().toLowerCase(); };
    // A quantity already typed in the application unit needs no conversion.
    var factor = (enteredUnit && appUnit && norm(enteredUnit) === norm(appUnit)) ? 1 : convRate;
    return round4(qty * factor / ac);
  }

  // --- OVERHEAD POOLS ---
  // A pool is an annual dollar figure (from the QuickBooks P&L) landed on
  // fields by the driver that causes the cost:
  //   acres     — general farm overhead (office, mgmt, insurance, utilities)
  //   passAcres — machinery ownership (depreciation, equipment interest, shop)
  //   irrAcres  — irrigation (power, pivot repairs, water)
  //   orgAcres  — organic-only overhead (certification, record keeping)
  // Rates are farm-wide ($ per driver unit) and are computed once per request
  // by computeOverheadRates, then passed in as refs.overheadRates. When no
  // pool carries dollars the flat laborOverhead rate is used unchanged.
  var OVERHEAD_DRIVERS = {
    acres:     { label: 'Crop acres',      unit: 'ac' },
    passAcres: { label: 'Pass-acres',      unit: 'pass-ac' },
    irrAcres:  { label: 'Irrigated acres', unit: 'irr ac' },
    orgAcres:  { label: 'Organic acres',   unit: 'org ac' }
  };

  function cropTypeMultiplierFor(field, acres) {
    if ((field.cropType || '').toUpperCase().indexOf('DBL') >= 0) return 0.5;
    if (field.dblSharedAcres > 0 && acres > 0) {
      var sharedAc = Math.min(field.dblSharedAcres, acres);
      return round4((acres - 0.5 * sharedAc) / acres);
    }
    return 1;
  }

  // Driver units one field contributes. Acre-based drivers honour the
  // double-crop ground-sharing rule (second crop pays half); pass-acres do
  // not, because every pass is a real trip across the field.
  function fieldDriverUnits(field) {
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    var mult = cropTypeMultiplierFor(field, acres);
    var code = (field.systemCode || '').toUpperCase();
    var passes = 0;
    (field.machinery || []).forEach(function (m) {
      if (m.passStatus !== 'disregarded') passes += (m.passes || 1);
    });
    return {
      acres: acres * mult,
      passAcres: passes * acres,
      irrAcres: code.indexOf('IRR') >= 0 ? acres * mult : 0,
      orgAcres: code.indexOf('ORG') >= 0 ? acres * mult : 0
    };
  }

  function computeOverheadRates(fields, pools) {
    var totals = { acres: 0, passAcres: 0, irrAcres: 0, orgAcres: 0 };
    (fields || []).forEach(function (f) {
      var u = fieldDriverUnits(f);
      totals.acres += u.acres;
      totals.passAcres += u.passAcres;
      totals.irrAcres += u.irrAcres;
      totals.orgAcres += u.orgAcres;
    });
    var rated = (pools || []).filter(function (p) {
      return (p.annualDollars || 0) > 0 && OVERHEAD_DRIVERS[p.driver];
    }).map(function (p) {
      var denom = totals[p.driver] || 0;
      return {
        id: p.id, name: p.name, driver: p.driver,
        annualDollars: p.annualDollars,
        driverTotal: round2(denom),
        ratePerUnit: denom > 0 ? round4(p.annualDollars / denom) : 0
      };
    });
    return { totals: totals, pools: rated, active: rated.length > 0 };
  }

  function resolveOverheadRates(refs) {
    if (refs && refs.overheadRates) return refs.overheadRates;
    if (typeof window !== 'undefined' && window.refData && window.refData.overheadRates) {
      return window.refData.overheadRates;
    }
    return null;
  }

  // --- Per-Field Budget Calculation ---
  // field: the field object from data.json
  // refs: { products, implements, cropPricing, laborOverhead, seeds }
  // settings: the global settings object
  function computeFieldBudget(field, refs, settings, options) {
    var result = {};
    // Single acre basis: use plantedAcres when set (for split-field multi-crop farms),
    // otherwise fall back to field.acres. Rent, costs, and per-acre calcs all use the
    // same basis so they are internally consistent. field.acres is preserved as fieldAcres.
    var acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    result.rentAcres = acres;       // rent charged on this crop's acreage
    result.fieldAcres = field.acres || 0; // full parcel size (reference only)
    result.effectiveAcres = acres;
    var opts = options || {};

    // --- CROP TYPE MULTIPLIER / DOUBLE-CROP GROUND SHARING ---
    // DBL CROP marks the SECOND crop riding on a base crop's ground: it pays 0.5×
    // rent and overhead on all its acres. The base crop carries dblSharedAcres
    // (maintained server-side from DBL entries paired via dblPartnerFieldId): it
    // pays full rate on exclusive acres and 0.5× on shared acres, i.e. a weighted
    // multiplier of (acres − 0.5×shared) / acres. Ground with one crop pays full.
    var cropTypeMultiplier = 1;
    result.dblSharedAcres = 0;
    if ((field.cropType || '').toUpperCase().indexOf('DBL') >= 0) {
      cropTypeMultiplier = 0.5;
    } else if (field.dblSharedAcres > 0 && acres > 0) {
      var sharedAc = Math.min(field.dblSharedAcres, acres);
      cropTypeMultiplier = round4((acres - 0.5 * sharedAc) / acres);
      result.dblSharedAcres = sharedAc;
    }
    result.cropType = field.cropType || 'SINGLE CROP';
    result.cropTypeMultiplier = cropTypeMultiplier;

    // --- RENT (charged on this crop's acres — prorated for split-field setups) ---
    result.rentPerAcre = round2((field.rentPerAcre || 0) * cropTypeMultiplier);
    result.rentTotal = round2(result.rentPerAcre * acres);
    result.rentPerCropAcre = result.rentPerAcre;

    // --- FERTILIZER / CHEMICAL INPUTS ---
    var springFert = 0;
    var fallFert = 0;
    var unassignedFert = 0;
    result.inputDetails = (field.inputs || []).map(function (inp) {
      var product = findByName(refs.products, inp.productName);
      var appPrice = product ? computeApplicationPrice(product) : 0;
      var isDisregarded = inp.passStatus === 'disregarded';
      var effectiveQty, costPerAcre;
      if (isDisregarded) {
        effectiveQty = 0;
        costPerAcre = 0;
      } else if (inp.passStatus === 'confirmed' && inp.invoiceCostTotal != null) {
        costPerAcre = acres > 0 ? inp.invoiceCostTotal / acres : 0;
        effectiveQty = inp.actualQuantity || inp.quantity || 0;
      } else {
        effectiveQty = (inp.passStatus === 'confirmed' && inp.actualQuantity != null) ? inp.actualQuantity : (inp.quantity || 0);
        costPerAcre = effectiveQty * appPrice;
      }
      if (!isDisregarded) {
        if ((inp.season || '').toLowerCase() === 'spring') springFert += costPerAcre;
        else if ((inp.season || '').toLowerCase() === 'fall') fallFert += costPerAcre;
        else unassignedFert += costPerAcre;
      }
      return {
        productName: inp.productName,
        quantity: inp.quantity || 0,
        actualQuantity: inp.actualQuantity || null,
        effectiveQuantity: effectiveQty,
        unit: product ? product.unit : '',
        applicationPrice: round4(appPrice),
        costPerAcre: round2(costPerAcre),
        totalCost: round2(costPerAcre * acres),
        season: inp.season || '',
        passStatus: inp.passStatus || 'planned'
      };
    });
    result.springFertPerAcre = round2(springFert);
    result.springFertTotal = round2(springFert * acres);
    result.fallFertPerAcre = round2(fallFert);
    result.fallFertTotal = round2(fallFert * acres);
    result.unassignedFertPerAcre = round2(unassignedFert);
    result.unassignedFertTotal = round2(unassignedFert * acres);
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
      var mIsDisregarded = m.passStatus === 'disregarded';
      if (!mIsDisregarded) {
        machCostPerAcre += cost;
        fuelGallonsPerAcre += fuel;
        // Accumulate labor hours in same pass (was a separate loop before)
        if (impl && impl.laborHoursPerAcre > 0) {
          laborHours += impl.laborHoursPerAcre * passes;
        }
      }
      return {
        implementName: m.implementName,
        costPerAcre: round2(mIsDisregarded ? 0 : cost),
        fuelGalPerAcre: round2(mIsDisregarded ? 0 : fuel),
        passes: passes,
        isHire: !!useHire,
        passStatus: m.passStatus || 'planned'
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
    var ohRates = resolveOverheadRates(refs);
    var usePools = !!(ohRates && ohRates.active && settings.useOverheadPools !== false);
    var rawOverheadPerAcre;
    result.overheadPools = [];
    if (usePools) {
      var units = fieldDriverUnits(field);
      var ohDollars = 0;
      ohRates.pools.forEach(function (p) {
        var d = p.ratePerUnit * (units[p.driver] || 0);
        ohDollars += d;
        result.overheadPools.push({
          id: p.id, name: p.name, driver: p.driver,
          perAcre: acres > 0 ? round2(d / acres) : 0
        });
      });
      rawOverheadPerAcre = acres > 0 ? ohDollars / acres : 0;
      result.overheadSource = 'pools';
    } else {
      rawOverheadPerAcre = (lo ? lo.overheadPerAcre : 0) * cropTypeMultiplier;
      result.overheadSource = 'flat';
    }
    result.overheadPerAcre = round2(rawOverheadPerAcre);
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
    // Moisture-based drying: if field has harvestMoisture and buyer has discount schedule, use tiered calc.
    // Full economic hit per gross bushel = price discount + shrink cost:
    //   total = P − (1−s)(P−d) = d + s(P−d)
    // where d = tiered $/bu price discount, s = buyer shrink %/pt × points over
    // threshold (payable-bushel reduction), P = crop price $/bu. With P unknown
    // (0), degrades to the price-discount-only behavior.
    result.harvestMoisture = field.harvestMoisture || 0;
    var rawDryingPerAcre;
    if (field.harvestMoisture > 0 && buyer && buyer.discountSchedule && buyer.discountSchedule.length > 0) {
      var moistureDiscount = computeMoistureDiscount(field.harvestMoisture, buyer.discountSchedule, buyer.threshold || 15);
      var pointsOver = Math.max(0, field.harvestMoisture - (buyer.threshold || 15));
      var shrinkFrac = Math.min(1, ((buyer.shrink || 0) / 100) * pointsOver);
      var cropPrice = pricing ? (pricing.pricePerUnit || 0) : 0;
      var totalHitPerBu = moistureDiscount + shrinkFrac * Math.max(0, cropPrice - moistureDiscount);
      rawDryingPerAcre = result.yieldPerAcre * totalHitPerBu;
      result.dryingMethod = 'moisture';
      result.moistureShrinkFrac = round4(shrinkFrac);
      result.moistureHitPerBu = round4(totalHitPerBu);
    } else {
      rawDryingPerAcre = result.yieldPerAcre * dryingRate;
      result.dryingMethod = 'flat';
    }
    result.dryingPerAcre = round2(rawDryingPerAcre);
    result.dryingTotal = round2(rawDryingPerAcre * acres);

    // --- INTEREST ---
    // Configurable carry period: carryMonths / 12 replaces the old hardcoded 0.6 (≈7.2 months/12)
    var interestRate = settings.interestRate != null ? settings.interestRate : (pricing ? pricing.interestRate : 0.06);
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
    result.priceSource = (pricing && pricing.priceSource) || 'reference';
    result.referencePricePerUnit = pricing && pricing.referencePrice != null ? pricing.referencePrice : pricePerUnit;
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
    result.profitPerAcre = acres > 0 ? round2((result.cropIncomeTotal - result.expTotal) / acres) : 0;
    result.profitFarmWithoutPayments = round2(
      result.cropIncomeTotal - result.expTotal
    );
    result.profitFarmWithPayments = round2(
      result.cropIncomeTotal + result.insuranceIncomeTotal + result.totalGovPayments - result.expTotal
    );

    // --- COP (Cost of Production per unit) ---
    result.cop = result.totalYield > 0 ? round2(result.expTotal / result.totalYield) : 0;
    // Operating COP: everything except the overhead pools (Layer A + B).
    // Marketing reads both — cover operating first, then the farm.
    result.opExpTotal = round2(result.expTotal - result.overheadTotal);
    result.opExpPerAcre = acres > 0 ? round2(result.opExpTotal / acres) : 0;
    result.opCop = result.totalYield > 0 ? round2(result.opExpTotal / result.totalYield) : 0;

    return result;
  }

  // --- Enterprise Summary ---
  function computeEnterpriseSummary(fields, refs, settings, options) {
    var totals = {
      acres: 0, rent: 0, springFert: 0, fallFert: 0, unassignedFert: 0, fert: 0, seed: 0, machinery: 0,
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
      totals.unassignedFert += b.unassignedFertTotal;
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
      var sumCropProfit = 0;
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
        sumCropProfit += (b.cropIncomeTotal - b.expTotal);
        sumMachTimesAcres += b.machineryPerAcre * a;
        totalProjected += b.totalYield;
        totalExpense += b.expTotal;
        totalYield += b.totalYield;
        totalCount++;
        if (b.yieldSource === 'actual') actualCount++;
      });

      var avgYield = totalAcres > 0 ? round2(sumYieldTimesAcres / totalAcres) : 0;
      var avgProfit = totalAcres > 0 ? round2(sumCropProfit / totalAcres) : 0;
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

  // --- Resolve enterprise for a field ---
  // Uses field.enterpriseId as the canonical assignment.
  function resolveEnterpriseId(field, cropTypes, enterprises) {
    return field.enterpriseId || null;
  }

  // --- Full Dashboard ---
  function computeDashboard(allFields, enterprises, refs, settings, options) {
    var result = { conventional: [], organic: [], enterpriseSummaries: [] };
    result.yieldMode = (options && options.yieldMode) || 'projected';
    var cropTypes = (refs && refs.cropTypes) || [];

    enterprises.forEach(function (ent) {
      var entFields = allFields.filter(function (f) {
        return resolveEnterpriseId(f, cropTypes, enterprises) === ent.id;
      });
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
  exports.resolveEnterpriseId = resolveEnterpriseId;
  exports.computeFieldBudget = computeFieldBudget;
  exports.computeOverheadRates = computeOverheadRates;
  exports.fieldDriverUnits = fieldDriverUnits;
  exports.OVERHEAD_DRIVERS = OVERHEAD_DRIVERS;
  exports.computeEnterpriseSummary = computeEnterpriseSummary;
  exports.computeDashboardByCrop = computeDashboardByCrop;
  exports.computeDashboard = computeDashboard;
  exports.computeApplicationPrice = computeApplicationPrice;
  exports.invoiceRatePerAcre = invoiceRatePerAcre;
  exports.computeMoistureDiscount = computeMoistureDiscount;
  exports.clearCropPricingCache = clearCropPricingCache;
  exports.explainCropPrice = explainCropPrice;
  exports.marketingEntryFor = marketingEntryFor;
  exports.round2 = round2;
  exports.round4 = round4;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.Calc = {}));
