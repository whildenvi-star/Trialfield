---
phase: 57-grain-marketing-position
plan: 02
subsystem: ui, marketing
tags: [marketing, grain-contracts, cbot, position-table, react, next-js, typescript]

# Dependency graph
requires:
  - phase: 57-01
    provides: grain_contracts table, CRUD API, CBOT price endpoint, GrainContract/CbotPrice/MarketingPosition types
  - phase: 52-yield-pipeline
    provides: /api/yield-summaries endpoint (grain-tickets port 3007) for estimated production totals

provides:
  - /app/marketing page with SSR grain contracts + CBOT prices + yield summaries
  - MarketingWorkspace component: header, price source badge, offline warning, Add Contract button
  - PositionTable component: per-crop position summary with expandable contract rows
  - ContractDrawer component: create/edit slide-out form for all six contract types

affects:
  - portal navigation (marketing module now has a working page)
  - 60-settlement-summary (contracts visible, position baseline established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled SSR: page loads grain_contracts + CBOT prices + yield summaries in parallel; works when grain-tickets offline"
    - "computePositions: registry_crop_id-preferred grouping with crop-name fallback; shared between SSR (page.tsx) and client-side refresh (marketing-workspace.tsx)"
    - "Expand-in-table pattern: click crop row to expand inline mini-table of individual contracts (Edit/Delete per row)"
    - "ContractDrawer conditional fields: contract type drives which of price/basis/futures fields are shown/required"
    - "Crop autocomplete: fetch from farm-registry /api/crops/autocomplete; graceful fallback to free-text"

key-files:
  created:
    - glomalin-portal/src/app/(protected)/app/marketing/page.tsx
    - glomalin-portal/src/components/marketing/marketing-workspace.tsx
    - glomalin-portal/src/components/marketing/position-table.tsx
    - glomalin-portal/src/components/marketing/contract-drawer.tsx
  modified: []

key-decisions:
  - "computePositions duplicated in page.tsx (SSR) and marketing-workspace.tsx (client refresh) — same logic, different contexts; avoids shared import complications"
  - "yieldSummaries not refetched client-side — loaded at SSR page load, stable during session; grain-tickets data doesn't change mid-session"
  - "CBOT Refresh Prices button calls /api/marketing/cbot-prices with cache:'no-store' — bypasses 15min revalidate for manual refresh"
  - "Map.entries() iterated via Array.from() — tsconfig target compatibility with downlevelIteration not required"
  - "Unpriced Exposure threshold coloring: yellow above $100k per crop, above $500k for total row"

patterns-established:
  - "marketing-position-compute: group by registry_crop_id OR crop name, merge yield+contracts+cbot, floor unpriced at 0"
  - "contract-drawer-conditional: showPrice/showBasis/showFutures helper functions per ContractType for clean conditional rendering"

requirements-completed: [MKT-01, MKT-02, MKT-03]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 57 Plan 02: Grain Marketing Position UI Summary

**Per-crop position table (Est. Production / Contracted / Unpriced / CBOT Exposure) + contract entry drawer for all six grain contract types, with graceful grain-tickets offline handling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T17:23:03Z
- **Completed:** 2026-03-29T17:27:45Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

- SSR marketing page loads grain contracts from Supabase, CBOT futures prices from internal API, and grain-tickets yield summaries via Promise.allSettled — page works even when grain-tickets is offline (shows warning banner, 0 production)
- PositionTable renders per-crop rows: Est. Production (from yield pipeline), Contracted (sum of all contract bushels), Unpriced (production - contracted, floor 0), CBOT Price, Unpriced Exposure ($) — click any crop row to expand inline contract detail table with Edit/Delete per contract
- Totals row at bottom sums contracted bu, unpriced bu, and total unpriced exposure
- CBOT price source badge in header (green for barchart-delayed, orange for manual-fallback) with timestamp and Refresh Prices button
- ContractDrawer supports all six types (cash, accumulator, HTA, options, min-price, basis) with conditional field visibility: price for cash/accumulator/options/min-price; basis + futures reference for HTA/basis; price hidden for basis-only contracts
- Crop autocomplete from farm-registry with graceful fallback when registry offline
- Position aggregation recomputes client-side after every CRUD operation (no page reload)

## Task Commits

Each task was committed atomically:

1. **Task 1: Marketing page and position table component** - `078d0f5` (feat)
2. **Task 2: Contract entry/edit drawer** - `c68c417` (feat)

**Plan metadata:** (docs commit below)

## Files Created

- `glomalin-portal/src/app/(protected)/app/marketing/page.tsx` — SSR page: Promise.allSettled loads contracts + CBOT + yield; Suspense wrapper for MarketingWorkspace
- `glomalin-portal/src/components/marketing/marketing-workspace.tsx` — Main orchestrator: header, price badge, offline warning, ContractDrawer + PositionTable wiring, CRUD handlers
- `glomalin-portal/src/components/marketing/position-table.tsx` — Per-crop summary table with expandable inline contract rows, totals row
- `glomalin-portal/src/components/marketing/contract-drawer.tsx` — Slide-out drawer: conditional fields by contract type, crop autocomplete, create/edit/error states

## Decisions Made

- computePositions logic duplicated between page.tsx and marketing-workspace.tsx — avoids a shared lib import that would complicate server/client boundary, each context is independent
- Yield summaries not refetched client-side — SSR value is stable during a session; grain-tickets data doesn't change while using the marketing module
- Refresh Prices explicitly bypasses Next.js cache with `cache: 'no-store'` to let users get fresher delayed quotes on demand
- Array.from(positionMap) used for Map iteration to satisfy TypeScript's downlevelIteration requirements without changing tsconfig

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: glomalin-portal/src/app/(protected)/app/marketing/page.tsx
- FOUND: glomalin-portal/src/components/marketing/marketing-workspace.tsx
- FOUND: glomalin-portal/src/components/marketing/position-table.tsx
- FOUND: glomalin-portal/src/components/marketing/contract-drawer.tsx
- FOUND: commit 078d0f5 (Task 1)
- FOUND: commit c68c417 (Task 2)
