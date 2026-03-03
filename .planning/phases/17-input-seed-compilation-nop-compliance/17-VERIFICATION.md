---
phase: 17-input-seed-compilation-nop-compliance
verified: 2026-03-03T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Trigger Compile All button in browser after enterprises are compiled"
    expected: "Both inputs and seeds preview tables appear with correct rows, NOP badges (green/amber/red/gray), source badges showing 'farm-budget', and compliance summary bar showing pass/restricted/needs-review counts"
    why_human: "Cannot run the Next.js server in this environment to confirm React rendering"
  - test: "With unresolved materials present, commit inputs via Compile All > Commit"
    expected: "Unresolved materials panel auto-expands and scrolls into view; count badge shows N items; NOP status dropdowns for each unresolved material"
    why_human: "Auto-expand + scroll behavior is DOM/browser-level, requires live interaction"
  - test: "Assign NOP statuses to unresolved materials and click Save All"
    expected: "POST /api/materials/batch-resolve succeeds; compile page re-runs handleCompileAll; NOP badges refresh immediately; resolved materials no longer appear in unresolved panel"
    why_human: "State refresh cycle requires live server + browser"
  - test: "Click Compile All when enterprises have NOT been compiled for the year"
    expected: "Button is disabled with tooltip 'Compile enterprises first'; message 'Compile enterprises first' shown below button; 400 returned if API called directly"
    why_human: "Disabled-state tooltip and button rendering require browser"
  - test: "Re-run Compile All after materials have been resolved (nopResolved=true)"
    expected: "NOP status on previously-resolved Materials is NOT changed; resolved materials continue to show their assigned status (green/amber/red badge)"
    why_human: "Requires live DB and multiple compile cycles to verify idempotency invariant"
---

# Phase 17: Input & Seed Compilation + NOP Compliance Verification Report

**Phase Goal:** Input application records and seed varieties from farm-budget are compiled into organic-cert — farm managers resolve any unmapped materials once, and NOP compliance rules run only against resolved materials
**Verified:** 2026-03-03
**Status:** human_needed — all automated checks pass; 5 items require live browser + server testing
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/compile/[year]/inputs returns preview rows for all organic field input applications | ✓ VERIFIED | `inputs/route.ts` calls `mapInputs()`, returns `InputCompileResult` with `preview[]`; guards empty body with default `preview=true` |
| 2 | POST /api/compile/[year]/inputs with preview=false commits MaterialUsage records via transactional delete+create | ✓ VERIFIED | Route runs `prisma.$transaction` with `deleteMany(SYNCED)` + `createMany`; materialsCreated count returned |
| 3 | POST /api/compile/[year]/seeds returns preview rows for all organic field seed varieties | ✓ VERIFIED | `seeds/route.ts` calls `mapSeeds()`, returns `SeedCompileResult` with `preview[]` |
| 4 | POST /api/compile/[year]/seeds with preview=false commits SeedUsage records via transactional delete+create | ✓ VERIFIED | Route runs `prisma.$transaction` with SeedLot upsert + `deleteMany(SYNCED)` + `createMany` |
| 5 | New farm-budget products create unresolved Material stubs (nopResolved: false) | ✓ VERIFIED | `inputs/route.ts` line 140–155: `tx.material.upsert({ create: { nopResolved: false, ... }, update: {} })` — NOP-safe empty update block |
| 6 | Re-compiling never overwrites user-assigned NOP status on existing Materials | ✓ VERIFIED | `update: {}` on Material upsert; SeedLot upsert also uses `update: {}` |
| 7 | Compile returns 400 if no FieldEnterprise records exist for the target year | ✓ VERIFIED | Both routes: `enterpriseCount === 0` → return 400 "Compile enterprises first before compiling inputs/seeds" |

**Score: 7/7 must-haves verified (automated)**

### Success Criteria Verification

| Criterion | Status | Evidence |
|-----------|--------|----------|
| MaterialUsage records appear for every farm-budget organic input — no manual re-entry | ✓ VERIFIED | `input-mapper.ts` fetches organic budget fields, resolves to FieldEnterprise, builds `MaterialUsage` rows; commit path creates records |
| SeedLot stubs appear for every seed variety on organic enterprise fields | ✓ VERIFIED | `seed-mapper.ts` fetches organic fields with seed, upserts SeedLot per `(farmId, crop, variety)`, creates SeedUsage |
| Compile page shows unresolved materials list; user assigns status once and it persists | ✓ VERIFIED (code) / ? HUMAN (UX) | `page.tsx` lines 1350–1475: collapsible unresolved panel with dropdowns + Save All; batch-resolve sets `nopResolved: true`; upsert `update: {}` prevents overwrite |
| NOP compliance badges appear only on resolved materials; unresolved show "Needs Review" | ✓ VERIFIED (code) / ? HUMAN (rendering) | `complianceBadge()` at line 88; `checkMaterialCompliance()` returns `needs-review` when `!nopResolved`; page renders gray "Needs Review" badge |
| Source badges show origin on every compiled record | ✓ VERIFIED (code) / ? HUMAN (rendering) | `sourceBadge()` at line 118 renders "farm-budget" (blue) for SYNCED records; every input/seed row calls `sourceBadge(row.dataSource)` |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `organic-cert/src/lib/compile/input-mapper.ts` | `mapInputs()` producing `InputPreviewRow[]` | ✓ VERIFIED | 214 lines (min 80); exports `mapInputs()` and `seasonToDate()`; substantive logic with Prisma queries and budget-client calls |
| `organic-cert/src/lib/compile/seed-mapper.ts` | `mapSeeds()` producing `SeedPreviewRow[]` | ✓ VERIFIED | 236 lines (min 60); exports `mapSeeds()`, `normalizeCropName()`, `normalizeCropForSeedMatch()`; substantive with crop normalization logic |
| `organic-cert/src/app/api/compile/[year]/inputs/route.ts` | POST handler for input compilation | ✓ VERIFIED | Exports `POST`; full preview + commit modes; transaction logic present |
| `organic-cert/src/app/api/compile/[year]/seeds/route.ts` | POST handler for seed compilation | ✓ VERIFIED | Exports `POST`; full preview + commit modes; SeedLot upsert + transaction |
| `organic-cert/prisma/schema.prisma` | `nopResolved` on Material, `dataSource` on MaterialUsage + SeedUsage, `@@unique` on SeedLot | ✓ VERIFIED | Line 420: `nopResolved Boolean @default(false)`; line 444: `dataSource DataSource @default(MANUAL)` on SeedUsage; line 462: `dataSource DataSource @default(MANUAL)` on MaterialUsage; line 408: `@@unique([farmId, crop, variety])` on SeedLot |
| `organic-cert/src/lib/compile/nop-compliance.ts` | `checkMaterialCompliance()` and `checkSeedCompliance()` | ✓ VERIFIED | 206 lines (min 60); pure functions, no Prisma imports; exports both functions; manure 90/120-day rule wired via `checkManureDayRule()` |
| `organic-cert/src/app/api/materials/batch-resolve/route.ts` | POST handler for batch NOP status assignment | ✓ VERIFIED | Exports `POST`; validates resolutions array; runs prisma transaction; calls `logAudit()`; returns `{ updated: N }` |
| `organic-cert/src/app/(app)/compile/page.tsx` | Extended with Compile All, inputs/seeds tables, unresolved panel, NOP badges, source badges | ✓ VERIFIED | 1548 lines; contains "Compile All", inputs preview table, seeds preview table, unresolved materials panel, `complianceBadge()`, `sourceBadge()`, `buildComplianceSummary()` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `input-mapper.ts` | `budget-client.ts` | `getBudgetProducts()` and `getBudgetFieldsWithInputs()` | ✓ WIRED | Line 16: `import { getBudgetProducts, getBudgetFieldsWithInputs, type BudgetFieldWithInputs }` |
| `inputs/route.ts` | `input-mapper.ts` | `mapInputs()` import | ✓ WIRED | Line 22: `import { mapInputs, seasonToDate } from "@/lib/compile/input-mapper"` |
| `seeds/route.ts` | `seed-mapper.ts` | `mapSeeds()` import | ✓ WIRED | Lines 21–23: `import { mapSeeds } from "@/lib/compile/seed-mapper"` and `import { normalizeCropName }` |
| `compile/page.tsx` | `nop-compliance.ts` | `checkMaterialCompliance` import | ✓ WIRED | Lines 14–17: `import { checkMaterialCompliance } from "@/lib/compile/nop-compliance"` |
| `compile/page.tsx` | `inputs/route.ts` | `fetch /api/compile/${year}/inputs` | ✓ WIRED | Lines 397, 455, 487: fetch POST to `/api/compile/${selectedYear}/inputs` in `handleCompileAll()` and commit handler |
| `compile/page.tsx` | `batch-resolve/route.ts` | `fetch /api/materials/batch-resolve` | ✓ WIRED | Line 528: `fetch("/api/materials/batch-resolve", { method: "POST", body: JSON.stringify({ resolutions }) })` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CMP-03 | 17-01, 17-02 | User can compile input application data from farm-budget into organic-cert material usage records | ✓ SATISFIED | `POST /api/compile/[year]/inputs` (preview + commit); `mapInputs()` resolves farm-budget organic field inputs to MaterialUsage; UI has Compile All button and inputs preview table; marked `[x]` in REQUIREMENTS.md |
| CMP-04 | 17-01, 17-02 | User can compile seed data from farm-budget into organic-cert seed source records | ✓ SATISFIED | `POST /api/compile/[year]/seeds` (preview + commit); `mapSeeds()` resolves farm-budget organic field seeds to SeedLot + SeedUsage; UI has seeds preview table; marked `[x]` in REQUIREMENTS.md |

No orphaned requirements — both IDs in plan frontmatter are present in REQUIREMENTS.md and fully implemented.

---

## Migration Verification

| Check | Status | Evidence |
|-------|--------|---------|
| Migration file exists | ✓ | `organic-cert/prisma/migrations/20260303081512_add_compile_phase17_fields/migration.sql` |
| `nopResolved` added to Material | ✓ | `ALTER TABLE "Material" ADD COLUMN "nopResolved" BOOLEAN NOT NULL DEFAULT false` |
| `dataSource` added to MaterialUsage | ✓ | `ALTER TABLE "MaterialUsage" ADD COLUMN "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL'` |
| `dataSource` added to SeedUsage | ✓ | `ALTER TABLE "SeedUsage" ADD COLUMN "dataSource" "DataSource" NOT NULL DEFAULT 'MANUAL'` |
| SeedLot unique index | ✓ | `CREATE UNIQUE INDEX "SeedLot_farmId_crop_variety_key" ON "SeedLot"("farmId", "crop", "variety")` |
| Schema matches migration | ✓ | `schema.prisma` has all four additions confirmed |
| TypeScript compiles clean | ✓ | `npx tsc --noEmit` returns zero errors |

---

## Compile-Engine Readiness Dashboard Verification

The Phase 17 plan required replacing hardcoded "Phase 17" / "pending" readiness placeholders with real SYNCED count queries.

| Check | Status | Evidence |
|-------|--------|---------|
| `compile-engine.ts` uses real SYNCED queries for inputs | ✓ VERIFIED | Lines 245–263: `prisma.materialUsage.findMany({ where: { dataSource: "SYNCED", ... }, distinct: ["fieldEnterpriseId"] })` |
| `compile-engine.ts` uses real SYNCED queries for seeds | ✓ VERIFIED | Lines 256–263: `prisma.seedUsage.findMany({ where: { dataSource: "SYNCED", ... }, distinct: ["fieldEnterpriseId"] })` |
| Readiness rows use fieldsWithInputs/fieldsWithSeeds sets | ✓ VERIFIED | Lines 266–283: `inputs: fieldsWithInputs.has(f.id) ? "compiled" : "missing"` |
| `page.tsx` readiness dashboard cells use `readinessCellClass/readinessCellText` | ✓ VERIFIED | Lines 704–713: `readinessCellClass(row.inputs)` and `readinessCellClass(row.seeds)` — no "Phase 17" hardcoding present |
| `isNopPlaceholder` parameter removed | ✓ VERIFIED | No occurrence of `isNopPlaceholder` in codebase |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `compile/page.tsx` | 48, 53 | `return null` in `statusBadge()` and `matchMethodBadge()` | Info | Intentional — these are render helpers that return null for unknown/null inputs; not stub behavior |
| `compile/page.tsx` | 1437 | `placeholder="optional notes..."` | Info | HTML input placeholder attribute — not a code stub |

No blockers found.

---

## Git Commit Status

The summaries claim commits 6ec9790, da9ac89 (Plan 01) and cbf3f47, 5924db8 (Plan 02). None of these hashes exist in the repository. The entire `organic-cert/` directory is untracked — all Phase 17 implementation code lives on disk but has never been committed to git.

**Impact on verification:** The code exists and is substantive. The goal is achieved at the code level. However, all `organic-cert/` implementation is uncommitted. This is a consistency issue between summaries and git state, not a code quality issue. The code will need to be committed before the repo reflects the work done.

---

## Human Verification Required

### 1. End-to-end compile page render

**Test:** With farm-budget running, navigate to `/compile`, select year 2026, compile enterprises first, then click "Compile All (inputs + seeds)"
**Expected:** Inputs preview table appears with Field/Product/Qty/Unit/Season/NOP Status/Source columns; compliance summary bar shows aggregate counts; seeds preview table appears; all compiled rows show "farm-budget" blue source badge
**Why human:** React rendering and fetch behavior require a live Next.js dev server

### 2. Unresolved materials panel auto-expand

**Test:** After clicking Commit in the compile section (with unresolved materials present)
**Expected:** Unresolved materials section auto-expands with count badge; page scrolls to the panel; each unresolved material shows NOP status dropdown (Approved / Restricted / Prohibited / Exempt) and notes field
**Why human:** DOM auto-scroll behavior (`unresolvedRef.current.scrollIntoView`) requires live browser

### 3. Save All persists NOP status

**Test:** Select NOP status for each unresolved material; click "Save All"
**Expected:** POST to `/api/materials/batch-resolve` returns `{ updated: N }`; compile page re-fetches preview; previously gray "Needs Review" badges turn green/amber/red; materials disappear from unresolved panel
**Why human:** Multi-step state cycle requires live server + DB

### 4. Compile All disabled without enterprises

**Test:** Navigate to compile page for a year with no compiled enterprises
**Expected:** "Compile All" button is disabled; tooltip or inline message reads "Compile enterprises first"
**Why human:** Button disabled-state rendering requires browser

### 5. NOP status immutability across re-compiles

**Test:** Resolve a material's NOP status (Save All); then click Compile All again and commit
**Expected:** Material's `nopStatus` and `nopResolved: true` are unchanged after re-compile; compliance badge still shows same verdict
**Why human:** Requires two DB write cycles and comparison; verifying `update: {}` invariant works end-to-end

---

## Summary

Phase 17 goal is achieved at the code level. All 7 must-have truths are verified. All 6 key links are wired. Both CMP-03 and CMP-04 requirements are satisfied. TypeScript compiles clean. The Prisma migration is complete and correct.

Two notes:

1. **Uncommitted code:** All `organic-cert/` implementation is untracked in git. Summary claims of specific commit hashes are false — the hashes do not exist. The code is real and substantive, but needs to be committed.

2. **Human verification needed:** Five UI behaviors (render, auto-expand, Save All refresh cycle, disabled-state, idempotency) cannot be verified without a running server and browser. These are standard human-testing items for a React/Next.js feature.

---

_Verified: 2026-03-03_
_Verifier: Claude (gsd-verifier)_
