// Seeds Manager — Seed Command Center
// Variety catalog (CRUD) + Season Demand panel with stat cards + enterprise/variety toggle
(function () {
  'use strict';

  var allSeeds = [];
  var allSeedFields = [];
  var loaded = false;
  var demandView = 'variety'; // 'variety' | 'enterprise'
  var lastForecast = null;

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'seeds') loadSeeds();
  });

  // ── Load ────────────────────────────────────────────────────────────────────

  function loadSeeds() {
    Promise.all([
      api.get('/api/seeds'),
      api.get('/api/fields?all=true'),
      api.get('/api/forecast').catch(function () { return null; })
    ]).then(function (results) {
      allSeeds = results[0];
      allSeedFields = results[1];
      lastForecast = results[2];
      renderTable(allSeeds);
      renderCommandCenter(lastForecast);
      loaded = true;
    });
  }

  // ── Catalog search ───────────────────────────────────────────────────────────

  document.getElementById('seed-search').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var filtered = allSeeds.filter(function (s) {
      return (s.crop || '').toLowerCase().includes(q) ||
             (s.brand || '').toLowerCase().includes(q) ||
             (s.variety || '').toLowerCase().includes(q);
    });
    renderTable(filtered);
  });

  // ── Catalog add ──────────────────────────────────────────────────────────────

  document.getElementById('seed-add').addEventListener('click', function () {
    api.post('/api/seeds', {
      crop: '',
      brand: '',
      variety: 'New Variety',
      pricePerUnit: 0,
      seedsPerUnit: 80000
    }).then(function () {
      loaded = false;
      loadSeeds();
      util.showToast('Seed added');
    });
  });

  // ── Catalog toggle (collapsible) ─────────────────────────────────────────────

  document.getElementById('seed-catalog-toggle').addEventListener('click', function () {
    var body = document.getElementById('seed-catalog-body');
    var toggle = document.getElementById('seed-catalog-toggle');
    var open = body.classList.contains('open');
    body.classList.toggle('open', !open);
    toggle.classList.toggle('open', !open);
  });

  // ── Demand search (delegated — rendered inside demand container) ──────────────

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'scc-demand-search') {
      filterDemandRows(e.target.value.trim().toLowerCase());
    }
  });

  function filterDemandRows(q) {
    var container = document.getElementById('seed-demand-container');
    if (!container) return;
    container.querySelectorAll('.sd-variety-block').forEach(function (block) {
      var variety = (block.getAttribute('data-variety') || '').toLowerCase();
      var crop = (block.getAttribute('data-crop') || '').toLowerCase();
      block.style.display = (!q || variety.includes(q) || crop.includes(q)) ? '' : 'none';
    });
    // In enterprise view, also check enterprise group visibility
    container.querySelectorAll('.scc-ent-group').forEach(function (grp) {
      // Show group header if any visible blocks follow it
      var next = grp.nextElementSibling;
      var anyVisible = false;
      while (next && !next.classList.contains('scc-ent-group')) {
        if (next.style.display !== 'none') { anyVisible = true; break; }
        next = next.nextElementSibling;
      }
      grp.style.display = anyVisible ? '' : 'none';
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function classify(p) {
    var billed = p.billedQty != null ? p.billedQty : p.totalQty;
    if ((p.orderedQty || 0) < billed) return 0;  // unmet / at-risk
    if ((p.deliveredQty || 0) < billed) return 1; // in transit (ordered, not delivered)
    return 2; // covered / on farm
  }

  function getSupplierName(id) {
    if (!id) return '--';
    var suppliers = window.refData.suppliers || [];
    var sup = suppliers.find(function (s) { return s.id === id; });
    return sup ? sup.name : '--';
  }

  // ── Command Center render ────────────────────────────────────────────────────

  function renderCommandCenter(forecastData) {
    // Extract seed products
    var seedProducts = [];
    if (forecastData && forecastData.categories) {
      forecastData.categories.forEach(function (cat) {
        (cat.products || []).forEach(function (p) {
          if (p.isSeedVariety) seedProducts.push(p);
        });
      });
    }

    renderStatCards(seedProducts);
    renderHeaderControls(seedProducts);
    renderDemandPanel(seedProducts);
  }

  // ── Stat cards ───────────────────────────────────────────────────────────────

  function renderStatCards(seedProducts) {
    var container = document.getElementById('seed-stat-cards');
    if (!container) return;

    if (seedProducts.length === 0) {
      container.innerHTML = '';
      return;
    }

    var atRisk = 0, inTransit = 0, covered = 0, totalCost = 0;
    seedProducts.forEach(function (p) {
      var level = classify(p);
      if (level === 0) atRisk++;
      else if (level === 1) inTransit++;
      else covered++;
      totalCost += (p.totalCost || 0);
    });

    var html = '<div class="scc-stat-grid">';

    html += '<div class="scc-stat-card risk' + (atRisk > 0 ? ' has-risk' : '') + '">' +
      '<div class="scc-stat-label">&#9888; At Risk</div>' +
      '<div class="scc-stat-value">' + atRisk + '</div>' +
      '<div class="scc-stat-sub">' + (atRisk === 0 ? 'all ordered' : 'need orders now') + '</div>' +
      '</div>';

    html += '<div class="scc-stat-card transit">' +
      '<div class="scc-stat-label">&#8599; In Transit</div>' +
      '<div class="scc-stat-value">' + inTransit + '</div>' +
      '<div class="scc-stat-sub">ordered, not on farm</div>' +
      '</div>';

    html += '<div class="scc-stat-card covered">' +
      '<div class="scc-stat-label">&#10003; On Farm</div>' +
      '<div class="scc-stat-value">' + covered + '</div>' +
      '<div class="scc-stat-sub">fully covered</div>' +
      '</div>';

    html += '<div class="scc-stat-card invest">' +
      '<div class="scc-stat-label">$ Investment</div>' +
      '<div class="scc-stat-value">' + util.formatMoney(totalCost) + '</div>' +
      '<div class="scc-stat-sub">total seed budget</div>' +
      '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  // ── Header controls (view toggle + search) ────────────────────────────────────

  function renderHeaderControls(seedProducts) {
    var wrap = document.getElementById('scc-header-right');
    if (!wrap) return;

    var html = '<div class="scc-toggle-group">' +
      '<button class="scc-toggle-btn' + (demandView === 'variety' ? ' active' : '') + '" data-view="variety">By Variety</button>' +
      '<button class="scc-toggle-btn' + (demandView === 'enterprise' ? ' active' : '') + '" data-view="enterprise">By Enterprise</button>' +
      '</div>';

    wrap.innerHTML = html;

    wrap.querySelectorAll('.scc-toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        demandView = btn.getAttribute('data-view');
        renderHeaderControls(seedProducts);
        renderDemandPanel(seedProducts);
      });
    });
  }

  // ── Demand panel ─────────────────────────────────────────────────────────────

  function renderDemandPanel(seedProducts) {
    var container = document.getElementById('seed-demand-container');
    if (!container) return;

    if (seedProducts.length === 0) {
      container.innerHTML = '<div style="color:var(--text-light);font-size:0.82rem;padding:0.75rem 0;font-family:var(--font-mono)">' +
        'No seed demand data — assign seed varieties to fields in the field editor.</div>';
      return;
    }

    // Sort: unmet first, then transit, then covered
    var sorted = seedProducts.slice().sort(function (a, b) { return classify(a) - classify(b); });

    var html = '<div class="scc-demand-controls">' +
      '<span class="scc-demand-label">Season Demand</span>' +
      '<input id="scc-demand-search" class="scc-demand-search" type="text" placeholder="Find variety or crop...">' +
      '<span style="color:var(--text-light);font-size:0.72rem;font-family:var(--font-mono)">' + sorted.length + ' variet' + (sorted.length !== 1 ? 'ies' : 'y') + '</span>' +
      '</div>';

    html += '<div class="scc-demand-wrap">';

    if (demandView === 'enterprise') {
      html += renderEnterpriseView(sorted);
    } else {
      html += renderVarietyView(sorted);
    }

    html += '</div>';
    container.innerHTML = html;

    // Wire up expand/collapse on all main rows
    container.querySelectorAll('.sd-card-main[data-bd]').forEach(function (row) {
      row.addEventListener('click', function () {
        var bdId = row.getAttribute('data-bd');
        var bd = document.getElementById(bdId);
        var caret = row.querySelector('.sd-caret');
        if (!bd) return;
        var open = bd.style.display !== 'none';
        bd.style.display = open ? 'none' : '';
        if (caret) caret.classList.toggle('open', !open);
      });
    });
  }

  // ── Variety view ─────────────────────────────────────────────────────────────

  function renderVarietyView(sorted) {
    var html = renderColHeader();

    sorted.forEach(function (p, idx) {
      html += renderVarietyCard(p, 'v' + idx);
    });

    return html;
  }

  // ── Enterprise view ───────────────────────────────────────────────────────────

  function renderEnterpriseView(sorted) {
    // Build field name → enterprise name map
    var fieldToEnt = {};
    var enterprises = (window.refData && window.refData.enterprises) || [];
    allSeedFields.forEach(function (f) {
      if (!f.enterpriseId) return;
      var ent = enterprises.find(function (e) { return e.id === f.enterpriseId; });
      fieldToEnt[f.name] = ent ? (ent.shortName || ent.name) : 'Other';
    });

    // Group: enterpriseName → [{product, fields}]
    var entMap = {};
    var entOrder = [];
    sorted.forEach(function (p) {
      if (!p.fields || p.fields.length === 0) {
        var key = 'Unassigned';
        if (!entMap[key]) { entMap[key] = []; entOrder.push(key); }
        entMap[key].push({ product: p, fields: p.fields || [] });
        return;
      }

      var fieldsByEnt = {};
      p.fields.forEach(function (f) {
        var entName = fieldToEnt[f.fieldName] || 'Other';
        if (!fieldsByEnt[entName]) fieldsByEnt[entName] = [];
        fieldsByEnt[entName].push(f);
      });

      Object.keys(fieldsByEnt).forEach(function (entName) {
        if (!entMap[entName]) { entMap[entName] = []; entOrder.push(entName); }
        entMap[entName].push({ product: p, fields: fieldsByEnt[entName] });
      });
    });

    // Deduplicate order
    entOrder = entOrder.filter(function (v, i, a) { return a.indexOf(v) === i; });

    var html = '';
    entOrder.forEach(function (entName, eIdx) {
      var items = entMap[entName];
      var totalFields = items.reduce(function (n, item) { return n + item.fields.length; }, 0);

      html += '<div class="scc-ent-group">' +
        util.escHtml(entName) +
        '<span class="scc-ent-badge">' + totalFields + ' field' + (totalFields !== 1 ? 's' : '') + '</span>' +
        '</div>';

      html += renderColHeader();

      items.forEach(function (item, iIdx) {
        // Build a synthetic product scoped to this enterprise's fields
        var billed = 0;
        item.fields.forEach(function (f) { billed += f.qty; });
        var synth = Object.assign({}, item.product, {
          billedQty: billed,
          fields: item.fields
        });
        html += renderVarietyCard(synth, 'e' + eIdx + 'i' + iIdx);
      });
    });

    return html;
  }

  // ── Shared card renderer ──────────────────────────────────────────────────────

  function renderColHeader() {
    return '<div class="scc-col-header">' +
      '<span>Variety &amp; Fields</span>' +
      '<span style="text-align:right;padding-right:0.25rem">Forecasted</span>' +
      '<span style="text-align:right;padding-right:0.25rem">Ordered</span>' +
      '<span style="text-align:right;padding-right:0.25rem">Delivered</span>' +
      '<span style="text-align:right;padding-right:0.25rem">Remaining</span>' +
      '<span></span>' +
      '</div>';
  }

  function renderVarietyCard(p, uid) {
    var billed = p.billedQty != null ? p.billedQty : p.totalQty;
    var ordered = p.orderedQty || 0;
    var delivered = p.deliveredQty || 0;
    var remaining = billed - ordered;
    var level = classify(p);
    var hasFields = p.fields && p.fields.length > 0;
    var autoExpand = level === 0;
    var bdId = 'sd-bd-' + uid;
    var fieldCount = hasFields ? p.fields.length : 0;

    // Total acres across fields
    var totalAcres = 0;
    if (hasFields) p.fields.forEach(function (f) { totalAcres += f.acres || 0; });

    var html = '<div class="sd-variety-block" data-variety="' + util.escHtml(p.productName) + '" data-crop="' + util.escHtml(p.crop || '') + '">';

    // Main row
    html += '<div class="sd-card-main level-' + level + '"' + (hasFields ? ' data-bd="' + bdId + '"' : '') + '>';

    // Col 1: name + meta
    html += '<div>';
    html += '<div class="sd-card-name">' + util.escHtml(p.productName) + '</div>';
    html += '<div class="sd-card-meta">';
    if (p.crop) html += util.escHtml(p.crop);
    if (fieldCount > 0) html += (p.crop ? ' &middot; ' : '') + fieldCount + ' field' + (fieldCount !== 1 ? 's' : '');
    if (totalAcres > 0) html += ' &middot; ' + util.formatNum(totalAcres, 0) + ' ac';
    html += '</div>';
    html += '</div>';

    // Col 2: forecasted
    html += '<div class="sd-stat-col">' +
      '<div class="sd-stat-lbl">Need</div>' +
      '<div class="sd-stat-num">' + util.formatNum(billed, 0) + '<span style="font-size:0.65rem;color:var(--text-light);margin-left:0.2rem">units</span></div>' +
      '</div>';

    // Col 3: ordered
    html += '<div class="sd-stat-col">' +
      '<div class="sd-stat-lbl">Ordered</div>' +
      '<div class="sd-stat-num' + (ordered >= billed ? ' success' : '') + '">' + util.formatNum(ordered, 0) + '</div>' +
      '</div>';

    // Col 4: delivered
    html += '<div class="sd-stat-col">' +
      '<div class="sd-stat-lbl">Delivered</div>' +
      '<div class="sd-stat-num' + (delivered >= billed ? ' success' : (delivered > 0 ? '' : ' muted')) + '">' + util.formatNum(delivered, 0) + '</div>' +
      '</div>';

    // Col 5: remaining (gap)
    html += '<div class="sd-stat-col">' +
      '<div class="sd-stat-lbl">Gap</div>' +
      '<div class="sd-stat-num' + (remaining > 0 ? ' danger' : ' muted') + '">' + (remaining > 0 ? util.formatNum(remaining, 0) : '&#10003;') + '</div>' +
      '</div>';

    // Col 6: caret
    html += '<div class="sd-caret' + (hasFields && autoExpand ? ' open' : '') + '">' +
      (hasFields ? '&#9654;' : '') +
      '</div>';

    html += '</div>'; // end sd-card-main

    // Field breakdown
    if (hasFields) {
      html += '<div id="' + bdId + '" class="sd-field-breakdown" style="display:' + (autoExpand ? '' : 'none') + '">';
      html += '<div class="sd-field-hdr"><span>Field</span><span>Acres</span><span>Population</span><span style="text-align:right">Units</span></div>';
      p.fields.forEach(function (f) {
        html += '<div class="sd-field-row">' +
          '<span class="sd-field-name">' + util.escHtml(f.fieldName) + '</span>' +
          '<span class="sd-field-acres">' + util.formatNum(f.acres, 1) + '</span>' +
          '<span class="sd-field-pop">' + (f.rate ? util.formatNum(f.rate, 0) + '/ac' : '—') + '</span>' +
          '<span class="sd-field-units">' + util.formatNum(f.qty, 0) + '</span>' +
          '</div>';
      });
      html += '</div>';
    }

    html += '</div>'; // end sd-variety-block
    return html;
  }

  // ── Catalog table render ──────────────────────────────────────────────────────

  function renderTable(seeds) {
    var tbody = document.getElementById('seed-tbody');
    var html = '';
    seeds.forEach(function (s) {
      var supplierName = getSupplierName(s.supplierId);
      html += '<tr>' +
        '<td class="editable" data-id="' + s.id + '" data-field="crop">' + util.escHtml(s.crop) + '</td>' +
        '<td class="supplier-cell" data-id="' + s.id + '" data-supplier-id="' + (s.supplierId || '') + '" style="cursor:pointer">' + util.escHtml(supplierName) + '</td>' +
        '<td class="editable" data-id="' + s.id + '" data-field="brand">' + util.escHtml(s.brand) + '</td>' +
        '<td class="editable" data-id="' + s.id + '" data-field="variety">' + util.escHtml(s.variety) + '</td>' +
        (window.APP_ROLE !== 'operator' ? '<td class="editable number" data-id="' + s.id + '" data-field="pricePerUnit">' + util.formatMoney(s.pricePerUnit) + '</td>' : '') +
        '<td class="editable number" data-id="' + s.id + '" data-field="seedsPerUnit">' + util.formatNum(s.seedsPerUnit, 0) + '</td>' +
        '<td style="text-align:center"><span class="seed-og-toggle" data-id="' + s.id + '" data-og="' + (s.organicGround ? '1' : '0') + '" style="cursor:pointer;padding:0.15rem 0.4rem;border-radius:3px;font-size:0.65rem;font-weight:600;' + (s.organicGround ? 'background:#16a34a;color:#fff' : 'background:var(--bg-alt,var(--card));color:var(--text-light)') + '">' + (s.organicGround ? 'OG' : '—') + '</span></td>' +
        '<td><button class="btn-danger" data-del-id="' + s.id + '">Del</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;

    var countEl = document.getElementById('seed-count');
    if (countEl) countEl.textContent = '— ' + seeds.length + ' variet' + (seeds.length !== 1 ? 'ies' : 'y');

    tbody.querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('dblclick', function () { startEdit(td, 'seeds'); });
    });

    tbody.querySelectorAll('[data-del-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Delete this seed?')) return;
        api.del('/api/seeds/' + btn.getAttribute('data-del-id')).then(function () {
          loaded = false;
          loadSeeds();
          util.showToast('Seed deleted');
        });
      });
    });

    tbody.querySelectorAll('.seed-og-toggle').forEach(function (span) {
      span.addEventListener('click', function () {
        var id = span.getAttribute('data-id');
        var current = span.getAttribute('data-og') === '1';
        api.put('/api/seeds/' + id, { organicGround: !current }).then(function () {
          loaded = false;
          loadSeeds();
          util.showToast(current ? 'Removed organic ground designation' : 'Designated for organic ground');
        });
      });
    });

    tbody.querySelectorAll('.supplier-cell').forEach(function (td) {
      td.addEventListener('dblclick', function () {
        if (td.classList.contains('editing')) return;
        td.classList.add('editing');
        var id = td.getAttribute('data-id');
        var currentVal = td.getAttribute('data-supplier-id') || '';
        var suppliers = (window.refData.suppliers || []).filter(function (s) { return s.type === 'seed'; });

        var select = document.createElement('select');
        select.style.width = '140px';
        select.innerHTML = '<option value="">— none —</option>';
        suppliers.forEach(function (s) {
          var opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          if (s.id === currentVal) opt.selected = true;
          select.appendChild(opt);
        });
        var addOpt = document.createElement('option');
        addOpt.value = '__add__';
        addOpt.textContent = '+ Add New';
        select.appendChild(addOpt);

        td.textContent = '';
        td.appendChild(select);
        select.focus();

        function save() {
          var val = select.value;
          if (val === '__add__') {
            var name = prompt('New seed supplier name:');
            if (!name) { loaded = false; loadSeeds(); return; }
            api.post('/api/suppliers', { name: name, type: 'seed', contact: '', notes: '' }).then(function (newSup) {
              return api.put('/api/seeds/' + id, { supplierId: newSup.id });
            }).then(function () {
              window.reloadRefDataSelective('seeds,suppliers').then(function () { loaded = false; loadSeeds(); });
              util.showToast('Supplier created & assigned');
            });
            return;
          }
          api.put('/api/seeds/' + id, { supplierId: val }).then(function () {
            loaded = false;
            loadSeeds();
          });
        }

        select.addEventListener('change', save);
        select.addEventListener('blur', function () {
          if (select.parentNode === td) { loaded = false; loadSeeds(); }
        });
      });
    });
  }

  // ── Inline edit ───────────────────────────────────────────────────────────────

  function startEdit(td, type) {
    if (td.classList.contains('editing')) return;
    var id = td.getAttribute('data-id');
    var field = td.getAttribute('data-field');
    var oldVal = td.textContent.replace(/[$,]/g, '').trim();

    td.classList.add('editing');
    var input = document.createElement('input');
    var isNum = (field === 'pricePerUnit' || field === 'seedsPerUnit');
    input.type = isNum ? 'number' : 'text';
    if (isNum) input.step = '0.01';
    input.value = oldVal;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function save() {
      var data = {};
      data[field] = isNum ? (parseFloat(input.value) || 0) : input.value;
      api.put('/api/' + type + '/' + id, data).then(function () {
        loaded = false;
        loadSeeds();
        window.reloadRefDataSelective('seeds,suppliers');
        window.dispatchEvent(new CustomEvent('seeds-data-changed'));
      });
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { loaded = false; loadSeeds(); }
    });
  }

  window.addEventListener('ref-data-loaded', function () {});
})();
