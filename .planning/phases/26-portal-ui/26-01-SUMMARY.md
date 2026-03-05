---
phase: 26-portal-ui
plan: "01"
subsystem: glomalin-portal
tags: [react-flow, landing-page, node-map, ui, dark-soil]
dependency_graph:
  requires: [25-04]
  provides: [public-landing-page, farm-node-map-component]
  affects: [glomalin-portal]
tech_stack:
  added: ["@xyflow/react"]
  patterns: [hub-and-spoke-layout, animated-edges, hover-tooltip, client-component-in-server-wrapper]
key_files:
  created:
    - glomalin-portal/src/components/farm-node-map.tsx
  modified:
    - glomalin-portal/src/app/page.tsx
    - glomalin-portal/src/app/globals.css
    - glomalin-portal/package.json
decisions:
  - "@xyflow/react Background component used for subtle dot grid; tooltips use fixed positioning to track cursor"
  - "Source app edges use soil-border color (#3a3020); portal module edges use accent color (#C8860A at 0.5 opacity) to distinguish data sources from portal views"
  - "nodeLabel() helper renders dual-line labels (label + sublabel) as ReactNode inline since React Flow accepts ReactNode for data.label"
  - "onNodeMouseMove handler added alongside onNodeMouseEnter so tooltip tracks cursor within large nodes"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-05"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 26 Plan 01: Landing Page Node Map Summary

React Flow hub-and-spoke node map on the public landing page — 12 nodes (1 center hub, 6 source apps, 5 portal modules) with 11 animated amber-glow edges and hover tooltips on a dark soil background.

## What Was Built

### FarmNodeMap Component (`glomalin-portal/src/components/farm-node-map.tsx`)
- 274-line 'use client' React Flow component
- Hub-and-spoke layout using `Math.cos/sin` to distribute nodes in polar coordinates
  - Center hub "GLOMALIN" at (420, 320) — 160px wide, 2px accent border
  - 6 source apps in outer ring, radius 290, 60° apart clockwise from top
  - 5 portal modules in inner ring, radius 150, 72° apart starting at 36°
- 11 animated edges: source apps use `#3a3020` stroke, portal modules use `#C8860A` at 0.5 opacity
- Hover tooltip: fixed-position div tracking cursor via `onNodeMouseEnter` + `onNodeMouseMove` + `onNodeMouseLeave`
- `fitView`, no drag/zoom/pan — fully static viewing experience
- React Flow Background component with dark dot grid (#1a1410, 32px gap)

### Landing Page (`glomalin-portal/src/app/page.tsx`)
- Server component wrapper with FarmNodeMap as client child
- GLOMALIN title (text-5xl, tracking-widest, soil-accent, font-mono) + "Farm Operations Portal" subtitle
- Sign In link top-right linking to /login (soil-muted, hover:soil-accent)
- FarmNodeMap in flex-1 container with min-h-[600px]

### Global CSS (`glomalin-portal/src/app/globals.css`)
- `.react-flow__edge-path { filter: drop-shadow(0 0 3px rgba(200, 134, 10, 0.3)); }` — ambient amber glow
- `.react-flow__edge.animated path { animation-duration: 3s; }` — slowed dash animation for ambient feel

## Verification

- Next.js build: PASSED (no errors, 11 routes generated)
- Root route `/` is static (○) — prerendered, accessible without authentication
- 12 nodes confirmed: hub + 6 SOURCE_APPS array entries + 5 PORTAL_MODULES array entries
- 11 animated edges confirmed: 2 animated forEach blocks (6 + 5)
- `@xyflow/react` import, CSS import, hover tooltip handlers all verified
- Sign In link and FarmNodeMap import in page.tsx confirmed

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 3aa3d5b | feat(26-01): install @xyflow/react and create FarmNodeMap component |
| 2 | 3719d63 | feat(26-01): replace landing page placeholder with React Flow node map |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| farm-node-map.tsx exists | FOUND |
| page.tsx exists | FOUND |
| globals.css exists | FOUND |
| 26-01-SUMMARY.md exists | FOUND |
| Commit 3aa3d5b exists | FOUND |
| Commit 3719d63 exists | FOUND |
| @xyflow/react in package.json | FOUND (^12.10.1) |
| farm-node-map.tsx >= 80 lines | 274 lines — PASS |
| page.tsx >= 10 lines | 31 lines — PASS |
