# Phase 5: Privacy Foundation - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Financial performance data is invisible to OFFICE and CREW through every access vector — API response, browser DevTools, and UI — before any role-filtered feature is built. This phase creates the RBAC permissions (`budget:read`, `budget:financial`), strips financial fields from API responses for non-ADMIN roles, removes the ADMIN auth fallback globally, and removes OFFICE `sale:read` permission.

</domain>

<decisions>
## Implementation Decisions

### Financial Field Boundary
- **Visible to OFFICE**: All direct production costs — seed costs (variety, brand, rate, acres, pricePerUnit, totalCost), material/input costs (name, category, rate, acres, unitCost, totalCost), operation/machinery costs (description, type, costPerAcre, acresWorked, totalCost), fuel costs, target yield (bu/acre)
- **Hidden from OFFICE**: Land rent, overhead, drying costs, interest, crop insurance, sale prices, revenue, projected revenue, gross margin, profit/acre
- **Summary**: The split is "direct production costs" vs "overhead + financial performance." OFFICE needs production cost detail for entering actuals in Phase 6.
- Full line-item detail visible (not just aggregates) — OFFICE sees every cost line item with unit prices, rates, and totals

### Budget Tab Appearance for OFFICE
- Same "Budget" tab title — no heading change to signal filtered view
- Identical cost tables to what ADMIN sees (seed, materials, operations)
- Revenue/margin summary cards simply don't render — only Total Cost and Cost/Acre cards appear
- Revenue projection section absent entirely
- No indication to OFFICE that data was withheld — it looks like the data doesn't exist
- **Researcher note**: Investigate where overhead-type costs (rent, drying, insurance, interest) live in the current data model — determine if they're in separate sections or mixed into existing cost tables, and what row-level filtering may be needed

### CREW Budget Access
- Budget tab entirely hidden from CREW navigation — they don't see it at all
- CREW API requests to budget routes receive 403 Forbidden

### Access Denial Behavior
- API response shape: financial fields completely absent from JSON keys (not present as null) — no trace in DevTools Network tab
- No UI indicators of restriction (no "restricted" badges, no lock icons, no "admin only" labels)
- Direct URL access to financial-only endpoints returns 403 Forbidden
- API routes return `{error: "Unauthorized", status: 401}` for unauthenticated requests
- Page routes redirect to /login for unauthenticated requests

### ADMIN Fallback Removal
- Remove the ADMIN fallback in `getAuthContext()` globally — affects ALL routes, not just budget
- No dev-only bypass needed — user always logs in during local development
- This is a root cause fix: no route should ever fall back to ADMIN for unauthenticated requests

### RBAC Permission Changes
- New `budget:read` permission (ADMIN + OFFICE) — gates access to cost data on budget routes
- New `budget:financial` permission (ADMIN only) — gates access to revenue, margin, overhead, sale price data
- Remove `sale:read` from OFFICE role (PRIV-04)
- **Researcher note**: Investigate what `sale:read` currently gates in the UI — check if removing it breaks any screens Sandy currently uses

### Claude's Discretion
- Exact error message wording for 401/403 responses
- How to structure the API field-stripping logic (middleware vs per-route)
- TypeScript type handling for conditional response shapes

</decisions>

<specifics>
## Specific Ideas

- Sandy = the primary OFFICE user; OFFICE role IS Sandy's access level
- Sandy should have slightly more access than CREW but never see financial performance data
- The financial boundary is NOT simply "revenue side vs cost side" — certain cost categories (overhead, rent, insurance, interest, drying) are also hidden because they reveal farm financial position
- Target yield stays visible because it's agronomic data, not financial

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-privacy-foundation*
*Context gathered: 2026-03-20*
