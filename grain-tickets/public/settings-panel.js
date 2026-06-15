/* ============================================================
   SETTINGS PANEL — Universal Day/Night + Text Size Control
   Shared across all Farm Operations Platform apps
   ============================================================ */

(function () {
  'use strict';

  // --- Embed Base Path ---
  // When running under Caddy's same-origin proxy (e.g. /embed/farm-budget/),
  // API calls like /api/fields must be prefixed to /embed/farm-budget/api/fields.
  // We intercept fetch() globally so ALL code (api helpers + direct fetch calls)
  // automatically gets the prefix — no per-file changes needed.
  var embedMatch = window.location.pathname.match(/^(\/embed\/[^/]+)/);
  window.__BASE = embedMatch ? embedMatch[1] : '';
  if (window.__BASE) {
    var _origFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (typeof url === 'string' && url.charAt(0) === '/' && url.indexOf('/embed/') !== 0) {
        url = window.__BASE + url;
      }
      return _origFetch.call(this, url, opts);
    };
  }

  // --- Config ---
  var THEME_KEY = (window.__SP_THEME_KEY) || 'mru-theme';
  var SCALE_KEY = 'mru-text-scale';
  var SCALES = [
    { label: 'XS', value: 0.85 },
    { label: 'S',  value: 0.93 },
    { label: 'M',  value: 1.0 },
    { label: 'L',  value: 1.15 },
    { label: 'XL', value: 1.3 }
  ];

  // --- Restore saved state before paint ---
  var savedScale = localStorage.getItem(SCALE_KEY);
  if (savedScale) {
    document.documentElement.style.setProperty('--text-scale', savedScale);
  }
  var savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light');
    document.body ? document.body.classList.add('light') : document.addEventListener('DOMContentLoaded', function() { document.body.classList.add('light'); });
  } else if (savedTheme === 'harvest') {
    document.body ? document.body.classList.add('harvest') : document.addEventListener('DOMContentLoaded', function() { document.body.classList.add('harvest'); });
  }

  // --- Skip UI when running inside an iframe (portal embeds these apps) ---
  // But first: listen for localStorage changes from the parent frame so
  // theme/scale changes made in the portal settings panel sync in real-time.
  // (The 'storage' event fires when *another* frame on the same origin writes
  // to localStorage — exactly what happens with same-origin proxy embeds.)
  var isIframe = false;
  try { isIframe = window.self !== window.top; } catch (e) { isIframe = true; }

  if (isIframe) {
    window.addEventListener('storage', function (e) {
      if (e.key === THEME_KEY) {
        if (e.newValue === 'light') {
          document.documentElement.classList.add('light');
          if (document.body) document.body.classList.add('light');
        } else {
          document.documentElement.classList.remove('light');
          if (document.body) document.body.classList.remove('light');
        }
      }
      if (e.key === SCALE_KEY && e.newValue) {
        document.documentElement.style.setProperty('--text-scale', e.newValue);
      }
    });
    return; // Skip settings panel UI — portal handles it
  }

  // --- Wait for DOM ---
  function init() {
    // Build backdrop
    var backdrop = document.createElement('div');
    backdrop.className = 'settings-panel-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    // Build trigger tab
    var trigger = document.createElement('button');
    trigger.className = 'settings-tab-trigger';
    trigger.textContent = 'Settings';
    trigger.setAttribute('aria-label', 'Open display settings');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'settings-panel');
    document.body.appendChild(trigger);

    // Build panel
    var panel = document.createElement('div');
    panel.className = 'settings-panel';
    panel.id = 'settings-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Display settings');
    panel.innerHTML = buildPanelHTML();
    document.body.appendChild(panel);

    // --- References ---
    var closeBtn     = panel.querySelector('.sp-close');
    var dayBtn       = panel.querySelector('[data-theme="day"]');
    var nightBtn     = panel.querySelector('[data-theme="night"]');
    var harvestBtn   = panel.querySelector('[data-theme="harvest"]');
    var sizeBtns = panel.querySelectorAll('.sp-size-btn');
    var preview  = panel.querySelector('.sp-preview');
    var resetBtn = panel.querySelector('.sp-reset');
    var saveBtn  = panel.querySelector('.sp-save');
    var agentToggle = panel.querySelector('.sp-agent-toggle');
    var scoreBadge  = panel.querySelector('.sp-score');
    var violationsList = panel.querySelector('.sp-violations');

    // --- State ---
    var isOpen = false;

    function openPanel() {
      isOpen = true;
      panel.classList.add('open');
      backdrop.classList.add('visible');
      trigger.setAttribute('aria-expanded', 'true');
      closeBtn.focus();
    }

    function closePanel() {
      isOpen = false;
      panel.classList.remove('open');
      backdrop.classList.remove('visible');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }

    trigger.addEventListener('click', function () {
      isOpen ? closePanel() : openPanel();
    });

    closeBtn.addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);

    // Keyboard: Escape closes
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closePanel();
    });

    // --- Theme Control ---
    function applyTheme(theme) {
      var meta = document.querySelector('meta[name="theme-color"]');
      // Clear all theme classes first
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light', 'harvest');
      [dayBtn, nightBtn, harvestBtn].forEach(function(b) { if (b) b.classList.remove('active'); });

      if (theme === 'light') {
        document.documentElement.classList.add('light');
        document.body.classList.add('light');
        if (meta) meta.content = '#f8fafc';
        if (dayBtn) dayBtn.classList.add('active');
      } else if (theme === 'harvest') {
        document.body.classList.add('harvest');
        if (meta) meta.content = '#f7f3eb';
        if (harvestBtn) harvestBtn.classList.add('active');
      } else {
        if (meta) meta.content = '#080a0f';
        if (nightBtn) nightBtn.classList.add('active');
      }
      localStorage.setItem(THEME_KEY, theme);

      // Update legacy toggle button if it exists
      var legacyBtn = document.getElementById('theme-toggle');
      if (legacyBtn) {
        if (legacyBtn.textContent.indexOf('[') !== -1) {
          legacyBtn.textContent = theme === 'light' ? '[night]' : '[day]';
        } else {
          legacyBtn.innerHTML = theme === 'light' ? '&#9790;' : '&#9788;';
        }
      }
      var legacyBtnNav = document.getElementById('theme-toggle-nav');
      if (legacyBtnNav) {
        legacyBtnNav.innerHTML = theme === 'light' ? '&#9790;' : '&#9788;';
      }

      window.dispatchEvent(new Event('theme-change'));
    }

    function getCurrentTheme() {
      if (document.body.classList.contains('harvest')) return 'harvest';
      return document.body.classList.contains('light') ? 'light' : 'dark';
    }

    dayBtn.addEventListener('click', function () { applyTheme('light'); });
    nightBtn.addEventListener('click', function () { applyTheme('dark'); });
    if (harvestBtn) harvestBtn.addEventListener('click', function () { applyTheme('harvest'); });

    // Sync initial state
    var initTheme = getCurrentTheme();
    if (initTheme === 'harvest' && harvestBtn) harvestBtn.classList.add('active');
    else if (initTheme === 'light') dayBtn.classList.add('active');
    else nightBtn.classList.add('active');

    // --- Text Size Control ---
    function applyScale(value) {
      document.documentElement.style.setProperty('--text-scale', value);
      localStorage.setItem(SCALE_KEY, value);

      // Update button states
      for (var i = 0; i < sizeBtns.length; i++) {
        var btn = sizeBtns[i];
        if (parseFloat(btn.dataset.scale) === parseFloat(value)) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }

      // Update preview text
      if (preview) {
        preview.style.fontSize = 'var(--size-base)';
      }

      window.dispatchEvent(new CustomEvent('text-scale-change', { detail: { scale: value } }));
    }

    for (var i = 0; i < sizeBtns.length; i++) {
      sizeBtns[i].addEventListener('click', function () {
        applyScale(this.dataset.scale);
      });
    }

    // Restore saved scale
    var currentScale = parseFloat(localStorage.getItem(SCALE_KEY) || '1');
    applyScale(currentScale);

    // --- Save ---
    saveBtn.addEventListener('click', function () {
      // Settings are already persisted to localStorage on each change,
      // but the save button gives explicit confirmation.
      localStorage.setItem(THEME_KEY, getCurrentTheme());
      localStorage.setItem(SCALE_KEY, document.documentElement.style.getPropertyValue('--text-scale') || '1');
      saveBtn.textContent = 'Saved!';
      saveBtn.classList.add('saved');
      setTimeout(function () {
        saveBtn.textContent = 'Save Settings';
        saveBtn.classList.remove('saved');
      }, 1500);
    });

    // --- Reset ---
    resetBtn.addEventListener('click', function () {
      applyTheme('dark');
      applyScale(1);
    });

    // --- Formatting Agent Toggle ---
    var agentEnabled = localStorage.getItem('mru-fmt-agent') !== 'off';
    updateAgentToggle(agentEnabled);

    agentToggle.addEventListener('click', function () {
      agentEnabled = !agentEnabled;
      updateAgentToggle(agentEnabled);
      localStorage.setItem('mru-fmt-agent', agentEnabled ? 'on' : 'off');
      window.dispatchEvent(new CustomEvent('formatting-agent-toggle', { detail: { enabled: agentEnabled } }));
    });

    function updateAgentToggle(on) {
      if (on) {
        agentToggle.classList.add('on');
        agentToggle.setAttribute('aria-checked', 'true');
      } else {
        agentToggle.classList.remove('on');
        agentToggle.setAttribute('aria-checked', 'false');
      }
    }

    // --- Public API for Formatting Agent ---
    window.__settingsPanel = {
      updateScore: function (score, violations) {
        if (!scoreBadge) return;
        scoreBadge.textContent = score + '/100';
        scoreBadge.className = 'sp-score ' + (score >= 90 ? 'good' : score >= 70 ? 'warn' : 'bad');

        if (violationsList && violations) {
          violationsList.innerHTML = '';
          var max = Math.min(violations.length, 20);
          for (var v = 0; v < max; v++) {
            var div = document.createElement('div');
            div.textContent = violations[v];
            violationsList.appendChild(div);
          }
          if (violations.length > 20) {
            var more = document.createElement('div');
            more.textContent = '... and ' + (violations.length - 20) + ' more';
            more.style.color = 'var(--text-light)';
            violationsList.appendChild(more);
          }
        }
      },
      isAgentEnabled: function () {
        return agentEnabled;
      }
    };

    // --- Intercept legacy theme toggle clicks ---
    var legacyToggle = document.getElementById('theme-toggle');
    if (legacyToggle) {
      // Clone to remove old listeners, then attach new one
      var newToggle = legacyToggle.cloneNode(true);
      legacyToggle.parentNode.replaceChild(newToggle, legacyToggle);
      newToggle.addEventListener('click', function () {
        var next = getCurrentTheme() === 'light' ? 'dark' : 'light';
        applyTheme(next);
      });
    }

    var legacyToggleNav = document.getElementById('theme-toggle-nav');
    if (legacyToggleNav) {
      var newToggleNav = legacyToggleNav.cloneNode(true);
      legacyToggleNav.parentNode.replaceChild(newToggleNav, legacyToggleNav);
      newToggleNav.addEventListener('click', function () {
        var next = getCurrentTheme() === 'light' ? 'dark' : 'light';
        applyTheme(next);
      });
    }
  }

  function buildPanelHTML() {
    var scaleHTML = '';
    var scales = [
      { label: 'XS', value: 0.85 },
      { label: 'S',  value: 0.93 },
      { label: 'M',  value: 1.0 },
      { label: 'L',  value: 1.15 },
      { label: 'XL', value: 1.3 }
    ];
    for (var i = 0; i < scales.length; i++) {
      scaleHTML += '<button class="sp-size-btn" data-scale="' + scales[i].value +
        '" aria-label="Text size ' + scales[i].label + '">' + scales[i].label + '</button>';
    }

    return '' +
      '<h3>Display Settings <button class="sp-close" aria-label="Close settings">&times;</button></h3>' +

      '<div class="sp-section">' +
        '<span class="sp-label">Theme</span>' +
        '<div class="sp-theme-row">' +
          '<button class="sp-theme-btn" data-theme="day" aria-label="Day theme">&#9788; Day</button>' +
          '<button class="sp-theme-btn" data-theme="night" aria-label="Night theme">&#9790; Night</button>' +
          '<button class="sp-theme-btn" data-theme="harvest" aria-label="Harvest theme">&#127807; Field</button>' +
        '</div>' +
      '</div>' +

      '<div class="sp-section">' +
        '<span class="sp-label">Text Size</span>' +
        '<div class="sp-size-row">' + scaleHTML + '</div>' +
        '<div class="sp-preview">The quick brown fox jumps over the lazy dog.</div>' +
      '</div>' +

      '<div class="sp-section">' +
        '<span class="sp-label">Formatting Agent</span>' +
        '<div class="sp-agent-row">' +
          '<span style="font-size:var(--size-xs);color:var(--text,#cbd5e1)">Readability monitor</span>' +
          '<button class="sp-agent-toggle on" role="switch" aria-checked="true" aria-label="Toggle formatting agent"></button>' +
        '</div>' +
        '<div class="sp-agent-row">' +
          '<span style="font-size:var(--size-xs);color:var(--text-light,#64748b)">Score:</span>' +
          '<span class="sp-score good">--/100</span>' +
        '</div>' +
        '<div class="sp-violations"></div>' +
      '</div>' +

      '<div class="sp-save-row">' +
        '<button class="sp-save" aria-label="Save settings">Save Settings</button>' +
      '</div>' +
      '<button class="sp-reset" aria-label="Reset to defaults">Reset to defaults</button>';
  }

  // Init on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
