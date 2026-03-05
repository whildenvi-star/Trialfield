# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v6.0 FSA Acres, Insurance & Claims — Phase 27 (FSA Data Foundation + Migration)

## Current Position

Phase: 27 of 33 (FSA Data Foundation + Migration)
Plan: 2 of 2 in Phase 27 — COMPLETE
Status: Phase 27 complete
Last activity: 2026-03-05 — Plan 27-02 complete (calc engine TypeScript port + validation API + auto-populate preview API)

Progress: [█░░░░░░░░░] 14% (v6.0) — 2/14 plans complete

## Performance Metrics

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-14 | 13 | 2026-03-04 |
| v3.0 | 15-19 | 12 | 2026-03-04 |
| v4.0 | 20-23 | 7 | 2026-03-04 |
| v5.0 | 24-26 | 9 | 2026-03-05 |
| **Total** | **26** | **60** | |

## Accumulated Context

### Decisions

- [v6.0]: 7-phase structure driven by FK dependency chain: clu_records → insurance_policies → claims
- [v6.0]: Data phases (27, 29, 31) always precede corresponding UI phases (28, 30, 32) — migration before UI is a hard rule
- [v6.0]: Three separate RBAC-gated modules (fsa-578, insurance, claims) — NOT one combined tab page
- [v6.0]: Insurance payout simulator is decision-support only (RP/RP-HPE/YP) — SCO/ECO deferred to v7+, disclaimer required on all outputs
- [v6.0]: Claims document upload uses signed URL pattern direct to Supabase Storage — never route file bytes through Server Actions (1MB limit)
- [v6.0]: ClaimsKanban wrapped in dynamic({ ssr: false }) from first card — not a retrofit
- [v6.0]: CSS grid for coverage matrix (not SVG/chart library) — instant render, no performance cliff
- [27-01]: UUID PKs + legacy_id text unique for FSA tables — UUID for Supabase FK chain, legacy_id for upsert idempotency
- [27-01]: Flat year columns (tillage_2024, tillage_2025) not normalized history table — matches calc.js field access patterns, 2 years only
- [27-01]: ins_482 migrated with notes flag — actual=40000 with no farm/crop is suspicious, Phase 29 UI will surface for review
- [27-01]: Option A module slug — fsa-578 added alongside fsa-reporting in modules.ts (additive, no module_access data migration risk)
- [27-01]: Claims use delete-then-insert pattern (not upsert) — no natural legacy_id, policy_id FK is uniqueness anchor
- [27-02]: computeInsurancePolicy signature is (policy, pricing) not (policy, cluRecords, pricing) — CLU-based FSA acres sum handled at UI layer; calc engine only does pricing lookup for payout simulator
- [27-02]: tillageSummary/coverCropSummary return multi-year arrays (2024+2025 combined) — Phase 28 UI renders tabs without multiple API calls
- [27-02]: buildAutoPopulateProposals in route file not calc.ts — integration logic (depends on farm-budget API shape) not pure business logic
- [27-02]: no-insurance warning emits per-crop — enables Phase 28 clickable filter links per crop

### Pending Todos

- .planning/todos/pending/2026-03-04-v4-scoping-questions-for-user.md (stale — v4.0 shipped, can delete)

### Blockers/Concerns

- [Ph27]: Verify whether prior-year (2025) fsa-acres data exists for year-over-year comparison — if not, that feature stays v7+
- [Ph29]: Verify RP vs RP-HPE formula against ISU Extension FM-1849 before writing lib/insurance/calc.ts
- [Ph31]: Spike signed upload URL + RLS behavior in this Supabase project before building upload UI (service_role vs anon key upload path differs by project config)
- Supabase project credentials required for glomalin-portal runtime
- CNH FieldOps staging API — mock mode active in organic-cert (not blocking v6.0)

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 27-02-PLAN.md (calc engine TypeScript port + validation API + auto-populate preview API)
Resume file: .planning/phases/27-fsa-data-foundation-migration/27-02-SUMMARY.md
Next action: Phase 28 (FSA UI) — run /gsd:execute-phase 28 once Supabase credentials are added and migration is run
