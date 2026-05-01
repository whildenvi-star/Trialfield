'use strict';

var client = require('./client');

function normalizeFieldName(name) {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchField(foField, storeFields) {
  var foName = normalizeFieldName(foField.name);
  return storeFields.find(function (f) {
    return normalizeFieldName(f.name) === foName;
  });
}

function matchImplement(foEquip, storeImplements) {
  var foName = normalizeFieldName(foEquip.name);
  return storeImplements.find(function (i) {
    return normalizeFieldName(i.name) === foName;
  });
}

function updateFarmGeoJSON(store, fieldId, boundary) {
  if (!store.farmGeoJSON) {
    store.farmGeoJSON = { type: 'FeatureCollection', features: [] };
  }
  var existingIdx = store.farmGeoJSON.features.findIndex(function (f) {
    return f.properties && f.properties.linkedFieldId === fieldId;
  });
  var feature = {
    type: 'Feature',
    geometry: boundary.geometry,
    properties: Object.assign({}, boundary.properties || {}, {
      linkedFieldId: fieldId,
      source: 'fieldops'
    })
  };
  if (existingIdx >= 0) {
    store.farmGeoJSON.features[existingIdx] = feature;
  } else {
    store.farmGeoJSON.features.push(feature);
  }
}

async function runSync(store, generateId, saveData) {
  var result = {
    date: new Date().toISOString(),
    status: 'success',
    fieldsMatched: 0,
    fieldsCreated: 0,
    boundariesUpdated: 0,
    equipmentSynced: 0,
    yieldUpdated: 0,
    applicationsImported: 0,
    telemetryUpdated: 0,
    errors: []
  };

  // Initialize sync metadata if needed
  if (!store.fieldopsSync) {
    store.fieldopsSync = {
      lastSync: null,
      lastStatus: null,
      lastError: null,
      history: [],
      fieldMapping: {}
    };
  }

  try {
    // --- 1. SYNC FIELDS & BOUNDARIES + 2. SYNC EQUIPMENT (fetched in parallel) ---
    // perf: parallel fetch — fields and equipment are independent
    var [foFields, foEquipment] = await Promise.all([client.getFields(), client.getEquipment()]);
    for (var fi = 0; fi < foFields.length; fi++) {
      var foField = foFields[fi];
      var match = matchField(foField, store.fields);

      if (match) {
        result.fieldsMatched++;
        store.fieldopsSync.fieldMapping[foField.id] = match.id;

        // Enrich with metadata — never overwrite budget data
        match._fieldops = match._fieldops || {};
        match._fieldops.externalId = foField.id;
        match._fieldops.lastSync = result.date;
        match._fieldops.farmName = foField.farmName;
        match._fieldops.reportedAcres = foField.area ? foField.area.value : null;

        // Populate geometry if field has none yet
        if (foField.boundary && foField.boundary.geometry && !match.geometry) {
          match.geometry = foField.boundary.geometry;
          result.boundariesUpdated++;
        }

        // Update farmGeoJSON
        if (foField.boundary) {
          updateFarmGeoJSON(store, match.id, foField.boundary);
        }
      } else {
        // Create new unassigned field
        result.fieldsCreated++;
        var newField = {
          id: generateId('fld'),
          enterpriseId: '',
          name: foField.name,
          systemCode: '',
          crop: '',
          cropType: 'SINGLE CROP',
          acres: foField.area ? foField.area.value : 0,
          rentPerAcre: 0,
          inputs: [],
          seed: null,
          machinery: [],
          yieldPerAcre: 0,
          yieldUnit: 'Bu',
          cropInsurancePerAcre: 0,
          insuranceIncomePerAcre: 0,
          govPaymentLabel: '',
          govPaymentsPerAcre: 0,
          tariffsPerAcre: 0,
          harvestMoisture: 0,
          buyerId: '',
          geometry: foField.boundary ? foField.boundary.geometry : null,
          _fieldops: {
            source: 'fieldops',
            externalId: foField.id,
            lastSync: result.date,
            farmName: foField.farmName,
            reportedAcres: foField.area ? foField.area.value : null
          }
        };
        store.fields.push(newField);
        store.fieldopsSync.fieldMapping[foField.id] = newField.id;

        if (foField.boundary) {
          updateFarmGeoJSON(store, newField.id, foField.boundary);
        }
      }
    }

    // --- 2. PROCESS EQUIPMENT (already fetched above) ---
    for (var ei = 0; ei < foEquipment.length; ei++) {
      var foEquip = foEquipment[ei];
      var implMatch = matchImplement(foEquip, store.implements);

      if (implMatch) {
        implMatch._fieldops = implMatch._fieldops || {};
        implMatch._fieldops.externalId = foEquip.id;
        implMatch._fieldops.make = foEquip.make;
        implMatch._fieldops.model = foEquip.model;
        implMatch._fieldops.type = foEquip.type;
        implMatch._fieldops.serialNumber = foEquip.serialNumber;
        if (foEquip.telemetry) {
          implMatch._fieldops.totalEngineHours = foEquip.telemetry.totalEngineHours;
          implMatch._fieldops.fuelUsedGallons = foEquip.telemetry.fuelUsedGallons;
          implMatch._fieldops.lastLocation = foEquip.telemetry.lastReportedLocation;
        }
        implMatch._fieldops.lastSync = result.date;
        result.equipmentSynced++;
      }
      // Do NOT auto-create implements — they need costPerAcre which FieldOps doesn't provide
    }

    // --- 3/4/5. SYNC YIELD, APPLICATIONS, TELEMETRY (fetched in parallel) ---
    var yieldSeason = String((store.settings.year || 2026) - 1);
    var currentSeason = String(store.settings.year || 2026);

    // perf: parallel fetch — yield, applications, telemetry are independent after field mapping
    var [foYield, foApps, foTelemetry] = await Promise.all([
      client.getYieldData({ season: yieldSeason }),
      client.getApplications({ season: currentSeason }),
      client.getTelemetry({ season: currentSeason })
    ]);

    // --- 3. PROCESS YIELD DATA ---
    for (var yi = 0; yi < foYield.length; yi++) {
      var yieldEntry = foYield[yi];
      var yieldFieldId = store.fieldopsSync.fieldMapping[yieldEntry.fieldId];
      var yieldField = yieldFieldId
        ? store.fields.find(function (f) { return f.id === yieldFieldId; })
        : null;

      if (!yieldField) {
        yieldField = matchField({ name: yieldEntry.fieldName }, store.fields);
      }

      if (yieldField) {
        yieldField._fieldops = yieldField._fieldops || {};
        yieldField._fieldops.yieldHistory = yieldField._fieldops.yieldHistory || [];

        // Dedup by season + crop (Set-based for O(1) lookup)
        if (!yieldField._fieldops._yieldKeys) {
          yieldField._fieldops._yieldKeys = new Set(
            yieldField._fieldops.yieldHistory.map(function (y) {
              return y.season + '|' + y.crop;
            })
          );
        }
        var yieldKey = yieldEntry.season + '|' + yieldEntry.crop;

        if (!yieldField._fieldops._yieldKeys.has(yieldKey)) {
          yieldField._fieldops._yieldKeys.add(yieldKey);
          yieldField._fieldops.yieldHistory.push({
            season: yieldEntry.season,
            crop: yieldEntry.crop,
            yieldPerAcre: yieldEntry.yieldPerAcre,
            totalYield: yieldEntry.totalYield,
            moisture: yieldEntry.moisture,
            harvestDate: yieldEntry.harvestDate,
            syncDate: result.date
          });
          // Keep last 5 seasons max per field
          if (yieldField._fieldops.yieldHistory.length > 5) {
            yieldField._fieldops.yieldHistory = yieldField._fieldops.yieldHistory.slice(-5);
          }
        }

        // Populate harvestMoisture if currently zero
        if (!yieldField.harvestMoisture && yieldEntry.moisture) {
          yieldField.harvestMoisture = yieldEntry.moisture;
        }

        result.yieldUpdated++;
      }
    }
    // Clean up transient dedup Sets from yield processing
    store.fields.forEach(function (f) {
      if (f._fieldops && f._fieldops._yieldKeys) {
        delete f._fieldops._yieldKeys;
      }
    });

    // --- 4. PROCESS APPLICATIONS ---
    for (var ai = 0; ai < foApps.length; ai++) {
      var app = foApps[ai];
      var appFieldId = store.fieldopsSync.fieldMapping[app.fieldId];
      var appField = appFieldId
        ? store.fields.find(function (f) { return f.id === appFieldId; })
        : null;

      if (!appField) {
        appField = matchField({ name: app.fieldName }, store.fields);
      }

      if (appField) {
        appField._fieldops = appField._fieldops || {};
        appField._fieldops.applications = appField._fieldops.applications || [];

        // Dedup by external ID (Set-based for O(1) lookup)
        if (!appField._fieldops._appIdSet) {
          appField._fieldops._appIdSet = new Set(
            appField._fieldops.applications.map(function (a) {
              return a.externalId;
            })
          );
        }

        if (!appField._fieldops._appIdSet.has(app.id)) {
          appField._fieldops._appIdSet.add(app.id);
          appField._fieldops.applications.push({
            externalId: app.id,
            date: app.date,
            type: app.type,
            products: app.products,
            area: app.area,
            applicator: app.applicator,
            notes: app.notes,
            syncDate: result.date
          });
          result.applicationsImported++;
        }
      }
    }
    // Clean up transient dedup Sets from application processing
    store.fields.forEach(function (f) {
      if (f._fieldops && f._fieldops._appIdSet) {
        delete f._fieldops._appIdSet;
      }
    });

    // --- 5. PROCESS TELEMETRY ---
    for (var ti = 0; ti < foTelemetry.length; ti++) {
      var tel = foTelemetry[ti];
      // Find the equipment in implements
      var telImpl = store.implements.find(function (i) {
        return i._fieldops && i._fieldops.externalId === tel.equipmentId;
      });
      if (telImpl) {
        telImpl._fieldops.telemetryLog = telImpl._fieldops.telemetryLog || [];

        // Dedup by date + fieldId (Set-based for O(1) lookup)
        if (!telImpl._fieldops._telKeys) {
          telImpl._fieldops._telKeys = new Set(
            telImpl._fieldops.telemetryLog.map(function (t) {
              return t.date + '|' + t.fieldId;
            })
          );
        }
        var telKey = tel.date + '|' + tel.fieldId;

        if (!telImpl._fieldops._telKeys.has(telKey)) {
          telImpl._fieldops._telKeys.add(telKey);
          telImpl._fieldops.telemetryLog.push({
            fieldId: tel.fieldId,
            date: tel.date,
            operationType: tel.operationType,
            fuelUsed: tel.fuelUsed,
            hoursOperated: tel.hoursOperated,
            areaWorked: tel.areaWorked,
            syncDate: result.date
          });
          // Cap at 100 entries
          if (telImpl._fieldops.telemetryLog.length > 100) {
            telImpl._fieldops.telemetryLog = telImpl._fieldops.telemetryLog.slice(-100);
          }
          result.telemetryUpdated++;
        }
      }
    }
    // Clean up transient dedup Sets from telemetry processing
    store.implements.forEach(function (i) {
      if (i._fieldops && i._fieldops._telKeys) {
        delete i._fieldops._telKeys;
      }
    });

  } catch (err) {
    result.status = 'error';
    result.errors.push(err.message);
    console.error('[FieldOps Sync] Error:', err);
  }

  // Update sync metadata
  store.fieldopsSync.lastSync = result.date;
  store.fieldopsSync.lastStatus = result.status;
  store.fieldopsSync.lastError = result.errors.length > 0 ? result.errors.join('; ') : null;
  store.fieldopsSync.history.unshift(result);
  if (store.fieldopsSync.history.length > 50) {
    store.fieldopsSync.history = store.fieldopsSync.history.slice(0, 50);
  }

  await saveData();
  console.log('[FieldOps Sync] Complete:', result.status,
    '| Fields matched:', result.fieldsMatched,
    '| Created:', result.fieldsCreated,
    '| Boundaries:', result.boundariesUpdated,
    '| Equipment:', result.equipmentSynced,
    '| Yield:', result.yieldUpdated,
    '| Applications:', result.applicationsImported);

  return result;
}

module.exports = { runSync: runSync };
