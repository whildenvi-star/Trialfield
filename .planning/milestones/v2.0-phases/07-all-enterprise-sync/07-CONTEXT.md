# Phase 7: All-Enterprise Sync - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand the farm-budget sync to pull in ALL enterprises (organic + conventional) so the full farm operation is represented in the database. The farm-budget service already returns both conventional and organic arrays. This phase ensures the organic-cert app stores all enterprises in FieldEnterprise records, not just organic ones. The farm-wide aggregated view is Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Enterprise matching
- Pull ALL enterprise tabs from the Macro Rollup workbook — skip utility/summary tabs (Claude determines which are non-enterprise)
- Each enterprise tab in the Macro Rollup maps to a separate FieldEnterprise record
- Add an organic/conventional type flag to the FieldEnterprise model
- Type flag is derived from the farm-registry service's explicit organic flag on fields — NOT from the farm-budget service's conventional/organic array classification
- Fields are dedicated organic OR conventional per crop year — never both simultaneously
- No deduplication needed between organic and conventional for the same field

### Sync behavior
- On-page-load sync — no manual sync buttons, no scheduled jobs
- Fetch fresh projected data from farm-budget service each time someone navigates to the Budget tab
- If farm-budget service is unavailable, show last known data from database with a stale indicator (e.g., "last updated X ago")
- Projected numbers update silently even if Sandy has already entered actuals against old projections — actuals are never touched
- Variance recalculates automatically against updated projections
- Current crop year only — do not sync historical years

### Data mapping
- Conventional and organic enterprise tabs have identical column structure — same cost categories, same line items
- Expect 1-5 conventional enterprise tabs alongside the existing organic ones
- Some conventional-specific cost categories may exist (e.g., synthetic inputs) — researcher should check actual tab data
- Enterprises grouped by type in the UI: organic section and conventional section displayed separately

### Sync triggering and access
- No sync buttons — data appears automatically via page-load fetch
- Sandy (OFFICE role) sees ALL enterprises — both organic and conventional
- Sandy can enter actuals for ALL enterprises (organic + conventional) — consistent workflow
- New enterprises from the Macro Rollup appear silently on next page load — no notification needed
- Move away from explicit "sync" UX — things should just be current

### Claude's Discretion
- Which tabs in the Macro Rollup are utility/non-enterprise (detection logic)
- How to handle the on-page-load sync without blocking UI rendering
- Stale data indicator design and placement
- Error handling for partial sync failures (some tabs succeed, some fail)
- How to handle enterprise tabs with no matching field in the registry

</decisions>

<specifics>
## Specific Ideas

- "I want to move away from sync buttons and have everything just sync in the background. Things break when syncs happen."
- Organic field certification is tracked explicitly in the farm-registry service — use that as the source of truth, not the farm-budget service's classification
- Organic fields are dedicated (certified organic fields) — the system won't enforce this but it's how the farm operates

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-all-enterprise-sync*
*Context gathered: 2026-03-21*
