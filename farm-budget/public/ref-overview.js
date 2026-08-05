// Reference Overview: landing cards with counts + data-health flags.
// Default landing in solo Reference mode (?view=reference); also available
// as a sub-tab in normal mode. Reads window.refData only — no API calls.
(function () {
  'use strict';

  var CARDS = [
    { key: 'products',      label: 'Products',         refSub: 'products' },
    { key: 'seeds',         label: 'Seeds',            refSub: 'seeds' },
    { key: 'implements',    label: 'Implements',       refSub: 'implements' },
    { key: 'suppliers',     label: 'Suppliers',        refSub: 'suppliers' },
    { key: 'unitPacks',     label: 'Unit/Packs',       refSub: 'unit-packs' },
    { key: 'laborOverhead', label: 'Labor & Overhead', refSub: 'labor', roleClass: 'role-hide-office' },
    { key: 'cropTypes',     label: 'Crop Types',       special: 'crop-types' },
    { key: 'forecast',      label: 'Forecast',         refSub: 'forecast', derived: true, sub: 'Aggregated demand from field plans' }
  ];

  function num(v) { return typeof v === 'number' && v > 0; }

  function flag(list, n, msg) {
    if (n > 0) list.push(n + ' ' + msg);
  }

  // Returns { flags: [...], count: N } for one card key
  function inspect(key, rd) {
    var flags = [];
    var rows = rd[key] || [];
    switch (key) {
      case 'products': {
        flag(flags, rows.filter(function (p) { return !num(p.unitBilledPrice); }).length, 'missing price');
        flag(flags, rows.filter(function (p) { return !p.supplierId; }).length, 'missing supplier');
        break;
      }
      case 'seeds': {
        flag(flags, rows.filter(function (s) { return !num(s.pricePerUnit); }).length, 'missing price');
        flag(flags, rows.filter(function (s) { return !num(s.seedsPerUnit); }).length, 'missing seeds/unit');
        break;
      }
      case 'implements': {
        flag(flags, rows.filter(function (im) { return !num(im.costPerAcre) && !num(im.customHireRate); }).length, 'missing cost');
        break;
      }
      case 'suppliers': {
        var used = {};
        (rd.products || []).forEach(function (p) { if (p.supplierId) used[p.supplierId] = true; });
        (rd.seeds || []).forEach(function (s) { if (s.supplierId) used[s.supplierId] = true; });
        flag(flags, rows.filter(function (sup) { return !used[sup.id]; }).length, 'unreferenced');
        flag(flags, rows.filter(function (sup) { return !sup.contact; }).length, 'missing contact');
        break;
      }
      case 'unitPacks': {
        flag(flags, rows.filter(function (up) { return !num(up.packQty); }).length, 'missing pack qty');
        break;
      }
      case 'laborOverhead': {
        flag(flags, rows.filter(function (lo) { return !num(lo.laborPerAcre) || !num(lo.overheadPerAcre); }).length, 'missing rates');
        break;
      }
      case 'cropTypes': {
        flag(flags, rows.filter(function (ct) { return !(ct.subCrops && ct.subCrops.length); }).length, 'no sub-crops');
        flag(flags, rows.filter(function (ct) { return ct.pricingMode === 'cbot' && !ct.cbotSymbol; }).length, 'CBOT missing symbol');
        break;
      }
    }
    return { count: rows.length, flags: flags };
  }

  function render() {
    var grid = document.getElementById('ref-overview-cards');
    var rd = window.refData;
    if (!grid || !rd) return;

    var html = '';
    CARDS.forEach(function (card) {
      var info = card.derived ? { count: null, flags: [] } : inspect(card.key, rd);
      var cls = 'ref-overview-card' + (info.flags.length ? ' has-flags' : '') + (card.roleClass ? ' ' + card.roleClass : '');
      html += '<div class="' + cls + '" data-card="' + card.key + '" role="button" tabindex="0">';
      html += '<div class="card-label">' + card.label + '</div>';
      html += '<div class="card-count">' + (info.count === null ? '&mdash;' : info.count) + '</div>';
      if (card.sub) html += '<div class="card-sub">' + card.sub + '</div>';
      if (info.flags.length) {
        info.flags.forEach(function (f) { html += '<span class="card-flag">&#9888; ' + f + '</span>'; });
      } else if (!card.derived) {
        html += '<span class="card-flag-ok">&#10003; complete</span>';
      }
      html += '</div>';
    });
    grid.innerHTML = html;
  }

  function drillIn(key) {
    var card = null;
    CARDS.forEach(function (c) { if (c.key === key) card = c; });
    if (!card) return;
    if (card.special === 'crop-types') {
      // Crop Types is a collapsible section below the sub-tabs, not a sub-tab
      var section = document.getElementById('crop-types-section');
      var toggle = document.getElementById('crop-types-toggle');
      if (section && toggle && !section.classList.contains('open')) toggle.click();
      if (section) section.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    var btn = document.querySelector('.ref-sub-btn[data-ref-sub="' + card.refSub + '"]');
    if (btn) btn.click(); // reuse existing sub-tab switch handler + its tab-activate events
  }

  document.addEventListener('DOMContentLoaded', function () {
    var grid = document.getElementById('ref-overview-cards');
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      var el = e.target.closest('.ref-overview-card');
      if (el) drillIn(el.getAttribute('data-card'));
    });
    grid.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = e.target.closest('.ref-overview-card');
      if (el) { e.preventDefault(); drillIn(el.getAttribute('data-card')); }
    });
  });

  // Fires at boot and after every editor save (reloadRefDataSelective),
  // so counts and flags stay fresh without polling.
  window.addEventListener('ref-data-loaded', render);
})();
