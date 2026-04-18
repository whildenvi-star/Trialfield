# Phase 69: Field Operations TC Log - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

A portal page where all roles (office, admin, operator) can add, TC (Transaction Complete),
and delete field operation records for machinery passes. Each TC captures: field, operation
type, date completed, and who signed off. Writes to organic-cert's FieldOperation table for
NOP 3-year audit history. Includes year selector for prior season review.

This is distinct from Phase 46's mobile /crop-plans flow. Phase 46 is operator-facing,
mobile-first, checkbox-tap confirmation built for in-field use. This phase is
desktop-accessible, all-role, formal sign-off oriented — designed for the office, admin,
and operators who need to record and review TCs from any device.

TC = Transaction Complete: an organic certification audit strategy. Auditors review TCs
as formal sign-offs on the 3-year field history. The signer is not necessarily the person
who did the work — this is explicitly a sign-off record.

</domain>

<decisions>
## Implementation Decisions

### View Layout
- Field-first: user picks a field, sees its operation records for the selected year
- Route: `/app/field-ops`
- Year selector defaults to current crop year; dropdown navigates to prior seasons
- No separate routes per field — single page with field selection state

### Operation Types
- Tillage, No-Till, Planting, Herbicide, Fertilizer, Scouting, Harvest, Hauling, Other
- Hauling is a distinct type (post-harvest truck handling — audit-relevant for organic cert)

### TC Sign-off
- Minimum required: field + operation type + date
- "TC'd by" auto-fills from logged-in user (Supabase session)
- Override picker shows all users with operator/agronomist/admin roles
- Notes field is optional

### Role Access
- All roles (office, admin, operator) can add TCs and delete their own TCs
- Admin can delete any TC
- No read restrictions — all roles see the full field history

### History
- Defaults to current crop year
- Year dropdown to navigate to prior seasons for NOP 3-year history review

### Data Layer
- Writes to organic-cert FieldOperation table (same backing store as Phase 46)
- `plannedSource: "field-ops-tc"` to distinguish from mobile-logger entries
- Reuse existing organic-cert `/api/field-enterprises/[id]/operations` POST endpoint

### Claude's Discretion
- Whether to surface planned passes (from farm-budget) alongside confirmed TCs, or confirmed-only
- Field picker implementation (search box vs paginated list)
- TC list layout (table rows vs card rows)
- How to handle the year selector when cert data spans partial years

</decisions>

<specifics>
## Specific Ideas

- "TC = Transaction Complete" — an organic certification audit strategy, not just a
  confirmation UX. Auditors review TCs as formal sign-offs on the 3-year field history.
- Sandy (office role) needs to be able to add TCs retroactively for work that happened
  yesterday or last week — this is a primary use case.
- The signer and the worker are intentionally separate concepts. A supervisor can TC
  work they witnessed without being the equipment operator.

</specifics>

<deferred>
## Deferred Ideas

- Printable PDF TC report for auditors — future phase
- Photo attachments on TCs — requires Supabase Storage (noted in v9.0 vision)
- Geofenced auto-prompting — already deferred from Phase 46

</deferred>

---

*Phase: 69-field-operations-tc-log*
*Context gathered: 2026-04-17*
