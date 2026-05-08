/* ============================================================
   FORMATTING AGENT — Live Readability Monitor
   Runs client-side, monitors contrast, font size, overflow,
   and line length. Reports score to settings panel.
   ============================================================ */

(function () {
  'use strict';

  // --- Config ---
  var MIN_CONTRAST_RATIO = 4.5;  // WCAG AA normal text
  var MIN_FONT_SIZE_PX   = 10;   // Absolute minimum legible size
  var MAX_LINE_LENGTH_CH  = 100;  // Max readable line length
  var SCAN_INTERVAL_MS    = 3000; // Periodic rescan
  var MAX_ELEMENTS        = 500;  // Cap per scan to avoid jank

  // --- State ---
  var enabled = localStorage.getItem('mru-fmt-agent') !== 'off';
  var lastScore = -1;
  var lastViolations = [];
  var scanning = false;

  // --- Luminance & Contrast ---
  function parseColor(str) {
    if (!str || str === 'transparent' || str === 'rgba(0, 0, 0, 0)') return null;
    var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return null;
  }

  function relativeLuminance(rgb) {
    var rs = rgb.r / 255, gs = rgb.g / 255, bs = rgb.b / 255;
    var r = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
    var g = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
    var b = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(fg, bg) {
    var l1 = relativeLuminance(fg);
    var l2 = relativeLuminance(bg);
    var lighter = Math.max(l1, l2);
    var darker  = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function getEffectiveBg(el) {
    var current = el;
    while (current && current !== document.documentElement) {
      var style = getComputedStyle(current);
      var bg = parseColor(style.backgroundColor);
      if (bg) return bg;
      current = current.parentElement;
    }
    // Fallback to body or document background
    var bodyBg = parseColor(getComputedStyle(document.body).backgroundColor);
    return bodyBg || { r: 8, g: 10, b: 15 }; // --bg default
  }

  // --- Element Selection ---
  function getTextElements() {
    var selector = 'p, span, a, button, td, th, li, label, h1, h2, h3, h4, h5, h6, ' +
                   'input, select, textarea, div, code, pre, small, strong, em';
    var all = document.querySelectorAll(selector);
    var result = [];
    for (var i = 0; i < all.length && result.length < MAX_ELEMENTS; i++) {
      var el = all[i];
      // Skip hidden, settings panel, and elements without visible text
      if (el.offsetParent === null && el.tagName !== 'BODY') continue;
      if (el.closest('.settings-panel, .settings-tab-trigger, .settings-panel-backdrop')) continue;
      // Only check elements with direct text content
      if (el.childNodes.length > 0) {
        var hasText = false;
        for (var c = 0; c < el.childNodes.length; c++) {
          if (el.childNodes[c].nodeType === 3 && el.childNodes[c].textContent.trim().length > 0) {
            hasText = true;
            break;
          }
        }
        if (hasText) result.push(el);
      }
    }
    return result;
  }

  // --- Scan ---
  function scan() {
    if (scanning || !enabled) return;
    scanning = true;

    var violations = [];
    var totalChecks = 0;
    var passedChecks = 0;

    var elements = getTextElements();

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var style = getComputedStyle(el);

      // 1. Font size check
      var fontSize = parseFloat(style.fontSize);
      totalChecks++;
      if (fontSize < MIN_FONT_SIZE_PX) {
        violations.push('Size: ' + fontSize.toFixed(1) + 'px < ' + MIN_FONT_SIZE_PX + 'px on <' +
          el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : '') + '>');
      } else {
        passedChecks++;
      }

      // 2. Contrast check
      var fg = parseColor(style.color);
      var bg = getEffectiveBg(el);
      if (fg && bg) {
        totalChecks++;
        var ratio = contrastRatio(fg, bg);
        if (ratio < MIN_CONTRAST_RATIO) {
          violations.push('Contrast: ' + ratio.toFixed(1) + ':1 < ' + MIN_CONTRAST_RATIO + ':1 on <' +
            el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : '') + '>');
        } else {
          passedChecks++;
        }
      }

      // 3. Overflow check (only block/inline-block elements with defined width)
      if (el.tagName !== 'BODY' && style.display !== 'inline') {
        totalChecks++;
        if (el.scrollWidth > el.clientWidth + 2 && style.overflow !== 'auto' &&
            style.overflow !== 'scroll' && style.overflowX !== 'auto' && style.overflowX !== 'scroll') {
          violations.push('Overflow: ' + el.scrollWidth + 'px > ' + el.clientWidth + 'px on <' +
            el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : '') + '>');
        } else {
          passedChecks++;
        }
      }
    }

    // Calculate score
    var score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

    // Log violations to console
    if (violations.length > 0 && (score !== lastScore || violations.length !== lastViolations.length)) {
      console.group('[FormattingAgent] Readability scan — Score: ' + score + '/100');
      for (var v = 0; v < violations.length; v++) {
        console.warn(violations[v]);
      }
      console.groupEnd();
    }

    // Report to settings panel
    if (window.__settingsPanel && window.__settingsPanel.updateScore) {
      window.__settingsPanel.updateScore(score, violations);
    }

    lastScore = score;
    lastViolations = violations;
    scanning = false;
  }

  // --- Safe Corrections ---
  function autoCorrect() {
    if (!enabled) return;
    // Nudge line-height on tight elements where safe
    var elements = getTextElements();
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var style = getComputedStyle(el);
      var lineHeight = parseFloat(style.lineHeight);
      var fontSize = parseFloat(style.fontSize);

      // If line-height is less than 1.2x font size and not intentionally tight
      if (lineHeight > 0 && fontSize > 0 && (lineHeight / fontSize) < 1.15) {
        if (!el.dataset.fmtOrigLh) {
          el.dataset.fmtOrigLh = style.lineHeight;
          el.style.lineHeight = '1.3';
        }
      }
    }
  }

  // --- Scheduling ---
  function scheduleIdle(fn) {
    if (window.requestIdleCallback) {
      requestIdleCallback(fn, { timeout: 2000 });
    } else {
      setTimeout(fn, 100);
    }
  }

  function runScan() {
    if (!enabled) return;
    scheduleIdle(function () {
      scan();
      autoCorrect();
    });
  }

  // --- Lifecycle ---
  // Initial scan on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(runScan, 500); // Let styles settle
    });
  } else {
    setTimeout(runScan, 500);
  }

  // Periodic rescan
  setInterval(function () {
    if (enabled) runScan();
  }, SCAN_INTERVAL_MS);

  // Re-scan on theme change
  window.addEventListener('theme-change', function () {
    setTimeout(runScan, 200);
  });

  // Re-scan on text scale change
  window.addEventListener('text-scale-change', function () {
    setTimeout(runScan, 200);
  });

  // Re-scan on resize
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(runScan, 300);
  });

  // MutationObserver for DOM changes
  var observer;
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (mutations) {
      // Debounce: only scan if substantial changes
      var dominated = false;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].type === 'childList' && mutations[i].addedNodes.length > 0) {
          dominated = true;
          break;
        }
      }
      if (dominated) {
        setTimeout(runScan, 500);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }

  // Toggle via settings panel
  window.addEventListener('formatting-agent-toggle', function (e) {
    enabled = e.detail.enabled;
    if (enabled) {
      runScan();
    } else {
      // Report disabled state
      if (window.__settingsPanel && window.__settingsPanel.updateScore) {
        window.__settingsPanel.updateScore('--', []);
      }
    }
  });

  // --- Public API ---
  window.FormattingAgent = {
    scan: runScan,
    getScore: function () { return lastScore; },
    getViolations: function () { return lastViolations.slice(); },
    isEnabled: function () { return enabled; },
    enable: function () { enabled = true; runScan(); },
    disable: function () {
      enabled = false;
      if (window.__settingsPanel && window.__settingsPanel.updateScore) {
        window.__settingsPanel.updateScore('--', []);
      }
    }
  };
})();
