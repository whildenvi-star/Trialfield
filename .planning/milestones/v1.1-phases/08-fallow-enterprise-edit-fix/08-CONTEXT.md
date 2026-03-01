# Phase 8: Fallow Enterprise Edit Fix - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the fallow enterprise edit path so existing cost data (fallowCostAmount, fallowCostCategory) is pre-filled when opening the edit form, and preserved on save. Closes INT-01 from v1.1 milestone audit. No schema changes, no new fields, no changes to the create flow.

</domain>

<decisions>
## Implementation Decisions

### Cost field display on edit
- Cost fields (amount + category) always visible in the fallow enterprise edit form — no collapsible sections
- Pre-fill from stored data when opening edit form (core fix)
- Editable inline — regular form fields, consistent with create flow
- No visual distinction between fallow and regular enterprise edit forms — fallow is just another enterprise
- Null cost amounts default to $0.00 in the form (never show blank)

### Save feedback behavior
- Normal save confirmation toast — no special cost-data messaging
- If user clears cost amount, save as $0.00 (not null) — always keep a numeric value
- Save returns to enterprise list (not stay in edit form)
- On error, preserve form state with all user changes intact — no data loss on failure

### Cost field validation
- Numeric only, no negative values
- Two decimal places allowed (standard currency: $1,234.56)
- No upper limit — user knows their costs
- Cost category field always optional (never required, even when amount > 0)

### Fallow enterprise context
- Fallow acres are ~20-30 acres/year out of total enterprise — small but real
- Fallow still carries real costs: rent, machinery cost, interest, overhead
- Fallow just zeroes out seed, inputs, yield, crop insurance
- Both create-new and edit-existing are real workflows for fallow enterprises
- Cost amount is updated each season (rent adjustments, etc.) — pre-fill is critical

### Claude's Discretion
- Exact form field placement relative to other enterprise fields
- Error toast wording
- Currency formatting implementation details

</decisions>

<specifics>
## Specific Ideas

- "Don't overthink fallow acres — it's only about 20-30 acres a year out of the entire enterprise"
- Fallow enterprises should feel identical to regular enterprises in the edit form — no special UI treatment

</specifics>

<deferred>
## Deferred Ideas

- Fallow as crop type instead of toggle — remove isFallow flag, treat fallow as just another crop value. Simplifies the model but requires schema migration. Future phase.
- Itemized cost breakdown per enterprise — separate fields for rent, machinery, interest, overhead instead of single lump sum. Future phase.
- Cost/overhead fields on ALL enterprise types — every acre carries costs (rent, machinery, interest, overhead), not just fallow. Future phase.

</deferred>

---

*Phase: 08-fallow-enterprise-edit-fix*
*Context gathered: 2026-03-01*
