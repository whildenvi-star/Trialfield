# Phase 20: Farm-Registry Bug Fix - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the farm-registry PUT /api/fields/:id endpoint so all form-submitted fields persist correctly. The updatable whitelist is missing `growerId`, causing it to be silently dropped on save. Additionally, the save flow has zero error handling — failures are completely silent with no user feedback.

</domain>

<decisions>
## Implementation Decisions

### Save feedback
- Add error toast when save fails (red toast, same style as existing green "Saved" toast)
- Retain user's edits in the form on failure so they can retry without losing work
- Add loading state on save button — disable briefly with "Saving..." text to prevent double-clicks
- No mismatch check needed — once the whitelist bug is fixed, silent drops shouldn't occur

### Field validation
- Add basic server-side guardrails mirroring what the client already validates: reject negative acres, require valid ownership enum (owned/rented/mixed), ensure name is non-empty
- Server-side sum constraints (tillable breakdown, cert acres) are client-only convenience — don't duplicate on server
- Return field-level error details in JSON response: `{errors: [{field: 'reportingAcres', message: 'Must be >= 0'}]}`
- Display validation errors as red toast (same pattern as save error), not inline field errors

### growerId handling
- growerId is NOT user-editable — preserve it on save but don't expose as a form field
- Add growerId to the PUT whitelist so it stops being silently dropped
- Single grower operation (Hughes Farm) — the allFields[0].growerId approach is acceptable
- Assign default 'grw_001' for fields missing growerId

### Claude's Discretion
- Whether to backfill existing data.json fields that are missing growerId (investigate downstream usage during implementation)
- Exact toast styling and duration
- Any additional defensive coding patterns for the save flow

</decisions>

<specifics>
## Specific Ideas

- The core bug is straightforward: `growerId` is not in the `updatable` array at server.js line 191-200
- The save error handling gap is a secondary but important fix — users currently have zero indication when saves fail
- This is an internal tool for a single farm operation, not a public API — validation should be practical, not enterprise-grade

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-farm-registry-bug-fix*
*Context gathered: 2026-03-04*
