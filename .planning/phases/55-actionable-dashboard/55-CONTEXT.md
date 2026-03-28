# Phase 55: Actionable Dashboard - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The portal dashboard shows what actually needs attention today — overdue claims, unreported CLUs, unreconciled settlements, delivery shortfalls — replacing the static module navigation cards. Each item links directly to the relevant module with context. Dashboard degrades gracefully when Express apps are offline (Promise.allSettled).

</domain>

<decisions>
## Implementation Decisions

### Item presentation
- Compact list rows (not cards or grouped sections)
- Color-coded source badges per module: [FSA], [INS], [GT], [BUDG]
- Each row shows: severity icon, summary description with count, source badge, age
- Aggregated rows (e.g., "3 CLU records missing acreage") not one-row-per-record
- Empty state: simple "Nothing needs attention" message with checkmark, no module links

### Priority & ordering
- Items grouped by module (FSA, Insurance, Grain Tickets, Budget)
- Two severity levels: warning (⚠) for overdue/critical, info (●) for routine items
- Total count header at top: "7 items need attention"
- Show all items — no cap or pagination (farm-scale volume, not enterprise-scale)

### Dashboard layout
- Action items fully replace existing module navigation cards (sidebar handles nav)
- Module group headers are clickable — navigate to that module
- Zero-item state: just the checkmark message, no module cards or quick links
- Offline Express apps: dimmed group with "Unavailable" tag and "(service offline)" note

### Deep-link behavior
- Clicking an item navigates within the portal (same tab, standard Next.js navigation)
- Links go to portal module pages with filter params (e.g., /fsa-578?filter=missing-acreage)
- For iframe-embedded Express apps: filter passed as URL param to iframe src
- Supabase-native modules: filter view to show only relevant records (not highlight-in-full-table)

### Claude's Discretion
- Exact badge colors per module (within the soil-dark palette)
- Loading skeleton while fetching action items
- Exact spacing, typography, and responsive breakpoints
- Severity classification rules (which item types are warning vs info)
- API route structure for aggregating status from Supabase + Express apps

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the soil-dark aesthetic.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 55-actionable-dashboard*
*Context gathered: 2026-03-28*
