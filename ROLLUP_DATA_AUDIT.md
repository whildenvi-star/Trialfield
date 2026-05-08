# Macro Roll-Up Data Audit
**Date:** 2026-03-31
**Auditor:** Code review of schema, migration scripts, and API routes — no live DB query possible.

---

## Method

Traced every number on the current roll-up page (`glomalin-portal/src/app/(protected)/app/macro-rollup/page.tsx`) back to its source table/column. Cross-referenced against:
- `supabase/schema.sql` (base schema)
- `supabase/migrations/001–005` (incremental migrations)
- `scripts/migrate-fsa.ts` (Phase 27 — original FSA data load)
- `scripts/migrate-29.ts` through `migrate-57.ts` (subsequent schema changes)
- `farm-budget/server.js` (expense/cost data, port 3001)
- `src/app/api/marketing/contracts/route.ts` (grain contracts, Phase 57)

---

## Critical Finding Up Front

> **The current roll-up page shows the wrong thing entirely.**
> It displays FSA acreage, insurance, claims, and conservation programs.
> The brief wants Revenue, Costs, Margin per field.
> These are completely different data sets.

Cost data exists — it lives in **farm-budget** (Express, port 3001), not Supabase.
Revenue data does **not** exist — `grain_contracts` table was created in Phase 57 but has no rows entered.

---

## Current Page: Data Point by Data Point

| # | Displayed label | Source table.column | Has real data? | Notes | Action for rebuild |
|---|---|---|---|---|---|
| 1 | Total Acres | `clu_records.fsa_acres` SUM | **Yes** — 444 CLU records migrated from `fsa-acres/data/data.json` | Confirmed from migrate-fsa.ts comment | **PARK** — not part of rebuilt roll-up |
| 2 | Organic Acres | `clu_records.fsa_acres` WHERE `organic = true` | **Yes** — subset of 444 rows, `organic` boolean populated during migration | Same source as above | **PARK** |
| 3 | Insured Acres | `insurance_policies.planted_acres` SUM | **Partial** — 3 policies exist, but default is `0`; values depend on whether migration set them | migrate-fsa.ts maps `insurancePolicies` from fsa-acres data — likely populated | **PARK** |
| 4 | Open Claims | `claims` WHERE `stage` IN open stages | **BROKEN** | Schema mismatch (see below) | **PARK** |
| 5 | Acreage by Crop (table) | `clu_records.crop + fsa_acres` GROUP BY crop | **Yes** — 444 rows, crop field populated | Real FSA data | **PARK** |
| 6 | Farm Summary (table) | `clu_records.farm_number/farm_name + fsa_acres` | **Yes** — same 444 rows, grouped by farm | Real FSA data | **PARK** |
| 7 | Insurance Coverage — Crop, Planted Acres | `insurance_policies.crop`, `.planted_acres` | **Yes** — 3 rows | Populated from fsa-acres migration | **PARK** |
| 8 | Insurance Coverage — Coverage Level | `insurance_policies.coverage_level` | **Yes** — default 75, likely overridden in migration | | **PARK** |
| 9 | Insurance Coverage — Guarantee | `insurance_policies.guarantee` | **Uncertain** — default `0`, may be blank if migration didn't set it | | **PARK** |
| 10 | Insurance Coverage — Premium/Acre | `insurance_policies.premium_per_acre` | **Uncertain** — nullable, migration may not have set it | | **PARK** |
| 11 | Insurance Coverage — Alert | `insurance_policies.claim_alert` | **Empty** — added in Phase 29 migration; default `'none'` on all rows unless yield sync has run | Phase 29 APH/claim-alert logic requires a separate sync step | **PARK** |
| 12 | Claims Status — Stage | `claims.stage` | **BROKEN** — see schema mismatch below | | **PARK** |
| 13 | Claims Status — Coverage Type/Level | `claims.coverage_type`, `.coverage_level` | **BROKEN** — same mismatch | | **PARK** |
| 14 | Claims Status — Deadline | `claims.deadline_at` | **BROKEN** | | **PARK** |
| 15 | Claims Status — Effective Guarantee | `claims.effective_guarantee` | **BROKEN** | | **PARK** |
| 16 | CC-340 Acres | `gcs_enrollments.cc340_acres` SUM | **Likely populated** — 149 rows migrated, but many may be `0` if not enrolled | Depends on actual GCS enrollment data | **PARK** |
| 17 | RT-345 Acres | `gcs_enrollments.rt345_acres` SUM | Same as above | | **PARK** |
| 18 | NT-329 Acres | `gcs_enrollments.nt329_acres` SUM | Same as above | | **PARK** |
| 19 | Crop Comparison — programs list | `farm-budget /api/programs` via `/api/macro/programs` proxy | **Conditional** — only available if farm-budget is running on port 3001 | Shows "Farm Budget unavailable" fallback otherwise | **PARK** |
| 20 | Crop Comparison — cost breakdowns | `farm-budget /api/dashboard.enterpriseSummaries` | **Conditional** — same dependency | This is BUDGET data, not actuals | **PARK** |

---

## Schema Mismatch: `claims` Table

**This is the most important structural bug.**

`migrate-fsa.ts` (Phase 27) created `claims` with these columns:
```
claim_status TEXT, claim_number TEXT, loss_type TEXT, adjuster_name TEXT,
adjuster_phone TEXT, claim_filed_date DATE, claim_paid_date DATE, claim_paid_amount NUMERIC
```

`migrate-31.ts` (Phase 31) tried to `CREATE TABLE IF NOT EXISTS claims` with:
```
stage claim_stage ENUM, stage_entered_at, coverage_type, coverage_level,
effective_guarantee, deadline_at, deadline_overridden, ...
```

Because the table already existed from Phase 27, `CREATE TABLE IF NOT EXISTS` was a no-op. The Phase 31 columns (`stage`, `coverage_type`, `effective_guarantee`, `deadline_at`) **were never added**.

The current page queries `claims.stage` — this column does not exist. The page either:
- Returns rows with `stage = null` (displayed as empty), or
- Silently returns no rows because the `OPEN_STAGES` filter matches nothing

**Result:** Claims Status section always shows "No claims filed." even if claims exist.

---

## Data Available for the Rebuilt Roll-Up

These are the sources the brief's three-layer design requires:

### Layer 1 & 2: Net Position, Field Table (Revenue − Costs)

| Data needed | Where it actually lives | Status |
|---|---|---|
| **Field names** | `farm-budget /api/budget-field-details` → `field.name` | **Available** — Express port 3001, real data |
| **Acres per field** | `farm-budget /api/budget-field-details` → `effectiveAcres` | **Available** — crop-specific acres |
| **Crop per field** | `farm-budget /api/budget-field-details` → `field.crop` | **Available** |
| **Total cost per field** | `farm-budget /api/budget-field-details` → `expPerAcre × acres` | **Available** — 10 cost categories: rent, fert, seed, machinery, labor, fuel, drying, interest, insurance, overhead |
| **Cost breakdown** (seed/fert/chem/rent/custom) | Same endpoint — `rentPerAcre`, `fertPerAcre`, `seedPerAcre`, `machineryPerAcre`, `laborPerAcre` | **Available** |
| **Budget revenue** | `farm-budget /api/budget-field-details` → `cropIncomePerAcre × acres` | **Available** — but this is BUDGETED, not actual contracted revenue |
| **Budget profit/acre** | `farm-budget /api/budget-field-details` → `profitPerAcre` | **Available** — budgeted only |
| **Actual grain contracts** | `grain_contracts` Supabase table (Phase 57) | **EMPTY** — table exists, 0 rows |
| **Contracted bushels** | `grain_contracts.bushels` WHERE `crop_year = 2026` | **EMPTY** |
| **Contract price** | `grain_contracts.price_per_bushel` | **EMPTY** |
| **Uncontracted bushels** | (total yield estimate) − (contracted bushels) | **Not computable** — no contracts entered |
| **CBOT / market price** | `insurance_pricing.fall_price` (22 rows) or CBOT API (`/api/marketing/cbot-prices`) | **Available** — insurance pricing has spring/fall prices per crop/year |

### Layer 3: Field Detail Breakdowns

| Data needed | Where it lives | Status |
|---|---|---|
| **Cost category breakdown** | `farm-budget /api/budget-field-details` | **Available** |
| **Contract list** | `grain_contracts` | **EMPTY** |
| **"What's missing" list** | Derived from above | Computable |

---

## Bottom Line for Phase 2

### What we CAN show immediately

- All field names, acres, crop from farm-budget
- All cost data from farm-budget (complete 10-category breakdown per field)
- Budget profit/acre from farm-budget (labeled clearly as "Budget Estimate")
- `grain_contracts` row count = 0, so revenue column shows "—" with a note

### What we CANNOT show without data entry

- Actual contracted revenue (grain_contracts is empty)
- True NET POSITION (requires revenue to be meaningful)
- "X% of grain unmarketed" summary line

### Recommended hero metric for Phase 2

Given that revenue is empty, the hero number should be:

```
BUDGET POSITION: $XX,XXX
based on [N] field budgets — 2026 crop year
[!] Revenue data missing — add grain contracts to complete
```

This is honest. It shows the cost-side picture (which IS real data) and makes the gap explicit rather than displaying a misleading zero.

### What to HIDE until populated

- Any column or calculation involving `grain_contracts` — hide, not zero
- Claims status section — broken schema, hide entirely
- Conservation programs — park it, not relevant to P&L
- Crop Comparison sandbox — park it, wrong purpose for this page

---

## Files to Change in Phase 2

- **Rebuild:** `glomalin-portal/src/app/(protected)/app/macro-rollup/page.tsx`
- **New API route needed:** `glomalin-portal/src/app/api/macro/field-rollup/route.ts`
  - Fetches `farm-budget /api/budget-field-details` (costs + budget revenue)
  - Fetches `grain_contracts` from Supabase (actual revenue — currently empty)
  - Returns merged per-field array for the page to render
- **Keep as-is:** All other files — no schema changes, no new tables

---

## PARKING LOT additions from this audit

See `PARKING_LOT.md` — items flagged during this audit that are out of scope for this session.
