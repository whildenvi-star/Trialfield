// Crop Types Manager + hedging-data-ready bridge
(function () {
  'use strict';

  function reloadCropTypes() {
    window.reloadRefDataSelective('crop-types').then(function () {
      renderCropTypes(window.refData.cropTypes);
    });
  }

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'reference') {
      renderCropTypes(window.refData.cropTypes);
      var toggle = document.getElementById('crop-types-toggle');
      var section = document.getElementById('crop-types-section');
      var body = document.getElementById('crop-types-body');
      if (toggle && !toggle._bound) {
        toggle._bound = true;
        toggle.addEventListener('click', function () {
          var isOpen = section.classList.toggle('open');
          body.style.display = isOpen ? 'block' : 'none';
        });
      }
    }
    if (e.detail.tab === 'sales') {
      api.get('/api/dashboard').then(function (dash) {
        window.dispatchEvent(new CustomEvent('hedging-data-ready', {
          detail: { dashboard: dash, sales: [] }
        }));
      });
    }
  });

  // === CROP TYPES MANAGER ===

  function renderCropTypes(cropTypes) {
    var container = document.getElementById('crop-types-container');
    if (!container) return;

    var html = '';
    cropTypes.forEach(function (ct) {
      var subs = ct.subCrops || [];
      var isCbot = ct.pricingMode === 'cbot';

      html += '<div class="ctype-card" data-ctype-id="' + ct.id + '">';

      // Header
      html += '<div class="ctype-header">';
      html += '<span class="ctype-arrow">&#9654;</span>';
      html += '<span class="ctype-swatch" style="background:' + ct.color + '"></span>';
      html += '<span class="ctype-name">' + util.escHtml(ct.name) + '</span>';

      var enterprises = window.refData.enterprises || [];
      html += '<span class="ctype-meta">Unit: ' + util.escHtml(ct.unit || 'Bu') + ' &middot; ' + subs.length + ' sub-crops</span>';

      html += '<div class="ctype-header-actions">';
      if (isCbot) {
        html += '<select class="ctype-symbol-select" data-ctype-id="' + ct.id + '">';
        var symbolOpts = [
          { group: 'Corn', items: [
            { val: 'ZCH', label: 'ZCH (Mar)' }, { val: 'ZCK', label: 'ZCK (May)' },
            { val: 'ZCN', label: 'ZCN (Jul)' }, { val: 'ZCU', label: 'ZCU (Sep)' },
            { val: 'ZCZ', label: 'ZCZ (Dec)' }
          ]},
          { group: 'Soybeans', items: [
            { val: 'ZSF', label: 'ZSF (Jan)' }, { val: 'ZSH', label: 'ZSH (Mar)' },
            { val: 'ZSK', label: 'ZSK (May)' }, { val: 'ZSN', label: 'ZSN (Jul)' },
            { val: 'ZSQ', label: 'ZSQ (Aug)' }, { val: 'ZSX', label: 'ZSX (Nov)' }
          ]},
          { group: 'Wheat', items: [
            { val: 'ZWH', label: 'ZWH (Mar)' }, { val: 'ZWK', label: 'ZWK (May)' },
            { val: 'ZWN', label: 'ZWN (Jul)' }, { val: 'ZWU', label: 'ZWU (Sep)' },
            { val: 'ZWZ', label: 'ZWZ (Dec)' }
          ]}
        ];
        symbolOpts.forEach(function (g) {
          html += '<optgroup label="' + g.group + '">';
          g.items.forEach(function (opt) {
            var sel = (ct.cbotSymbol || '') === opt.val ? ' selected' : '';
            html += '<option value="' + opt.val + '"' + sel + '>' + opt.label + '</option>';
          });
          html += '</optgroup>';
        });
        var isStandard = symbolOpts.some(function (g) {
          return g.items.some(function (o) { return o.val === ct.cbotSymbol; });
        });
        if (!isStandard && ct.cbotSymbol) {
          html += '<option value="' + util.escHtml(ct.cbotSymbol) + '" selected>' + util.escHtml(ct.cbotSymbol) + '</option>';
        }
        html += '</select>';
        html += '<span class="ctype-cbot-price">$' + util.formatNum(ct.cbotPrice || 0, 4) + '</span>';
        html += '<button class="ctype-fetch-btn" data-ctype-id="' + ct.id + '">Fetch</button>';
        if (ct.cbotLastFetched) {
          var d = new Date(ct.cbotLastFetched);
          html += '<span class="ctype-last-fetched">' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</span>';
        }
      }
      html += '<button class="ctype-delete-btn" data-ctype-id="' + ct.id + '" title="Delete crop type">&#10005;</button>';
      html += '</div></div>';

      // Body — sub-crops table
      html += '<div class="ctype-body">';
      html += '<table class="ctype-sub-table"><thead><tr>';
      html += '<th>Sub-Crop</th><th>Mode</th><th class="number">Price</th>';
      if (isCbot) html += '<th class="number">Basis</th>';
      html += '<th class="number">Drying</th><th>Unit</th><th>Enterprise</th><th></th>';
      html += '</tr></thead><tbody>';

      subs.forEach(function (sc, idx) {
        var effectivePrice = sc.pricePerUnit || 0;
        if (sc.pricingMode === 'cbot' && isCbot) {
          effectivePrice = (ct.cbotPrice || 0) + (sc.basisDefault || 0);
        }
        var modeCls = sc.pricingMode === 'cbot' ? 'cbot' : sc.pricingMode === 'flat' ? 'flat' : 'contract';

        html += '<tr data-ctype-id="' + ct.id + '" data-sub-idx="' + idx + '">';
        html += '<td class="editable" data-field="name">' + util.escHtml(sc.name) + '</td>';
        html += '<td><span class="mode-badge ' + modeCls + '">' + sc.pricingMode.toUpperCase() + '</span></td>';
        html += '<td class="number editable" data-field="price">$' + util.formatNum(effectivePrice, 2) + '</td>';
        if (isCbot) {
          html += '<td class="number editable" data-field="basis">' + (sc.pricingMode === 'cbot' ? '$' + util.formatNum(sc.basisDefault || 0, 2) : '—') + '</td>';
        }
        html += '<td class="number editable" data-field="drying">$' + util.formatNum(sc.dryingRate || 0, 2) + '</td>';
        html += '<td>' + util.escHtml(sc.unit || ct.unit || '') + '</td>';
        html += '<td><select class="subcrop-enterprise-select" data-ctype-id="' + ct.id + '" data-sub-idx="' + idx + '">';
        html += '<option value="">None</option>';
        enterprises.forEach(function (ent) {
          var sel = sc.enterpriseId === ent.id ? ' selected' : '';
          html += '<option value="' + ent.id + '"' + sel + '>' + util.escHtml(ent.shortName || ent.name) + '</option>';
        });
        html += '</select></td>';
        html += '<td><button class="ctype-delete-btn" data-ctype-id="' + ct.id + '" data-sub-idx="' + idx + '" title="Remove sub-crop">&#10005;</button></td>';
        html += '</tr>';
      });

      html += '</tbody></table>';
      html += '<button class="btn-sm ctype-add-sub" data-ctype-id="' + ct.id + '">+ Add Sub-Crop</button>';
      html += '</div></div>';
    });

    container.innerHTML = html;
    bindCropTypeEvents(container, cropTypes);
  }

  function bindCropTypeEvents(container, cropTypes) {
    container.querySelectorAll('.ctype-header').forEach(function (hdr) {
      hdr.addEventListener('click', function (e) {
        if (e.target.closest('.ctype-fetch-btn') || e.target.closest('.ctype-delete-btn') || e.target.closest('.ctype-symbol-select')) return;
        hdr.parentElement.classList.toggle('open');
      });
    });

    container.querySelectorAll('.ctype-fetch-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var ctypeId = btn.getAttribute('data-ctype-id');
        var card = btn.closest('.ctype-card');
        var symbolSelect = card ? card.querySelector('.ctype-symbol-select') : null;
        var symbol = symbolSelect ? symbolSelect.value : '';
        if (!symbol) { util.showToast('No CBOT symbol configured'); return; }
        btn.textContent = 'Fetching...';
        btn.disabled = true;
        api.get('/api/cbot-fetch?symbol=' + encodeURIComponent(symbol)).then(function (result) {
          if (result.price) {
            api.put('/api/crop-types/' + ctypeId, {
              cbotPrice: result.price,
              cbotLastFetched: result.timestamp
            }).then(function () {
              util.showToast('CBOT price updated: $' + result.price.toFixed(4));
              reloadCropTypes();
            });
          } else {
            util.showToast(result.error || 'Fetch failed — enter price manually');
            btn.textContent = 'Fetch';
            btn.disabled = false;
          }
        }).catch(function () {
          util.showToast('Fetch failed — enter price manually');
          btn.textContent = 'Fetch';
          btn.disabled = false;
        });
      });
    });

    container.querySelectorAll('.ctype-symbol-select').forEach(function (sel) {
      sel.addEventListener('click', function (e) { e.stopPropagation(); });
      sel.addEventListener('change', function (e) {
        e.stopPropagation();
        var ctypeId = sel.getAttribute('data-ctype-id');
        api.put('/api/crop-types/' + ctypeId, { cbotSymbol: sel.value }).then(function () {
          util.showToast('Symbol updated to ' + sel.value);
        });
      });
    });

    container.querySelectorAll('.subcrop-enterprise-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var ctypeId = sel.getAttribute('data-ctype-id');
        var subIdx = parseInt(sel.getAttribute('data-sub-idx'));
        var newEntId = sel.value || null;
        var ct = cropTypes.find(function (c) { return c.id === ctypeId; });
        if (!ct) return;
        var subs = (ct.subCrops || []).slice();
        subs[subIdx] = Object.assign({}, subs[subIdx], { enterpriseId: newEntId });
        api.put('/api/crop-types/' + ctypeId, { subCrops: subs }).then(function () {
          var entName = sel.options[sel.selectedIndex].text;
          util.showToast(subs[subIdx].name + ' → ' + entName);
          reloadCropTypes();
        });
      });
    });

    container.querySelectorAll('.ctype-sub-table td.editable').forEach(function (td) {
      td.addEventListener('dblclick', function () {
        if (td.querySelector('input, select')) return;
        var tr = td.closest('tr');
        var ctypeId = tr.getAttribute('data-ctype-id');
        var subIdx = parseInt(tr.getAttribute('data-sub-idx'));
        var field = td.getAttribute('data-field');
        var ct = cropTypes.find(function (c) { return c.id === ctypeId; });
        if (!ct) return;
        var sc = (ct.subCrops || [])[subIdx];
        if (!sc) return;

        var oldText = td.textContent.replace(/[$,]/g, '').trim();

        if (field === 'name') {
          var input = document.createElement('input');
          input.type = 'text'; input.value = sc.name; input.style.width = '100%'; input.style.fontSize = '0.82rem';
          td.textContent = ''; td.appendChild(input); input.focus(); input.select();
          function saveName() {
            var val = input.value.trim();
            if (val && val !== sc.name) {
              var subs = ct.subCrops.slice();
              subs[subIdx] = Object.assign({}, subs[subIdx], { name: val });
              api.put('/api/crop-types/' + ctypeId, { subCrops: subs }).then(reloadCropTypes);
            } else { reloadCropTypes(); }
          }
          input.addEventListener('blur', saveName);
          input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') reloadCropTypes();
          });
        } else if (field === 'price' || field === 'basis' || field === 'drying') {
          var numVal = parseFloat(oldText) || 0;
          var input = document.createElement('input');
          input.type = 'number'; input.step = '0.01'; input.value = numVal; input.style.width = '80px'; input.style.fontSize = '0.82rem';
          td.textContent = ''; td.appendChild(input); input.focus(); input.select();
          function saveNum() {
            var val = parseFloat(input.value) || 0;
            var subs = ct.subCrops.slice();
            var updatedSc = Object.assign({}, subs[subIdx]);
            if (field === 'price') {
              if (updatedSc.pricingMode === 'cbot') {
                updatedSc.basisDefault = val - (ct.cbotPrice || 0);
              } else {
                updatedSc.pricePerUnit = val;
              }
            } else if (field === 'basis') {
              updatedSc.basisDefault = val;
            } else if (field === 'drying') {
              updatedSc.dryingRate = val;
            }
            subs[subIdx] = updatedSc;
            api.put('/api/crop-types/' + ctypeId, { subCrops: subs }).then(reloadCropTypes);
          }
          input.addEventListener('blur', saveNum);
          input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') reloadCropTypes();
          });
        }
      });
    });

    container.querySelectorAll('.ctype-add-sub').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ctypeId = btn.getAttribute('data-ctype-id');
        var ct = cropTypes.find(function (c) { return c.id === ctypeId; });
        if (!ct) return;
        var subs = (ct.subCrops || []).slice();
        subs.push({
          name: 'New ' + ct.name,
          pricingMode: ct.pricingMode === 'cbot' ? 'cbot' : 'contract',
          pricePerUnit: 0, basisDefault: 0, unit: ct.unit || 'Bu', dryingRate: 0,
          shadeIndex: subs.length, enterpriseId: null
        });
        api.put('/api/crop-types/' + ctypeId, { subCrops: subs }).then(reloadCropTypes);
      });
    });

    container.querySelectorAll('.ctype-sub-table .ctype-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ctypeId = btn.getAttribute('data-ctype-id');
        var subIdx = parseInt(btn.getAttribute('data-sub-idx'));
        var ct = cropTypes.find(function (c) { return c.id === ctypeId; });
        if (!ct || isNaN(subIdx)) return;
        var sc = ct.subCrops[subIdx];
        if (!confirm('Remove sub-crop "' + sc.name + '"?')) return;
        var subs = ct.subCrops.slice();
        subs.splice(subIdx, 1);
        api.put('/api/crop-types/' + ctypeId, { subCrops: subs }).then(reloadCropTypes);
      });
    });

    container.querySelectorAll('.ctype-header .ctype-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var ctypeId = btn.getAttribute('data-ctype-id');
        var ct = cropTypes.find(function (c) { return c.id === ctypeId; });
        if (!ct) return;
        if (!confirm('Delete crop type "' + ct.name + '" and all its sub-crops?')) return;
        api.del('/api/crop-types/' + ctypeId).then(reloadCropTypes);
      });
    });
  }

  var btnAddCropType = document.getElementById('btn-add-crop-type');
  if (btnAddCropType) btnAddCropType.addEventListener('click', function () {
    var name = prompt('New crop type name (e.g. "Millet"):');
    if (!name || !name.trim()) return;
    api.post('/api/crop-types', {
      name: name.trim(), color: '#455a64', unit: 'Bu',
      defaultMoisture: 0, dryingRate: 0, interestRate: 0.06,
      pricingMode: 'manual', cbotPrice: 0, cbotSymbol: '', cbotLastFetched: null, subCrops: []
    }).then(reloadCropTypes);
  });
})();
