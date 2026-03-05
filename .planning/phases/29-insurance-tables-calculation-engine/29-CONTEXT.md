# Phase 29: Insurance Tables + Calculation Engine - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Insurance policies migrated from fsa-acres JSON into Supabase with APH auto-detection from CLU records, actual yield bridging from grain-tickets, and automatic potential claim flagging. This is the data/engine phase — no policy editor UI, no coverage comparison matrix, no payout simulator (those are Phase 30).

</domain>

<decisions>
## Implementation Decisions

### APH Auto-Detection
- Claude's discretion on calculation method (simple average vs acre-weighted) based on CLU data structure
- When CLU records lack APH values, Claude decides fallback behavior (empty+prompt vs county average)
- Claude decides refresh behavior (auto on load vs manual button) based on insurance workflow patterns
- Match key: Claude examines data overlap and picks crop+farm vs crop+farm+line based on what produces reliable matches

### Yield-to-Policy Matching
- Claude decides matching approach (crop+destination vs crop+farm-wide) based on existing grain-ticket and policy data
- Claude decides live API call vs synced snapshot based on existing cross-app fetch patterns in the codebase
- Claude decides unit conversion approach (standard bushel weights vs configurable per crop) based on grain-ticket data patterns
- Claude decides moisture adjustment handling (raw delivered vs moisture-adjusted) based on whether moisture data exists in grain tickets

### Claim Alert Rules
- Claude decides trigger approach (simple threshold vs tiered warnings) for useful signal without noise
- Claude decides alert timing (on yield sync vs auto on page load) based on yield bridge implementation
- Claude decides alert detail level (flag only vs estimated indemnity) appropriate for data/engine phase vs UI phase
- Claude decides plan type support scope (all three RP/RP-HPE/YP vs yield-only) based on Phase 29 requirements vs Phase 30 responsibilities

### Migration & Schema
- Claude decides claim field handling (migrate all vs split for Phase 31) based on cleanest schema approach
- Claude decides multi-year support (policy_year column vs single-season) based on schema design and future requirements
- Claude decides farm linking strategy (FK to CLU records vs text-only with later FK) based on data overlap
- Claude decides migration type (one-time seed vs repeatable sync) based on how Phase 27 CLU migration was handled

### Claude's Discretion
- All areas above — user gave full discretion on all implementation decisions
- APH calculation algorithm and fallback strategy
- Yield bridge architecture (live vs snapshot, matching logic, unit handling)
- Claim alert design (thresholds, timing, detail level, plan coverage)
- Schema design (field placement, multi-year, FK strategy, migration approach)

</decisions>

<specifics>
## Specific Ideas

- Existing fsa-acres app already has working APH lookup (`lookupCluAph()`) and grain-ticket yield bridge (`lookupGrainYield()`) — use these as reference implementations
- Only 3 insurance policies currently in fsa-acres/data/data.json — small migration
- Existing policy data has farmName as free text ("KLUG, DAVIS"), farmNumber field (may be empty), lineNumber field
- Remember: this is "decision support" not a premium calculator — keep it practical for a farm operator

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-insurance-tables-calculation-engine*
*Context gathered: 2026-03-05*
