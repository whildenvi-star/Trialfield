/* ──────────────────────────────────────────────────────────────────────
   THEME BOOT — pre-paint theme + text restore
   Canonical source: shared/platform/theme-boot.js
   Copied into each app's public/ by scripts/sync-shared.sh — DO NOT EDIT
   THE COPIES. Edit here, run `scripts/sync-shared.sh`, commit both.

   Loaded as a BLOCKING script in <head>, before any stylesheet-dependent
   paint, so the saved theme is on the element before the first frame.
   That is the whole job: without it the page paints one theme and then
   swaps, which is the flash this file exists to prevent.

   It must agree with settings-panel.js about the default. Both read
   DEFAULT_THEME below — the panel imports nothing, so the two constants
   are kept identical by sync-shared.sh's --check.

   Per-app configuration — set on window BEFORE this script tag:
     window.__SP_THEME_KEY  storage key      (default 'mru-theme')
     window.__THEME_EXTRA   extra body theme (e.g. 'harvest')
   ────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* The one place the platform default lives. Flip this and run
     scripts/sync-shared.sh to change it everywhere at once. */
  var DEFAULT_THEME = 'light';

  var KEY    = window.__SP_THEME_KEY || 'mru-theme';
  var EXTRA  = window.__THEME_EXTRA || null;
  var root   = document.documentElement;

  /* localStorage throws in some privacy modes — a missing preference is
     not an error, it just means the default applies. */
  function read(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }

  var theme = read(KEY) || DEFAULT_THEME;

  /* 'light-pending' rides on <html> because <body> does not exist yet.
     The inline transfer script at the top of <body> moves it across;
     keeping the class off <body> until then avoids a reflow. */
  if (theme === 'light') {
    root.classList.add('light-pending');
  } else if (EXTRA && theme === EXTRA) {
    root.classList.add(EXTRA + '-pending');
  }

  var scale = read('mru-text-scale');
  if (scale) root.style.setProperty('--text-scale', scale);

  var weight = read('mru-font-weight');
  if (weight) root.style.setProperty('--fw-base', weight);

  /* The portal embeds these apps in same-origin iframes; app chrome that
     would duplicate the portal's own is hidden off this class. */
  if (window !== window.top) root.classList.add('in-iframe');
})();
