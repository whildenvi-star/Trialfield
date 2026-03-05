# Phase 29: Insurance Tables + Calculation Engine - Research

**Researched:** 2026-03-05
**Domain:** Supabase insurance data layer, APH auto-detection, grain-ticket yield bridge, claim alert logic
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

None — user gave Claude full discretion on all implementation decisions in this phase.

### Claude's Discretion

- APH auto-detection: calculation method (simple average vs acre-weighted), fallback behavior when CLU records lack APH values, refresh behavior (auto on load vs manual button), match key (crop+farm vs crop+farm+line)
- Yield-to-policy matching: matching approach (crop+destination vs crop+farm-wide), live API call vs synced snapshot, unit conversion (standard bushel weights vs configurable per crop), moisture adjustment handling
- Claim alert rules: trigger approach (simple threshold vs tiered warnings), alert timing (on yield sync vs auto on page load), alert detail level (flag only vs estimated indemnity), plan type support scope (all three RP/RP-HPE/YP vs yield-only)
- Migration and schema: claim field handling (migrate all vs split for Phase 31), multi-year support (policy_year column vs single-season), farm linking strategy (FK to CLU records vs text-only), migration type (one-time seed vs repeatable sync)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INS-01 | User can see existing insurance policies (migrated from fsa-acres) in the portal | insurance_policies table already migrated in Phase 27-01; need GET /api/insurance/policies route + list UI shell |
| INS-05 | User can see APH yield auto-populated from CLU records | CLU records have aph column (all 0 in current data — see Critical Discovery below); auto-compute from CLU records by crop+farm match; write aph_computed back or return as derived field |
| INS-06 | User can sync actual yield from grain-tickets for post-harvest comparison | Port lookupGrainYield() from fsa-acres/public/insurance.js; cross-app fetch to grain-tickets port 3000 /api/farms endpoint; write actual_yield to insurance_policies |
| INS-07 | User can see potential claim alerts when actual yield < effective guarantee | computeClaimAlert() pure function; flag when actual < (guarantee × coverage_level/100); store alert_status on policy or derive at read time |

</phase_requirements>

---

## Summary

Phase 29 is a pure data/engine phase — no policy editor UI (that's Phase 30). It has two plans: Plan 29-01 creates the Supabase API layer for insurance_policies and insurance_pricing (both tables already exist from Phase 27-01) plus the `lib/insurance/calc.ts` engine. Plan 29-02 adds the APH auto-detect route, grain-ticket yield bridge API, and claim alert detection logic.

**Critical Discovery: All 444 CLU records have `aph = 0`.** The `aph` column exists on `clu_records` in Supabase (migrated from Phase 27), but not a single CLU in the source data has a non-zero APH value. This means INS-05 ("APH yield auto-populated from CLU records") cannot be a simple average of existing CLU data. The implementation must handle this gracefully: query CLU records by crop+farm, report how many have APH values, and if none do, surface a prompt rather than silently showing zero. The existing `lookupCluAph()` in fsa-acres/public/insurance.js already handles this correctly — it shows "N CLU records found — no APH values set" when totalRecords > 0 but avgAph === 0.

The insurance_policies table was migrated with 3 policies in Phase 27-01. Two policies belong to "KLUG, DAVIS" with lineNumber "0001-0077"; one policy (ins_482) has no farm/crop and was flagged as potentially corrupt (actual=40000). The policies have no populated farmNumber fields — only farmName. CLU-to-policy matching must therefore use farmName normalization + crop matching, not farmNumber FK.

**Primary recommendation:** Keep calc.ts minimal and pure — extend `lib/fsa/calc.ts` patterns to `lib/insurance/calc.ts`. The yield bridge and APH lookup are thin proxy routes (like the existing auto-populate-preview route), not complex services. Alert detection is a synchronous pure function on the same data shape computeInsurancePolicy() already produces.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | Already installed | Supabase client for read/write | Same as Phase 27/28 — no new dependency |
| TypeScript | Already configured | Type-safe calc engine | Matches existing lib/fsa/calc.ts pattern |
| Next.js App Router API routes | Already in use | REST endpoints under /api/insurance/* | Established project pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None new | — | — | Phase 29 adds zero new npm packages |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure function calc | Zod validation | Zod not installed; plain TypeScript types match fsa/calc.ts precedent |
| Live cross-app fetch | Cached snapshot in Supabase | Live fetch chosen — matches existing grain-yield proxy pattern; snapshot would require background job (out of scope) |
| Separate insurance module slug | Reusing fsa-578 | INS-* requirements are for a separate RBAC module — add 'insurance' slug to modules.ts additively |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
glomalin-portal/
├── src/
│   ├── lib/
│   │   └── insurance/
│   │       └── calc.ts              # Pure calc engine (INS-05, INS-06, INS-07 logic)
│   └── app/
│       ├── api/
│       │   └── insurance/
│       │       ├── policies/
│       │       │   └── route.ts     # GET /api/insurance/policies (INS-01)
│       │       ├── policies/[id]/
│       │       │   └── route.ts     # PATCH /api/insurance/policies/[id] (yield sync)
│       │       ├── aph-lookup/
│       │       │   └── route.ts     # GET /api/insurance/aph-lookup (INS-05)
│       │       └── yield-sync/
│       │           └── route.ts     # POST /api/insurance/yield-sync (INS-06)
│       └── (protected)/app/
│           └── insurance/
│               └── page.tsx         # Insurance module shell (INS-01 display)
```

### Pattern 1: Pure Calc Engine (lib/insurance/calc.ts)

**What:** Mirror lib/fsa/calc.ts — export pure TypeScript functions that take typed inputs and return typed outputs. No side effects, no Supabase calls. The route handlers call these functions.

**When to use:** All business logic for APH averaging, effective guarantee, claim alert detection.

```typescript
// Source: lib/fsa/calc.ts established pattern — same shape
export interface InsurancePolicy {
  id: string
  legacy_id: string
  farm_name: string | null
  farm_number: string | null
  line_number: string | null
  crop: string | null
  policy_year: number
  planted_acres: number
  fsa_acres_manual: number | null
  guarantee: number           // APH yield (bu/ac)
  actual: number              // actual yield after harvest
  coverage_level: number      // 50-85 (stored as integer, e.g. 75 = 75%)
  unit_type: string | null
  premium_per_acre: number | null
  prevented_planting: boolean
  prevented_planting_acres: number | null
  notes: string | null
  // Phase 29 adds these computed/stored fields:
  aph_computed: number | null         // auto-filled from CLU average
  aph_clu_count: number | null        // how many CLUs contributed
  actual_synced_from_grain: boolean   // was actual set by yield bridge?
  claim_alert: 'none' | 'potential'   // derived flag
}

// APH average from CLU records (simple average — acre-weighted adds complexity
// for no benefit given all CLUs currently have aph=0; revisit in Phase 30 if needed)
export function computeAphFromClus(clus: CluRecord[]): {
  avgAph: number
  count: number
  totalRecords: number
} {
  const withAph = clus.filter((r) => r.aph !== null && r.aph > 0)
  const avgAph = withAph.length > 0
    ? round2(withAph.reduce((sum, r) => sum + (r.aph ?? 0), 0) / withAph.length)
    : 0
  return { avgAph, count: withAph.length, totalRecords: clus.length }
}

// Claim alert: simple threshold — actual < effectiveGuarantee triggers 'potential'
// No tiered warnings for Phase 29 (data phase); tiered display is a Phase 30 concern
export function computeClaimAlert(policy: {
  guarantee: number
  actual: number
  coverage_level: number
}): 'none' | 'potential' {
  const effectiveGuarantee = policy.guarantee * (policy.coverage_level / 100)
  if (policy.actual > 0 && policy.actual < effectiveGuarantee) return 'potential'
  return 'none'
}
```

### Pattern 2: APH Lookup Route (GET /api/insurance/aph-lookup)

**What:** Query clu_records filtered by crop + farm_name normalization. Return avgAph, count, totalRecords. Same pattern as the existing /api/clu-records route — auth check, Supabase query, return structured JSON.

**When to use:** Called by INS-05 display logic when rendering a policy card.

**Match key decision:** Use crop + farm_name normalization (not farmNumber FK) because:
- All 3 policies have empty farmNumber fields in the source data
- Policies reference "KLUG, DAVIS" as farmName — CLU records have farm names like "klug" (lowercase, abbreviated)
- The existing lookupCluAph() in insurance.js already does this: normalizes both sides to lowercase, checks substring containment
- lineNumber match (e.g., "0001-0077") is possible for 41 CLUs that have lineNumbers, but provides no APH value since all CLU aph=0 anyway — use it as a tiebreaker if multiple farm matches, not primary key

```typescript
// Source: insurance.js lookupCluAph() reference implementation
// GET /api/insurance/aph-lookup?crop=rye&farmName=KLUG%2C+DAVIS
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const crop = searchParams.get('crop') ?? ''
  const farmName = searchParams.get('farmName') ?? ''

  // Fetch CLU records matching crop (case-insensitive via ilike)
  const { data, error } = await supabase
    .from('clu_records')
    .select('farm_name, farm_number, aph, fsa_acres')
    .ilike('crop', `%${crop}%`)
    .eq('crop_year', 2026)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Further filter by farm_name substring match (normalize both sides)
  const normFarm = normName(farmName)
  const filtered = (data ?? []).filter((r) => {
    if (!normFarm) return true
    const rFarm = normName(r.farm_name ?? '')
    return rFarm.includes(normFarm) || normFarm.includes(rFarm)
  })

  const { avgAph, count, totalRecords } = computeAphFromClus(filtered as CluRecord[])
  return NextResponse.json({ avgAph, count, totalRecords })
}
```

### Pattern 3: Grain Ticket Yield Bridge (POST /api/insurance/yield-sync)

**What:** Cross-app fetch to grain-tickets (port 3000 /api/farms), match by crop+farmName normalization using the exact scoring logic from insurance.js lookupGrainYield(), write the matched yieldPerAcre back to insurance_policies.actual. Return the updated policy.

**Live vs snapshot decision:** Live fetch matches existing fsa-acres proxy pattern (/api/grain-yield) and the existing auto-populate-preview route. Snapshots would require a background job. Live is correct for Phase 29.

**Unit conversion decision:** Grain tickets already express yieldPerAcre in bushels/acre (computed from totalBU ÷ acres). No conversion needed. Moisture adjustment is not tracked in grain-ticket data — raw delivered bu/ac is what's stored.

**Endpoint shape:**
```typescript
// POST /api/insurance/yield-sync
// Body: { policyId: string }
// Response: { policy: InsurancePolicy, match: GrainFarmMatch | null }
export async function POST(request: Request) {
  // 1. Auth check
  // 2. Fetch policy from Supabase
  // 3. Fetch grain-ticket farms from port 3000 /api/farms with AbortSignal.timeout(5000)
  // 4. Score matches using findBestGrainMatch() pure function (port from insurance.js)
  // 5. If score >= 2: PATCH insurance_policies.actual + set actual_synced_from_grain=true
  // 6. Recompute claim_alert, update claim_alert column
  // 7. Return updated policy
}
```

### Pattern 4: Claim Alert Timing

**Alert timing decision:** Compute alert at write time (when yield is synced), not at read time on every page load. Store `claim_alert` column on `insurance_policies`. This keeps the GET /api/insurance/policies response fast (no recompute per request). Recompute happens in two cases:
1. POST /api/insurance/yield-sync — after writing new actual yield
2. PATCH /api/insurance/policies/[id] — whenever actual or guarantee or coverage_level changes

**Alert detail level for Phase 29:** Store only `claim_alert: 'none' | 'potential'` — a boolean flag. Estimated indemnity dollar amounts are for Phase 30 UI display (computeInsurancePolicy() already calculates indemnity — Phase 30 calls it client-side).

### Pattern 5: Schema Additions to insurance_policies

Phase 27-01 created insurance_policies with the exact columns listed in migrate-fsa.ts. Phase 29 needs to add columns for APH auto-detection and yield bridge results. These must be added via SQL migration, not by recreating the table.

**Columns to add:**
```sql
ALTER TABLE insurance_policies
  ADD COLUMN IF NOT EXISTS aph_computed       numeric(10,2),
  ADD COLUMN IF NOT EXISTS aph_clu_count      integer,
  ADD COLUMN IF NOT EXISTS actual_synced_from_grain boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claim_alert        text NOT NULL DEFAULT 'none';

-- Index for fast alert filtering
CREATE INDEX IF NOT EXISTS insurance_policies_claim_alert_idx
  ON insurance_policies(claim_alert);
```

**Multi-year decision:** Keep single policy_year column (already exists). Phase 29 does not add year-over-year comparison — that's v7+ (INS-09). The existing policy_year column handles future years when policies are added manually.

**Farm linking decision:** Do NOT add a FK from insurance_policies to clu_records. Farm name normalization + crop-based matching is the correct approach given:
- Policies have text farmName, not farmNumber FK
- CLU records have farm_name (text) not a unified farm entity ID
- A FK would require resolving the farm entity ambiguity first (out of Phase 29 scope)
- Text-only matching (with normalization) matches the existing working approach in insurance.js

**Migration approach:** Repeatable ALTER TABLE (IF NOT EXISTS) — same approach as Phase 27-01 createSchema() function. Add to the migrate-fsa.ts script OR create a new scripts/migrate-29.ts that only runs the ALTER TABLE statements. Prefer the new separate script to avoid re-running the full Phase 27 migration.

### Anti-Patterns to Avoid

- **Storing computed indemnity dollars in Supabase:** computeInsurancePolicy() output is ephemeral display data, not persisted state. Only persist `claim_alert` flag (not dollar amounts).
- **Module access check in API routes:** The existing pattern (auth check only in /api/* routes, module check only in /app/* middleware) is correct. Do not add module_access checks to /api/insurance/* routes.
- **acre-weighted APH average:** All 444 CLU records have aph=0. Do not implement complex weighting when there's no APH data. Simple average of non-zero records is correct; fallback to "no APH data found — enter manually" is the right UX.
- **Single grain-ticket match per policy:** The scoring logic should return the best match (score >= 2) or null. Do not auto-apply low-confidence matches (score 1 = farm name only, no crop match).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Farm name normalization | Custom regex | Port normName() from insurance.js (11 lines) | Already tested in production for 2+ seasons |
| Crop substring matching | Levenshtein distance | Port cropContains() from insurance.js | Substring containment is sufficient for these crop names |
| Cross-app fetch timeout | Manual AbortController | AbortSignal.timeout(5000) | Established project pattern from auto-populate-preview route |
| Grain ticket yield bridge | New Supabase table | Proxy to grain-tickets port 3000 /api/farms | Live data; no sync job needed; 3 policies = fast |

**Key insight:** The fsa-acres/public/insurance.js already has working reference implementations of every algorithm this phase needs. The job is TypeScript porting and route wiring, not algorithm design.

---

## Common Pitfalls

### Pitfall 1: APH Auto-Detect Returns 0 for All Current Policies

**What goes wrong:** aph_computed is written as 0 for all policies because all 444 CLU aph values are 0. Phase 30 then shows "APH: 0 bu/ac" which confuses the user.

**Why it happens:** The aph field was migrated from fsa-acres data.json where all CLU records have aph=0 (the field exists but was never populated).

**How to avoid:** Distinguish between "computed APH = 0 because CLUs have no APH values" vs "computed APH = 0 because no matching CLUs found." Store aph_clu_count: when aph_clu_count > 0 but aph_computed = 0, the UI (Phase 30) should prompt "CLU records found but no APH entered — add APH to CLU records or enter manually." When aph_clu_count = 0, show "No matching CLU records found."

**Warning signs:** aph_computed = 0 on every policy after running the APH computation endpoint.

### Pitfall 2: Grain Ticket Service Unavailable at Request Time

**What goes wrong:** User clicks "Sync Yield" — grain-tickets app (port 3000) is not running — 502 error without useful message.

**Why it happens:** Cross-app fetch has no retry, no fallback.

**How to avoid:** Wrap cross-app fetch in try/catch. Return `{ error: 'Grain ticket service unavailable — is port 3000 running?', matched: false }` with HTTP 200 (not 502). The client can display the error message gracefully. Use AbortSignal.timeout(5000) to fail fast. This matches the pattern in auto-populate-preview route.

**Warning signs:** Unhandled promise rejection in route handler logs.

### Pitfall 3: ins_482 Corrupt Data Surfacing as False Claim Alert

**What goes wrong:** ins_482 has actual=40000 (suspicious, flagged in Phase 27 migration) and guarantee=0, coverage_level=75. effectiveGuarantee = 0 × 0.75 = 0. actual (40000) > effectiveGuarantee (0), so no claim alert — this is coincidentally correct. But if guarantee gets populated later, the 40000 actual will cause claim_alert = 'potential' even though it's likely corrupt data.

**Why it happens:** ins_482 was migrated with a notes flag but the data wasn't cleaned.

**How to avoid:** In computeClaimAlert(), only flag 'potential' when BOTH actual > 0 AND guarantee > 0 (i.e., both values are meaningful). If guarantee = 0, skip the alert. Also: the notes field already says "VERIFY — data may be corrupt" — Phase 30 UI should surface this note prominently on the ins_482 card.

### Pitfall 4: TypeScript Set/Map Iteration Error

**What goes wrong:** `for (const x of mySet)` fails TypeScript compilation in this project's tsconfig.

**Why it happens:** The tsconfig.json has no `target` field (defaults to ES3). This was discovered and fixed in Phase 27-02.

**How to avoid:** Wrap all Set/Map iterations with `Array.from()` — same fix as Phase 27-02. Example: `for (const x of Array.from(mySet))`.

**Warning signs:** `Type 'IterableIterator<string>' is not an array type` TypeScript error.

### Pitfall 5: Policy farmNumber vs farmName Mismatch

**What goes wrong:** APH lookup uses farmNumber to filter CLU records, but all 3 policies have empty farmNumber fields. Zero CLU records are returned. APH lookup always reports "no matching CLU records."

**Why it happens:** The source data never populated farmNumber on insurance policies — they use farmName ("KLUG, DAVIS") as the identifier.

**How to avoid:** The APH lookup endpoint must accept farmName (not farmNumber) as the matching parameter. Normalize both sides: policy farmName "KLUG, DAVIS" → "klug davis", CLU farm_name "klug" → "klug". Substring match finds the right CLUs.

---

## Code Examples

### APH Lookup — Complete Reference from insurance.js

```typescript
// Ported from fsa-acres/public/insurance.js lines 325-350 (lookupCluAph)
// Source: fsa-acres/public/insurance.js

function normName(n: string | null): string {
  return (n ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

// CLU records already filtered by crop (ilike) from Supabase
// Further filter by farm name normalization:
function matchByFarm(clus: CluRecord[], farmName: string): CluRecord[] {
  const normFarm = normName(farmName)
  if (!normFarm) return clus
  return clus.filter((r) => {
    const rFarm = normName(r.farm_name ?? '')
    return rFarm.includes(normFarm) || normFarm.includes(rFarm)
  })
}
```

### Grain Ticket Score Matching — From insurance.js

```typescript
// Ported from fsa-acres/public/insurance.js lines 514-535 (findBestGrainMatch)
// Score: 3 = farm+crop match, 2 = crop only, 1 = farm only, 0 = no match
// Only apply matches with score >= 2

interface GrainFarm {
  farm: string
  crop: string
  acres: number
  totalBU: number
  yieldPerAcre: number
  ticketCount: number
}

function findBestGrainMatch(
  policy: { farm_name: string | null; crop: string | null },
  gtFarms: GrainFarm[]
): { match: GrainFarm | null; score: number } {
  const pFarm = normName(policy.farm_name)
  const pCrop = normName(policy.crop)
  let best: GrainFarm | null = null
  let bestScore = 0

  for (const f of gtFarms) {
    if (f.yieldPerAcre <= 0) continue
    const gtFarm = normName(f.farm)
    const nameMatch = pFarm && gtFarm && (pFarm.includes(gtFarm) || gtFarm.includes(pFarm))
    const cropMatch = pCrop && (normName(f.crop).includes(pCrop) || pCrop.includes(normName(f.crop)))
    const score = nameMatch && cropMatch ? 3 : cropMatch ? 2 : nameMatch ? 1 : 0
    if (score > bestScore) { bestScore = score; best = f }
  }

  return { match: best, score: bestScore }
}
```

### Supabase ALTER TABLE for Phase 29 Columns

```sql
-- Run in Supabase SQL editor (or via scripts/migrate-29.ts)
ALTER TABLE insurance_policies
  ADD COLUMN IF NOT EXISTS aph_computed              numeric(10,2),
  ADD COLUMN IF NOT EXISTS aph_clu_count             integer,
  ADD COLUMN IF NOT EXISTS actual_synced_from_grain  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claim_alert               text NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS insurance_policies_claim_alert_idx
  ON insurance_policies(claim_alert);

-- RLS: same authenticated_read policy as other FSA tables
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
-- (already enabled from Phase 27 — IF NOT EXISTS equivalent below)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'insurance_policies' AND policyname = 'authenticated_read'
  ) THEN
    CREATE POLICY "authenticated_read" ON insurance_policies
      FOR SELECT USING (auth.role() = 'authenticated');
    CREATE POLICY "authenticated_write" ON insurance_policies
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END$$;
```

### GET /api/insurance/policies Route Pattern

```typescript
// Source: established pattern from /api/fsa/clu-records/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '2026', 10)

  const { data, error } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('policy_year', year)
    .order('farm_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ policies: data ?? [], count: data?.length ?? 0, year })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| APH as a manually-entered field on policy | APH auto-detected from CLU records by crop+farm match | Phase 29 | Reduces manual entry; gracefully degrades when CLU aph=0 |
| Grain yield entered manually by user | Synced from grain-tickets via yield bridge | Phase 29 | One-click sync; preserves actual_synced_from_grain flag so user knows source |
| Claim status manually toggled (none/potential/filed/paid) | claim_alert computed from yield vs guarantee | Phase 29 adds auto-detection; Phase 31 adds manual claims workflow | Automatic potential claim detection; manual claim lifecycle stays in Phase 31 |

**Deprecated/outdated from fsa-acres:**
- `_computed` ephemeral fields: The fsa-acres app computes everything in-memory on GET /api/insurance. Phase 29 stores only the durable fields (aph_computed, actual_synced_from_grain, claim_alert). Display-time computations (effectiveGuarantee, indemnity, shortfall) remain ephemeral in Phase 30 UI.
- `claimStatus`, `claimNumber`, `adjusterName`, etc. on the policy object: These are now split into the `claims` table (Phase 27 FK design). Phase 29 does not mix claim workflow fields back into insurance_policies.

---

## Open Questions

1. **Can the grain-tickets /api/farms endpoint be relied upon for yield sync?**
   - What we know: fsa-acres/server.js already proxies it at /api/grain-yield (lines 499-530); the endpoint returns `[{ farm, crop, acres, totalBU, yieldPerAcre, ticketCount }]`
   - What's unclear: Whether the grain-tickets app is running in the user's environment when Phase 29 routes are tested
   - Recommendation: Return a clear 200 with `{ error: 'Grain ticket service unavailable — is port 3000 running?', matched: false }` on connection failure. Do not 502.

2. **Should insurance module get its own Supabase RLS write policy?**
   - What we know: Phase 27 only set up `authenticated_read` on insurance_policies (SELECT only). Phase 29 needs to write aph_computed, actual, claim_alert via API routes (which use the anon/user JWT, not service_role).
   - What's unclear: Whether the existing RLS policies allow UPDATE from authenticated users
   - Recommendation: Add `authenticated_write` policy (`FOR ALL USING (auth.role() = 'authenticated')`) in the Phase 29 schema migration. This is a farm management tool with single-tenant auth — per-user row restrictions are not needed.

3. **ISU Extension FM-1849 RP vs RP-HPE formula verification (from STATE.md blocker)**
   - What we know: STATE.md lists "Verify RP vs RP-HPE formula against ISU Extension FM-1849 before writing lib/insurance/calc.ts" as a pending concern
   - What's clarified by scope: Phase 29 is data/engine only. The payout simulator (RP vs RP-HPE price selection) is a Phase 30 UI feature. `computeInsurancePolicy()` already exists in lib/fsa/calc.ts and uses `highestPrice = Math.max(springPrice, fallPrice)` — this is the RP formula (uses harvest price if higher). Phase 29 only adds APH auto-detect and claim alert. The ISU formula check is a Phase 30 pre-work item, not blocking Phase 29.

---

## Sources

### Primary (HIGH confidence)

- `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/public/insurance.js` — Reference implementation of lookupCluAph(), lookupGrainYield(), findBestGrainMatch(), computeClaimAlert logic
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/scripts/migrate-fsa.ts` — insurance_policies table schema (exact column names and types)
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/lib/fsa/calc.ts` — Established calc engine pattern; InsurancePolicy interface; computeInsurancePolicy() already implemented
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/app/api/fsa/clu-records/route.ts` — Route handler pattern for Phase 29 API routes
- `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/data/data.json` (inspected via node) — Confirmed: 3 insurance policies, all 444 CLU records have aph=0, policies have no farmNumber values

### Secondary (MEDIUM confidence)

- Phase 27-01 SUMMARY.md — Confirms insurance_policies schema, migration approach, FK design decisions
- Phase 27-02 SUMMARY.md — Confirms TypeScript Set/Map pitfall; Array.from() fix required; cross-app fetch pattern (AbortSignal.timeout + typed revalidate:0)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns come from existing project code
- Architecture: HIGH — directly ported from verified fsa-acres/public/insurance.js reference implementation
- APH data state: HIGH — direct node inspection of data.json confirms all 444 CLU aph fields are 0
- Pitfalls: HIGH — most are discovered from Phase 27 SUMMARY.md or verified in source data

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable architecture; grain-tickets API shape unlikely to change)
