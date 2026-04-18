---
phase: 69-field-operations-tc-log
plan: "02"
subsystem: glomalin-portal
tags: [field-ops, tc-log, portal-ui, organic-cert, nop]
dependency_graph:
  requires: [69-01]
  provides: [field-ops-ui, tc-log-module]
  affects: [glomalin-portal/modules-nav, glomalin-portal/dashboard-grid]
tech_stack:
  added: []
  patterns: [split-panel-layout, supabase-browser-client, url-state-sync, optimistic-ui]
key_files:
  created:
    - glomalin-portal/src/app/(protected)/app/field-ops/page.tsx
    - glomalin-portal/src/app/(protected)/app/field-ops/field-ops-client.tsx
  modified:
    - glomalin-portal/src/lib/modules.ts
    - glomalin-portal/src/app/api/field-ops/tcs/route.ts
decisions:
  - "field-ops module inserted after compliance, before marketing — operations-adjacent to field-timeline"
  - "GET /tcs response extended to include fieldEnterpriseId — delete URL construction requires it"
  - "Delete ownership heuristic: name-match for non-admins (cert does not store supabase IDs)"
  - "Server-side refresh after add (not optimistic insert) — avoids stale state when cert assigns real IDs"
  - "No-enterprise state shows notice + disables Add TC button — not an error for conventional fields"
metrics:
  duration_minutes: 45
  completed_date: "2026-04-18"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
requirements-completed: [FTC-01, FTC-02, FTC-03, FTC-04]
---

# Phase 69 Plan 02: Field Ops TC Log UI Summary

Split-panel portal module at `/app/field-ops` deployed live at portal.whughesfarms.com — field picker, year selector, inline Add TC form, and ownership-guarded delete. All 11 human-verify steps passed.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | SSR page wrapper + FieldOpsClient component | Complete | 8df55a6 |
| 2 | Add field-ops to MODULES nav | Complete | f69d794 |
| 3 | Verify field-ops TC log end-to-end | Complete — human approved | e3f4c28 |

## What Was Built

**`page.tsx` (SSR wrapper):**
- Fetches all active fields from farm-registry via `fetchRegistryService`
- Graceful error card if registry unavailable
- Wraps `FieldOpsClient` in `<Suspense fallback={null}>` (required for useSearchParams)
- Passes `fields` and `initialFieldId` (from searchParams.field)

**`field-ops-client.tsx` (interactive workspace):**
- 288px left sidebar: header, search input, scrollable field list with accent left-border highlight
- Right workspace: empty state until field selected
- Header bar on field selection: field name + year dropdown (current + 3 prior years) + Add TC button
- No-enterprise notice for conventional fields (disables Add TC)
- Inline add form: operation type select, date input, TC'd-by read-only, sign-off-as operator picker, notes textarea
- Sign-off-as: fetches `/api/field-ops/operators` once on form open; appends `[Signed off by: Name]` to notes, sends cert user ID as override
- TC table: Date, Operation, TC'd By, Notes, Delete columns (font-mono, xs)
- Delete: admin sees all rows, non-admin sees own rows (name-match heuristic); inline confirm "Delete this TC? Yes / Cancel"
- URL state: `?field=` sync via useRouter + useSearchParams

**`modules.ts`:**
- `field-ops` entry inserted after `compliance`, before `marketing`
- Appears in portal nav sidebar and dashboard module grid

**Auto-fix applied during Task 1 (Rule 1 — Bug):**
- GET `/api/field-ops/tcs` response now includes `fieldEnterpriseId` — the plan specified the client needs it for delete URL construction but the Phase 69-01 implementation omitted it from the response shape.

**Auto-fix applied during production verification (Rule 3 — Blocking):**
- `EMBED_TOKEN` added to pm2 `ecosystem.config.js` for the glomalin-portal process — was missing, causing fetchRegistryService proxy calls to 401 in production ("Registry Unavailable" error on field load).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GET /tcs missing fieldEnterpriseId in response**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `{ tcs, fieldEnterpriseId, year }` shape; Phase 69-01 only returned `{ tcs, year, fieldId }`
- **Fix:** Added `fieldEnterpriseId: certFieldEnterpriseId` to the GET response JSON
- **Files modified:** `glomalin-portal/src/app/api/field-ops/tcs/route.ts`
- **Commit:** 8df55a6

**2. [Rule 3 - Blocking] EMBED_TOKEN missing from pm2 ecosystem.config.js**
- **Found during:** Task 1 production verification
- **Issue:** glomalin-portal pm2 process lacked EMBED_TOKEN env var; fetchRegistryService proxy returned 401, field list showed "Registry Unavailable"
- **Fix:** Added EMBED_TOKEN to glomalin-portal env block in ecosystem.config.js and reloaded pm2
- **Files modified:** ecosystem.config.js (root)
- **Verification:** Registry fields loaded correctly in production; all 56 fields visible in left panel
- **Commit:** 8df55a6

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Human Verification Results

All 11 steps passed at portal.whughesfarms.com/app/field-ops:
1. Field list loads on left (farm-registry fields)
2. Selecting organic field loads TC list (empty if no records)
3. "Add TC" opens inline form below header
4. Add Planting TC with today's date — record appears immediately
5. Year selector shows current + 3 prior years; switching changes records
6. Hover on own TC — Delete button visible
7. Click Delete — inline "Delete this TC? Yes / Cancel" appears
8. Click Yes — TC disappears
9. Portal dashboard shows "Field Ops TC Log" module card
10. Clicking card navigates to /app/field-ops
11. Module appears in portal nav sidebar

## Self-Check: PASSED

- FOUND: glomalin-portal/src/app/(protected)/app/field-ops/page.tsx
- FOUND: glomalin-portal/src/app/(protected)/app/field-ops/field-ops-client.tsx
- FOUND: commit 8df55a6 (Task 1)
- FOUND: commit f69d794 (Task 2)
- Human verify: approved by user

## Next Phase Readiness

Phase 69 is the final phase in the current roadmap. The platform is feature-complete:
- Field Ops TC Log is live at portal.whughesfarms.com/app/field-ops for Sandy and operators
- TC records write to organic-cert FieldOperation with `plannedSource="field-ops-tc"` for NOP audit trail
- No blockers or concerns for future work
