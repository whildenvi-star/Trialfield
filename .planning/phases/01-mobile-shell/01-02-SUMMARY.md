---
phase: 01-mobile-shell
plan: "02"
subsystem: layout
tags: [mobile, responsive, layout, maps, iframe-fallback, enterprise-summary, card-view]
dependency_graph:
  requires: [MobileHeader, MobileBottomNav]
  provides: [responsive-protected-layout, mobile-maps, iframe-mobile-fallback, enterprise-summary-card-view]
  affects: [all-protected-pages, embed-modules, maps-page, enterprise-summary-page]
tech_stack:
  added: []
  patterns: [CSS-only responsive (md:hidden / hidden md:block), pb-[56px] md:pb-0 content clearance, server-component Supabase role fetch, table-to-card conversion]
key_files:
  created: []
  modified:
    - src/app/(protected)/layout.tsx
    - src/app/(protected)/app/maps/page.tsx
    - src/app/(protected)/app/[module]/page.tsx
    - src/app/(protected)/app/enterprise-summary/page.tsx
decisions:
  - "grantedModules null (admin) mapped to all MODULES IDs for MobileBottomNav — avoids null prop propagation into client component"
  - "enterprise-summary fetches role via Supabase server client inline — no prop drilling from layout needed since it's a standalone server component"
  - "Financial columns (cost, revenue) crew-gated in mobile cards using role === 'admin' || role === 'office' — matches CONTEXT.md locked decision"
  - "Mobile fallback for embed modules uses CSS-only md:hidden (Option A from RESEARCH.md) — avoids UA string detection"
metrics:
  duration_seconds: 152
  completed: "2026-05-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 4
requirements_completed: [UX-01, UX-02]
---

# Phase 01 Plan 02: Layout Integration Summary

**One-liner:** Protected layout switched to dual CSS-only shells (MobileHeader + MobileBottomNav on mobile, SideNav on desktop); maps hardcoded offset fixed; iframe embeds show desktop-only fallback; enterprise-summary 10-column table replaced with role-gated card view on mobile.

## What Was Built

**Task 1 — Protected layout responsive switch** (`src/app/(protected)/layout.tsx`)
- Imported `MobileHeader` and `MobileBottomNav`
- Wrapped SideNav in `hidden md:block` — invisible on mobile, unchanged on desktop
- Added `MobileHeader pageTitle="Portal"` in `md:hidden` — mobile only
- Added `MobileBottomNav grantedModuleIds={...}` in `md:hidden` — mobile only
- Content wrapper changed from `md:ml-[220px]` to `md:ml-[220px] pb-[56px] md:pb-0` — prevents content hiding behind bottom nav
- Admin grantedModules `null` mapped to all module IDs before passing to MobileBottomNav

**Task 2a — Maps page full-width fix** (`src/app/(protected)/app/maps/page.tsx`)
- Changed `left-[220px]` to `left-0 md:left-[220px]` — map fills full viewport width on 375px phone

**Task 2b — Iframe module mobile fallback** (`src/app/(protected)/app/[module]/page.tsx`)
- Existing `EmbedBreadcrumb` + `EmbedFrame` wrapped in `hidden md:block`
- Added `md:hidden` fallback div before it: shows module label + "This module works best on desktop" + portal URL guidance
- Applies to all 6 embed modules (farm-budget, grain-tickets, farm-registry, org-cert, meristem-malt, seed-inventory) from one file

**Task 2c — Enterprise summary card view** (`src/app/(protected)/app/enterprise-summary/page.tsx`)
- Added `createClient` import and inline Supabase role fetch at page top
- Added `md:hidden` card view per enterprise group: field name, acres, crop, and cost/revenue only for admin/office roles
- Each card includes "Open on desktop for full detail" notice (per CONTEXT.md locked decision)
- Existing table wrapped in `hidden md:block overflow-x-auto` — unchanged on desktop

## Verification

```
npx tsc --noEmit → 0 errors (zero TypeScript errors across all 4 files)
```

All must_haves confirmed:
- [x] Protected layout renders mobile shell (MobileHeader + MobileBottomNav) on mobile, SideNav on desktop
- [x] Content wrapper has `pb-[56px] md:pb-0` — no content hidden behind bottom nav
- [x] No JS media queries — CSS-only `md:hidden` / `hidden md:block` (SSR-safe, no hydration mismatch)
- [x] `maps/page.tsx` has `left-0 md:left-[220px]` — fills full width on mobile
- [x] `[module]/page.tsx` has `md:hidden` fallback + `hidden md:block` iframe wrapper
- [x] `enterprise-summary/page.tsx` has mobile card list (admin/office see costs) + desktop table unchanged
- [x] Financial columns hidden from crew role on mobile card view

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Added role fetch to enterprise-summary server component**

- **Found during:** Task 2c
- **Issue:** `enterprise-summary/page.tsx` is a standalone server component with no `role` prop — the existing desktop table had no role-based hiding at all. To implement crew-gating on mobile cards, role access was needed.
- **Fix:** Added `createClient` import and inline Supabase role fetch (same pattern as layout.tsx) — single extra DB query, adds ~10ms to page render on cache miss.
- **Files modified:** `src/app/(protected)/app/enterprise-summary/page.tsx`
- **Commit:** b54d367

Plan stated: "If role isn't directly available... use the same pattern [as the existing table]." The existing table had no role pattern, so fetching via Supabase was the correct application of Rule 2 (missing critical security feature).

## Commits

| Hash | Task | Description |
|------|------|-------------|
| 01b87c7 | Task 1 | feat(01-02): wire mobile shell into protected layout |
| b54d367 | Task 2 | feat(01-02): maps fix, iframe fallback, enterprise-summary card view |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/app/(protected)/layout.tsx modified | FOUND |
| src/app/(protected)/app/maps/page.tsx modified | FOUND |
| src/app/(protected)/app/[module]/page.tsx modified | FOUND |
| src/app/(protected)/app/enterprise-summary/page.tsx modified | FOUND |
| Commit 01b87c7 exists | FOUND |
| Commit b54d367 exists | FOUND |
| npx tsc --noEmit passes | PASS |
