---
phase: 72
slug: acreage-reconciliation-tool
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-01
---

# Phase 72 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed: `vitest` + `@testing-library/react` + `@testing-library/user-event`) |
| **Config file** | `glomalin-portal/vitest.config.ts` (or inline in `vite.config.ts`) — confirm on first Wave 0 run |
| **Quick run command** | `cd glomalin-portal && npx vitest run <changed-file>.test.ts` |
| **Full suite command** | `cd glomalin-portal && npm run test` (`vitest run`) |
| **Estimated runtime** | ~30 seconds (unit suite; no live DB) |

Project convention: colocated `*.test.ts(x)` files next to source (e.g. `src/lib/marketing/position.test.ts`, `src/components/marketing/delivery-progress-bar.test.tsx`) — not a separate `__tests__/` tree.

---

## Sampling Rate

- **After every task commit:** Run `cd glomalin-portal && npx vitest run <changed-file>.test.ts` (targeted)
- **After every plan wave:** Run `cd glomalin-portal && npm run test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green + `npx tsc --noEmit` clean
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 72-01-01 | 01 | 1 | ACR-02 | T-72-01-02 | Migration seeds defaults idempotently | grep-gate | `grep -v '^--' supabase/migrations/037_acreage_thresholds.sql \| grep -c acreage_thresholds` | ✅ | ⬜ pending |
| 72-01-02 | 01 | 1 | ACR-02 | — | Single threshold engine, duplicates retired | unit | `npx vitest run src/lib/fsa/thresholds.test.ts` | ❌ W0 | ⬜ pending |
| 72-01-03 | 01 | 1 | ACR-02 | T-72-01-01 | Admin route guarded + validates input | tsc-gate | `npx tsc --noEmit` (no acreage-thresholds/route errors) | ✅ | ⬜ pending |
| 72-02-01 | 02 | 2 | ACR-02 | T-72-02-02 | Coverage folded, ST_MakeValid both sides | grep-gate | `grep -v '^--' supabase/migrations/041_farm_reconciliation_coverage.sql \| grep -c -E "coverage_events\|ST_MakeValid"` | ✅ | ⬜ pending |
| 72-02-02 | 02 | 2 | ACR-02, ACR-05 | T-72-02-01 | Status from configurable engine | grep+tsc | `grep -c evaluateThreshold src/lib/fsa/reconciliation.ts` + `npx tsc --noEmit` | ✅ | ⬜ pending |
| 72-02-03 | 02 | 2 | ACR-04, ACR-05 | — | 6th view wired, coloring separate (Pitfall 3) | grep+tsc | `grep -c reconciliation src/components/compliance/acreage-tab.tsx` + `npx tsc --noEmit` | ✅ | ⬜ pending |
| 72-03-* | 03 | 1 | ACR-03 | — | Merge/draw RPC input validation | unit | `npx vitest run src/app/api/fsa/clu-records/merge/route.test.ts` | ❌ W0 | ⬜ pending |
| 72-04-* | 04 | 1 | ACR-01 | — | CLU import handles MultiPolygon | unit | `npx vitest run src/app/api/fsa/clu-boundaries/import/route.test.ts` | ❌ W0 | ⬜ pending |
| 72-05-02 | 05 | 2 | ACR-06 | T-72-05-01 | DBF fields ≤10 chars, no collisions | unit | `npx vitest run src/app/api/fsa/export-shapefile/route.test.ts` | ❌ W0 | ⬜ pending |
| 72-05-03 | 05 | 2 | ACR-05 | T-72-05-02 | RMA field validation + escapeCell hardening | tsc-gate | `npx tsc --noEmit` (no clu-workspace/clu-records/calc errors) | ✅ | ⬜ pending |
| 72-06-* | 06 | 1 | ACR-01 | — | FieldView OAuth (credential-blocked) | manual | human-verify checkpoint (no live credentials) | N/A | ⬜ pending |
| 72-07-02 | 07 | 3 | ALL | T-72-07-01 | Full suite green + merge smoke stamps source_flag='manual' | full+tsc | `npm run test && npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/fsa/thresholds.test.ts` — seven-case coverage for the configurable Green/Yellow/Red engine (ACR-02) — created by 72-01 Task 2
- [ ] `src/app/api/fsa/export-shapefile/route.test.ts` — extended DBF schema + no-truncation-collision guard (ACR-06) — created by 72-05 Task 2
- [ ] `src/app/api/fsa/clu-boundaries/import/route.test.ts` — MultiPolygon import handling (ACR-01) — created in 72-04
- [ ] `src/app/api/fsa/clu-records/merge/route.test.ts` — merge RPC contract (ACR-03) — created in 72-03
- [ ] **PostGIS RPC test strategy decision** — no existing pattern in this repo for automated integration tests against Supabase RPCs (all current FSA RPCs are tested manually/in production). Wave 0 must document the chosen strategy per RPC: mock the RPC response at the route boundary (preferred for unit-level) vs. smoke-test against live data in 72-07 Task 2. Do NOT silently skip.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migrations 037-041 applied to live Supabase | ALL | Schema push targets production DB; requires credentials/blocking checkpoint | 72-07 Task 1: apply 037→041 in order via `apply_migration`; confirm via `pg_proc`/`geometry_columns`/column-presence queries |
| PostGIS RPC smoke tests against real data | ACR-02, ACR-03, ACR-06 | No local Supabase pattern; needs live farm/year data | 72-07 Task 2: call `get_farm_reconciliation`, `merge_reporting_units` (rollback), export path — confirm coverage rows / ST_Union acreage / RMA DBF fields |
| FieldView live OAuth activation | ACR-01 | External Climate/Bayer credential registration (no CLI/API path) | 72-06: human-verify checkpoint — register app, obtain `FIELDVIEW_CLIENT_ID/SECRET/API_KEY` |
| Reconciliation map coloring vs workflow-status coloring stay distinct | ACR-04 | Visual UI verification (Pitfall 3 semantic separation) | Open Acreage tab → Reconciliation view; confirm Green/Yellow/Red discrepancy fill is not the reporting-map workflow coloring |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (4 new test files + PostGIS strategy)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-01
