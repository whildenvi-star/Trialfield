---
phase: 14-add-chat-agent-for-system-information-and-recall
plan: 02
subsystem: frontend
tags: [vanilla-js, iife, sse, streaming, chart.js, markdown, csv, drag-drop, chat-widget]

# Dependency graph
requires:
  - phase: 14-01
    provides: /api/agent/chat SSE endpoint, /api/agent/status daily cap endpoint, GLOMALIN_ENABLED server injection

provides:
  - grain-tickets/public/glomalin.js — self-contained IIFE floating chat widget (763 lines)
  - grain-tickets/public/glomalin.css — themed styles for widget (639 lines)
  - grain-tickets/public/chart.min.js — Chart.js 4.x UMD (local, offline-safe)
  - grain-tickets/public/index.html updated with glomalin.css link + chart.min.js + glomalin.js script tags

affects:
  - 14-03 (admin notes UI if planned — builds on same widget or standalone page)

# Tech tracking
tech-stack:
  added:
    - Chart.js 4.x UMD (downloaded locally to chart.min.js, no npm package)
  patterns:
    - IIFE kill-switch guard pattern (if !window.GLOMALIN_ENABLED return)
    - Buffer-based SSE parsing (split on \n\n, keep incomplete tail)
    - Throttled streaming render (100ms setInterval to avoid DOM thrashing)
    - Hand-rolled markdown renderer (no libraries — bold, italic, tables, lists, headers, code blocks)
    - chartjs code block -> canvas instantiation via setTimeout for post-DOM-insertion
    - csv code block -> Blob download + 3-row preview table
    - Deep link navigation via window._glomalinNav() callback
    - ASCII art tractor animation with 3-frame setInterval at 300ms

key-files:
  created:
    - grain-tickets/public/glomalin.js
    - grain-tickets/public/glomalin.css
    - grain-tickets/public/chart.min.js
  modified:
    - grain-tickets/public/index.html

key-decisions:
  - "Hand-rolled markdown renderer chosen over marked.js/showdown — plan spec required no library, and the feature set is bounded (bold, italic, tables, lists, headers, code, links)"
  - "Chart.js downloaded via curl to chart.min.js — farm office may have unreliable internet; no CDN dependency"
  - "defer attribute on chart.min.js and glomalin.js — correct load order guaranteed by DOM position without blocking HTML parse"
  - "100ms throttled render during streaming — prevents DOM thrashing on fast text deltas without noticeable lag"
  - "window._glomalinNav global for deep link navigation — avoids tight coupling to app module internals"
  - "conversationHistory.slice(-20) sliding window — matches research pitfall 3 recommendation, avoids token overflow"

patterns-established:
  - "IIFE guard: if (!window.GLOMALIN_ENABLED) return; at top of script — single check, zero DOM if disabled"
  - "Buffer tail: buffer += decoded chunk; parts = buffer.split('\n\n'); buffer = parts.pop() — handles split SSE events across TCP chunks"
  - "Chart instantiation: setTimeout 50ms after DOM insertion — reliable across all browsers without MutationObserver"

requirements-completed: [CHT-01, CHT-02, AGT-01, AGT-04]

# Metrics
duration: 7min
completed: 2026-03-02
---

# Phase 14 Plan 02: Glomalin Chat Widget Frontend Summary

**Glomalin chat widget: self-contained IIFE with SSE streaming, ASCII tractor loading animation, hand-rolled markdown renderer, inline Chart.js charts, CSV export, deep links, drag/resize popup, and local Chart.js bundle**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-02T23:20:51Z
- **Completed:** 2026-03-02T23:27:41Z
- **Tasks:** 2 of 2
- **Files modified:** 4

## Accomplishments

- Built `glomalin.js` — 763-line self-contained IIFE with GLOMALIN_ENABLED kill-switch, floating tractor SVG button, draggable/resizable popup, SSE streaming reader, ASCII tractor animation, full markdown rendering pipeline
- Built `glomalin.css` — 639-line stylesheet covering dark and light themes, all widget components, responsive mobile breakpoint (near-fullscreen < 600px)
- Downloaded Chart.js 4.x UMD (208KB) to `chart.min.js` locally — no CDN dependency for offline farm office use
- Updated `index.html` with correct loading order: glomalin.css link, chart.min.js (defer), glomalin.js (defer)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create glomalin.js floating chat widget and glomalin.css styles** - `019a3f8` (feat)
2. **Task 2: Wire widget into index.html and download Chart.js locally** - `c3d6689` (feat)

## Files Created/Modified

- `grain-tickets/public/glomalin.js` — IIFE widget (763 lines): button, popup, drag, SSE, markdown, charts, CSV, deep links, daily cap
- `grain-tickets/public/glomalin.css` — Widget styles (639 lines): dark/light themes, responsive, all component selectors
- `grain-tickets/public/chart.min.js` — Chart.js 4.x UMD bundle (208KB, local copy)
- `grain-tickets/public/index.html` — Added glomalin.css link + chart.min.js + glomalin.js script tags

## Key Technical Decisions

- **Hand-rolled markdown renderer** — Plan required no library. The bounded feature set (bold, italic, tables, lists, headers, code blocks, links) was implemented with regex patterns and a code-block extraction/restoration approach to protect fenced blocks from inline processing
- **Local Chart.js copy** — Downloaded to `chart.min.js` via curl during plan execution. Farm office internet may be unreliable; CDN failure would silently break chart rendering. The widget has a `if (!window.Chart)` guard that degrades gracefully
- **defer loading order** — `chart.min.js` and `glomalin.js` both use `defer`. Since chart.min.js appears first in DOM order, it executes before glomalin.js. This ensures `window.Chart` is defined when the widget renders chart blocks
- **Throttled streaming render** — Text deltas are accumulated in `currentFullText` and re-rendered to HTML every 100ms via a timer. This prevents DOM thrashing on fast Claude Haiku responses while keeping visible latency under 100ms
- **window._glomalinNav** — Deep link handler is assigned as a global rather than injected as an event listener on click, avoiding tight coupling to the DOM structure of the app modules. Any future refactor of app.js doesn't break chat deep links
- **ASCII tractor frames** — 3-frame cycling animation at 300ms matches the plan specification. The exhaust `~~` characters cycle left/right to give a puffing exhaust effect while the tractor body stays static

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Chart.js downloaded cleanly. All 26 automated verification checks passed on first run.

## Next Phase Readiness

- Complete Glomalin system: backend API (Plan 01) + frontend widget (Plan 02) are both live
- Farm manager can now click the tractor button, ask grain data questions, and see streaming responses
- Phase 14 Plan 03 (if planned) — AgentNote admin UI — can build independently or be skipped
- No blockers

## Self-Check: PASSED

All created files exist on disk. Both task commits verified in git log.

| Check | Result |
|-------|--------|
| grain-tickets/public/glomalin.js | FOUND |
| grain-tickets/public/glomalin.css | FOUND |
| grain-tickets/public/chart.min.js | FOUND |
| grain-tickets/public/index.html | FOUND |
| 14-02-SUMMARY.md | FOUND |
| Commit 019a3f8 | FOUND |
| Commit c3d6689 | FOUND |

---
*Phase: 14-add-chat-agent-for-system-information-and-recall*
*Completed: 2026-03-02*
