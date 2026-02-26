# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** A farm manager can pull Case IH field data and hand an inspector a complete, print-ready audit report with zero manual data entry.
**Current focus:** Phase 4 — Synced Harvest CropLot Wiring (gap closure)

## Current Position

Phase: 4 of 4 (Synced Harvest CropLot Wiring) — COMPLETE
Plan: 2 of 2 in Phase 4 — COMPLETE (04-02 executed; enterpriseLotMap fallback in report assembler + CropLot-aware toast in review page)
Status: Phase 4 complete — all synced harvest CropLot wiring done; PDF harvest log shows lot numbers; admin toast reports CropLot counts
Last activity: 2026-02-26 -- Completed 04-02: enterpriseLotMap fallback in report-assembler.ts; useRouter + actionable no-enterprise toast + newLots/updatedLots counters in review/page.tsx

Progress: [####################] 100% (Phase 4: 2/2 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 11 (01-01, 01-02, 01-03, 02-01, 02-02, 02-03, 03-01, 03-02, 03-03, 04-01, 04-02)
- Average duration: 6 min
- Total execution time: ~1.10 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-case-ih-api-integration | 3 complete | 19 min | 6 min |
| 02-field-records-history | 3 complete | 12 min | 4 min |
| 03-inspection-report-generation | 3 complete | 45 min | 15 min |
| 04-synced-harvest-croplot-wiring | 2 complete | 9 min | 4.5 min |

**Recent Trend:**
- Last 5 plans: 7 min, 13 min, 25 min, 6 min, 3 min
- Trend: stable

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
- [02-03]: PUT handlers on collection routes (/operations, /applications, /harvest) vs [recordId] routes — consistent with form submission where enterpriseId is the URL param
- [02-03]: Inline cmdk Command (not CommandDialog) for product/equipment search inside Sheet — always-visible inline search better than modal-within-sheet
- [02-03]: Empty season cards link to /field-enterprises for crop year creation — no "Add records" until enterprise exists
- [02-03]: dataSource: MANUAL explicit on FieldOperation.create — documents intent even though MANUAL is Prisma default
- [03-01]: col()/headerCol() return explicit typed objects (not StyleSheet entries) so they compose without StyleSheet conflicts
- [03-01]: assembleReportData uses single farm query + one CropLot query for mass balance — minimizes DB round trips
- [03-01]: ReportPage orientation prop defaults to portrait; caller passes landscape for wide-table sections
- [03-02]: FarmInfo extended with certStatus, certExpiry, nopId — cover page and operation overview need cert fields not in original interface
- [03-02]: FieldWithHistory.enterprises extended with fieldOperations and fertilityEvents arrays — field history requires operations per enterprise not just summary fields
- [03-02]: Bookmark is a type in react-pdf (Page prop), not a JSX element — TOC uses static list; PDF bookmarks added to section Pages
- [03-02]: Application/harvest logs filter to current cropYear — 3-year detail is in field history; all-years log would be redundant
- [03-02]: Shared pageProps spread pattern — const pageProps = { farmName, reportTitle, generatedDate } spread to all 8 sections from InspectionReport
- [03-03]: window.location.href for PDF download — triggers browser download without needing blob URL management
- [03-03]: Tenant isolation on download route via report.farmId !== farmId check before file read — prevents cross-farm file access
- [03-03]: File-not-found 404 separate from record-not-found 404 — distinguishes DB miss from disk miss
- [03-03]: Optional field filter defaults to all fields — fieldIds absent from POST body means assembleReportData uses all farm fields
- [04-01]: Year-matched FieldEnterprise lookup — prefer operationDate.getFullYear() === cropYear before falling back to latest-by-desc to prevent wrong-year lot numbers
- [04-01]: One CropLot per FieldEnterprise for synced harvests — findFirst by fieldEnterpriseId, increment quantityLbs if exists rather than creating second lot
- [04-01]: convertYieldToLbs returns null for unknown crops/units — fail safely rather than guess test weight for undocumented Case IH schema
- [04-01]: SyncedOperation.update(APPROVED) moved inside $transaction — ensures no approved harvest without a corresponding CropLot
- [04-02]: enterpriseLotMap built before flatten loop — first lot per enterprise wins, handles sparse join (cropLots: [] on harvests that updated existing lot)
- [04-02]: Bulk toast wording uses full model names "HarvestEvents" / "CropLots" for admin clarity
- [04-02]: No-enterprise actionable error routes to /field-enterprises via useRouter.push inside sonner action.onClick

### Pending Todos

1. Work on grain ticket system enhancements (general) — TBD scope

### Blockers/Concerns

- [Phase 1]: CNH FieldOps full API response schema is behind login-gated developer portal. Build against farm-budget/fieldops/mock-data.js initially.

## Session Continuity

Last session: 2026-02-26
Stopped at: Completed 04-02-PLAN.md — Phase 4 complete, all synced harvest CropLot wiring done (11 plans total, 4 phases complete)
Resume file: None
