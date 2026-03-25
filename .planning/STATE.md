# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v10.0 Platform Consolidation & Data Integrity — Phase 52: Yield Pipeline

## Current Position

Phase: 52 of 61 (Yield Pipeline)
Plan: 03 complete
Status: Complete (3/3 plans complete)
Last activity: 2026-03-25 — Phase 52 Plan 03 complete: SC-4 gap closure — empty-state wording in insurance-workspace and farm-budget dashboard (PIPE-04)

Progress: v7.0 [██████████] SHIPPED | v8.0 [██████████] SHIPPED | v9.0 [█████░░░░░] PAUSED | v10.0 [░░░░░░░░░░] 0%

**v9.0 status:** Phase 44-46 complete, Phase 47 Plan 01 complete (offline sync engine shipped 2026-03-25), 47-02 and 48 paused — resume after v10.0
**v10.0 status:** Roadmap created — 13 phases (49-61), ready to plan phase 49

## Performance Metrics

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-14 | 13 | 2026-03-04 |
| v3.0 | 15-19 | 12 | 2026-03-04 |
| v4.0 | 20-23 | 7 | 2026-03-04 |
| v5.0 | 24-26 | 9 | 2026-03-05 |
| v6.0 | 27-34 | 15 | 2026-03-06 |
| v7.0 | 35-39 | 8 | 2026-03-08 |
| v8.0 | 40-43 | 9 | 2026-03-08 |
| v9.0 | 44-45 | 4 | PAUSED |
| **Total** | **47** | **96** | |
| Phase 49 P02 | 3 | 2 tasks | 4 files |
| Phase 49-canonical-field-ids P03 | 7 | 2 tasks | 9 files |
| Phase 50-canonical-crop-registry P01 | 2 | 2 tasks | 2 files |
| Phase 50-canonical-crop-registry P02 | 5 | 2 tasks | 6 files |
| Phase 50 P03 | 12 | 3 tasks | 14 files |
| Phase 51 P01 | 4 | 2 tasks | 4 files |
| Phase 51 P03 | 15 | 2 tasks | 4 files |
| Phase 51-fsa-insurance-data-consolidation P02 | 20 | 2 tasks | 5 files |
| Phase 46 P01 | 3 | 2 tasks | 6 files |
| Phase 46-field-pass-logger P02 | 4 | 1 task | 2 files |
| Phase 46-field-pass-logger P02 | 5 | 2 tasks | 2 files |
| Phase 52 P01 | 5 | 2 tasks | 3 files |
| Phase 46-field-pass-logger P03 | 3 | 1 tasks | 1 files |
| Phase 52 P02 | 16 | 2 tasks | 6 files |
| Phase 52 P03 | 5 | 1 tasks | 2 files |
| Phase 47 P01 | 4 | 2 tasks | 5 files |

## Accumulated Context

### Decisions

- [v10.0]: Pause v9.0 mobile work, do consolidation first — canonical field IDs and unified data make mobile work cleaner
- [v10.0]: All 42 requirements in scope (CONS, PIPE, UXN, DOM, AUTO) — full consolidation
- [v10.0]: Merged small related phases: PIPE-05..08 combined (53), UXN-04..09 combined (54) — 13 phases total
- [v9.0]: PWA approach (not native app) — @serwist/next, no app store
- [v10.0]: Phase 49 (canonical field IDs) is the dependency root — all cross-module joins depend on it
- [49-01]: Migration numbered 004 not 003 — 003-field-observations.sql already existed
- [49-01]: grain-tickets Farm.registryId is the existing canonical field ID linkage — no Prisma change needed
- [49-01]: fsa-acres uses Object.assign without allowlist — registryFieldId accepted implicitly, documented with comments
- [Phase 49-02]: Self-contained backfill scripts — normalize+alias matching logic duplicated across 4 scripts (not shared module) for independent runability
- [Phase 49-02]: grain-tickets backfill script reads .env manually (no dotenv dep) to load DATABASE_URL for Prisma
- [Phase 49-03]: grain-tickets had no registry sync — added POST /api/farms/sync-registry with ID-first/name-fallback pattern matching farm-budget
- [Phase 49-03]: portal CLU card registry selector uses select dropdown (not autocomplete) — 56 fields fit comfortably, simpler implementation
- [Phase 50-01]: Organic flag is boolean attribute on crop record (not baked into name) — "Yellow Corn" with organic=true, not "ORG Yellow Corn"
- [Phase 50-01]: Seed Beans and Natto Beans kept as separate records from Soybeans — fundamentally different markets, not just organic premium
- [Phase 50-01]: 38 crop records across 13 categories covering all platform crops; FSA land-use categories excluded
- [Phase 50-02]: farm-budget enterprises use cropTypeNames (category names), not individual crop strings — backfill targets fields[].crop and cropTypes[].subCrops[].name instead
- [Phase 50-02]: fsa-acres non-crop FSA categories (NC, idle, gls, MIXED FORAGE/HAY) flagged as expected-unmatched, not errors
- [Phase 50-02]: grain-tickets Ticket.registryCropId updated in bulk by crop name string match via updateMany
- [Phase Phase 50-03]: farm-budget crop dropdown is in field-editor.js not enterprise.js — both files modified to ensure registry references
- [Phase Phase 50-03]: FSA land-use categories (Idle/Fallow/CRP/Cover Crop) kept as FSA_LAND_USE_CATEGORIES local constant — not registry crops, merged at point of use
- [Phase 51-01]: GCS enrollments skipped in migration — program discontinued, not migrated to Supabase
- [Phase 51-01]: ins_482 flagged as potentially corrupt (no farm/crop, actual=40000)
- [Phase 51-01]: Claims skipped in migration — Phase 31 claims schema incompatible with legacy format
- [Phase 51-01]: data.json renamed to data.json.migrated after verified migration (read-only backup)
- [Phase 51-03]: Scraper scope from clu_records.crop — adapts to planted crops automatically
- [Phase 51-03]: manual_override pricing rows never overwritten by scraper
- [Phase 51-03]: Daily cron deferred — manual Refresh Prices button is the priority for CONS-03
- [Phase 51-02]: data/settings.json stores app settings locally (not in Supabase) — settings are app config not farm data
- [Phase 51-02]: Conservation practice fields mapped as individual Supabase columns — confirmed by migration script schema, no JSONB needed
- [Phase 51-02]: fsa-acres .gitignore created — node_modules must not be committed (Rule 2 auto-fix)
- [Phase 46]: resolveFieldEnterpriseId uses two cert calls (fields + enterprises) — acceptable for 56 fields, no caching needed
- [Phase 46]: crop-plans/[fieldId] graceful degradation — planned-only fallback when organic-cert unavailable to support offline mobile use
- [Phase 46-02]: Inline undo toast/bottom sheets with no external UI libs — consistent with Phase 45 pattern, inline CSS transitions
- [Phase 46-02]: Flush-before-start for pending confirmations — tap second pass while toast showing commits first immediately then starts new
- [Phase 46-02]: tokenRef stores auth token — useRef prevents stale closure in 5s setTimeout confirm callbacks
- [Phase 52-01]: Weight basis for yield is netWeight (net lbs after buyer deductions) — already on tickets, consistent across buyers
- [Phase 52-01]: Acre denominator for yieldPerAcre uses Farm.acres in grain-tickets; Plan 02 uses insurance planted_acres when pushing to portal
- [Phase 46-03]: Pre-existing TypeScript errors in enterprise-grid.tsx are out of scope (not caused by this change, different file)
- [Phase 52-02]: Crop-name matching used in farm-budget dashboard — cropRows aggregated by crop name with no registryCropId at render time
- [Phase 52-02]: GT badge uses CSS group-hover tooltip — enables formatted multi-line timestamp display
- [Phase 47]: SW uses raw IndexedDB API for Background Sync replay — idb library not available in SW bundle context
- [Phase 47]: Network errors (TypeError, AbortError) queued silently; HTTP errors re-thrown — only true offline failures are intercepted

### Pending Todos

None active.

### Blockers/Concerns

- v9.0 phases 47-48 paused pending v10.0 completion (by choice, not dependency) — phase 46 now complete
- Phase 51 (FSA/Insurance consolidation) is the riskiest — migrating live data between stores
- Phase 49 touches all 8 apps — backfill scripts need careful field name matching before writing IDs

## Session Continuity

Last session: 2026-03-25
Stopped at: Completed 52-03-PLAN.md — PIPE-04 gap closure complete. SC-4 closed in insurance-workspace and farm-budget dashboard. Phase 52 complete.
Resume file: —
Next action: Phase 53 (PIPE-05..08 combined)
