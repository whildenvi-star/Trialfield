# Phase 31: Claims Tables + API - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Claims, documents, and timeline data foundation in Supabase. Schema (claims, claim_documents, claim_timeline), Storage bucket (claim-documents, private), signed-URL upload pattern, and CRUD route handlers. No UI — Phase 32 handles the claims lifecycle interface.

</domain>

<decisions>
## Implementation Decisions

### Claim pipeline stages
- 6 stages: Notice of Loss → Filed → Adjuster Assigned → Under Review → Settled → Closed
- Stage stored as enum in claims table
- These stages map 1:1 to Kanban columns in Phase 32

### Deadline model
- Auto-calculated deadlines based on stage entry date + standard filing windows
- User can override any auto-calculated deadline
- Deadlines recalculate on stage transitions (e.g., moving to "Filed" sets next deadline)

### Multi-claim support
- Multiple claims allowed per policy (e.g., prevent planting + harvest loss on same crop year)
- policy_id is FK but not unique — one-to-many relationship

### Create-from-policy prefill
- Auto-fill from policy: crop, county, coverage type (RP/RP-HPE/YP), coverage level (%), effective guarantee
- User provides at creation: date of loss, brief description
- Initial stage: Notice of Loss

### Claude's Discretion
- Financial fields on claims table (estimated loss, indemnity, deductible, appraised value — pick what's reasonable for crop insurance tracking)
- Whether claims link to clu_record_id in addition to policy_id (decide based on existing schema relationships)
- Cause-of-loss field — structured dropdown of FCIC codes vs free text vs both
- Initial deadline auto-set on create-from-policy (decide based on deadline model above)

</decisions>

<decisions>
## Document Upload Decisions

### Claude's Discretion
- Allowed file types (PDF, JPG, PNG baseline — add spreadsheets if useful)
- File size limit per document (10-25MB range)
- Document categories/tags vs flat list (decide based on what Phase 32 UI needs)
- Document access model — module-level vs claim-level RLS (decide based on existing portal RBAC patterns)

</decisions>

<decisions>
## Timeline & Audit Trail Decisions

### Claude's Discretion
- Auto-tracked events (baseline: created, stage change, doc upload, deadline change, financial update — add adjuster assignment if schema supports it)
- Manual note types — plain text vs tagged notes (decide based on Phase 32 timeline UI needs)
- User tracking on timeline entries (decide based on portal's multi-user model)
- Immutable vs editable timeline entries (immutable recommended for audit trail)
- DB triggers vs application code for auto-events (decide based on Supabase + Next.js patterns)

</decisions>

<specifics>
## Specific Ideas

- Claims are "decision support / tracking" not official FCIC filing — same philosophy as insurance module
- Signed URL pattern: server generates URL → client PUT to Storage → client posts metadata (no file bytes through Server Actions)
- Schema must enforce FK to insurance_policies (Phase 29 dependency)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-claims-tables-api*
*Context gathered: 2026-03-05*
