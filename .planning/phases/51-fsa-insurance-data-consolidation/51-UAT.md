---
status: complete
phase: 51-fsa-insurance-data-consolidation
source: 51-01-SUMMARY.md, 51-02-SUMMARY.md, 51-03-SUMMARY.md
started: 2026-03-25T15:00:00Z
updated: 2026-03-25T15:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Migration executed — data.json renamed
expected: fsa-acres/data/data.json no longer exists. fsa-acres/data/data.json.migrated is present as read-only backup.
result: pass

### 2. FSA Entry tab loads CLU records from Supabase
expected: Open fsa-acres (localhost:3002). The FSA Entry tab shows CLU records — should be 444 records total across all farms.
result: pass

### 3. Insurance tab shows policies from Supabase
expected: Click the Insurance tab in fsa-acres. Should show insurance policies (at least 3-4 policies with farm names, crops, and acres).
result: pass

### 4. Pricing data loads from Supabase
expected: Pricing section in fsa-acres shows 22 crop pricing rows (organic wheat, organic rye, etc.) pulled from Supabase.
result: pass

### 5. GCS enrollment tab removed
expected: The GCS Enrollment tab/section that was previously in fsa-acres is completely gone — no tab button, no section in the UI.
result: pass

### 6. Rollup reports work correctly
expected: fsa-acres reports/rollup views show farm-level totals. Farm 14903 should show ~3,738.94 acres. Total across all farms ~5,977.24 acres.
result: pass

### 7. Portal insurance staleness badge visible
expected: Open glomalin-portal insurance page. A staleness badge appears near the top — either amber "Prices may be stale" (if >7 days) or green "Updated Xd ago".
result: pass

### 8. Staleness badge refresh triggers RMA scrape
expected: Click "Refresh Prices" on the staleness badge. Loading spinner appears. After completion, badge updates with new timestamp or shows error message. Feedback auto-clears after ~6 seconds.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
