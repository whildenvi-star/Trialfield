# Phase 3: Mobile Dashboard - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a phone-first dashboard that becomes the home screen of the portal. Farm team opens the app and immediately sees module cards showing the projected plan and current state for each accessible module. Users can tap a quick-action to make simple updates (mark steps done, add a note) without navigating away. Tapping a card navigates into the full module.

This is the field crew's window into the plan vs. reality gap — they see what was projected in winter and can make simple corrections from the front lines.

</domain>

<decisions>
## Implementation Decisions

### Card Layout & Content
- Summary card style: module name, 1-2 key data points, one quick-action button — clean and scannable on small screens
- All modules the user has access to get a card (no curated subset — access tiers control what appears)
- Cards in fixed order by module type — consistent and predictable for daily use
- Cards show live data when online, fall back to last-cached data (with timestamp) when offline — uses Phase 2 sync infrastructure

### Card Empty State
- Cards are never empty — they show the projected plan data (crop, variety, input targets, expected units) from the winter budget planning even before actuals are entered
- The plan IS the content; "no actuals yet" is a valid and useful card state, not an error

### Quick-Actions
- Primary action: mark a task or step complete — inline optimistic update, card reflects change without navigation
- Secondary: Claude's discretion on whether a short note/annotation action fits (simple updates only, not full actuals editing)
- Inline interaction — no bottom sheet, no navigation away from dashboard
- Scope: simple field corrections (mark done, note a change). Full input/pass/seed quantity editing is a separate future phase.

### Access Filtering
- Use existing user tiers (admin / office / operator) already in the system — no new access logic
- Admin: full dashboard, all module cards
- Office: operational cards (crop plan, inputs, field obs) — no marketing or financial cards
- Operators/field crew: field-relevant cards per their access
- Access filtering is data-driven from existing permission system

### Navigation & Entry Point
- Dashboard replaces the current home/first tab in the mobile bottom nav (built in Phase 1)
- Dashboard is the default landing screen when opening the portal on mobile
- Tapping a card body → navigate into full module view (same destination as tapping the nav tab)
- Tapping the quick-action button → inline update, stay on dashboard

### Claude's Discretion
- Specific modules included and their fixed ordering (infer from codebase module structure)
- Whether a note/annotation quick-action is added alongside mark-complete
- Loading skeleton design for cards
- Exact spacing, typography, card shadow treatment
- Error state handling (failed data fetch)

</decisions>

<specifics>
## Specific Ideas

- "The card shows the plan from what admin is projecting in the winter" — projected budget/crop plan data is the baseline content, even before actuals exist
- Vision: field crew can see crop, variety, input inventory, expected units per field/enterprise and spot the gap between plan and reality. They make simple corrections; Sandy reconciles larger changes in the office interface.
- The dashboard bridges the office-planned world and the field-reality world — it's the front-line crew's read/light-write view of the farm's operating plan.

</specifics>

<deferred>
## Deferred Ideas

- Full actuals editing from the field (changing input quantities, passes, seed rates) — deeper actuals correction workflow, future phase
- Visual projected-vs-actual comparison chart or delta indicator on cards — a richer "plan over reality" visualization, future phase
- Dashboard personalization / card reordering by user preference — future phase

</deferred>

---

*Phase: 03-mobile-dashboard*
*Context gathered: 2026-05-22*
