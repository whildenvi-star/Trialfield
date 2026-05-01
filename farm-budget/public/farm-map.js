// Farm Map — Leaflet + shapefile upload + field linking
(function () {
  'use strict';

  var map = null;
  var geoLayer = null;
  var farmGeoJSON = null;
  var fieldsData = [];
  var linkingFeature = null;
  var colorMode = 'enterprise';
  // Budget cache: avoids recomputing per-feature on every map render
  var _budgetCache = {};

  // Enterprise colors
  var entColors = ['#4af626', '#ff9500', '#4a9eff', '#ffb800', '#b388ff', '#ff3b30', '#64ffda'];
  var cropColors = {};
  var cropColorPalette = ['#4af626', '#4a9eff', '#ffb800', '#b388ff', '#ff3b30',
    '#64ffda', '#8d6e63', '#66bb6a', '#ff80ab', '#78909c'];

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'map') {
      initMap();
      loadMapData();
    }
  });

  function initMap() {
    if (map) return;
    map = L.map('farm-map').setView([41.5, -89.0], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);
    // Fix Leaflet sizing after tab reveal
    setTimeout(function () { map.invalidateSize(); }, 200);
  }

  function loadMapData() {
    // Clear budget cache when fresh data arrives
    _budgetCache = {};
    Promise.all([
      api.get('/api/fields?all=true'),
      api.get('/api/farm-geojson').catch(function () { return null; })
    ]).then(function (results) {
      fieldsData = results[0];
      farmGeoJSON = results[1];
      renderMap();
    });
  }

  function renderMap() {
    if (geoLayer) { map.removeLayer(geoLayer); geoLayer = null; }
    if (!farmGeoJSON || !farmGeoJSON.features || !farmGeoJSON.features.length) {
      document.getElementById('map-legend').innerHTML =
        '<span style="color:var(--text-light)">Upload a shapefile (.zip) to get started.</span>';
      return;
    }

    geoLayer = L.geoJSON(farmGeoJSON, {
      style: styleFeature,
      onEachFeature: onEachFeature
    }).addTo(map);

    map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
    renderLegend();
    renderStats();
  }

  function getLinkedField(feature) {
    if (!feature.properties || !feature.properties.linkedFieldId) return null;
    return fieldsData.find(function (f) { return f.id === feature.properties.linkedFieldId; });
  }

  function styleFeature(feature) {
    var field = getLinkedField(feature);
    var color = '#999';
    var fillOpacity = 0.4;

    if (colorMode === 'enterprise' && field) {
      var entIdx = window.refData.enterprises.findIndex(function (e) { return e.id === field.enterpriseId; });
      color = entColors[entIdx >= 0 ? entIdx : 0] || '#999';
      fillOpacity = 0.5;
    } else if (colorMode === 'profit' && field) {
      // Use cached budget if available; compute only on cache miss.
      // Before: computeFieldBudget called per-feature on every map render (~100 calls).
      // After: computed once per field, cached until map data reloads.
      var budget = _budgetCache[field.id] || Calc.computeFieldBudget(field, {
        products: window.refData.products,
        implements: window.refData.implements,
        cropPricing: window.refData.cropPricing,
        cropTypes: window.refData.cropTypes,
        laborOverhead: window.refData.laborOverhead,
        seeds: window.refData.seeds,
        buyers: window.refData.buyers || []
      }, window.refData.settings);
      _budgetCache[field.id] = budget;
      var profit = budget.profitPerAcre || 0;
      if (profit > 50) color = '#4af626';
      else if (profit > 0) color = '#66bb6a';
      else if (profit > -50) color = '#ffb800';
      else color = '#ff3b30';
      fillOpacity = 0.55;
    } else if (colorMode === 'crop' && field) {
      var crop = field.crop || 'Unknown';
      if (typeof CropColors !== 'undefined') {
        color = CropColors.getCropColor(crop);
      } else {
        if (!cropColors[crop]) {
          var idx = Object.keys(cropColors).length % cropColorPalette.length;
          cropColors[crop] = cropColorPalette[idx];
        }
        color = cropColors[crop];
      }
      fillOpacity = 0.5;
    } else if (colorMode === 'source' && field) {
      color = field._fieldops ? '#4a9eff' : '#4af626';
      fillOpacity = 0.5;
    }

    return {
      color: field ? color : '#888',
      weight: field ? 2 : 1,
      fillColor: color,
      fillOpacity: fillOpacity,
      dashArray: field ? '' : '4 4'
    };
  }

  function onEachFeature(feature, layer) {
    layer.on('click', function () {
      var field = getLinkedField(feature);
      if (field) {
        showLinkedPopup(layer, field);
      } else {
        showLinkPanel(feature);
      }
    });
  }

  function showLinkedPopup(layer, field) {
    var budget = Calc.computeFieldBudget(field, {
      products: window.refData.products,
      implements: window.refData.implements,
      cropPricing: window.refData.cropPricing,
      cropTypes: window.refData.cropTypes,
      laborOverhead: window.refData.laborOverhead,
      seeds: window.refData.seeds,
      buyers: window.refData.buyers || []
    }, window.refData.settings);

    var profitCls = budget.profitPerAcre >= 0 ? 'profit-pos' : 'profit-neg';
    var _showMapFinancials = window.APP_ROLE !== 'office' && window.APP_ROLE !== 'operator';
    var html = '<div class="map-popup">' +
      '<strong>' + util.escHtml(field.name) + '</strong><br>' +
      '<span style="background:var(--green);color:#fff;padding:1px 6px;border-radius:3px;font-size:0.7rem">' + util.escHtml(field.crop) + '</span><br>' +
      '<table style="font-size:0.75rem;margin-top:4px;width:100%">' +
      '<tr><td>Acres</td><td style="text-align:right">' + util.formatNum(field.acres, 1) + '</td></tr>' +
      (_showMapFinancials ? '<tr><td>Exp/AC</td><td style="text-align:right">' + util.formatMoney(budget.expPerAcre) + '</td></tr>' : '') +
      (_showMapFinancials ? '<tr><td>Profit/AC</td><td style="text-align:right;font-weight:600" class="' + profitCls + '">' + util.formatMoney(budget.profitPerAcre) + '</td></tr>' : '') +
      (_showMapFinancials ? '<tr><td>COP</td><td style="text-align:right">' + util.formatMoney(budget.cop) + '</td></tr>' : '') +
      '</table>' +
      '</div>';

    layer.bindPopup(html, { maxWidth: 220 }).openPopup();
  }

  function showLinkPanel(feature) {
    linkingFeature = feature;
    var panel = document.getElementById('map-link-panel');
    panel.classList.remove('hidden');

    var featureName = feature.properties.NAME || feature.properties.name ||
      feature.properties.FIELD_NAME || feature.properties.OBJECTID || 'Unnamed Feature';
    document.getElementById('map-link-feature-name').textContent = 'Feature: ' + featureName;

    // Find already-linked field IDs
    var linkedIds = {};
    (farmGeoJSON.features || []).forEach(function (f) {
      if (f.properties && f.properties.linkedFieldId) {
        linkedIds[f.properties.linkedFieldId] = true;
      }
    });

    var select = document.getElementById('map-link-field-select');
    select.innerHTML = '<option value="">-- Select Field --</option>';
    fieldsData.forEach(function (f) {
      if (!linkedIds[f.id]) {
        var ent = window.refData.enterprises.find(function (e) { return e.id === f.enterpriseId; });
        var entName = ent ? ent.shortName : '';
        select.innerHTML += '<option value="' + f.id + '">' +
          util.escHtml(f.name) + ' (' + entName + ', ' + util.formatNum(f.acres, 0) + ' ac)</option>';
      }
    });
  }

  document.getElementById('map-link-save').addEventListener('click', function () {
    if (!linkingFeature) return;
    var fieldId = document.getElementById('map-link-field-select').value;
    if (!fieldId) { util.showToast('Select a field first', 2000, 'error'); return; }

    linkingFeature.properties = linkingFeature.properties || {};
    linkingFeature.properties.linkedFieldId = fieldId;

    api.put('/api/farm-geojson', farmGeoJSON).then(function () {
      util.showToast('Field linked to map feature');
      document.getElementById('map-link-panel').classList.add('hidden');
      linkingFeature = null;
      renderMap();
    });
  });

  document.getElementById('map-link-cancel').addEventListener('click', function () {
    document.getElementById('map-link-panel').classList.add('hidden');
    linkingFeature = null;
  });

  // Color mode
  document.getElementById('map-color-by').addEventListener('change', function () {
    // Guard: office role may not use profit coloring
    if (this.value === 'profit' && (window.APP_ROLE === 'office' || window.APP_ROLE === 'operator')) {
      this.value = colorMode; // revert selection
      return;
    }
    colorMode = this.value;
    cropColors = {};
    renderMap();
  });

  // Shapefile upload
  document.getElementById('map-shp-upload').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;

    util.showToast('Parsing shapefile...', 5000, 'info');

    var reader = new FileReader();
    reader.onload = function (evt) {
      shp(evt.target.result).then(function (geojson) {
        // Normalize to FeatureCollection
        if (geojson.type === 'FeatureCollection') {
          farmGeoJSON = geojson;
        } else if (Array.isArray(geojson)) {
          farmGeoJSON = {
            type: 'FeatureCollection',
            features: geojson.reduce(function (acc, fc) {
              return acc.concat(fc.features || []);
            }, [])
          };
        } else {
          farmGeoJSON = { type: 'FeatureCollection', features: [geojson] };
        }

        api.put('/api/farm-geojson', farmGeoJSON).then(function () {
          util.showToast('Shapefile loaded: ' + farmGeoJSON.features.length + ' features');
          renderMap();
        });
      }).catch(function (err) {
        util.showToast('Error parsing shapefile: ' + err.message, 5000, 'error');
        console.error('Shapefile parse error:', err);
      });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  });

  // Stats bar
  function renderStats() {
    var el = document.getElementById('map-stats');
    if (!el) return;
    var features = farmGeoJSON && farmGeoJSON.features ? farmGeoJSON.features.length : 0;
    var linked = 0;
    var linkedAcres = 0;
    if (farmGeoJSON && farmGeoJSON.features) {
      farmGeoJSON.features.forEach(function (f) {
        var field = getLinkedField(f);
        if (field) { linked++; linkedAcres += field.acres || 0; }
      });
    }
    var totalAcres = fieldsData.reduce(function (s, f) { return s + (f.acres || 0); }, 0);
    el.innerHTML =
      '<span>' + features + ' features</span>' +
      '<span>' + linked + '/' + features + ' linked</span>' +
      '<span>' + util.formatNum(linkedAcres, 0) + ' / ' + util.formatNum(totalAcres, 0) + ' acres mapped</span>' +
      '<span>' + fieldsData.length + ' fields total</span>';
  }

  // Legend
  function renderLegend() {
    var legend = document.getElementById('map-legend');
    var html = '';

    if (colorMode === 'enterprise') {
      window.refData.enterprises.forEach(function (ent, idx) {
        html += '<span class="map-legend-item">' +
          '<span class="map-legend-swatch" style="background:' + entColors[idx] + '"></span>' +
          util.escHtml(ent.shortName) + '</span>';
      });
      html += '<span class="map-legend-item"><span class="map-legend-swatch" style="background:#999;border-style:dashed"></span>Unlinked</span>';
    } else if (colorMode === 'profit') {
      [
        { color: '#4af626', label: '> $50/ac' },
        { color: '#66bb6a', label: '$0-50/ac' },
        { color: '#ffb800', label: '$0 to -$50/ac' },
        { color: '#ff3b30', label: '< -$50/ac' }
      ].forEach(function (r) {
        html += '<span class="map-legend-item"><span class="map-legend-swatch" style="background:' + r.color + '"></span>' + r.label + '</span>';
      });
    } else if (colorMode === 'crop') {
      Object.keys(cropColors).forEach(function (crop) {
        html += '<span class="map-legend-item"><span class="map-legend-swatch" style="background:' + cropColors[crop] + '"></span>' + util.escHtml(crop) + '</span>';
      });
    } else if (colorMode === 'source') {
      [
        { color: '#4a9eff', label: 'FieldOps Synced' },
        { color: '#4af626', label: 'Manual Entry' }
      ].forEach(function (r) {
        html += '<span class="map-legend-item"><span class="map-legend-swatch" style="background:' + r.color + '"></span>' + r.label + '</span>';
      });
    }

    legend.innerHTML = html;
  }
})();
