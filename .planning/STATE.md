# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v6.0 FSA Acres, Insurance & Claims — Phase 31 (Claims Data Foundation)

## Current Position

Phase: 31 of 33 (Claims Data Foundation) — IN PROGRESS
Plan: 1 of 1 in Phase 31 — COMPLETE (Plan 31-01: Claims Schema + API)
Status: Phase 31 plan 1 complete — Phase 32 (Claims Lifecycle UI) next
Last activity: 2026-03-05 — Plan 31-01 complete (claims schema, CRUD routes, timeline, shell page)

Progress: [██████░░░░] 64% (v6.0) — 9/14 plans complete

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
| Phase 28 P01 | 28 | 2 | 2026-03-05 |
| Phase 28-fsa-planting-workflow-ui P02 | 5 | 2 tasks | 4 files |
| Phase 29 P01 | 3 | 2 tasks | 5 files |
| Phase 29 P02 | 2 | 2 tasks | 3 files |
| Phase 30 P01 | 4 | 2 tasks | 8 files |
| Phase 30 P02 | 3 | 2 tasks | 4 files |
| Phase 31 P01 | 5 | 2 tasks | 7 files |

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
- [Phase 28-01]: CluCard practice/use field is a select dropdown with Non-Irrigated/Irrigated options (not free text)
- [Phase 28-01]: BulkActionBar assign-crop uses inline CropTypeahead within the sticky bar (not a modal)
- [Phase 28-01]: ConfirmDialog z-[60] sits above BulkActionBar z-50 so backdrop covers the bar correctly
- [Phase 28-02]: react-pdf isolation: only acreage-pdf.tsx and acreage-pdf-button.tsx import @react-pdf/renderer — enforced by architecture, SSR guard via dynamic({ ssr: false })
- [Phase 28-02]: PDF disclaimer required: "This is a reporting summary for producer records. It is not an official FSA-578 government form." — applies to all FSA PDF outputs
- [Phase 28-02]: dynamic() named export syntax: import(mod).then(m => ({ default: m.NamedExport })) — required for named exports with next/dynamic
- [Phase 29-01]: computeClaimAlert requires both actual > 0 AND guarantee > 0 to avoid false positives from ins_482 corrupt data (actual=40000, guarantee=0)
- [Phase 29-01]: computeAphFromClus returns { avgAph, count, totalRecords } to distinguish no-CLU-match from CLUs-found-but-no-APH — critical since all 444 CLU records have aph=0
- [Phase 29-01]: migrate-29.ts is separate from migrate-fsa.ts — only runs ALTER TABLE additions, does not re-run Phase 27 data migration
- [Phase 29-02]: yield-sync returns HTTP 200 not 502 when grain-tickets offline — offline is expected during dev; 502 implies the insurance service failed
- [Phase 29-02]: PATCH policies/[id] fetches current row before claim_alert recompute — ensures merged values used, not just patch delta
- [Phase 29-02]: Next.js 15+ dynamic route params typed as Promise and awaited — breaking change from Next.js 14 sync params
- [Phase 30-01]: InsuranceWorkspace manages policy list state client-side — no full page reload on CRUD operations
- [Phase 30-01]: RP-HPE and YP both use spring_price for fall_price in coverage matrix — simplification documented in code comment, labeled illustrative
- [Phase 30-01]: Delete uses browser confirm() — no custom ConfirmDialog for insurance (unlike FSA module which uses ConfirmDialog component)
- [Phase 30-02]: PayoutSimulator adjusts both spring_price and fall_price to simPrice for uniform market scenario — models 'what if price is X' cleanly without split spring/fall ambiguity
- [Phase 30-02]: InsurancePdfDocument renders Page 2 (coverage matrix) conditionally only when pricing.length > 0 — avoids blank/misleading page when no pricing data loaded
- [Phase 30-02]: PDF disclaimer appears as fixed footer on every page via react-pdf fixed prop — required on all insurance outputs per INS-08
- [Phase 31-01]: claim_stage enum uses DO/EXCEPTION block for idempotency — CREATE TYPE does not support IF NOT EXISTS universally
- [Phase 31-01]: Timeline events written in application code (PATCH/POST handlers), not DB triggers — matches established project pattern
- [Phase 31-01]: computeDeadline returns null for notice_of_loss (uses INITIAL_DEADLINE_DAYS from date_of_loss instead) and closed (no deadline)
- [Phase 31-01]: Adjuster assignment detection fires timeline event only when adjuster_name transitions from null/empty to a value

### Pending Todos

- .planning/todos/pending/2026-03-04-v4-scoping-questions-for-user.md (stale — v4.0 shipped, can delete)

### Blockers/Concerns

- [Ph27]: Verify whether prior-year (2025) fsa-acres data exists for year-over-year comparison — if not, that feature stays v7+
- [Ph29 RESOLVED]: RP vs RP-HPE formula check — not blocking Phase 29; payout simulator is Phase 30 UI feature, computeInsurancePolicy() already in lib/fsa/calc.ts. Formula check deferred to Phase 30 pre-work.
- [Ph31]: Spike signed upload URL + RLS behavior in this Supabase project before building upload UI (service_role vs anon key upload path differs by project config)
- Supabase project credentials required for glomalin-portal runtime
- CNH FieldOps staging API — mock mode active in organic-cert (not blocking v6.0)

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 31-01-PLAN.md (claims schema, CRUD routes, timeline auto-events, shell page)
Resume file: .planning/phases/31-claims-tables-api/31-01-SUMMARY.md
Next action: Phase 32 — Claims Lifecycle UI (Kanban board, claim detail view)
