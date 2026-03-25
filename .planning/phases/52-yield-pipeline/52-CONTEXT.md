# Phase 52: Yield Pipeline - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-compute yield summaries in grain-tickets from ticket data and push to portal insurance policies and farm-budget dashboard. Eliminates triple manual entry of yield data. Does not include APH computation, marketing position, or settlement reconciliation.

</domain>

<decisions>
## Implementation Decisions

### Yield computation logic
- Granularity: per field per crop (using registry_field_id + canonical crop ID)
- Bushel conversion: USDA standard test weights per crop (wheat=60, corn=56, etc.)
- Weight basis: net pounds after buyer deductions (moisture/dockage), not gross scale weight
- Finality: always live — no manual "finalize" step. Yield updates continuously as tickets are added/edited

### Sync trigger & timing
- Trigger: on every ticket save/edit/delete — yield summary recomputes immediately
- Push direction: grain-tickets pushes yield summaries via API to both portal (insurance) and farm-budget
- No manual "resync all" button — auto-sync on each ticket save is sufficient
- No debounce — immediate recompute on every save

### Sync status display
- Insurance view: inline badge next to the actual yield value (green "GT" or checkmark), timestamp on hover showing "Synced from grain tickets"
- Budget dashboard: actual yield replaces the budgeted estimate once yield data arrives. Show variance (e.g., "Actual 42 bu/ac vs Budget 45 bu/ac")
- Empty state: muted dash "—" in the yield column with tooltip "No grain tickets recorded for this field/crop yet"

### Mismatch handling
- Field matching: registry_field_id only — tickets without a registry_field_id are excluded from yield computation with a warning
- Crop matching: canonical crop ID from Phase 50 — both apps already have these IDs
- Unmatched policies: if a field+crop has yield data but no insurance policy, flag it as "no insurance policy found" (still compute and store the yield, just skip the insurance push)
- Acre denominator for bu/ac: use insurance policy acres when pushing to insurance (the number that matters for yield comparison)

### Claude's Discretion
- Push failure/retry strategy when portal or farm-budget API is unreachable
- Staleness warning design (whether to show amber warning or just timestamp)
- Empty state presentation details beyond the muted dash pattern
- Internal yield summary storage schema in grain-tickets

</decisions>

<specifics>
## Specific Ideas

- Net pounds after deductions was chosen because buyers use different shrink methods — gross weight would be inconsistent with what's actually received
- Always-live model chosen over finality gates — this is a small operation where manual finalization would be friction without benefit
- Insurance policy acres as denominator (not registry acres) because that's what insurance yield reporting compares against

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 52-yield-pipeline*
*Context gathered: 2026-03-25*
