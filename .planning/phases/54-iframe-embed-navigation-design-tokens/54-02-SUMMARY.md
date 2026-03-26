---
phase: 54-iframe-embed-navigation-design-tokens
plan: 02
subsystem: glomalin-portal
tags: [navigation, ux, breadcrumb, embed, iframe]
dependency_graph:
  requires: []
  provides: [embed-breadcrumb-component, embed-navigation-context]
  affects: [glomalin-portal/embed-pages]
tech_stack:
  added: []
  patterns: [fixed-position-breadcrumb, css-variable-layout-coordinates]
key_files:
  created:
    - glomalin-portal/src/components/embed-breadcrumb.tsx
  modified:
    - glomalin-portal/src/components/embed-frame.tsx
    - glomalin-portal/src/app/(protected)/app/[module]/page.tsx
    - glomalin-portal/src/app/globals.css
key_decisions:
  - EmbedBreadcrumb uses fixed positioning (not sticky) to escape the layout.tsx main wrapper — same escape mechanism as EmbedFrame
  - CSS variable --embed-breadcrumb-h set to 36px in globals.css :root — single definition point referenced by both breadcrumb and EmbedFrame top calc
  - moduleSublabel prop accepted but not rendered in breadcrumb bar — kept in interface for future use (e.g. tooltip)
  - Breadcrumb only rendered when embedUrl is present — "not configured" fallback still shows plain Back to Dashboard link
metrics:
  duration: ~15 minutes
  tasks_completed: 2
  files_modified: 4
  completed_date: 2026-03-26
---

# Phase 54 Plan 02: Embed Breadcrumb Navigation Summary

EmbedBreadcrumb component added to all portal iframe embeds showing persistent "Dashboard > Module Name" path and "Back to Dashboard" button above every embedded Express app.

## What Was Built

### EmbedBreadcrumb component (`embed-breadcrumb.tsx`)
- Slim fixed-position bar (36px height) anchored at `top: var(--portal-header-h, 56px)`
- Left side: "Dashboard" accent link > chevron > current module label in text color
- Right side: left-arrow SVG + "Back to Dashboard" muted link with accent hover transition
- Full-width with `px-4 sm:px-6` horizontal padding matching portal chrome
- `border-b border-glomalin-border` bottom border, `bg-glomalin-surface` background
- `z-index: 40` to stack above iframe content

### EmbedFrame top offset update (`embed-frame.tsx`)
- `top` CSS updated from `var(--portal-header-h, 56px)` to `calc(var(--portal-header-h, 56px) + var(--embed-breadcrumb-h, 36px))`
- Iframe now starts at 92px (56 + 36) leaving room for both portal header and breadcrumb bar

### Module page integration (`[module]/page.tsx`)
- `EmbedBreadcrumb` imported and rendered above `EmbedFrame` in a fragment
- Only rendered for `mod.type === 'embed'` paths — native modules (fsa-578, insurance, claims, macro-rollup) are unaffected
- Passes `moduleLabel={mod.label}` and `moduleSublabel={mod.sublabel}` as props

### CSS variable (`globals.css`)
- `--embed-breadcrumb-h: 36px` added to `:root` inside `@layer base`
- Referenced by both the breadcrumb bar height and the EmbedFrame top calc

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `glomalin-portal/src/components/embed-breadcrumb.tsx` created
- [x] `glomalin-portal/src/components/embed-frame.tsx` updated (top calc)
- [x] `glomalin-portal/src/app/(protected)/app/[module]/page.tsx` updated (breadcrumb import + render)
- [x] `glomalin-portal/src/app/globals.css` updated (--embed-breadcrumb-h)
- [x] Task 1 commit: 80ad7e0
- [x] Task 2 commit: 7a1cd44
- [x] Zero new TypeScript errors introduced (4 pre-existing errors in unrelated files unchanged)
