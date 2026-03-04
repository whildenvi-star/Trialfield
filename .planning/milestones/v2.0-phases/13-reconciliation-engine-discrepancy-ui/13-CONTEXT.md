# Phase 13: Reconciliation Engine & Discrepancy UI - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The system automatically matches farm tickets to settlement lines by normalized ticket number within buyer and cropYear, surfaces every unmatched load with reason hints, displays weight variances with color-coded thresholds, and lets the farm manager flag and annotate discrepancies. Manual-override linking is available for edge cases where ticket numbers genuinely differ between farm and buyer.

</domain>

<decisions>
## Implementation Decisions

### Matching trigger & flow
- Auto-match runs immediately when a settlement is committed — no extra user step required
- Re-match button available on each settlement for when new tickets arrive after initial import
- Ticket number normalization: strip H-prefix and leading zeros, compare numeric core (H066666, 066666, 66666 all match to "66666")
- Match results shown as summary toast notification ("42 matched, 3 unmatched") with badge count on settlement card

### Variance display
- Show both pounds and percentage: "-340 lbs (-0.8%)"
- Color-coded: green within 1% tolerance, red above 1% threshold (hardcoded for now — configurable threshold deferred to v2.x REC-06)
- Settlement summary table: per-crop per-buyer rows (e.g., "Hybrid Rye — Meristem Malt")
- Columns: farm lbs, buyer lbs, variance (lbs + %), ticket count
- Pounds are the primary comparison unit (apples-to-apples); buyer's reported bushels and farm's calculated bushels shown in adjacent columns for reference only — variance computed on pounds only

### Unmatched loads view
- Two-panel split layout: "Farm-Only Tickets" on left, "Settlement-Only Lines" on right; stacks vertically on mobile
- Filter dropdowns at top: buyer and cropYear (default to most recent cropYear)
- Manual matching: user selects a farm ticket and a settlement line, clicks "Link" — sets matchStatus to "manual"
- Reason hints on each unmatched ticket: "No settlement for [buyer]" or "Ticket# not in settlement"

### Dispute & override workflow
- Inline dispute: click "Dispute" button on matched ticket row, text field appears for note, status changes immediately — no modal
- Flag + note only — no resolution workflow for now (deferred to v2.x WRK-01)
- Manual overrides show distinct orange "Manual" badge vs green "Matched" badge — preserves audit trail of human intervention
- Color-coded badge column on ticket list: Unreconciled (gray), Matched (green), Disputed (red), Manual (orange)
- Same badge appears on ticket detail screen

### Claude's Discretion
- Navigation/routing structure for reconciliation views
- Exact toast notification implementation
- Mobile responsive breakpoints for two-panel split
- Badge styling and positioning on ticket list
- Settlement summary table pagination or scrolling behavior

</decisions>

<specifics>
## Specific Ideas

- Reconciliation should compare raw pounds not derived bushels — buyers use different shrink methods, so bushel comparison is apples-to-oranges
- Existing schema already has SettlementLine.ticketId (FK), matchStatus ("unmatched"|"matched"|"disputed"|"manual"), and notes — no schema changes needed for reconciliation status
- 14 known duplicate ticket numbers exist in data — matching must handle within buyer+cropYear scope, not globally
- The 1% threshold mirrors the deferred REC-06 default, making future configurability a natural extension

</specifics>

<deferred>
## Deferred Ideas

- Configurable weight discrepancy tolerance per crop (REC-06) — v2.x
- Multi-buyer season summary on one screen (REC-07) — v2.x
- Fuzzy matching by date + weight for non-matching ticket numbers (REC-08) — v2.x
- Disputed ticket resolution workflow with resolvedAt tracking (WRK-01) — v2.x

</deferred>

---

*Phase: 13-reconciliation-engine-discrepancy-ui*
*Context gathered: 2026-03-02*
