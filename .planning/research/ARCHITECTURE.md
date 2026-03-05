# Architecture Research

**Domain:** FSA-578 workflow, crop insurance decision tool, claims tracker — integrated into existing glomalin-portal
**Researched:** 2026-03-04
**Confidence:** HIGH — based on direct codebase inspection of glomalin-portal (all source files) and fsa-acres (server.js, calc.js, insurance.js, data.json)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  GLOMALIN PORTAL (port 3006)                     │
│                  Next.js 14 App Router + Supabase               │
├──────────────────┬──────────────────┬───────────────────────────┤
│  FSA MODULE      │  INSURANCE MOD   │  CLAIMS MODULE            │
│  /app/fsa-578    │  /app/insurance  │  /app/claims              │
│                  │                  │                           │
│  CLU card grid   │  Coverage matrix │  Kanban pipeline          │
│  Bulk editor     │  Payout sim      │  Claim detail view        │
│  578 PDF export  │  Policy tracker  │  Document upload          │
│  YoY compare     │  Perf history    │  Deadline alerts          │
└──────┬───────────┴─────┬────────────┴──────────┬────────────────┘
       │                 │                       │
       │    ┌────────────▼───────────────────────▼──────────┐
       │    │         SUPABASE (NEW TABLES)                 │
       │    │  clu_records, insurance_policies              │
       │    │  insurance_pricing, claims, claim_documents   │
       │    │  claim_timeline, gcs_enrollments              │
       │    │  (+ existing: profiles, module_access)        │
       │    └────────────────────────────────────────────────┘
       │
       ▼  server-side fetch (Next.js API routes — never from browser)
┌──────────────────────────────────────────────────────────────────┐
│                    EXISTING EXPRESS APPS                         │
│  farm-budget :3001   farm-registry :3005   grain-tickets :3000  │
│  (read-only — portal never writes back)                          │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `/app/fsa-578` module page | CLU planting/practice workflow, 578 export | React Server Component shell + Client components |
| `/app/insurance` module page | Policy tracking, coverage matrix, scenario sim | Server Component + interactive Client sections |
| `/app/claims` module page | Kanban pipeline, claim details, document management | Primarily Client Component (drag-and-drop) |
| Supabase tables | Persistent storage for all FSA/insurance/claims data | PostgreSQL + RLS policies |
| Express proxy layer | Read-only data pull from farm-budget, farm-registry, grain-tickets | Next.js API routes with TTL cache + graceful fallback |
| File storage | Claims documents (PDFs, photos) | Supabase Storage buckets |
| `lib/fsa/calc.ts` | Port of calc.js — rollups, validation, summaryMetrics | TypeScript, pure functions, no DOM dependencies |
| `lib/insurance/calc.ts` | Port of computeInsurancePolicy() — indemnity, shortfall, claimStatus | TypeScript, runs client-side in payout simulator |

---

## Recommended Project Structure

```
glomalin-portal/src/
├── app/
│   ├── (protected)/
│   │   └── app/
│   │       └── [module]/
│   │           └── page.tsx           # existing — replace "Coming Soon" per module
│   ├── api/
│   │   ├── fsa/
│   │   │   ├── clu-records/
│   │   │   │   ├── route.ts           # GET (list+filter), POST (create)
│   │   │   │   ├── [id]/route.ts      # GET, PUT, DELETE
│   │   │   │   └── bulk/route.ts      # PUT bulk (mark reported, bulk crop assign)
│   │   │   ├── rollup/route.ts        # summaryMetrics, rollupByCrop, reportingProgress
│   │   │   ├── export/
│   │   │   │   └── 578/route.ts       # PDF 578 generation
│   │   │   ├── sync/
│   │   │   │   └── budget/route.ts    # proxy: farm-budget crop sync preview + apply
│   │   │   └── registry/route.ts      # proxy: farm-registry field names for autocomplete
│   │   ├── insurance/
│   │   │   ├── policies/
│   │   │   │   ├── route.ts           # GET (list), POST (create)
│   │   │   │   └── [id]/route.ts      # GET, PUT, DELETE
│   │   │   ├── pricing/
│   │   │   │   ├── route.ts           # GET (list), POST (create)
│   │   │   │   ├── [id]/route.ts      # PUT, DELETE
│   │   │   │   └── scrape/route.ts    # POST: USDA RMA price discovery pull
│   │   │   └── grain-yield/route.ts   # proxy: grain-tickets yield bridge
│   │   └── claims/
│   │       ├── route.ts               # GET (list), POST (create)
│   │       ├── [id]/
│   │       │   ├── route.ts           # GET, PUT, DELETE
│   │       │   ├── documents/route.ts # POST (register doc), GET (list)
│   │       │   └── timeline/route.ts  # GET (list), POST (add event)
│   │       └── summary/route.ts       # dashboard summary card data
├── components/
│   ├── fsa/
│   │   ├── clu-card.tsx               # individual CLU card with inline edit
│   │   ├── clu-card-grid.tsx          # card grid with bulk selection
│   │   ├── clu-editor-drawer.tsx      # slide-in editor for all FSA-578 fields
│   │   ├── bulk-action-bar.tsx        # selected-count + bulk action buttons
│   │   ├── fsa-dashboard-metrics.tsx  # summary bar (total ac, reported, etc.)
│   │   ├── yoy-comparison.tsx         # year-over-year planting comparison
│   │   └── reporting-progress.tsx     # farm-by-farm reporting progress bars
│   ├── insurance/
│   │   ├── coverage-matrix.tsx        # RP/RP-HPE/YP heat map by coverage level
│   │   ├── payout-simulator.tsx       # interactive scenario calculator (client-side calc)
│   │   ├── policy-card.tsx            # individual policy summary card
│   │   ├── policy-editor-drawer.tsx   # slide-in editor (all policy fields)
│   │   ├── performance-summary.tsx    # historical performance dashboard
│   │   └── claim-status-stepper.tsx   # none→potential→filed→paid stepper
│   └── claims/
│       ├── claims-kanban.tsx          # drag-and-drop Kanban board
│       ├── claim-card.tsx             # Kanban card with loss type, amount, deadline
│       ├── claim-detail.tsx           # full claim detail view
│       ├── document-upload.tsx        # file upload to Supabase Storage
│       ├── document-list.tsx          # list with signed URL previews
│       └── deadline-alert-banner.tsx  # urgent claims within 7 days of deadline
└── lib/
    ├── supabase/
    │   ├── browser.ts  (existing)
    │   ├── server.ts   (existing)
    │   └── middleware.ts (existing)
    ├── fsa/
    │   ├── calc.ts                    # port of calc.js (rollupByFarm, rollupByCrop, etc.)
    │   └── types.ts                   # CluRecord, GcsEnrollment, FsaSettings TypeScript types
    ├── insurance/
    │   ├── calc.ts                    # port of computeInsurancePolicy()
    │   └── types.ts                   # InsurancePolicy, InsurancePricing TypeScript types
    └── modules.ts  (existing — add fsa-578, insurance, claims entries)
```

### Structure Rationale

- **`app/api/fsa/`, `app/api/insurance/`, `app/api/claims/`:** Route handlers map to domain boundaries. All Express app reads go through these handlers — never from browser code. This keeps the Express apps invisible to the client, avoids CORS issues, and enables graceful fallback when Express apps are down.
- **`components/fsa/`, `components/insurance/`, `components/claims/`:** Domain-grouped to avoid a flat mess. Each domain has independent drawers, grids, and summary bars with no cross-domain component dependencies.
- **`lib/fsa/calc.ts`, `lib/insurance/calc.ts`:** Port the calculation engines from Express `calc.js` into TypeScript. The payout simulator must recalculate instantly (no round-trip to server). The rollup logic runs on the server when generating dashboard summary cards.
- **Module page stays at `/app/[module]/page.tsx`:** The existing dynamic route handles auth + RBAC via middleware. Replace the "Coming Soon" placeholder with real module content. New module IDs (`fsa-578`, `insurance`, `claims`) are registered in `lib/modules.ts`.

---

## Architectural Patterns

### Pattern 1: Server Component Shell + Client Feature Islands

**What:** Module page is a React Server Component that fetches initial data from Supabase and passes it as props to Client Components. Interactive features (editors, Kanban, simulators) are `'use client'` components.

**When to use:** Every module page in this milestone. The shell handles auth check, initial data load, and dark soil layout wrapper. Client islands handle interactivity without blocking the initial render.

**Trade-offs:** Server components cannot use hooks or browser APIs; client components cannot be async. Keep data fetching in server components or route handlers, not in `useEffect()` chains.

**Example:**
```typescript
// The module page is a server component that loads initial data
async function FsaModulePage() {
  const supabase = await createClient()
  const { data: cluRecords } = await supabase
    .from('clu_records')
    .select('*')
    .eq('crop_year', 2026)
    .order('farm_number')

  return <CluCardGrid initialRecords={cluRecords ?? []} />
  // CluCardGrid is 'use client' — handles interactivity
}
```

### Pattern 2: Supabase Route Handlers with RLS

**What:** All data mutations go through `app/api/` route handlers. Each handler calls `createClient()` (server-side Supabase client) and relies on RLS for authorization. Session-scoped client enforces RLS automatically — no service-role key needed for user data.

**When to use:** Every write operation (POST, PUT, DELETE). Route handlers are the boundary between browser and Supabase. They validate input, enforce business rules, and return typed responses.

**Trade-offs:** Adds one HTTP hop vs calling Supabase directly from the browser client. Worth it for consistent validation, audit hooks, and keeping service-role key server-only.

**Example:**
```typescript
// app/api/fsa/clu-records/route.ts
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('clu_records')
    .insert({ ...body, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

### Pattern 3: Express Proxy Route Handler with TTL Cache

**What:** Next.js API routes proxy read-only requests to Express apps (farm-budget, farm-registry, grain-tickets). Module-level cache with 60-second TTL prevents hammering Express and handles graceful fallback when apps are down. Mirrors the `cachedFetch()` pattern already in `fsa-acres/server.js`.

**When to use:** Any time the portal needs data from an Express app. Never call Express apps from browser code.

**Trade-offs:** Adds latency (Express must be running). Cache means data may be up to 60 seconds stale — acceptable for crop planning data. Returns empty array on failure so the portal UI never hard-crashes from a missing Express app.

**Example:**
```typescript
// app/api/fsa/registry/route.ts
let cache: { data: unknown; ts: number } | null = null

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < 60_000) {
    return NextResponse.json(cache.data)
  }
  try {
    const res = await fetch('http://localhost:3005/api/fields', {
      signal: AbortSignal.timeout(5000)
    })
    const data = await res.json()
    cache = { data, ts: now }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(cache?.data ?? []) // stale or empty fallback
  }
}
```

### Pattern 4: Client-Side Calculation Engine for Insurance Simulator

**What:** Port `computeInsurancePolicy()` from `fsa-acres/public/calc.js` into `lib/insurance/calc.ts`. The payout simulator calls this function on every user input change (coverage level slider, yield inputs). No server round-trip.

**When to use:** Any calculation that needs sub-100ms feedback in response to user input. The insurance simulator adjusts 3-4 variables; waiting 200ms per change makes it feel broken.

**Trade-offs:** The calculation engine runs in the browser. Policy data (pricing, CLU acres) must be pre-loaded. Load the required data once on page mount, then calculate locally.

**Example:**
```typescript
// lib/insurance/calc.ts
export function computeInsurancePolicy(
  policy: InsurancePolicy,
  cluRecords: CluRecord[],
  pricing: InsurancePricing[]
): ComputedPolicyResult {
  // port of Calc.computeInsurancePolicy() from calc.js
  const fsaAcres = policy.fsa_acres_manual
    ?? cluRecords
        .filter(r => r.crop?.toLowerCase() === policy.crop?.toLowerCase()
               && (!policy.farm_number || r.farm_number === policy.farm_number))
        .reduce((sum, r) => sum + (r.fsa_acres ?? 0), 0)

  const priceEntry = pricing.find(p => p.crop?.toLowerCase() === policy.crop?.toLowerCase())
  const springPrice = priceEntry?.spring_price ?? 0
  const fallPrice = priceEntry?.fall_price ?? 0
  const highestPrice = Math.max(springPrice, fallPrice)

  const guarantee = policy.guarantee ?? 0
  const actual = policy.actual ?? 0
  const plantedAcres = policy.planted_acres ?? 0
  const coverageLevel = policy.coverage_level ?? 75
  const effectiveGuarantee = round2(guarantee * (coverageLevel / 100))
  const shortfall = Math.max(0, effectiveGuarantee - actual)
  const dollarGuarantee = round2(effectiveGuarantee * highestPrice * plantedAcres)
  const indemnity = round2(shortfall * highestPrice * plantedAcres)
  const totalPremium = round2((policy.premium_per_acre ?? 0) * plantedAcres)

  let claimStatus = policy.claim_status ?? 'none'
  if (claimStatus === 'none' && shortfall > 0 && plantedAcres > 0 && highestPrice > 0) {
    claimStatus = 'potential'
  }

  return { fsaAcres, springPrice, fallPrice, highestPrice, effectiveGuarantee,
           dollarGuarantee, shortfall, indemnity, claimStatus, totalPremium }
}
```

### Pattern 5: Supabase Storage for Claim Documents

**What:** Claims documents upload directly to a Supabase Storage bucket from the browser client. Store the `storage_path` in the `claim_documents` table via a route handler after successful upload. Generate signed URLs on-demand for viewing.

**When to use:** Document upload/download in the claims module.

**Trade-offs:** Direct browser-to-Supabase upload is faster (no proxy through Next.js). The route handler call after upload registers the metadata. Signed URLs expire (default 60s) — generate fresh URLs on each page load, not stored in DB.

**Example:**
```typescript
// In DocumentUpload component ('use client')
const { data: upload, error } = await supabase.storage
  .from('claim-documents')
  .upload(`claims/${claimId}/${Date.now()}-${file.name}`, file)

if (upload) {
  await fetch(`/api/claims/${claimId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      storage_path: upload.path,
      file_size: file.size,
      mime_type: file.type,
      doc_type: selectedDocType,
    })
  })
}
```

---

## New Supabase Tables

### `clu_records`

Migrated from `fsa-acres/data/data.json` `cluRecords[]`. Primary data source for the FSA planting workflow.

```sql
create table clu_records (
  id              text primary key,       -- preserve existing IDs ('clu_1', 'clu_2', ...)
  crop_year       int not null default 2026,
  farm_number     text,
  farm_name       text,
  tract_number    text,
  clu             text,
  field_name      text,
  crop            text,
  fsa_acres       numeric(8,2) default 0,
  land_class      text,                   -- 'Tillable', 'Grass/GLS', 'CRP', 'Hay/Forage', 'Idle', 'NC'
  use_type        text,                   -- 'grain', 'forage'
  irrigated       boolean default false,
  organic         boolean default false,
  double_crop     boolean default false,
  cover_crop      boolean default false,
  grain_plant_date text,
  reported        boolean default false,
  -- Tillage history (2 active years + 1 CC species archive)
  tillage_2025    text,
  cc_2025         text,
  cc_2025_plant_date text,
  nt_adoption_2025 text,
  cc_adoption_2025 text,
  tillage_2024    text,
  cc_2024         text,
  cc_2024_plant_date text,
  nt_adoption_2024 text,
  cc_adoption_2024 text,
  cc_2023_species text,
  cc_2023_plant_date text,
  -- Insurance linkage (denormalized on CLU for quick lookup)
  policy_number   text,
  line_number     text,
  unit_number     text,
  aph             numeric(8,2) default 0,
  -- Metadata
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table clu_records enable row level security;

create policy "authenticated_read_clu"
  on clu_records for select
  using (auth.role() = 'authenticated');

create policy "operator_write_clu"
  on clu_records for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'agronomist', 'operator')
    )
  );
```

### `insurance_policies`

Migrated from `fsa-acres/data/data.json` `insurancePolicies[]`. Core insurance tracking table.

```sql
create table insurance_policies (
  id               text primary key,
  crop_year        int not null default 2026,
  policy_number    text,
  line_number      text,
  farm_number      text,
  farm_name        text,
  crop             text,
  coverage_level   numeric(5,2) default 75,
  unit_type        text,                    -- 'Basic', 'Optional', 'Enterprise'
  planted_acres    numeric(8,2) default 0,
  fsa_acres_manual numeric(8,2),           -- override computed FSA acres when needed
  guarantee        numeric(8,2) default 0, -- APH bu/acre
  actual           numeric(8,2) default 0, -- actual yield bu/acre (filled post-harvest)
  premium_per_acre numeric(8,2) default 0,
  agent_name       text,
  policy_year      int,
  -- Claim fields (lightweight — full claims live in claims table)
  claim_status     text default 'none',    -- 'none', 'potential', 'filed', 'paid', 'denied'
  claim_filed_date date,
  claim_paid_date  date,
  claim_paid_amount numeric(12,2),
  claim_number     text,
  adjuster_name    text,
  adjuster_phone   text,
  loss_type        text,
  prevented_planting boolean default false,
  prevented_planting_acres numeric(8,2),
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table insurance_policies enable row level security;
-- same pattern as clu_records
```

### `insurance_pricing`

Crop price reference for indemnity calculations. Migrated from `store.pricing[]`.

```sql
create table insurance_pricing (
  id              text primary key,
  crop            text not null,
  spring_price    numeric(8,4) default 0,
  fall_price      numeric(8,4) default 0,
  manual_override boolean default false,
  last_scraped    timestamptz,
  created_at      timestamptz default now()
);

alter table insurance_pricing enable row level security;
-- all authenticated users read; admin/agronomist write
```

### `claims`

Full claims lifecycle — richer than the `claim_status` field on `insurance_policies`. Each policy may have 0 or 1 active claims.

```sql
create table claims (
  id              uuid primary key default gen_random_uuid(),
  policy_id       text references insurance_policies(id),
  crop_year       int not null default 2026,
  farm_number     text,
  farm_name       text,
  crop            text,
  loss_type       text,           -- 'drought', 'flood', 'hail', 'prevented_planting', 'other'
  status          text default 'potential',
  -- status progression:
  --   potential → notice_filed → adjuster_assigned → appraisal → settlement → closed
  --   potential → denied (any point)
  claim_number    text,
  adjuster_name   text,
  adjuster_phone  text,
  adjuster_company text,
  loss_date       date,
  notice_deadline date,           -- FSA/RMA deadline for filing notice of loss
  appraisal_date  date,
  settlement_amount numeric(12,2),
  claim_amount_requested numeric(12,2),
  notes           text,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table claims enable row level security;

create policy "authenticated_read_claims"
  on claims for select
  using (auth.role() = 'authenticated');

create policy "operator_write_claims"
  on claims for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'agronomist', 'operator')
    )
  );
```

### `claim_documents`

Metadata for files stored in Supabase Storage bucket `claim-documents`.

```sql
create table claim_documents (
  id           uuid primary key default gen_random_uuid(),
  claim_id     uuid references claims(id) on delete cascade,
  filename     text not null,
  storage_path text not null,      -- path in Supabase Storage bucket
  file_size    int,
  mime_type    text,
  doc_type     text,               -- 'notice_of_loss', 'adjuster_report', 'settlement', 'fsa_578', 'photo', 'other'
  uploaded_by  uuid references profiles(id),
  uploaded_at  timestamptz default now()
);

alter table claim_documents enable row level security;
-- authenticated users read; operator+ write
```

### `claim_timeline`

Append-only audit trail for each claim. Inserted by route handlers, never deleted.

```sql
create table claim_timeline (
  id           uuid primary key default gen_random_uuid(),
  claim_id     uuid references claims(id) on delete cascade,
  event_type   text not null,      -- 'status_changed', 'document_uploaded', 'note_added', 'amount_updated', 'adjuster_assigned'
  description  text,
  old_value    text,
  new_value    text,
  created_by   uuid references profiles(id),
  created_at   timestamptz default now()
);

alter table claim_timeline enable row level security;
create policy "authenticated_read_timeline"
  on claim_timeline for select
  using (auth.role() = 'authenticated');
create policy "operator_insert_timeline"
  on claim_timeline for insert
  with check (auth.uid() = created_by);
-- no update or delete — append-only
```

### `gcs_enrollments`

GCS (Conservation) enrollment records. Migrated from `store.gcsEnrollments[]`.

```sql
create table gcs_enrollments (
  id           text primary key,
  farm_number  text,
  tract_number text,
  field_id     text,
  commodity    text,
  cc340_acres  numeric(8,2) default 0,   -- Cover Crop practice 340
  rt345_acres  numeric(8,2) default 0,   -- Reduced Till practice 345
  nt329_acres  numeric(8,2) default 0,   -- No-Till practice 329
  default_yield numeric(8,2),
  irrigation   text,
  tillage      text,
  crop_year    int default 2026,
  created_at   timestamptz default now()
);

alter table gcs_enrollments enable row level security;
-- same pattern as clu_records
```

---

## Data Flow

### FSA Planting Workflow (Primary Flow)

```
User opens /app/fsa-578
    ↓
Server Component fetches Supabase:
  - clu_records (crop_year = current)
  - rollup metrics for summary bar
    ↓
CluCardGrid ('use client') renders one card per CLU
User edits CLU (crop, plant date, tillage, practices)
    ↓
PUT /api/fsa/clu-records/[id]
  → createClient() + RLS check
  → update clu_records in Supabase
  → return updated record
    ↓
Card optimistically updates in UI; refetch on error
```

### Auto-Population from Farm Budget (Budget Sync Flow)

```
User clicks "Sync from Budget"
    ↓
POST /api/fsa/sync/budget
  → Route handler fetches http://localhost:3001/api/dashboard (60s cache)
  → Runs normName() fuzzy matching (same logic as fsa-acres server.js)
  → Returns proposals: { cluId, currentCrop, proposedCrop, matchScore }[]
    ↓
Side-by-side preview renders in portal (no writes yet)
User accepts/rejects individual proposals
    ↓
PUT /api/fsa/clu-records/bulk (accepted proposals only)
  → Batch update Supabase clu_records
```

### Insurance Policy Calculation (Client-Side, No Server Round-Trip)

```
User views /app/insurance
    ↓
Server Component fetches Supabase:
  - insurance_policies (all for crop_year)
  - insurance_pricing (all crops)
  - clu_records (for FSA acres auto-computation)
    ↓
computeInsurancePolicy() runs in browser via lib/insurance/calc.ts:
  effectiveGuarantee = guarantee * (coverageLevel/100)
  shortfall = max(0, effectiveGuarantee - actual)
  indemnity = shortfall * highestPrice * plantedAcres
  claimStatus = 'potential' if shortfall > 0 and no existing claim
    ↓
Coverage matrix renders as color-coded grid (heat map by coverage level)
Payout simulator updates live as sliders change (useState → recompute)
```

### Claims Kanban State Flow

```
User views /app/claims ('use client' page)
    ↓
useEffect: GET /api/claims
  → Returns claims with policy linkage
    ↓
Renders Kanban columns:
  potential | notice_filed | adjuster_assigned | appraisal | settlement | closed
User drags claim card to new column
    ↓
PATCH /api/claims/[id] { status: newStatus }
  → Supabase update on claims table
  → POST /api/claims/[id]/timeline { event_type: 'status_changed', old_value, new_value }
  → Optimistic UI update before response
```

### Document Upload Flow

```
User drops file onto claim detail page
    ↓
DocumentUpload component (browser client):
  supabase.storage.from('claim-documents').upload(path, file)
    ↓ (direct browser → Supabase Storage)
On success:
  POST /api/claims/[id]/documents
    { filename, storage_path, file_size, mime_type, doc_type }
    → Insert into claim_documents table
    → Insert into claim_timeline (event_type: 'document_uploaded')
    ↓
Document list refreshes; signed URL generated (60s TTL) for inline preview
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Endpoint | Notes |
|---------|---------------------|----------|-------|
| farm-registry :3005 | Next.js API route proxy with 60s TTL cache | `GET /api/fields` | Field names for CLU autocomplete; graceful empty array fallback |
| farm-budget :3001 | Next.js API route proxy with 60s TTL cache | `GET /api/dashboard`, `GET /api/fields` | Enterprise crop assignments for FSA sync preview |
| grain-tickets :3000 | Next.js API route proxy with 60s TTL cache | `GET /api/farms` | Yield data for insurance actual-yield bridge |
| USDA RMA Price Discovery | Direct HTTPS fetch from route handler | `public-rma.fpac.usda.gov/apps/PriceDiscovery` | Scrape spring/fall prices into `insurance_pricing` table |
| Supabase Storage | Direct browser SDK upload | `claim-documents` bucket | File upload bypasses Next.js for performance; metadata saved via route handler |

### Internal Boundaries (Portal Architecture — New vs Existing)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Middleware → new module routes | Existing middleware unchanged — checks `module_access` for `/app/{slug}` | No code change needed in middleware |
| Admin panel → new modules | Admin grants `fsa-578`, `insurance`, `claims` via existing module_access UI | No admin panel code change — module string is free-form |
| Dashboard page → new module cards | Add 3 entries to `lib/modules.ts` | Dashboard grid renders new cards automatically |
| FSA module ↔ Insurance module | `insurance_policies.farm_number + crop` joined to `clu_records` for FSA acres | Loose coupling — no FK between modules |
| Insurance module → Claims module | `claims.policy_id` FK to `insurance_policies.id` | Claims created from policy detail view or from 'potential' detection |
| Claims module → Supabase Storage | Browser SDK direct upload | Route handler registers metadata after upload completes |

---

## Build Order — Critical Dependency Chain

The three modules depend on each other in a linear chain. Follow this order strictly:

### Phase 1: FSA Data Foundation

1. Create Supabase tables: `clu_records`, `insurance_pricing`, `gcs_enrollments`
2. Write migration script: `fsa-acres/data/data.json` → Supabase `clu_records`
3. Add `fsa-578` to `MODULES` in `lib/modules.ts`
4. Build `/api/fsa/clu-records/` route handlers (CRUD + bulk)
5. Build `/api/fsa/rollup/` route handler (port rollupByFarm, rollupByCrop, summaryMetrics from calc.js into TypeScript)
6. Build `/api/fsa/registry/` proxy (farm-registry field names for autocomplete)
7. Port `fsa-acres/public/calc.js` → `lib/fsa/calc.ts` (TypeScript, no DOM)

**Why first:** `clu_records` is the anchor. Insurance policies reference it for FSA acres. Rollup logic is reused by dashboard summary cards.

### Phase 2: FSA Planting Workflow UI

1. `FsaDashboardMetrics` summary bar
2. `CluCard` + `CluCardGrid` (replaces "Coming Soon" in module shell)
3. `CluEditorDrawer` (slide-in with all FSA-578 fields — same shape as existing `openEditor()` in app.js)
4. `BulkActionBar` (select all, mark reported, bulk crop assign)
5. `YoyComparison` (year-over-year planting side-by-side)
6. FSA-578 PDF export via `/api/fsa/export/578/`
7. Budget sync: `/api/fsa/sync/budget/` route + preview UI

### Phase 3: Insurance Tables + Calculation Engine

1. Create Supabase table: `insurance_policies`
2. Write migration script: `fsa-acres/data/data.json` `insurancePolicies[]` → Supabase
3. Add `insurance` to `MODULES`
4. Port `Calc.computeInsurancePolicy()` → `lib/insurance/calc.ts`
5. Build `/api/insurance/policies/` route handlers
6. Build `/api/insurance/pricing/` route handlers + USDA RMA scrape
7. Build `/api/insurance/grain-yield/` proxy (grain-tickets yield bridge)

**Why third:** Insurance policies reference `clu_records` for FSA acres auto-computation. The calc engine must run against Supabase data, not Express data.

### Phase 4: Insurance UI

1. `PolicyCard` + policy list/grid
2. `PolicyEditorDrawer` (all policy fields + APH lookup + grain ticket yield bridge)
3. `CoverageMatrix` — heat map of coverage levels vs crops; color-code by indemnity likelihood
4. `PayoutSimulator` — interactive sliders for yield scenarios, live indemnity calc via `lib/insurance/calc.ts`
5. `PerformanceSummary` — aggregate: total premium paid, total indemnity received, net position
6. `ClaimStatusStepper` (none → potential → filed → paid)

### Phase 5: Claims Tables + API

1. Create Supabase tables: `claims`, `claim_documents`, `claim_timeline`
2. Create Supabase Storage bucket: `claim-documents` with RLS
3. Add `claims` to `MODULES`
4. Build `/api/claims/` route handlers (CRUD)
5. Build `/api/claims/[id]/documents/` handler
6. Build `/api/claims/[id]/timeline/` handler

**Why fifth:** `claims.policy_id` FK requires `insurance_policies` to exist first.

### Phase 6: Claims UI

1. `ClaimsKanban` — 6-column pipeline board (potential, notice_filed, adjuster_assigned, appraisal, settlement, closed)
2. `ClaimCard` — Kanban card with loss type, amount, deadline badge
3. `ClaimDetail` — full detail view (timeline, documents, financials)
4. `DocumentUpload` — drag-and-drop to Supabase Storage
5. `DeadlineAlertBanner` — urgent claims within 7 days of notice_deadline

### Phase 7: Cross-Module Integration + Dashboard Summary Cards

1. Dashboard summary cards (3 new cards: FSA progress, Insurance status, Claims pipeline)
2. FSA → Insurance link: click through from CLU card to related policy
3. Insurance → Claims link: create claim from policy detail view
4. Shared validation warnings across modules (uninsured crops, unreported CLUs)

---

## Anti-Patterns

### Anti-Pattern 1: Calling Express Apps from Browser Code

**What people do:** `fetch('http://localhost:3001/api/dashboard')` from a `'use client'` component.

**Why it's wrong:** Port 3001 is inaccessible from browsers in production (different host). CORS issues in development. No caching or timeout protection. Portal hard-crashes when Express apps are down.

**Do this instead:** All Express app calls go through Next.js API route handlers. The handler adds 60-second TTL cache, 5-second timeout (`AbortSignal.timeout(5000)`), and returns an empty array on failure.

### Anti-Pattern 2: Server-Only Calculation Engine for the Insurance Simulator

**What people do:** Move `computeInsurancePolicy()` to a server action, call it every time a user adjusts a slider.

**Why it's wrong:** The insurance simulator needs live, sub-100ms recalculation as the user adjusts coverage levels and yield inputs. A server round-trip on every slider change creates 200-500ms lag that destroys the UX.

**Do this instead:** Port `calc.ts` to run in the browser. The formula is pure arithmetic with no external dependencies. Fetch policy, pricing, and CLU acres data once on page load; run calculations entirely client-side with `useState`.

### Anti-Pattern 3: Storing Document Bytes in Supabase DB Columns

**What people do:** Store PDF bytes as `bytea` in `claim_documents.content`.

**Why it's wrong:** Balloons row size, slows queries on the claims table, no streaming for large files, no access-controlled URL pattern.

**Do this instead:** Store files in Supabase Storage bucket `claim-documents`. Store only `storage_path` in the database. Generate signed URLs on demand for viewing (60-second TTL, generated fresh on each page load).

### Anti-Pattern 4: One Giant `fsa-reporting` Module with All Three Features as Tabs

**What people do:** Build a single `/app/fsa-reporting` page with FSA, insurance, and claims as tabs.

**Why it's wrong:** Three distinct modules with different data models, user roles, and workflows. One page means one module_access gate — cannot independently grant/revoke access to insurance vs. claims vs. FSA entry.

**Do this instead:** Three separate module entries (`fsa-578`, `insurance`, `claims`) in `MODULES`. Middleware's `isModuleRoute()` already handles any slug. Each module is its own independently gated page.

### Anti-Pattern 5: Building Claims Before FSA and Insurance Foundation

**What people do:** Start with the visually engaging Kanban board first, using placeholder/mock data.

**Why it's wrong:** `claims.policy_id` is a FK to `insurance_policies`. `insurance_policies` references `clu_records` for FSA acres. Building claims first means retrofitting real FK relationships after the fact, rebuilding mock data structures.

**Do this instead:** Follow Phase 1 → 3 → 5 order for table creation before building the corresponding UIs. Each phase builds on real data, not mocks.

### Anti-Pattern 6: Writing Back to Express Apps

**What people do:** After editing a CLU record in the portal, also write it back to `fsa-acres/data/data.json` to keep them in sync.

**Why it's wrong:** Two sources of truth for CLU records. Conflicts become inevitable. The Express app has no auth — any write from the portal bypasses RLS. The portal becomes coupled to the Express filesystem format.

**Do this instead:** Supabase is the source of truth for all new data in the portal. The old fsa-acres Express app becomes read-only reference once the migration is done. Run a one-time migration script; never write back to data.json.

---

## Scaling Considerations

This is a single-farm application. Scale concerns are minimal.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (1 farm, <10 users) | Single Supabase project, all tables in `public` schema, no read replicas |
| Multi-farm (5-20 farms) | Add `farm_id` FK to all tables; RLS filters by farm; module_access scoped per-farm |
| Enterprise (100+ farms) | Separate Supabase projects per customer; subdomain routing |

**First bottleneck:** Express proxy calls (farm-budget + farm-registry). If Express apps are down, sync features are unavailable. Mitigated by cache + graceful fallback. Not a blocking issue for core FSA/insurance/claims functionality which runs entirely against Supabase.

**Second bottleneck:** None anticipated. Supabase free tier handles 500MB database storage and 1GB file storage — far above what this farm generates.

---

## Module Registration (Concrete Action)

Add to `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/lib/modules.ts`:

```typescript
export const MODULES: Module[] = [
  // ... existing 5 modules ...
  {
    id: 'fsa-578',
    label: 'FSA 578',
    sublabel: 'Planting & Practice Workflow',
    route: '/app/fsa-578',
  },
  {
    id: 'insurance',
    label: 'Crop Insurance',
    sublabel: 'Coverage & Claims Tracker',
    route: '/app/insurance',
  },
  {
    id: 'claims',
    label: 'Claims',
    sublabel: 'Claims Lifecycle Pipeline',
    route: '/app/claims',
  },
]
```

The existing middleware (`isModuleRoute()` checks `pathname.startsWith('/app/')`, `getModuleId()` splits on `/`) already handles these slugs without any code changes. The admin panel already handles granting access to any free-text module string.

---

## Sources

- Direct inspection: `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/server.js` — all Express endpoints, data model, cross-app proxy patterns, cachedFetch() implementation
- Direct inspection: `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/public/calc.js` — rollup, validation, computeInsurancePolicy() source for TypeScript port
- Direct inspection: `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/public/insurance.js` — insurance UI patterns, grain ticket bridge, status stepper, bulk sync
- Direct inspection: `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/data/data.json` — actual CLU record shape and insurance policy shape for migration planning
- Direct inspection: `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/middleware.ts` — auth + RBAC + module access middleware
- Direct inspection: `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/app/api/admin/users/route.ts` — API route pattern (server client, admin check, Supabase queries)
- Direct inspection: `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/lib/modules.ts` — existing MODULES registry structure
- Direct inspection: `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/app/(protected)/dashboard/page.tsx` — server component pattern with Supabase data fetch
- Direct inspection: `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/package.json` — installed dependencies (no PDF library currently installed)

---

*Architecture research for: FSA-578 workflow, crop insurance decision tool, claims tracker — glomalin-portal v6.0 integration*
*Researched: 2026-03-04*
