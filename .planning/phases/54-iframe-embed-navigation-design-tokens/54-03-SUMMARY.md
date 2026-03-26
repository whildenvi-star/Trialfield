---
phase: 54-iframe-embed-navigation-design-tokens
plan: "03"
subsystem: embed-theme-sync
tags: [postMessage, theme-sync, cross-origin, iframe, organic-cert]
dependency_graph:
  requires: []
  provides: [cross-origin-theme-sync]
  affects: [glomalin-portal, organic-cert]
tech_stack:
  added: []
  patterns: [postMessage for cross-origin iframe theme push, storage event for same-origin theme detection]
key_files:
  created: []
  modified:
    - glomalin-portal/src/components/embed-frame.tsx
    - organic-cert/src/app/layout.tsx
decisions:
  - postMessage uses '*' origin wildcard — cosmetic-only message, namespaced by type field, safe for dev/prod flexibility
  - theme-change custom event also covered alongside storage event — belt-and-suspenders for all toggle paths
  - message listener guarded by window!==window.top — standalone organic-cert never registers the listener
metrics:
  duration: "~8 minutes"
  completed: 2026-03-26
  tasks: 2
  files: 2
---

# Phase 54 Plan 03: Cross-Origin iframe Theme Sync Summary

Portal EmbedFrame now pushes day/night theme to all embedded apps via postMessage; organic-cert listens and applies .light class in real-time when embedded.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add postMessage theme sync to portal EmbedFrame | 270bfa9 | glomalin-portal/src/components/embed-frame.tsx |
| 2 | Add postMessage theme listener to organic-cert | 2028e09 | organic-cert/src/app/layout.tsx |

## What Was Built

### Task 1 — EmbedFrame postMessage push

`embed-frame.tsx` was updated to:
- Add `iframeRef` (useRef) attached to the `<iframe>` element
- Add `getCurrentTheme()` helper that reads `localStorage.getItem('mru-theme')`
- `handleLoad()` replaces the `onLoad` inline: after load, immediately send `{ type: 'glomalin-theme', theme }` to the iframe
- `useEffect` registers two listeners:
  - `storage` event on `mru-theme` key — catches portal settings-panel writing to localStorage
  - Custom `theme-change` event — catches dispatched events from settings-panel.js
- Both listeners call `sendThemeToIframe()` which uses `iframeRef.current?.contentWindow?.postMessage(..., '*')`
- Same-origin embeds receive postMessage redundantly (harmless) — localStorage event still fires on those too

### Task 2 — organic-cert message listener

`layout.tsx` inline script was extended. The existing block:
```
if(window!==window.top) document.documentElement.classList.add('in-iframe');
```
was expanded to also register a `message` event listener inside the `if(window!==window.top)` guard:
- Filters on `e.data.type === 'glomalin-theme'`
- Adds `.light` to both `document.documentElement` and `document.body` on `theme === 'light'`
- Removes `.light` from both on any other value
- Listener only registered when inside an iframe — standalone cert.whughesfarms.com is unaffected

## Decisions Made

- **postMessage origin `'*'`**: The theme action is purely cosmetic; messages are namespaced by `type: 'glomalin-theme'` to avoid conflicts; portal origin varies between dev/prod — wildcard is safe here
- **Dual event listeners**: Both `storage` and custom `theme-change` events are covered to ensure all paths through settings-panel.js trigger the postMessage push
- **`window !== window.top` guard**: Keeps organic-cert clean in standalone use; no console noise, no listener overhead

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` in glomalin-portal: embed-frame.tsx has zero errors (pre-existing errors in other files are out of scope)
- `npx tsc --noEmit` in organic-cert: layout.tsx has zero errors
- `grep -c "glomalin-theme" organic-cert/src/app/layout.tsx` returns 1

## Self-Check: PASSED

- glomalin-portal/src/components/embed-frame.tsx — FOUND (modified)
- organic-cert/src/app/layout.tsx — FOUND (modified)
- Commit 270bfa9 — FOUND in git log
- Commit 2028e09 — FOUND in organic-cert git log
