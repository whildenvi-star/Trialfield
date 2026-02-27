---
status: testing
phase: 04-synced-harvest-croplot-wiring
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md]
started: 2026-02-26T17:55:00Z
updated: 2026-02-26T17:55:00Z
---

## Current Test

number: 1
name: Approve a staged harvest creates CropLot
expected: |
  Go to http://localhost:3004 → Admin → FieldOps Review page. Find a PENDING staged harvest operation. Click Approve. The toast should show the lot number (e.g., "lot 2026-CORN-SIMPS created") and the operation should move to APPROVED status.
awaiting: user response

## Tests

### 1. Approve a staged harvest creates CropLot
expected: Approving a PENDING staged harvest operation creates a CropLot with an auto-generated lot number in YEAR-CROP-FIELD format. Toast shows lot number and "created".
result: [pending]

### 2. Approve blocked without FieldEnterprise
expected: If you try to approve a staged harvest for a field/crop/year that has no FieldEnterprise, the approve is blocked. An actionable toast appears with a "Create Enterprise" button that navigates to /field-enterprises.
result: [pending]

### 3. Second harvest for same enterprise accumulates
expected: Approve a second staged harvest for the same FieldEnterprise. Instead of creating a new CropLot, the existing one's quantity should be incremented. Toast shows lot number and "updated" (not "created").
result: [pending]

### 4. Bulk approve with CropLot summary toast
expected: Select multiple staged harvests and bulk approve. Toast shows: "N HarvestEvents approved, M new CropLots created, K existing CropLots updated" with actual counts.
result: [pending]

### 5. PDF Harvest Log shows lot numbers for synced harvests
expected: Generate an inspection report (Reports page → Generate). Open the PDF. In the Harvest Log section, synced HarvestEvents should show their lot numbers (e.g., "2026-CORN-SIMPS") — not dashes (—).
result: [pending]

### 6. PDF Mass Balance includes synced harvest quantities
expected: In the same PDF, the Mass Balance section should include the harvested lbs from synced HarvestEvents in the per-crop totals. The total harvested should reflect both manual and synced data.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
