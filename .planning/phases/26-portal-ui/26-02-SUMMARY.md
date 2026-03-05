---
phase: 26-portal-ui
plan: 02
subsystem: glomalin-portal
tags: [dashboard, module-cards, dynamic-routes, server-component, supabase, rbac]
dependency_graph:
  requires: [26-01, 25-02, 25-04]
  provides: [dashboard-ui, module-shell-pages]
  affects: [glomalin-portal]
tech_stack:
  added: []
  patterns: [server-component-data-fetch, dynamic-route-segments, conditional-rendering]
key_files:
  created:
    - glomalin-portal/src/app/(protected)/app/[module]/page.tsx
  modified:
    - glomalin-portal/src/app/(protected)/dashboard/page.tsx
decisions:
  - Dashboard fetches module_access server-side and builds a Set<string> for O(1) granted lookup — avoids passing auth state as props
  - Inaccessible cards use plain div (not Link) to prevent navigation — opacity-40 + cursor-not-allowed gives clear visual feedback
  - Module shell uses async params pattern (Promise<{module: string}>) for Next.js 14 App Router compatibility
  - notFound() called for unrecognized slugs rather than fallback UI — 404 is the correct response for invalid module paths
metrics:
  duration_seconds: 110
  completed_date: "2026-03-05"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 26 Plan 02: Dashboard + Module Shell Pages Summary

**One-liner:** Access-aware module card dashboard with server-side Supabase grant checks and dynamic /app/[module] shell pages returning 404 for unknown slugs.

## What Was Built

### Task 1: Dashboard page with access-aware module cards (commit 349046f)

Rewrote `src/app/(protected)/dashboard/page.tsx` as a server component that:

- Calls `supabase.auth.getUser()` then queries `module_access` table for the authenticated user
- Builds a `Set<string>` of granted module IDs for O(1) access lookup
- Renders all 5 modules from the `MODULES` array in a responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` grid
- Accessible modules: wrapped in Next.js `<Link>` with hover accent border, arrow icon, and "Coming Soon" green badge
- Inaccessible modules: plain `<div>` (not clickable), `opacity-40 cursor-not-allowed`, lock icon SVG, "No Access" label

### Task 2: Dynamic module shell pages (commit 77cbfaa)

Created `src/app/(protected)/app/[module]/page.tsx` as a server component that:

- Extracts `params.module` slug via `await params` (Next.js 14 async params pattern)
- Looks up module in `MODULES` array by `id` match
- Calls `notFound()` for unrecognized slugs (proper 404 response)
- Renders a centered shell: hexagon-style SVG icon, module label (text-3xl), sublabel, horizontal divider, "Coming Soon" accent badge, "Back to Dashboard" link

## Verification

- `npx next build` completes without errors
- `/dashboard` route is server-rendered (ƒ), 176 B bundle
- `/app/[module]` route is server-rendered (ƒ), 176 B bundle
- All 5 module routes map correctly: macro-rollup, farm-registry, org-cert, inputs-seeds, fsa-reporting
- Admin panel at `/admin` unchanged from Phase 25 (UI-03 already complete)
- File line counts: dashboard 113 lines (min 40), module shell 64 lines (min 20)

## Deviations from Plan

None — plan executed exactly as written.

## Key Links Verified

- `dashboard/page.tsx` → `module_access` table via `supabase.from('module_access').select('module, granted').eq('user_id', user.id)`
- `dashboard/page.tsx` → `@/lib/modules` via `import { MODULES } from '@/lib/modules'`
- `app/[module]/page.tsx` → `@/lib/modules` via `import { MODULES } from '@/lib/modules'`

## Requirements Satisfied

- UI-02: Dashboard module cards with access-based rendering
- UI-03: Admin panel (already built in Phase 25, unchanged)
- UI-04: Module shell pages at /app/[module]
