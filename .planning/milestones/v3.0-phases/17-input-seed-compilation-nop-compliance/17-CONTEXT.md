# Phase 17: Input & Seed Compilation + NOP Compliance - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Pull input application records and seed varieties from farm-budget into organic-cert MaterialUsage and SeedLot records. Users resolve unmapped materials to NOP statuses once (persists across seasons). NOP compliance rules run only against resolved materials. Source badges show data provenance on every compiled record.

</domain>

<decisions>
## Implementation Decisions

### Material Resolution Flow
- Unresolved materials panel lives inline on the compile page — no separate materials admin page needed
- NOP status assignment uses a dropdown (Approved, Restricted, Prohibited, Exempt) plus an optional notes field for audit trail
- Batch resolution: all unresolved materials displayed at once with individual dropdowns, one "Save All" button to commit
- Resolved materials remain editable on the compile page — user can change NOP status anytime without navigating elsewhere

### Compliance Indicators
- Badge/pill style for NOP compliance verdicts: green "Compliant", red "Prohibited", amber "Restricted", gray "Needs Review"
- Summary bar at top of inputs section showing counts (e.g., "12 pass, 1 restricted, 3 needs review") plus per-row badges
- Manure 90/120-day rule runs using estimated dates derived from season (Spring → April 1, Fall → Oct 15) with a visible "date estimated" warning badge on affected records
- OMRI Listed shown as a separate badge alongside the NOP compliance badge when applicable

### Compile Trigger UX
- One "Compile All" button for inputs and seeds together — not separate triggers
- Diff-style preview before commit: new records, updated records, and unchanged records shown separately (consistent with Phase 16 enterprise compile pattern)
- Compile button disabled with explanatory message when enterprises have not been compiled yet — prevents FK errors
- After successful compile, unresolved materials section automatically expands and scrolls into view with count badge

### Source Badges
- Text pill badges showing source name (e.g., "farm-budget", "manual") on every row in compiled records tables
- Existing manually-entered records get "manual" badge retroactively via `@default(MANUAL)` on the migration field
- All Phase 17 compiled records carry `dataSource: "SYNCED"` displayed as "farm-budget" badge

### Claude's Discretion
- Source badge color palette — pick colors that complement compliance badges (green/red/amber/gray) without clashing
- Exact layout of the unresolved materials panel (table rows, card layout, etc.)
- Compliance summary bar design and positioning
- Loading states during compile operations

</decisions>

<specifics>
## Specific Ideas

- Compliance indicators should feel like GitHub label pills — colored, readable, compact
- The unresolved materials workflow should feel efficient: open compile page → compile → see unresolved items auto-surface → batch assign statuses → save all → see compliance results update
- OMRI badge is informational for inspectors who look for it during NOP audits

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-input-seed-compilation-nop-compliance*
*Context gathered: 2026-03-02*
