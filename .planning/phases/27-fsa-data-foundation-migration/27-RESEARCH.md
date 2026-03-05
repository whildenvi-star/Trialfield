# Phase 27: FSA Data Foundation + Migration - Research

**Researched:** 2026-03-05
**Domain:** Supabase schema design, Node.js migration scripting, Next.js 14 API routes, TypeScript port of pure-function calc engine, cross-app HTTP proxy pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Migration Strategy**
- Repeatable import script with upsert (can safely re-run if Excel source changes before go-live)
- Legacy fsa-acres Express app stays running read-only on port 3002 as reference
- Verification: script outputs record counts per table + total acres, compared against source (444 CLU, 22 pricing, 3 insurance, 149 GCS, ~3,164 FSA acres — NOTE: actual total in data.json is 5,977.24 acres, not 3,164; confirm with user before hardcoding)

**Data Model**
- Split claim fields from insurance_policies NOW — create insurance_policies (policy fields only) + claims table from Phase 27. The 3 existing policies with claim data get rows in both tables. Clean FK chain for Phases 29-32.
- Separate gcs_enrollments table with FK to clu_records by (farmNumber, tractNumber, fieldId)
- Dedicated insurance_pricing table scoped by crop year (crop, year, spring_price, fall_price) — supports multi-year history
- Tillagecodes as enum/reference data (not a table)

**Farm-Budget Auto-Populate**
- When farm-budget (port 3001) is offline: show clear error "Farm-budget is offline — auto-populate unavailable" with retry button. No stale data fallback.
- Auto-populate proposes crop assignments for ALL CLUs (including ones with existing crops), not just blanks. User reviews full diff and controls what gets applied.

**Validation Rules**
- All 5 existing warning types from calc.js carry over: missing-crop, missing-date, missing-price, no-insurance (crops >10ac without policies), unreported
- Warn only — validation warnings are advisory, never block saves
- Two endpoints: full-dataset (GET /api/validation for warnings panel) + per-record validation on individual saves
- Three severity levels: error (missing-crop, missing-date), warning (unreported, no-insurance), info (missing-price)

### Claude's Discretion
- ID strategy: UUID primary keys vs keeping original string IDs (clu_1, pr_455, etc.)
- Year column normalization: flat columns (tillage_2024, tillage_2025) vs normalized clu_practice_history table
- Auto-populate preview format (side-by-side diff vs proposed-with-highlights)
- Auto-populate matching strategy (crop-only vs field+crop between farm-budget and CLU records)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FSA-01 | User can see existing CLU records (migrated from fsa-acres) in the portal, scoped by crop year | Supabase upsert migration script + Next.js API route GET /api/fsa/clu-records?year=2026 reads from clu_records table |
| FSA-05 | User can see validation warnings (missing crop, date, unreported) with clickable links | TypeScript port of validateRecords() → Route Handler GET /api/fsa/validation returning structured warning array |
| FSA-06 | User can auto-populate CLU crop assignments from farm-budget macro rollup with preview | Route Handler GET /api/fsa/auto-populate-preview fetches localhost:3001/api/dashboard with AbortSignal.timeout(5000), returns diff array |
</phase_requirements>

---

## Summary

Phase 27 migrates 444 CLU records, 22 pricing rows, 3 insurance policies, and 149 GCS enrollments from `fsa-acres/data/data.json` into Supabase, registers the fsa-578 module in the portal, ports `calc.js` pure functions to TypeScript, and builds two backend capabilities: a validation API and a farm-budget cross-app proxy for auto-populate preview.

The source data is well-understood — `fsa-acres/import.js` (288 lines) documents the full Excel-to-JSON transformation and serves as a direct reference for the Supabase migration script. The `calc.js` (383 lines) is a clean UMD module of pure functions with no side effects, making the TypeScript port straightforward. The glomalin-portal already has working patterns for Supabase server clients, Route Handlers, and RBAC middleware — Phase 27 extends these patterns rather than introducing new ones.

The primary architectural decisions in Claude's Discretion (ID strategy, year-column normalization) have clear answers based on what the codebase needs: UUID PKs for Supabase compatibility + a `legacy_id` text column to preserve original string IDs for debugging, and flat year columns (not a history table) because only 2024 and 2025 data exist and the UI functions reference them by field name directly in `tillageSummary()` and `coverCropSummary()`.

**Primary recommendation:** Write the Supabase migration as a standalone Node.js script (`scripts/migrate-fsa.ts`) using `@supabase/supabase-js` with `upsert` on a `legacy_id` unique constraint. Port calc.js to `lib/fsa/calc.ts` preserving all function signatures. Build two Route Handlers: `app/api/fsa/validation/route.ts` and `app/api/fsa/auto-populate-preview/route.ts`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.98.0 (already installed) | Migration script DB client + server-side Supabase reads | Already in project; service_role key needed for migration |
| @supabase/ssr | ^0.9.0 (already installed) | Server Component / Route Handler Supabase client | Already in project; established pattern in lib/supabase/server.ts |
| next | 14.2.35 (already installed) | Route Handlers for validation and auto-populate APIs | Already in project |
| typescript | ^5 (already installed) | lib/fsa/calc.ts port | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | devDependency | Run migration script with TypeScript directly | One-time execution: `npx tsx scripts/migrate-fsa.ts` |
| dotenv | devDependency or use built-in | Load SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in migration script | Migration script runs outside Next.js context |

### No New Packages Required
The existing `@supabase/supabase-js` handles both migration and server-side reads. No new dependencies needed for Phase 27.

**Installation:**
```bash
# No new packages — use existing stack
# If tsx not present for running migration script:
npm install --save-dev tsx -w glomalin-portal
```

---

## Architecture Patterns

### Recommended Project Structure
```
glomalin-portal/
├── scripts/
│   └── migrate-fsa.ts              # One-time migration script (run with: npx tsx scripts/migrate-fsa.ts)
├── src/
│   ├── app/
│   │   └── api/
│   │       └── fsa/
│   │           ├── clu-records/
│   │           │   └── route.ts    # GET ?year=2026 — reads clu_records from Supabase
│   │           ├── validation/
│   │           │   └── route.ts    # GET — runs validateCluRecords() against Supabase data
│   │           └── auto-populate-preview/
│   │               └── route.ts    # GET — fetches farm-budget:3001, returns diff proposals
│   ├── lib/
│   │   └── fsa/
│   │       └── calc.ts             # TypeScript port of fsa-acres/public/calc.js
│   └── (protected)/
│       └── app/
│           └── fsa-578/            # NEW module directory (replaces generic [module] shell)
│               └── page.tsx        # Shell page — reads clu_records, renders count
```

**Module slug decision:** The existing portal uses `fsa-reporting` in `lib/modules.ts` and the middleware checks `module_access.module = 'fsa-reporting'`. Phase 27 should add a new `fsa-578` entry to `MODULES` (or rename `fsa-reporting` to `fsa-578` to match the v6.0 design context). The CONTEXT.md and REQUIREMENTS.md consistently use `fsa-578` as the module ID — update `lib/modules.ts` to add/rename accordingly, and grant `fsa-578` access in Supabase `module_access` table.

### Pattern 1: Supabase Migration Script with Upsert
**What:** Standalone Node.js/TypeScript script that reads `fsa-acres/data/data.json`, transforms records, and upserts into Supabase using service_role key. Idempotent via unique constraint on `legacy_id`.
**When to use:** One-time migration + re-run safety when source Excel changes.

```typescript
// Source: @supabase/supabase-js official pattern
// scripts/migrate-fsa.ts
import { createClient } from '@supabase/supabase-js'
import data from '../../../fsa-acres/data/data.json'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // bypass RLS for migration
)

// Upsert CLU records — idempotent via legacy_id unique constraint
const cluRows = data.cluRecords.map(r => ({
  legacy_id: r.id,              // 'clu_1', 'clu_2', etc.
  crop_year: 2026,
  farm_number: r.farmNumber,
  tract_number: r.tractNumber,
  clu: r.clu,
  field_name: r.fieldName,
  farm_name: r.farmName,
  fsa_acres: r.fsaAcres,
  crop: r.crop || null,
  irrigated: r.irrigated,
  organic: r.organic,
  double_crop: r.doubleCrop,
  cover_crop: r.coverCrop,
  grain_plant_date: r.grainPlantDate || null,
  use: r.use || null,
  reported: r.reported,
  tillage_2024: r.tillage2024 || null,
  tillage_2025: r.tillage2025 || null,
  cc_2024: r.cc2024 || null,
  cc_2025: r.cc2025 || null,
  nt_adoption_2024: r.ntAdoption2024 || null,
  nt_adoption_2025: r.ntAdoption2025 || null,
  cc_adoption_2024: r.ccAdoption2024 || null,
  cc_adoption_2025: r.ccAdoption2025 || null,
  unit_number: r.unitNumber || null,
  aph: r.aph || null,
  line_number: r.lineNumber || null,
  policy_number: r.policyNumber || null,
}))

const { error } = await supabase
  .from('clu_records')
  .upsert(cluRows, { onConflict: 'legacy_id' })

if (error) throw error
console.log(`Upserted ${cluRows.length} CLU records`)
```

### Pattern 2: Route Handler with Supabase Server Client (existing pattern)
**What:** Next.js 14 Route Handler using `lib/supabase/server.ts` pattern, reads from Supabase, returns JSON.
**When to use:** All FSA API endpoints in the portal.

```typescript
// Source: existing pattern from src/app/api/admin/users/route.ts
// src/app/api/fsa/validation/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateCluRecords } from '@/lib/fsa/calc'

export async function GET() {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch data
  const [cluResult, pricingResult, policiesResult] = await Promise.all([
    supabase.from('clu_records').select('*').eq('crop_year', 2026),
    supabase.from('insurance_pricing').select('*').eq('year', 2026),
    supabase.from('insurance_policies').select('*').eq('policy_year', 2026),
  ])

  const warnings = validateCluRecords(
    cluResult.data ?? [],
    pricingResult.data ?? [],
    policiesResult.data ?? []
  )

  return NextResponse.json({ warnings })
}
```

### Pattern 3: Cross-App Proxy with AbortSignal.timeout (established pattern)
**What:** Route Handler that fetches farm-budget Express app at localhost:3001, with timeout and explicit offline error. No stale cache fallback (per locked decision).
**When to use:** auto-populate-preview endpoint.

```typescript
// Source: fsa-acres/server.js pattern + v6.0 design context decision
// src/app/api/fsa/auto-populate-preview/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch farm-budget dashboard — no stale fallback, explicit offline error
  let budgetData: unknown
  try {
    const res = await fetch('http://localhost:3001/api/dashboard', {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`Budget returned ${res.status}`)
    budgetData = await res.json()
  } catch {
    return NextResponse.json(
      { error: 'Farm-budget is offline — auto-populate unavailable' },
      { status: 502 }
    )
  }

  // Fetch CLU records from Supabase
  const { data: cluRecords } = await supabase
    .from('clu_records')
    .select('id, legacy_id, farm_number, tract_number, clu, field_name, crop, fsa_acres')
    .eq('crop_year', 2026)

  // Build diff proposals (see architecture section below)
  const proposals = buildAutoPopulateProposals(budgetData, cluRecords ?? [])
  return NextResponse.json({ proposals })
}
```

### Pattern 4: TypeScript Port of Pure Functions
**What:** Direct port of calc.js UMD module to TypeScript ES module with explicit types. Preserves all function signatures.
**When to use:** lib/fsa/calc.ts — consumed by validation Route Handler.

```typescript
// src/lib/fsa/calc.ts
export const TILLAGE_CODES: Record<string, string> = {
  A: 'No Till', B: 'Strip Till', C: 'Fall Vertical',
  D: 'Spring Vertical', E: 'Fall Field Cultivation', E2: 'Spring Field Cultivation',
  F: 'Disk Ripper', G: 'Reduced Till'
}

export interface ValidationWarning {
  type: 'missing-crop' | 'missing-date' | 'missing-price' | 'no-insurance' | 'unreported'
  severity: 'error' | 'warning' | 'info'
  message: string
  count: number
  filter?: Record<string, string>
  details?: Array<{ crop: string; acres: number }>
}

// Note: Supabase row uses snake_case columns — calc functions receive mapped objects
// The Route Handler maps Supabase rows to the shape calc functions expect before calling
export function validateCluRecords(
  records: CluRecord[],
  pricing: PricingEntry[],
  policies: InsurancePolicy[]
): ValidationWarning[] {
  // ... direct port of validateRecords() with adjusted severity levels per locked decision:
  // missing-crop → error, missing-date → error (not info as in original),
  // unreported → warning, no-insurance → warning, missing-price → info
}
```

**Severity correction:** The original calc.js uses inconsistent severity labels. Per locked decision:
- `missing-crop`: **error**
- `missing-date`: **error** (original incorrectly labeled 'info')
- `unreported`: **warning** (original labeled 'info')
- `no-insurance`: **warning** (original correct)
- `missing-price`: **info** (original labeled 'warning' — demote)

### Anti-Patterns to Avoid
- **Sequential upserts in loop:** Always batch upsert in chunks of 500+ rows, not one-by-one. Supabase REST has per-request overhead.
- **Importing data.json directly from portal Next.js app context:** Import in the migration script from a relative path to `fsa-acres/data/data.json`. Do not copy the file into the portal.
- **Using anon key for migration:** Must use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS during migration. Never commit this key.
- **Calling localhost:3001 from Server Components at build time:** Always use `next: { revalidate: 0 }` to prevent Next.js from caching cross-app fetches.
- **Renaming module_access entries in middleware:** The middleware checks `module_access.module = moduleId`. If the module slug changes from `fsa-reporting` to `fsa-578`, the Supabase `module_access` table rows must also be updated (or add `fsa-578` rows alongside existing `fsa-reporting` rows).

---

## Data Model Design

### Supabase Tables for Phase 27

#### clu_records
```sql
create table clu_records (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique not null,          -- 'clu_1', 'clu_2', etc. — upsert anchor
  crop_year   integer not null default 2026,
  farm_number text not null,
  tract_number text not null,
  clu         text not null,
  field_name  text,
  farm_name   text,
  fsa_acres   numeric(10,2) not null default 0,
  crop        text,                           -- null = no crop assigned
  irrigated   boolean not null default false,
  organic     boolean not null default false,
  double_crop boolean not null default false,
  cover_crop  boolean not null default false,
  grain_plant_date text,                     -- stored as text (values like '2010', '2024-04-25', 'TBD', '')
  use         text,
  reported    boolean not null default false,
  -- Prior-year conservation practice data (flat columns — 2 years only, no normalization needed)
  tillage_2024 text,
  tillage_2025 text,
  cc_2024     text,
  cc_2025     text,
  nt_adoption_2024 text,
  nt_adoption_2025 text,
  cc_adoption_2024 text,
  cc_adoption_2025 text,
  -- Additional metadata
  unit_number text,
  aph         numeric(10,2),
  line_number text,
  policy_number text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index on clu_records(crop_year);
create index on clu_records(farm_number);
```

**Why flat year columns (not a history table):** The calc.js functions (`tillageSummary`, `coverCropSummary`) access year data by field name — `r.tillage2024`, `r.tillage2025`. Preserving flat columns avoids a join and keeps the TypeScript port trivial. Only 2 years of data exist. A `clu_practice_history` table would add complexity with no benefit at this scale.

**Why UUID PK + legacy_id:** Supabase FK relationships, RLS policies, and Phase 29+ references require UUID PKs. The `legacy_id` preserves the original string IDs for debugging and upsert idempotency without polluting the FK chain.

#### insurance_pricing
```sql
create table insurance_pricing (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique not null,
  crop        text not null,
  year        integer not null default 2026,
  spring_price numeric(10,4) not null default 0,
  fall_price  numeric(10,4) not null default 0,
  manual_override boolean not null default false,
  created_at  timestamptz default now()
);

create unique index on insurance_pricing(crop, year);
```

#### insurance_policies (policy fields only — claims split out)
```sql
create table insurance_policies (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique not null,
  farm_name   text,
  farm_number text,
  line_number text,
  policy_number text,
  crop        text,
  policy_year integer not null default 2026,
  planted_acres numeric(10,2) not null default 0,
  fsa_acres_manual numeric(10,2),
  guarantee   numeric(10,2) not null default 0,
  actual      numeric(10,2) not null default 0,
  coverage_level integer not null default 75,
  unit_type   text,
  premium_per_acre numeric(10,4),
  agent_name  text,
  prevented_planting boolean not null default false,
  prevented_planting_acres numeric(10,2),
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

#### claims (split from insurance_policies — FK to insurance_policies)
```sql
create table claims (
  id          uuid primary key default gen_random_uuid(),
  policy_id   uuid not null references insurance_policies(id) on delete cascade,
  claim_status text not null default 'none',   -- 'none', 'potential', 'filed', 'paid'
  claim_number text,
  loss_type   text,
  adjuster_name text,
  adjuster_phone text,
  claim_filed_date date,
  claim_paid_date date,
  claim_paid_amount numeric(10,2),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
```

**Migration of 3 existing policies to claims table:** The 3 insurance policies in data.json have claim-related fields at the policy level (`claimStatus`, `claimNumber`, etc.). During migration, insert a corresponding `claims` row for each policy that has any claim data set. The `ins_478` policy has `claimStatus: 'none'` and no claim amounts, so it may or may not need a claims row — insert a `'none'` status row for completeness to keep the FK chain clean for Phase 29.

#### gcs_enrollments
```sql
create table gcs_enrollments (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   text unique not null,
  farm_number text not null,
  tract_number text not null,
  field_id    text not null,
  commodity   text,
  cc340_acres numeric(10,2) not null default 0,
  rt345_acres numeric(10,2) not null default 0,
  nt329_acres numeric(10,2) not null default 0,
  default_yield numeric(10,2),
  irrigation  text,
  tillage     text,
  state       text not null default 'WI',
  county      text not null default 'Rock',
  created_at  timestamptz default now()
);

create index on gcs_enrollments(farm_number, tract_number);
```

### RLS Policy
All tables need RLS enabled. For Phase 27, the minimum viable policy is: authenticated users with `fsa-578` module access can read. Writes require admin or service_role.

```sql
-- Enable RLS
alter table clu_records enable row level security;
alter table insurance_pricing enable row level security;
alter table insurance_policies enable row level security;
alter table claims enable row level security;
alter table gcs_enrollments enable row level security;

-- Read policy: any authenticated user with module access
-- (module_access check done at API layer via middleware, not in RLS for simplicity)
create policy "authenticated_read" on clu_records
  for select using (auth.role() = 'authenticated');
-- Repeat for other tables
```

---

## Auto-Populate Matching Strategy

The CONTEXT.md leaves the matching strategy to Claude's discretion. Based on what the existing `fsa-acres/server.js` does at `/api/sync-crops/enterprise-preview` (lines 568-656), the recommended approach for the portal is:

**Enterprise-level crop match (simpler, more reliable than field-name fuzzy match):**

1. Fetch `GET http://localhost:3001/api/dashboard` — returns `{ enterpriseSummaries: [{ enterprise: { name, category }, cropRows: [{ crop, acres }] }], ... }`
2. From enterpriseSummaries, build a budget crop map: `{ normalizedCrop: { displayName, budgetAcres } }`
3. From `clu_records`, build a CLU crop map: `{ normalizedCrop: { cluIds: [], fsaAcres, currentCrop } }`
4. For each CLU record, propose the budget crop that fuzzy-matches its current crop (or propose based on acres if blank)
5. Return proposals array with: `{ cluId, fieldName, farmNumber, tractNumber, clu, currentCrop, proposedCrop, fsaAcres, matchConfidence }`

**Normalization function (port from existing `normName` in fsa-acres/server.js):**
```typescript
function normName(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()
}
```

**Why enterprise-level (not field-name fuzzy match):** The per-field matching in `/api/sync-crops/preview` (line 658) requires the farm-registry to be running (port 3005) and uses multi-step fuzzy matching with a combinedScore. For the portal, the simpler enterprise-level crop assignment (what crops are being grown and how many acres) is more reliable and avoids a second external dependency. The user reviews the full diff anyway, so false positives are correctable.

---

## Module Registration

The portal's `lib/modules.ts` currently lists `fsa-reporting` (id: 'fsa-reporting'). The v6.0 design context uses `fsa-578` as the module ID. Phase 27 must decide one of:

**Option A (recommended):** Add `fsa-578` as a new module in `lib/modules.ts`. Keep `fsa-reporting` if it has existing module_access grants. Update `farm-node-map.tsx` to use `fsa-578` for the FSA Reporting node.

```typescript
// lib/modules.ts addition
{
  id: 'fsa-578',
  label: 'FSA 578',
  sublabel: 'Acreage Reporting',
  route: '/app/fsa-578',
}
```

The middleware reads the module slug from the URL path (`/app/fsa-578`) and checks `module_access.module = 'fsa-578'`. Grants must be inserted into Supabase `module_access` for any user who needs access.

**Option B:** Rename `fsa-reporting` → `fsa-578` everywhere (modules.ts, farm-node-map.tsx, module_access rows). Cleaner long-term but requires a Supabase data migration.

Recommendation: **Option A** for Phase 27 (additive, no data migration risk). Clean up `fsa-reporting` in a later phase.

---

## Source Data Reality Check

From direct inspection of `fsa-acres/data/data.json`:

| Table | Count | Notes |
|-------|-------|-------|
| clu_records | **444** | Confirmed |
| pricing | **22** | Confirmed |
| insurancePolicies | **3** | Confirmed — but data is sparse; ins_479 and ins_482 missing many fields |
| gcsEnrollments | **149** | Confirmed |
| farms | 10 | Not migrated as separate table — farm data is denormalized into clu_records |
| Total FSA acres | **5,977.24** | NOTE: CONTEXT.md says ~3,164 acres — this appears to be a discrepancy. Actual sum = 5,977.24 acres. Verify with user. |

**Insurance policy data quality:**
- `ins_478`: Has farm_name, line_number, planted_acres, guarantee, actual — most complete
- `ins_479`: Has farm_name, line_number, crop ('rye'), fsaAcresManual — minimal
- `ins_482`: No farm_name, no line_number, has actual (40000) — possibly aggregate/test data

**Crop data quality:**
- 267 of 444 CLU records have a crop assigned; 177 are blank
- Blank crop records represent 4,052 of 5,977 acres — these are the validation targets for FSA-05
- Crops are not normalized (mix of 'Soybeans', 'nc', 'NC', 'gls', 'GLS')

**Farms:**
- 10 unique farm numbers in data: 7217, 8459, 9808, 11555, 11624, 12638, 13329, 14903, 14904, 15180
- Farm 14903 dominates: 290 of 444 CLU records

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upsert idempotency | Custom "check if exists, insert or update" logic | Supabase `.upsert()` with `onConflict: 'legacy_id'` | Single atomic operation, handles race conditions |
| Auth check in Route Handlers | Custom JWT parsing | `supabase.auth.getUser()` (existing pattern in admin routes) | Established pattern, handles token refresh |
| Cross-app timeout | `Promise.race()` with setTimeout | `AbortSignal.timeout(5000)` | Native browser/Node API, cleaner than race pattern |
| TypeScript types for Supabase | Manual interface definitions | Supabase CLI type generation (`supabase gen types typescript`) | Auto-generated from schema, always in sync |

**Key insight:** Everything needed for Phase 27 is either already in the portal (Supabase client patterns, Route Handler auth) or a direct port from existing Express code (calc.js, sync-crops logic). Do not introduce new abstractions.

---

## Common Pitfalls

### Pitfall 1: Acres Discrepancy in CONTEXT.md
**What goes wrong:** CONTEXT.md says "~3,164 FSA acres" but actual data.json total is 5,977.24 acres. If the migration script validates against 3,164, it will always fail.
**Why it happens:** The CONTEXT.md figure was likely from a filtered subset (e.g., only reported acres or only certain farms) rather than the total.
**How to avoid:** Verification script should output actual total and record count without hardcoded expected values. Let the user confirm the expected total before shipping.
**Warning signs:** Migration script exits with "validation failed" despite correct record count.

### Pitfall 2: grain_plant_date as TEXT not DATE
**What goes wrong:** Casting `grainPlantDate` values to PostgreSQL `date` type fails because source data contains mixed formats: `'2010'` (year only), `'2024-04-25'` (ISO date), `'TBD'` (text), `''` (empty string).
**Why it happens:** The import.js `toDate()` function emits year-only values for Excel serial dates < 3000 and passes through text strings like 'TBD'.
**How to avoid:** Store `grain_plant_date` as `text` in Supabase (as designed above). If ISO date filtering is needed later, add a computed column.
**Warning signs:** Supabase upsert fails with type coercion errors.

### Pitfall 3: Module Slug Mismatch
**What goes wrong:** Creating route at `/app/fsa-578/` but middleware checks `module_access.module` against slug extracted from URL. If module_access rows say `fsa-reporting` but URL is `/app/fsa-578`, access check returns false and user is redirected to dashboard.
**Why it happens:** The middleware `getModuleId()` extracts the slug from the URL path — it must match the `module` column value in `module_access`.
**How to avoid:** After adding `fsa-578` to modules.ts and creating the route, immediately grant `fsa-578` access in Supabase for test users. Run a quick smoke test navigating to `/app/fsa-578`.
**Warning signs:** Redirect loop to `/dashboard?denied=fsa-578`.

### Pitfall 4: Next.js fetch() Caching Cross-App Calls
**What goes wrong:** Next.js 14 caches `fetch()` calls at build time by default. The auto-populate endpoint calling `localhost:3001/api/dashboard` gets a build-time snapshot, not live data.
**Why it happens:** Next.js 14 App Router fetch caching defaults to `force-cache` in some contexts.
**How to avoid:** Always include `next: { revalidate: 0 }` in the fetch options for cross-app calls.
**Warning signs:** Auto-populate preview returns stale crop data that doesn't match current farm-budget state.

### Pitfall 5: RLS Blocking Migration Script
**What goes wrong:** Migration script using anon key cannot insert into RLS-protected tables.
**Why it happens:** Supabase RLS blocks all writes from anon/authenticated roles unless a policy explicitly permits it.
**How to avoid:** Migration script must use `SUPABASE_SERVICE_ROLE_KEY` (not `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Service role bypasses RLS.
**Warning signs:** Supabase upsert returns `{ error: { message: 'new row violates row-level security policy' } }`.

### Pitfall 6: ins_482 "Phantom" Insurance Policy
**What goes wrong:** The third insurance policy (`ins_482`) has no farm_name, no line_number, no crop, and an actual value of 40,000 — which is clearly not a yield (it's likely an indemnity dollar amount in the wrong field). Migrating it as-is will corrupt insurance calculations.
**Why it happens:** Source Excel had data entry errors or aggregate rows that were captured by import.js.
**How to avoid:** Inspect `ins_482` carefully during migration. Either skip it (with a log message) or migrate it with a `notes` field flagging it as 'suspect — verify before Phase 29'.
**Warning signs:** Insurance payout calculations return implausibly large numbers.

---

## Code Examples

### Migration Script Skeleton
```typescript
// scripts/migrate-fsa.ts
// Run: cd glomalin-portal && npx tsx ../scripts/migrate-fsa.ts
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const dataPath = path.resolve(__dirname, '../../fsa-acres/data/data.json')
const store = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

async function main() {
  console.log('Source data:')
  console.log(`  CLU records: ${store.cluRecords.length}`)
  console.log(`  Pricing: ${store.pricing.length}`)
  console.log(`  Insurance: ${store.insurancePolicies.length}`)
  console.log(`  GCS: ${store.gcsEnrollments.length}`)
  const totalAcres = store.cluRecords.reduce((s: number, r: any) => s + (r.fsaAcres || 0), 0)
  console.log(`  Total acres: ${totalAcres.toFixed(2)}`)

  await migrateCluRecords()
  await migratePricing()
  await migrateInsurancePolicies()
  await migrateGcsEnrollments()

  console.log('\nMigration complete.')
}

async function migrateCluRecords() {
  const rows = store.cluRecords.map((r: any) => ({
    legacy_id: r.id,
    crop_year: store.settings?.year ?? 2026,
    // ... field mapping
  }))

  // Batch upsert in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await supabase.from('clu_records').upsert(chunk, { onConflict: 'legacy_id' })
    if (error) throw new Error(`CLU upsert failed: ${error.message}`)
  }
  console.log(`Upserted ${rows.length} CLU records`)
}

// ... migratePricing, migrateInsurancePolicies, migrateGcsEnrollments

main().catch((err) => { console.error(err); process.exit(1) })
```

### calc.ts Type Interfaces
```typescript
// src/lib/fsa/calc.ts — mapped to Supabase snake_case columns

export interface CluRecord {
  id: string
  legacy_id: string
  crop_year: number
  farm_number: string
  tract_number: string
  clu: string
  field_name: string | null
  farm_name: string | null
  fsa_acres: number
  crop: string | null
  irrigated: boolean
  organic: boolean
  reported: boolean
  // ... etc.
}

export interface PricingEntry {
  id: string
  crop: string
  year: number
  spring_price: number
  fall_price: number
}

export interface InsurancePolicy {
  id: string
  crop: string | null
  planted_acres: number
  guarantee: number
  actual: number
  coverage_level: number
  // ... etc.
}
```

**Note:** The calc functions must be adapted to use snake_case column names from Supabase (e.g., `r.fsa_acres` instead of `r.fsaAcres`, `r.farm_number` instead of `r.farmNumber`). This is straightforward — it's just property name changes throughout the function bodies.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| fsa-acres/import.js reads Excel → data.json | scripts/migrate-fsa.ts reads data.json → Supabase | Single migration step, no Excel parsing needed in portal |
| calc.js UMD module (browser + Node) | lib/fsa/calc.ts ES module (TypeScript, server-only) | Type safety, tree-shakeable, no global namespace pollution |
| Express /api/validation endpoint | Next.js Route Handler /api/fsa/validation/route.ts | Runs at edge, uses Supabase auth |
| localhost:3001 fetch in Express server.js | localhost:3001 fetch in Next.js Route Handler | Same AbortSignal.timeout pattern, different runtime |

**Deprecated/outdated:**
- `fsa-acres/public/calc.js` UMD wrapper: Only needed for browser consumption — not needed in TypeScript ESM context.

---

## Open Questions

1. **Total FSA acres discrepancy**
   - What we know: CONTEXT.md says "~3,164 FSA acres" but data.json totals 5,977.24 acres
   - What's unclear: Whether 3,164 is a filtered subset (e.g., only reported, or only one farm) or an outdated figure
   - Recommendation: Migration script outputs actual total; planner should add a verification step that logs the total and compares to a user-confirmed figure

2. **`ins_482` data quality**
   - What we know: Third insurance policy has `actual: 40000` with no farm/crop info — suspicious
   - What's unclear: Whether this is an indemnity dollar amount in the wrong field, a test row, or a real policy aggregate
   - Recommendation: Flag in migration script, insert with `notes: 'VERIFY - data may be corrupt'`, let Phase 29 (Insurance UI) surface it for user review

3. **Module slug: keep `fsa-reporting` or rename to `fsa-578`?**
   - What we know: Portal currently has `fsa-reporting` in modules.ts; v6.0 design context uses `fsa-578`
   - What's unclear: Whether any existing module_access rows exist for `fsa-reporting` in the live Supabase project
   - Recommendation: Add `fsa-578` alongside `fsa-reporting` in Phase 27 (Option A). Document the cleanup as a later task.

4. **Migration script location**
   - What we know: The portal is at `glomalin-portal/`. The data.json is at `fsa-acres/data/data.json` (monorepo sibling).
   - What's unclear: Whether to put the migration script inside `glomalin-portal/scripts/` or at the repo root level.
   - Recommendation: `glomalin-portal/scripts/migrate-fsa.ts` — colocated with the portal it serves, references sibling via `../../fsa-acres/data/data.json`.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `fsa-acres/data/data.json` (444 records, verified counts)
- Direct codebase inspection — `fsa-acres/public/calc.js` (383 lines, full function inventory)
- Direct codebase inspection — `fsa-acres/import.js` (288 lines, column mapping reference)
- Direct codebase inspection — `fsa-acres/server.js` (auto-populate logic lines 568-776)
- Direct codebase inspection — `glomalin-portal/src/app/api/admin/users/route.ts` (Route Handler auth pattern)
- Direct codebase inspection — `glomalin-portal/src/middleware.ts` (module slug extraction logic)
- Direct codebase inspection — `glomalin-portal/src/lib/supabase/server.ts` (server client pattern)
- Direct codebase inspection — `glomalin-portal/src/lib/modules.ts` (current module registry)
- Direct codebase inspection — `glomalin-portal/package.json` (@supabase/supabase-js ^2.98.0, next 14.2.35)

### Secondary (MEDIUM confidence)
- `@supabase/supabase-js` upsert with `onConflict` — standard documented feature
- `AbortSignal.timeout()` — Node.js 17.3+ and all modern browsers; confirmed available in Next.js 14 runtime
- `next: { revalidate: 0 }` in fetch options — Next.js 14 App Router fetch caching documentation pattern

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — patterns directly copied from existing portal code
- Pitfalls: HIGH — identified from direct source data inspection (acres discrepancy, grain_plant_date format, ins_482 anomaly)
- Data model: HIGH — based on direct schema design from source data field inventory

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable stack; expires if Supabase project credentials change or fsa-acres data.json is regenerated from Excel before migration runs)
