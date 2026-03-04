---
phase: 20-farm-registry-bug-fix
plan: 01
subsystem: api, ui
tags: [express, vanilla-js, json, form-validation, error-handling]

# Dependency graph
requires: []
provides:
  - PUT /api/fields/:id with growerId in whitelist + field-level validation
  - Server-side validation returning 400 with errors array (name, acres, ownership)
  - Client save flow with loading state, green success toast, red error toast
  - growerId backfill default (grw_001) for existing fields missing the field
affects: [farm-budget, organic-cert, grain-tickets]  # consumers of farm-registry data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side validation: collect all errors into array, return 400 with {errors: [{field, message}]} if any exist"
    - "Client error toast: reuse same element, swap class between save-toast and save-toast-error"
    - "Loading state: store originalText, set Saving.../disabled before fetch, restore in both .then and .catch"

key-files:
  created: []
  modified:
    - farm-registry/server.js
    - farm-registry/public/app.js
    - farm-registry/public/style.css

key-decisions:
  - "growerId default is grw_001 for this single-grower operation — backfilled on any PUT that passes validation"
  - "Error toast reuses existing save-toast element with save-toast-error modifier class — no new HTML elements needed"
  - "4-second error toast vs 2-second success toast — errors need more read time"
  - "Form retains user edits on failure — no loadFields() call in catch block"

patterns-established:
  - "Validation pattern: check all fields, collect errors[], return 400 immediately if any errors present"
  - "Loading state pattern: capture originalText, disable button, restore in both success and error paths"

requirements-completed: [FIX-01, FIX-02]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 20 Plan 01: Farm-Registry Field Save Bug Fix Summary

**growerId added to PUT whitelist with server-side validation (400 + errors array) and client loading state + red/green toast feedback**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-04T19:47:07Z
- **Completed:** 2026-03-04T19:48:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed core data persistence bug: growerId now in PUT /api/fields/:id updatable whitelist and persists through save cycles
- Added server-side validation returning 400 with field-level errors array for name (required), reportingAcres/organicAcres (>=0), and ownership (owned|rented|mixed)
- Added client save error handling: red toast with server error messages, form retains edits on failure, no silent failures
- Added loading state: save button shows "Saving..." and is disabled during request, restored on both success and failure

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix PUT /api/fields/:id — growerId whitelist + server-side validation** - `77ffbd8` (fix)
2. **Task 2: Add save error handling, loading state, and error toast to the client** - `c641b7d` (feat)

## Files Created/Modified
- `farm-registry/server.js` - Added growerId to updatable whitelist, added validation block with 400 errors response, growerId backfill, try/catch around saveData()
- `farm-registry/public/app.js` - Replaced api() helper with fetch() in save handler, added loading state, error toast catch block
- `farm-registry/public/style.css` - Added .save-toast-error modifier class with red color/border

## Decisions Made
- growerId default is `grw_001` for this single-grower operation — backfilled on any PUT that passes validation (defensive measure for existing fields missing the field)
- Error toast reuses existing `save-toast` element with `save-toast-error` modifier class — no new HTML elements needed
- 4-second display time for error toast vs 2-second for success toast (errors need more read time)
- Form retains user edits on failure — `loadFields()` is NOT called in catch block so user can fix and retry

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The plan's automated verification script used a regex that hit the growers PUT updatable array before the fields PUT updatable array. This was a false failure in the verify script only — the actual file changes were correct. Verified with a more specific regex targeting the fields PUT handler context.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Farm-registry field editor is now fully functional with proper error feedback
- All form fields (growerId, reportingAcres, organicAcres, ownership) persist correctly through save cycles
- Ready for Phase 21 (Farm-Budget Field Editor Polish) — independent of this phase

---
*Phase: 20-farm-registry-bug-fix*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: farm-registry/server.js
- FOUND: farm-registry/public/app.js
- FOUND: farm-registry/public/style.css
- FOUND: .planning/phases/20-farm-registry-bug-fix/20-01-SUMMARY.md
- FOUND commit: 77ffbd8 (Task 1 — server.js validation + whitelist fix)
- FOUND commit: c641b7d (Task 2 — client loading state + error toast)
