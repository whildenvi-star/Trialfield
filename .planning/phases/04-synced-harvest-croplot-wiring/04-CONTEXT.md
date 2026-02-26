# Phase 4: Synced Harvest CropLot Wiring - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

When a staged Case IH harvest/yield operation is approved via the staged-ops review flow, the system auto-creates (or updates) a CropLot record with an auto-generated lot number. This completes the data pipeline so synced harvests appear in the PDF Harvest Log and Mass Balance exactly like manual harvests. No new UI pages — this wires into the existing approve flow and existing report assembler.

</domain>

<decisions>
## Implementation Decisions

### Lot Number Generation
- Same format as manual harvests: `YEAR-CROP-FIELDABBREV` (e.g., 2024-SRWW-KOPP)
- No sync prefix or origin indicator — a lot number is a lot number
- Field abbreviation derived from Field.name (first 4–6 chars, uppercase)
- If a CropLot already exists for the FieldEnterprise, accumulate into it (don't create a second lot)
- CropLot.quantityLbs auto-sums all linked HarvestEvent net weights — always computed, never manual

### Approve Flow Behavior
- CropLot creation happens in the same Prisma transaction as HarvestEvent creation — atomic, no orphaned harvests
- Batch approval supported — select multiple staged ops, approve all at once
- Partial-field harvests (acresHarvested < plantedAcres) create/update CropLot regardless — no special handling
- After batch approval, show a summary toast/banner: "3 HarvestEvents approved, 2 new CropLots created, 1 existing CropLot updated"
- Approval blocked if no FieldEnterprise exists for the staged op's crop+year — user must create the enterprise first

### Report Display for Synced Data
- Synced harvests look identical to manual harvests in the PDF — no origin indicator
- Missing data (moisture %, test weight) shows as dashes (—) in report columns
- Mass balance sums ALL harvested lbs per crop regardless of source — one interchangeable total
- Convert Case IH yield from bushels/acre to lbs at approval time using standard test weights (corn 56 lb/bu, wheat 60 lb/bu, soybeans 60 lb/bu)

### Edge Cases & Conflicts
- Manual and synced HarvestEvents for the same FieldEnterprise are both valid — accumulate into the same CropLot
- Re-sync bringing already-approved operations: skip silently (existing dedup by fieldopsExternalId)
- Unmatched staged ops (no field mapping): show in review queue but disable the approve button with "No field mapping" indicator

### Claude's Discretion
- Exact field abbreviation algorithm (how to truncate/abbreviate field names for lot numbers)
- Toast/banner component choice and styling
- How to display the "blocked — no enterprise" state in the approve UI
- Transaction rollback behavior on partial batch failures

</decisions>

<specifics>
## Specific Ideas

- Standard test weights for bu→lbs conversion: corn=56, wheat=60, soybeans=60, barley=48, oats=32, rye=56
- The existing manual lot number generation logic should be reused or extracted into a shared utility — don't duplicate the format logic
- Batch approve should work like "select all matching" — when reviewing a season of synced data, Randy needs to move fast

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-synced-harvest-croplot-wiring*
*Context gathered: 2026-02-26*
