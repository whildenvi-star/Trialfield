# Phase 5: Split-Field Schema & Acre Reconciliation - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

A field can hold multiple crop enterprises per season with validated acre totals and fallow tracking. This is the data foundation — schema changes, API validation, and acre reconciliation logic. UI views and PDF reports come in Phases 6 and 7.

</domain>

<decisions>
## Implementation Decisions

### Enterprise Identity
- Crop is the primary identifier — "Kopps - Corn 2026", "Kopps - Soybeans 2026"
- Variety distinguishes same-crop enterprises (e.g., Pioneer P63ME80 vs DeKalb DKC64-34), but variety is optional and often filled in after planting
- Freeform label (optional) needed only when the same crop appears twice on a field — user types something like "Corn - North" or "Corn 2" to distinguish
- Single-enterprise fields don't need any label — they work exactly as today
- Uniqueness: [fieldId, cropYear, crop, label] where label defaults to null for single-crop fields

### Acre Validation
- Over-allocation (enterprise sum > field total): yellow warning but allow save — FSA acres don't always match reality, rounding happens
- Under-allocation (enterprise sum < field total): show "X ac unallocated" as informational text on the field, not a forced fallow enterprise
- Field totalAcres can be updated from the enterprise view if the total was wrong
- Acre utilization display ("120 of 160 ac") only on multi-enterprise fields; single-enterprise fields show total like today

### Fallow/Idle Tracking
- User creates fallow enterprises manually when they want to track idle land costs
- No auto-creation of fallow enterprises from unallocated acres

### Claude's Discretion
- Fallow enterprise schema fields (cost amount, cost category, notes) — exact field types and naming
- Migration strategy for existing single-enterprise data
- Whether to use a separate `enterpriseType` enum (CROP/FALLOW) or just a special crop value like "Fallow"
- API response shape for acre reconciliation data

</decisions>

<specifics>
## Specific Ideas

- Current unique constraint is `@@unique([fieldId, cropYear, crop])` — needs to change to accommodate same-crop splits
- Existing FieldEnterprise records have no label — backward compatible means null label works for single enterprises

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-split-field-schema-acre-reconciliation*
*Context gathered: 2026-02-27*
