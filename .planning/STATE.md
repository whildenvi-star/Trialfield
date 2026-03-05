# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v6.0 FSA Acres, Insurance & Claims — Phase 27 (FSA Data Foundation + Migration)

## Current Position

Phase: 27 of 33 (FSA Data Foundation + Migration)
Plan: 0 of TBD in Phase 27
Status: Ready to plan
Last activity: 2026-03-05 — v6.0 roadmap created (7 phases, 27 requirements mapped)

Progress: [░░░░░░░░░░] 0% (v6.0)

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
Stopped at: v6.0 roadmap created — ready to plan Phase 27
Resume file: None
Next action: /gsd:plan-phase 27
