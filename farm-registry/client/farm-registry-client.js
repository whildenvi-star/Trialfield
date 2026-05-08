/**
 * Farm Registry Client
 * Include via: <script src="http://localhost:3005/client/farm-registry-client.js"></script>
 *
 * Usage:
 *   FarmRegistry.autocomplete(document.getElementById('farm-input'), {
 *     onSelect: function(field) { console.log('Selected:', field.name, field.reportingAcres); }
 *   });
 */
(function (global) {
  'use strict';

  // Auto-detect base URL: when loaded via /embed/farm-registry/ proxy, use
  // the embed path so requests stay same-origin. Falls back to localhost:3005.
  var BASE_URL = (function () {
    var embedMatch = window.location.pathname.match(/^(\/embed\/farm-registry)/);
    if (embedMatch) return embedMatch[1];
    // Check if the script tag itself came from an embed path
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var m = (scripts[i].src || '').match(/(\/embed\/farm-registry)/);
      if (m) return m[1];
    }
    return 'http://localhost:3005';
  })();
  var DEBOUNCE_MS = 300;

  // Grab embed token from the host page's query string (iframe loads with ?token=…)
  var EMBED_TOKEN = (function () {
    var m = window.location.search.match(/[?&]token=([^&]+)/);
    return m ? m[1] : null;
  })();

  // --- API helpers ---
  function fetchJSON(url) {
    // Append embed token so cross-service requests pass the auth gate
    if (EMBED_TOKEN) {
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      url = url + sep + 'token=' + encodeURIComponent(EMBED_TOKEN);
    }
    return fetch(BASE_URL + url, { credentials: 'same-origin' }).then(function (r) { return r.json(); });
  }

  function getFields(opts) {
    var qs = [];
    if (opts && opts.active !== undefined) qs.push('active=' + opts.active);
    if (opts && opts.growerId) qs.push('growerId=' + opts.growerId);
    var url = '/api/fields' + (qs.length ? '?' + qs.join('&') : '');
    return fetchJSON(url);
  }

  function getField(id) {
    return fetchJSON('/api/fields/' + id);
  }

  function searchFields(query) {
    return fetchJSON('/api/fields/search?q=' + encodeURIComponent(query));
  }

  function getGrowers() {
    return fetchJSON('/api/growers');
  }

  // --- Autocomplete ---
  function autocomplete(inputEl, opts) {
    opts = opts || {};
    var onSelect = opts.onSelect || function () {};
    var minChars = opts.minChars || 1;
    var timer = null;
    var dropdown = null;
    var selectedIdx = -1;
    var currentResults = [];

    // Create dropdown container
    dropdown = document.createElement('div');
    dropdown.className = 'fr-autocomplete-dropdown';
    dropdown.style.cssText = 'position:absolute;z-index:9999;background:var(--card,#1a1a2e);border:1px solid var(--border,#333);' +
      'border-top:none;max-height:260px;overflow-y:auto;display:none;min-width:280px;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.4);border-radius:0 0 4px 4px;color:var(--text,#e0e0e0);';

    // Position relative to input
    var wrapper = inputEl.parentNode;
    if (getComputedStyle(wrapper).position === 'static') {
      wrapper.style.position = 'relative';
    }
    wrapper.appendChild(dropdown);

    function renderDropdown(results) {
      currentResults = results;
      selectedIdx = -1;
      if (!results.length) {
        dropdown.style.display = 'none';
        return;
      }
      var html = '';
      results.forEach(function (f, i) {
        var ownership = f.ownership === 'organic' ? 'org' : f.ownership;
        html += '<div class="fr-ac-item" data-idx="' + i + '" style="' +
          'padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border,#333);' +
          'display:flex;justify-content:space-between;align-items:center;' +
          'font-size:14px;color:var(--text,#e0e0e0);">' +
          '<span style="font-weight:500;">' + escapeHtml(f.name) + '</span>' +
          '<span style="color:var(--text-light,#999);font-size:12px;">' +
          f.reportingAcres + ' ac' +
          (f.organicAcres > 0 ? ' <span style="color:#16a34a;font-weight:600;">ORG</span>' : '') +
          ' &middot; ' + (f.ownership || '') +
          '</span></div>';
      });
      dropdown.innerHTML = html;
      dropdown.style.display = 'block';

      // Position dropdown below input
      var rect = inputEl.getBoundingClientRect();
      var wrapRect = wrapper.getBoundingClientRect();
      dropdown.style.left = (rect.left - wrapRect.left) + 'px';
      dropdown.style.top = (rect.bottom - wrapRect.top) + 'px';
      dropdown.style.width = rect.width + 'px';
    }

    function highlightItem(idx) {
      var items = dropdown.querySelectorAll('.fr-ac-item');
      items.forEach(function (el, i) {
        el.style.background = i === idx ? 'var(--highlight,#2a2a4a)' : 'var(--card,#1a1a2e)';
      });
      selectedIdx = idx;
    }

    function selectItem(idx) {
      if (idx >= 0 && idx < currentResults.length) {
        var field = currentResults[idx];
        inputEl.value = field.name;
        dropdown.style.display = 'none';
        onSelect(field);
      }
    }

    inputEl.addEventListener('input', function () {
      var q = inputEl.value.trim();
      if (q.length < minChars) {
        dropdown.style.display = 'none';
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(function () {
        searchFields(q).then(renderDropdown);
      }, DEBOUNCE_MS);
    });

    inputEl.addEventListener('keydown', function (e) {
      if (dropdown.style.display === 'none') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightItem(Math.min(selectedIdx + 1, currentResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightItem(Math.max(selectedIdx - 1, 0));
      } else if (e.key === 'Enter' && selectedIdx >= 0) {
        e.preventDefault();
        selectItem(selectedIdx);
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
      }
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.fr-ac-item');
      if (!item) return;
      selectItem(parseInt(item.getAttribute('data-idx')));
    });

    dropdown.addEventListener('mouseover', function (e) {
      var item = e.target.closest('.fr-ac-item');
      if (!item) return;
      highlightItem(parseInt(item.getAttribute('data-idx')));
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

    return {
      destroy: function () {
        dropdown.remove();
        clearTimeout(timer);
      }
    };
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Public API ---
  global.FarmRegistry = {
    autocomplete: autocomplete,
    getFields: getFields,
    getField: getField,
    searchFields: searchFields,
    getGrowers: getGrowers,
    BASE_URL: BASE_URL
  };

})(window);
