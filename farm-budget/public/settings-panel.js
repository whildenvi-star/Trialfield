/* ============================================================
   SETTINGS PANEL — Universal Display Settings
   Theme · Font · Text Size · Text Weight
   Shared across all Farm Operations Platform apps.
   Renders inside portal embeds too (same-origin localStorage), so the
   panel is reachable from the only surface users actually visit.
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
  var THEME_KEY  = (window.__SP_THEME_KEY) || 'mru-theme';
  var SCALE_KEY  = 'mru-text-scale';
  var FONT_KEY   = 'mru-font';
  var WEIGHT_KEY = 'mru-font-weight';

  var SCALES = [
    { label: 'XS',  value: 0.85 },
    { label: 'S',   value: 0.93 },
    { label: 'M',   value: 1.0  },
    { label: 'M+',  value: 1.1  },
    { label: 'L',   value: 1.2  },
    { label: 'L+',  value: 1.3  },
    { label: 'XL',  value: 1.45 },
    { label: 'XXL', value: 1.6  }
  ];

  var WEIGHTS = [
    { label: 'Regular',  value: 400 },
    { label: 'Medium',   value: 500 },
    { label: 'Semibold', value: 600 },
    { label: 'Bold',     value: 700 }
  ];

  var FONTS = [
    { key: 'jetbrains', label: 'JetBrains Mono', hint: 'terminal · default',
      stack: "'JetBrains Mono', 'Courier New', monospace", gf: null },
    { key: 'atkinson', label: 'Atkinson Hyperlegible', hint: 'designed for low-vision readers',
      stack: "'Atkinson Hyperlegible', 'Segoe UI', Arial, sans-serif", gf: 'Atkinson+Hyperlegible:wght@400;700' },
    { key: 'lexend', label: 'Lexend', hint: 'reading-optimized sans',
      stack: "'Lexend', 'Segoe UI', Arial, sans-serif", gf: 'Lexend:wght@400;500;600;700' },
    { key: 'inter', label: 'Inter', hint: 'clean interface sans',
      stack: "'Inter', 'Segoe UI', Arial, sans-serif", gf: 'Inter:wght@400;500;600;700' },
    { key: 'plex', label: 'IBM Plex Mono', hint: 'softer monospace',
      stack: "'IBM Plex Mono', 'Courier New', monospace", gf: 'IBM+Plex+Mono:wght@400;500;600;700' }
  ];

  function fontByKey(key) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].key === key) return FONTS[i];
    return FONTS[0];
  }

  // Load a Google Fonts stylesheet once per families-string
  function ensureFontLink(id, families) {
    if (!families || document.getElementById(id)) return;
    var link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + families + '&display=swap';
    document.head.appendChild(link);
  }

  function applyFontVars(key) {
    var f = fontByKey(key);
    ensureFontLink('sp-font-' + f.key, f.gf);
    var root = document.documentElement.style;
    // Chosen font drives the whole app — body, headings, and the mono/code
    // slots most components reference directly.
    root.setProperty('--font-body', f.stack);
    root.setProperty('--font-heading', f.stack);
    root.setProperty('--font-mono', f.stack);
    root.setProperty('--font-code', f.stack);
  }

  function applyWeightVar(value) {
    document.documentElement.style.setProperty('--fw-base', String(value));
  }

  // --- Restore saved state before first render ---
  var savedScale = localStorage.getItem(SCALE_KEY);
  if (savedScale) {
    document.documentElement.style.setProperty('--text-scale', savedScale);
  }
  var savedTheme = localStorage.getItem(THEME_KEY);
  // Light is the default — dark only when explicitly chosen
  if (savedTheme !== 'dark') {
    document.documentElement.classList.add('light');
    document.body ? document.body.classList.add('light') : document.addEventListener('DOMContentLoaded', function() { document.body.classList.add('light'); });
  }
  var savedFont = localStorage.getItem(FONT_KEY);
  if (savedFont && savedFont !== 'jetbrains') applyFontVars(savedFont);
  var savedWeight = localStorage.getItem(WEIGHT_KEY);
  if (savedWeight) applyWeightVar(savedWeight);

  // --- Cross-frame sync ---
  // The 'storage' event fires when *another* same-origin frame writes to
  // localStorage — the portal shell and every embedded app stay in step.
  var isIframe = false;
  try { isIframe = window.self !== window.top; } catch (e) { isIframe = true; }

  window.addEventListener('storage', function (e) {
    if (e.key === THEME_KEY) {
      if (e.newValue !== 'dark') {
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
    if (e.key === FONT_KEY && e.newValue) applyFontVars(e.newValue);
    if (e.key === WEIGHT_KEY && e.newValue) applyWeightVar(e.newValue);
  });

  // Inside an embed, the TOP window (portal) renders the settings UI from its
  // own copy of this file — rendering here too stacks two trigger tabs. The
  // storage listener above keeps this frame in sync with the portal's panel.
  if (isIframe) return;

  // --- Wait for DOM ---
  function init() {
    // Preload every font choice so the picker buttons preview correctly
    for (var fi = 0; fi < FONTS.length; fi++) {
      ensureFontLink('sp-font-' + FONTS[fi].key, FONTS[fi].gf);
    }

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
    var closeBtn = panel.querySelector('.sp-close');
    var dayBtn   = panel.querySelector('[data-theme="day"]');
    var nightBtn = panel.querySelector('[data-theme="night"]');
    var sizeBtns = panel.querySelectorAll('.sp-size-btn');
    var fontBtns = panel.querySelectorAll('.sp-font-btn');
    var weightBtns = panel.querySelectorAll('.sp-weight-btn');
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
      if (theme === 'light') {
        document.documentElement.classList.add('light');
        document.body.classList.add('light');
        if (meta) meta.content = '#f8fafc';
        dayBtn.classList.add('active');
        nightBtn.classList.remove('active');
      } else {
        document.documentElement.classList.remove('light');
        document.body.classList.remove('light');
        if (meta) meta.content = '#080a0f';
        nightBtn.classList.add('active');
        dayBtn.classList.remove('active');
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
      return document.body.classList.contains('light') ? 'light' : 'dark';
    }

    dayBtn.addEventListener('click', function () { applyTheme('light'); });
    nightBtn.addEventListener('click', function () { applyTheme('dark'); });

    // Sync initial state
    if (getCurrentTheme() === 'light') {
      dayBtn.classList.add('active');
      nightBtn.classList.remove('active');
    } else {
      nightBtn.classList.add('active');
      dayBtn.classList.remove('active');
    }

    // --- Text Size Control ---
    function applyScale(value) {
      document.documentElement.style.setProperty('--text-scale', value);
      localStorage.setItem(SCALE_KEY, value);

      for (var i = 0; i < sizeBtns.length; i++) {
        var btn = sizeBtns[i];
        if (parseFloat(btn.dataset.scale) === parseFloat(value)) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }

      if (preview) preview.style.fontSize = 'var(--size-base)';
      window.dispatchEvent(new CustomEvent('text-scale-change', { detail: { scale: value } }));
    }

    for (var i = 0; i < sizeBtns.length; i++) {
      sizeBtns[i].addEventListener('click', function () {
        applyScale(this.dataset.scale);
      });
    }

    // --- Font Control ---
    function applyFont(key) {
      applyFontVars(key);
      localStorage.setItem(FONT_KEY, key);
      for (var i = 0; i < fontBtns.length; i++) {
        fontBtns[i].classList.toggle('active', fontBtns[i].dataset.font === key);
      }
      window.dispatchEvent(new CustomEvent('font-change', { detail: { font: key } }));
    }

    for (var i = 0; i < fontBtns.length; i++) {
      fontBtns[i].addEventListener('click', function () {
        applyFont(this.dataset.font);
      });
    }

    // --- Text Weight Control ---
    function applyWeight(value) {
      applyWeightVar(value);
      localStorage.setItem(WEIGHT_KEY, String(value));
      for (var i = 0; i < weightBtns.length; i++) {
        weightBtns[i].classList.toggle('active', parseInt(weightBtns[i].dataset.weight, 10) === parseInt(value, 10));
      }
    }

    for (var i = 0; i < weightBtns.length; i++) {
      weightBtns[i].addEventListener('click', function () {
        applyWeight(this.dataset.weight);
      });
    }

    // Restore saved choices into the UI
    applyScale(parseFloat(localStorage.getItem(SCALE_KEY) || '1'));
    applyFont(localStorage.getItem(FONT_KEY) || 'jetbrains');
    applyWeight(parseInt(localStorage.getItem(WEIGHT_KEY) || '500', 10));

    // --- Save ---
    saveBtn.addEventListener('click', function () {
      // Settings are already persisted to localStorage on each change,
      // but the save button gives explicit confirmation.
      localStorage.setItem(THEME_KEY, getCurrentTheme());
      localStorage.setItem(SCALE_KEY, document.documentElement.style.getPropertyValue('--text-scale') || '1');
      localStorage.setItem(FONT_KEY, localStorage.getItem(FONT_KEY) || 'jetbrains');
      localStorage.setItem(WEIGHT_KEY, localStorage.getItem(WEIGHT_KEY) || '500');
      saveBtn.textContent = 'Saved as default!';
      saveBtn.classList.add('saved');
      setTimeout(function () {
        saveBtn.textContent = 'Save as my default';
        saveBtn.classList.remove('saved');
      }, 1500);
    });

    // --- Reset ---
    resetBtn.addEventListener('click', function () {
      applyTheme('light'); // light is the platform default
      applyScale(1);
      applyFont('jetbrains');
      applyWeight(500);
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
      var newToggle = legacyToggle.cloneNode(true);
      legacyToggle.parentNode.replaceChild(newToggle, legacyToggle);
      newToggle.addEventListener('click', function () {
        applyTheme(getCurrentTheme() === 'light' ? 'dark' : 'light');
      });
    }

    var legacyToggleNav = document.getElementById('theme-toggle-nav');
    if (legacyToggleNav) {
      var newToggleNav = legacyToggleNav.cloneNode(true);
      legacyToggleNav.parentNode.replaceChild(newToggleNav, legacyToggleNav);
      newToggleNav.addEventListener('click', function () {
        applyTheme(getCurrentTheme() === 'light' ? 'dark' : 'light');
      });
    }
  }

  function buildPanelHTML() {
    var scaleHTML = '';
    for (var i = 0; i < SCALES.length; i++) {
      scaleHTML += '<button class="sp-size-btn" data-scale="' + SCALES[i].value +
        '" aria-label="Text size ' + SCALES[i].label + '">' + SCALES[i].label + '</button>';
    }

    var fontHTML = '';
    for (var f = 0; f < FONTS.length; f++) {
      fontHTML += '<button class="sp-font-btn" data-font="' + FONTS[f].key +
        '" style="font-family:' + FONTS[f].stack.replace(/"/g, '&quot;') + '"' +
        ' aria-label="Font ' + FONTS[f].label + '">' +
        '<span class="sp-font-name">' + FONTS[f].label + '</span>' +
        '<span class="sp-font-hint">' + FONTS[f].hint + '</span>' +
        '</button>';
    }

    var weightHTML = '';
    for (var w = 0; w < WEIGHTS.length; w++) {
      weightHTML += '<button class="sp-weight-btn" data-weight="' + WEIGHTS[w].value +
        '" style="font-weight:' + WEIGHTS[w].value + '"' +
        ' aria-label="Text weight ' + WEIGHTS[w].label + '">' + WEIGHTS[w].label + '</button>';
    }

    return '' +
      '<h3>Display Settings <button class="sp-close" aria-label="Close settings">&times;</button></h3>' +

      '<div class="sp-section">' +
        '<span class="sp-label">Theme</span>' +
        '<div class="sp-theme-row">' +
          '<button class="sp-theme-btn" data-theme="day" aria-label="Day theme">' +
            '&#9788; Day' +
          '</button>' +
          '<button class="sp-theme-btn" data-theme="night" aria-label="Night theme">' +
            '&#9790; Night' +
          '</button>' +
        '</div>' +
      '</div>' +

      '<div class="sp-section">' +
        '<span class="sp-label">Font</span>' +
        '<div class="sp-font-col">' + fontHTML + '</div>' +
      '</div>' +

      '<div class="sp-section">' +
        '<span class="sp-label">Text Size</span>' +
        '<div class="sp-size-row">' + scaleHTML + '</div>' +
      '</div>' +

      '<div class="sp-section">' +
        '<span class="sp-label">Text Weight</span>' +
        '<div class="sp-weight-row">' + weightHTML + '</div>' +
        '<div class="sp-preview">The quick brown fox jumps over the lazy dog. 0123456789</div>' +
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
        '<button class="sp-save" aria-label="Save settings as default">Save as my default</button>' +
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
