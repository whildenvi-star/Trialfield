---
phase: 58-field-activity-timeline
plan: 02
subsystem: glomalin-portal/timeline-ui
tags: [timeline, ui, react, progressive-loading, pdf-export, csv-export, portal-module]
dependency_graph:
  requires:
    - phase: 58-01
      provides: timeline types, per-source fetch API routes, SingleSourceResponse shape
  provides:
    - field-timeline module registered in portal navigation
    - searchable field list with registry fields
    - split-panel timeline page with URL-based field selection
    - TimelineWorkspace with progressive per-source loading
    - TimelineEntryCard with source color-coding and expandable detail templates
    - TimelineFilters with per-chip loading spinners and year selector
    - TimelineExport for PDF and CSV with filtered entries
  affects: [glomalin-portal/navigation, glomalin-portal/modules]
tech_stack:
  added: []
  patterns:
    - progressive-per-source-loading (4 independent fetch calls, not Promise.allSettled, entries merge incrementally)
    - AbortController-per-fetch-cycle (abort all in-flight fetches on fieldId/year change)
    - URL-search-param-field-selection (?field=xxx shareable/bookmarkable)
    - source-color-coded-left-border (4px border stripe per source)
    - pairedMap-after-all-sources-resolve (budget+cert pairing computed after all 4 fetches complete)
    - gap-marker-threshold (>14 days between date groups inserts dashed gap marker)
key_files:
  created:
    - glomalin-portal/src/app/(protected)/app/field-timeline/page.tsx
    - glomalin-portal/src/app/(protected)/app/field-timeline/field-timeline-client.tsx
    - glomalin-portal/src/components/timeline/field-list.tsx
    - glomalin-portal/src/components/timeline/timeline-workspace.tsx
    - glomalin-portal/src/components/timeline/timeline-entry-card.tsx
    - glomalin-portal/src/components/timeline/timeline-filters.tsx
    - glomalin-portal/src/components/timeline/timeline-export.tsx
  modified:
    - glomalin-portal/src/lib/modules.ts
key-decisions:
  - "field-timeline-client.tsx is a separate file from page.tsx — Suspense boundary required for useSearchParams() in Next.js 14 App Router; wrapping in same file causes SSR issues"
  - "pairedMap computed after all sources resolve (isAnyLoading=false) — budget+cert pairing requires both source sets present to back-fill IDs"
  - "SOURCE_COLORS defined in timeline-workspace.tsx and exported — single source of truth used by entry cards and filter chips"
  - "unknown type from detail Record<string,unknown> requires explicit String() conversion before JSX — TypeScript strict mode rejects unknown as ReactNode in conditional renders"
  - "TimelineExport receives already-filtered entries from workspace — no additional API call needed, workspace already has all per-source entries"
patterns-established:
  - "Source color-coding: budget=#C8860A, cert=#7A9E7E, fieldops=#6A8CAF, grain=#B87333"
  - "Progressive loading: 4 independent fetch() calls with AbortController, not Promise.allSettled"
  - "Per-chip spinner: sourceLoading[source] drives independent spinner per filter chip"
  - "Gap markers: >14 day threshold between date groups, shows week count in muted text"
requirements-completed: [FLD-01, FLD-02]
duration: 5min
completed: "2026-03-29"
---

# Phase 58 Plan 02: Field Activity Timeline UI Summary

**Field activity timeline portal module with split-panel field list, 4-source progressive loading, color-coded expandable entry cards, per-chip loading spinners, paired budget+cert comparison, gap markers, and PDF/CSV export.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-29T19:08:46Z
- **Completed:** 2026-03-29T19:14:19Z
- **Tasks:** 2
- **Files modified:** 8 (1 modified, 7 created)

## Accomplishments

- Field timeline module registered in portal navigation (after marketing, before macro-rollup)
- Split-panel page with SSR registry field fetch, URL ?field= param for bookmarkable selection, searchable field list with alias search and acre display
- TimelineWorkspace with 4 independent parallel fetches (not Promise.allSettled), AbortController per cycle, progressive rendering — partial data visible as each source resolves, skeleton shimmers while loading
- TimelineEntryCard with 4px source-colored left border, 4 source-specific detail templates, paired planned vs actual comparison panel for budget+cert entries
- TimelineFilters with per-chip loading spinners that resolve independently, year selector, summary stats bar
- TimelineExport for PDF (@react-pdf/renderer, grouped by month, colored source column) and CSV (Blob+createObjectURL, 11 columns)

## Task Commits

1. **Task 1: Field timeline page, field list, and module registration** - `c230ed7` (feat)
2. **Task 2: Timeline workspace, entry cards, filters, and export** - `a95318e` (feat)

## Files Created/Modified

- `glomalin-portal/src/lib/modules.ts` — Added field-timeline module entry (after marketing, before macro-rollup)
- `glomalin-portal/src/app/(protected)/app/field-timeline/page.tsx` — SSR page, fetches registry fields, split-panel layout with Suspense
- `glomalin-portal/src/app/(protected)/app/field-timeline/field-timeline-client.tsx` — Client wrapper, URL ?field= param, field selection router
- `glomalin-portal/src/components/timeline/field-list.tsx` — Searchable field list with name/alias filter, accent border on selected, acre display
- `glomalin-portal/src/components/timeline/timeline-workspace.tsx` — Main workspace: 4 independent fetches, AbortController, sortByDate, pairedMap, gap markers, skeleton shimmers
- `glomalin-portal/src/components/timeline/timeline-entry-card.tsx` — Collapsed/expanded cards, 4 source detail templates, paired comparison panel, source link
- `glomalin-portal/src/components/timeline/timeline-filters.tsx` — Source toggle chips, per-chip loading spinners, year selector, stats bar
- `glomalin-portal/src/components/timeline/timeline-export.tsx` — PDF and CSV export with filtered entries

## Decisions Made

- Created `field-timeline-client.tsx` as a separate client component from `page.tsx` — Suspense boundary is required for `useSearchParams()` in Next.js 14 App Router; the client wrapper must be wrapped in `<Suspense>` at the server component level.
- `pairedMap` computed only after all 4 sources resolve (`isAnyLoading === false`) — pairing requires both budget and cert entry sets to be present so back-filled IDs can be resolved.
- `SOURCE_COLORS` defined in `timeline-workspace.tsx` and exported — single source of truth for all 4 source colors used across entry cards and filter chips.
- `TimelineExport` receives already-filtered entries as props from workspace — no additional aggregated API call needed at export time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript: unknown type from Record<string,unknown> not assignable to ReactNode**
- **Found during:** Task 2 (timeline-entry-card.tsx)
- **Issue:** Detail fields typed as `unknown` in `Record<string, unknown>` — conditional renders like `{detail.operator && <span>{String(detail.operator)}</span>}` TypeScript-reject the `&&` short-circuit as `unknown` ReactNode
- **Fix:** Extract fields to typed string variables before JSX: `const operator = detail.operator != null ? String(detail.operator) : null` — then use the typed variable in the conditional
- **Files modified:** `glomalin-portal/src/components/timeline/timeline-entry-card.tsx`
- **Verification:** `npx tsc --noEmit` passes with 0 errors
- **Committed in:** a95318e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type correctness bug)
**Impact on plan:** Single fix required for TypeScript strict mode compliance with Record<string,unknown> detail objects. No scope creep.

## Issues Encountered

None beyond the TypeScript strict mode issue documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 58 complete — field activity timeline UI fully built on top of the Plan 01 API backbone
- Ready for Phase 59 (or next planned phase in v11.0 roadmap)
- Timeline module accessible at /app/field-timeline and listed in portal navigation

---
*Phase: 58-field-activity-timeline*
*Completed: 2026-03-29*

## Self-Check: PASSED

- [x] `glomalin-portal/src/lib/modules.ts` — exists, field-timeline entry added
- [x] `glomalin-portal/src/app/(protected)/app/field-timeline/page.tsx` — exists
- [x] `glomalin-portal/src/app/(protected)/app/field-timeline/field-timeline-client.tsx` — exists
- [x] `glomalin-portal/src/components/timeline/field-list.tsx` — exists
- [x] `glomalin-portal/src/components/timeline/timeline-workspace.tsx` — exists
- [x] `glomalin-portal/src/components/timeline/timeline-entry-card.tsx` — exists
- [x] `glomalin-portal/src/components/timeline/timeline-filters.tsx` — exists
- [x] `glomalin-portal/src/components/timeline/timeline-export.tsx` — exists
- [x] Commit c230ed7 — verified in git log
- [x] Commit a95318e — verified in git log
