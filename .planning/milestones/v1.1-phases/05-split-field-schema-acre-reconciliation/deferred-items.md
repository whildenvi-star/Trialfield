# Deferred Items — Phase 05

## Out-of-scope issues discovered during 05-01 execution

### TypeScript error in sync-registry route

**File:** `organic-cert/src/app/api/fields/sync-registry/route.ts` (line 94)
**Error:** `TS2554: Expected 1 arguments, but got 3`
**Description:** The `logAudit` function is called with 3 arguments (action, actor, payload) but the current implementation only accepts 1. This file is untracked in git and pre-dates phase 05 work.
**Status:** Out of scope — not caused by schema changes. Should be fixed when sync-registry is brought into scope (likely Phase 5 or 6 when the route is first committed).
**Impact:** TypeScript build shows 1 error (pre-existing). All phase 05-01 changes themselves type-check cleanly.
