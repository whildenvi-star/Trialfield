# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** A farm manager can pull Case IH field data and hand an inspector a complete, print-ready audit report with zero manual data entry.
**Current focus:** Phase 2: Field Records & History

## Current Position

Phase: 2 of 3 (Field Records & History)
Plan: 2 of 4 in current phase (02-02 complete — field index upgrade + history timeline UI, TypeScript clean)
Status: Phase 2 in progress
Last activity: 2026-02-25 -- Completed 02-02: field index card grid with activity stats, field history timeline page with season grouping, unified operation cards, filter bar

Progress: [######....] 57%

## Performance Metrics

**Velocity:**
- Total plans completed: 4 (01-01, 01-02, 01-03, 02-01)
- Average duration: 5.5 min
- Total execution time: 0.30 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-case-ih-api-integration | 3 complete | 19 min | 6 min |
| 02-field-records-history | 2 complete | 8 min | 4 min |

**Recent Trend:**
- Last 5 plans: 9 min, 5 min, 5 min, 4 min, 4 min
- Trend: fast execution

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 3-phase structure following data pipeline order (ingest -> view -> report)
- [Roadmap]: No separate audit store hardening phase in v1 (deferred to v2 per requirements)
- [Roadmap]: Manual entry (FIELD-05) in Phase 2 alongside viewing screens, not Phase 1
- [01-01]: OAuth2 token stored in server-side memory only — never DB, cookies, or localStorage
- [01-01]: useMock() auto-enables in non-production when credentials absent, disabled in production
- [01-01]: validateConnection() returns linkedAccountWarning on empty field list (CNH linked account limitation)
- [01-01]: Zod v4 safeParse throughout normalizer — CNH API schema is undocumented, defensive parsing required
- [01-02]: Manual data always wins — approve returns 409 if manual FieldOperation/HarvestEvent exists for same date/type
- [01-02]: Linked account early return in runFieldOpsSync — empty field list triggers no_data status + message
- [01-02]: DELETE /connection preserves SyncedOperation rows for audit trail compliance
- [01-02]: GET /sync-state returns { connected: false } (200) when no FieldOpsSyncState exists — UI uses this for flow control
- [Phase 01-03]: Sidebar FieldOps link not role-gated at component level — route-level auth gates protect data; sidebar has no session context
- [Phase 01-03]: cmdk Command used inline (not CommandDialog) in split-panel matching UI — always-visible search better than modal overlay for matching workflow
- [Phase 01-03]: 409 conflict handled client-side with dedicated dialog — manual-data-wins policy surfaced clearly to admin before rejecting synced record
- [02-01]: db push used instead of migrate dev — no migration history existed; db push syncs schema without requiring baseline migration
- [02-01]: CropLot lot suffix strategy — first harvest uses base lot number, subsequent harvests get -N suffix by counting existing CropLots
- [02-01]: Explicit dataSource: MANUAL on manual harvest creates — documents intent even though MANUAL is the Prisma default
- [02-01]: Tenant isolation via farmId in where clause in history endpoint — matches auth pattern from staged-ops
- [02-02]: Card grid layout over table for field index — cards scale better to history links and show activity stats without column overflow
- [02-02]: TimelineItem unification — merge 4 record types into single chronological stream; simplifies filter bar and rendering loop
- [02-02]: syncRunId from notes field (not SyncedOperation join) — Phase 2 scope; full provenance display deferred to Phase 3
- [02-02]: MaterialUsage/FertilityEvent default MANUAL dataSource — neither model has dataSource column in schema
- [02-02]: Three preset year-window buttons replace arbitrary offset stepper — simpler UX covering practical audit range

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: CNH FieldOps full API response schema is behind login-gated developer portal. Build against farm-budget/fieldops/mock-data.js initially.
- [Phase 3]: Need actual certifier inspection worksheet (CCOF, Oregon Tilth, or MOSA) before PDF layout work.

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 02-02-PLAN.md — Phase 2 Plan 2 complete; ready for 02-03 (manual entry form)
Resume file: None
