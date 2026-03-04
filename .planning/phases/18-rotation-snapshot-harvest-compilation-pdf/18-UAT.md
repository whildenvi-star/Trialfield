---
status: complete
phase: 18-rotation-snapshot-harvest-compilation-pdf
source: 18-01-SUMMARY.md, 18-02-SUMMARY.md, 18-03-SUMMARY.md
started: 2026-03-03T23:30:00Z
updated: 2026-03-04T00:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Snapshot Warning Banner
expected: On the Compile page, select the current crop year. A yellow warning banner appears indicating no rotation snapshot exists for this year.
result: pass

### 2. Take Rotation Snapshot
expected: On the Compile page, click the "Take Snapshot" button in the Rotation Snapshot section. The button triggers a preview/commit flow. After completion, the yellow warning disappears and a green badge shows the number of fields snapshotted.
result: pass

### 3. Rotation History on Fields Page
expected: On the Fields page, a collapsible "Rotation History" section is available. Expanding it lazy-loads a 3-year table showing fields as rows and years as columns with crop data.
result: pass

### 4. Harvest Compilation Preview
expected: On the Compile page, click the harvest compile button. A preview table appears showing matched tickets with columns: Field, Crop, Loads, Net Weight (lbs), Acres, Date, and Source. Summary bar shows new/updated/unchanged/unmatched counts.
result: pass

### 5. Harvest Unmatched Review
expected: If any grain tickets don't match a field or crop, they appear in an amber-bordered "unmatched" review list showing Farm Field, Crop, Tickets, Weight, and Reason (human-readable).
result: pass

### 6. Commit Harvest
expected: After previewing harvest, click "Commit Harvest" (button disabled if no new/updated rows). A confirm dialog shows counts. After commit, the preview re-runs showing rows as "unchanged".
result: pass

### 7. Compile All Includes Harvest
expected: Clicking "Compile All" on the Compile page runs harvest compilation alongside other compilations. If grain-tickets (port 3000) is unavailable, Compile All still succeeds for other sections — harvest shows an unavailability message.
result: pass

### 8. PDF Compile Checklist on Cover Page
expected: Generate the NOP inspection PDF. The cover page includes a "Data Compilation Status" section showing green check or red cross for each data source (fields, enterprises, inputs, seeds, harvest, rotation snapshot).
result: pass

### 9. PDF Empty State Safety
expected: Generate the NOP inspection PDF when no fields have been compiled yet. The PDF generates without errors — the field list section shows a "No fields compiled" placeholder instead of an empty/broken table.
result: pass

### 10. PDF Null Harvest Date Safety
expected: If any harvest record has no date, the harvest log in the PDF renders a dash (—) instead of crashing or showing "Invalid Date".
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
