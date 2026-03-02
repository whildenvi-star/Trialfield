# Architecture Research

**Domain:** Cross-app data aggregation — organic-cert v3.0 compilation engine (Next.js App Router + multi-Express API fan-out)
**Researched:** 2026-03-01
**Confidence:** HIGH — Based on direct examination of all source files: organic-cert/src/ (~85K LOC), organic-cert/prisma/schema.prisma, farm-budget/server.js, grain-tickets/server.js, farm-registry/server.js, existing import-plan route, sync-registry route, fieldops-client.ts, and report-assembler.ts.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  organic-cert (Next.js 16 App Router, port 3004)          │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                       App Pages (React 19)                           │ │
│  │  /import-plan   /fields   /field-enterprises   /reports   /osp/c2   │ │
│  └─────────────────────────────┬────────────────────────────────────────┘ │
│                                 │ fetch() + SWR/React Query               │
│  ┌──────────────────────────────▼────────────────────────────────────────┐ │
│  │                    API Routes (app/api/)                              │ │
│  │                                                                        │ │
│  │  Existing:                        New (v3.0):                         │ │
│  │  /api/import-plan (budget sync)   /api/compile/[year]                │ │
│  │  /api/fields/sync-registry        /api/compile/[year]/preview        │ │
│  │  /api/admin/fieldops/sync         /api/compile/[year]/commit         │ │
│  │  /api/reports/generate            /api/rotation-snapshot/[year]      │ │
│  │  /api/field-enterprises/...       /api/rotation-snapshot/[year]/take │ │
│  └────────────────────┬──────────────────────┬───────────────────────────┘ │
│                        │                      │                              │
│  ┌─────────────────────▼──┐      ┌────────────▼──────────────────────────┐ │
│  │   Ecosystem Client     │      │   Aggregation Layer                   │ │
│  │   src/lib/ecosystem/   │      │   src/lib/compile/                    │ │
│  │                        │      │                                        │ │
│  │  budget-client.ts      │      │  compile-engine.ts (orchestrate)      │ │
│  │  registry-client.ts    │      │  field-mapper.ts  (field name match)  │ │
│  │  tickets-client.ts     │      │  input-mapper.ts  (product → material)│ │
│  │  eco-cache.ts          │      │  harvest-mapper.ts (ticket → harvest) │ │
│  └───────┬───────────────┘      │  nop-filter.ts    (organic-only gate) │ │
│           │                      │  snapshot-taker.ts (rotation archive) │ │
│           │                      └───────────────────────────────────────┘ │
│           │ fetch() HTTP                         │                           │
│           │                           ┌──────────▼──────────────────────┐  │
│           │                           │   Prisma 6 + PostgreSQL         │  │
│           │                           │   (organic-cert DB)              │  │
│           │                           │                                  │  │
│           │                           │  Field  FieldEnterprise          │  │
│           │                           │  MaterialUsage  HarvestEvent     │  │
│           │                           │  FieldHistory (rotation archive) │  │
│           │                           │  RotationSnapshot (new)          │  │
│           │                           └──────────────────────────────────┘  │
└───────────┼──────────────────────────────────────────────────────────────────┘
            │
            │  localhost HTTP (no auth, same machine)
            │
   ┌────────┴──────────────────────────────────────────────────────────┐
   │                 Upstream Source Apps                               │
   │                                                                    │
   │  farm-budget (port 3001)           farm-registry (port 3005)       │
   │  GET /api/enterprises              GET /api/fields?active=true     │
   │  GET /api/fields?all=true          (name, aliases, reportingAcres, │
   │  GET /api/products                  organicAcres, ownership)       │
   │  GET /api/seeds                                                    │
   │  GET /api/settings                 grain-tickets (port 3000)       │
   │  (category, systemCode, inputs,    GET /api/tickets?farm=X         │
   │   seed variety, machinery passes,  GET /api/stats                  │
   │   yieldPerAcre)                    GET /api/farms                  │
   └───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New vs Existing |
|-----------|---------------|-----------------|
| `src/lib/ecosystem/budget-client.ts` | HTTP client for farm-budget API — fetch enterprises, fields, products, seeds, settings with timeout + retry | NEW |
| `src/lib/ecosystem/registry-client.ts` | HTTP client for farm-registry API — fetch fields with aliases and acres | NEW (extract from existing sync-registry route) |
| `src/lib/ecosystem/tickets-client.ts` | HTTP client for grain-tickets API — fetch tickets by farm/crop/year | NEW |
| `src/lib/ecosystem/eco-cache.ts` | In-process TTL cache (5-minute) for upstream API responses — prevents hammering local servers on repeated previews | NEW |
| `src/lib/compile/compile-engine.ts` | Orchestrates the full compilation: calls ecosystem clients, runs mappers, returns `CompiledData` type | NEW |
| `src/lib/compile/field-mapper.ts` | Matches budget field names to organic-cert fields via registry aliases; handles new-field detection | NEW |
| `src/lib/compile/input-mapper.ts` | Maps farm-budget product names to organic-cert Material records; creates Materials for unknown products | NEW |
| `src/lib/compile/harvest-mapper.ts` | Correlates grain-ticket records (farm name + crop + date range) to FieldEnterprise; deduplicates against existing HarvestEvents | NEW |
| `src/lib/compile/nop-filter.ts` | Filters enterprise list to organic-only using `category === 'organic'` or systemCode containing 'ORG' | NEW (extract from import-plan route) |
| `src/lib/compile/snapshot-taker.ts` | Takes a point-in-time FieldHistory snapshot from current season's FieldEnterprise records — called at year-end | NEW |
| `app/api/compile/[year]/route.ts` | GET: returns preview of what would be compiled. POST: executes compilation and writes to DB | NEW |
| `app/api/compile/[year]/preview/route.ts` | Fast preview endpoint — returns diff without writing | NEW |
| `app/api/rotation-snapshot/[year]/route.ts` | GET: current snapshot status. POST /take: execute snapshot for a given year | NEW |
| `app/api/import-plan/route.ts` | Existing import-plan route — v3.0 replaces its manual-import model; this route is RETIRED in favor of compile API | MODIFIED → RETIRED |
| `app/(app)/import-plan/page.tsx` | Existing "Import Plan" UI — replaced by new Compile page | MODIFIED → REPLACED |
| `src/lib/report-assembler.ts` | Existing assembler — reads from organic-cert DB only. Unchanged in v3.0 — PDF still reads from local DB; compilation writes data there first | UNCHANGED |
| `prisma/schema.prisma` | Existing schema — add `RotationSnapshot` model, add `externalSourceId` columns to tie records back to their upstream source | MODIFIED (additive only) |

---

## Recommended Project Structure

```
organic-cert/src/
├── lib/
│   ├── ecosystem/              # NEW — upstream API clients
│   │   ├── budget-client.ts    # farm-budget HTTP client
│   │   ├── registry-client.ts  # farm-registry HTTP client
│   │   ├── tickets-client.ts   # grain-tickets HTTP client
│   │   ├── eco-cache.ts        # in-process TTL cache
│   │   └── types.ts            # shared BudgetField, RegistryField, GrainTicket types
│   │
│   ├── compile/                # NEW — aggregation logic
│   │   ├── compile-engine.ts   # top-level orchestrator, returns CompiledData
│   │   ├── field-mapper.ts     # budget field name → organic-cert Field
│   │   ├── input-mapper.ts     # budget product → organic-cert Material + MaterialUsage
│   │   ├── harvest-mapper.ts   # grain ticket → HarvestEvent (with dedup)
│   │   ├── nop-filter.ts       # enterprise organic-status gate
│   │   ├── snapshot-taker.ts   # FieldEnterprise → FieldHistory point-in-time copy
│   │   └── types.ts            # CompiledData, CompilePreview, CompileDiff types
│   │
│   ├── report-assembler.ts     # UNCHANGED — reads from local DB only
│   ├── fieldops-client.ts      # UNCHANGED — Case IH API
│   ├── fieldops-sync.ts        # UNCHANGED
│   ├── audit-logger.ts         # UNCHANGED
│   ├── prisma.ts               # UNCHANGED
│   └── ...                     # other existing lib files unchanged
│
├── app/
│   ├── api/
│   │   ├── compile/
│   │   │   └── [year]/
│   │   │       ├── route.ts        # GET preview, POST compile
│   │   │       └── preview/
│   │   │           └── route.ts    # fast diff-only preview
│   │   ├── rotation-snapshot/
│   │   │   └── [year]/
│   │   │       ├── route.ts        # GET status
│   │   │       └── take/
│   │   │           └── route.ts    # POST execute snapshot
│   │   ├── import-plan/            # RETIRING — replaced by compile
│   │   │   └── route.ts            # keep until compile is stable, then delete
│   │   └── ...                     # all other existing routes unchanged
│   │
│   └── (app)/
│       ├── compile/                # NEW page — replaces import-plan
│       │   └── page.tsx
│       ├── import-plan/            # RETIRING
│       │   └── page.tsx
│       └── ...                     # other pages unchanged
│
└── prisma/
    └── schema.prisma               # MODIFIED — add RotationSnapshot, externalSourceId columns
```

### Structure Rationale

- **`lib/ecosystem/` separate from `lib/compile/`:** The ecosystem clients are concerned with fetching (network, error handling, caching). The compile layer is concerned with mapping and writing. Separation means ecosystem clients can be tested or used independently.
- **`compile-engine.ts` as single entry point:** All API routes call one function — `compileForYear(farmId, cropYear)` — and receive a `CompiledData` type. The compile routes are thin wrappers. Business logic stays out of API routes.
- **No new standalone service:** The aggregation layer lives in organic-cert's `src/lib/`. There is no case for a separate service process — this is an internal compile operation on a single-farm, single-user system. A service adds deployment complexity for zero benefit.
- **Server Actions considered and rejected:** Next.js Server Actions are appropriate for form-adjacent mutations. The compile operation is complex (multi-source fetch, diff computation, batch write) and needs proper loading states, error reporting, and preview flow. An API route is the right boundary.

---

## Architectural Patterns

### Pattern 1: Ecosystem Client with Structured Error Handling

**What:** Each upstream app gets a typed client module that wraps `fetch()` with timeout, retry-once on network error, and structured error type so callers know whether a service is down vs. returned bad data.

**When to use:** Any call to an upstream localhost Express app from organic-cert's API routes.

**Trade-offs:** Adds ~50 lines per client but makes error messages actionable ("farm-budget is not running" vs. generic 500).

**Example:**
```typescript
// src/lib/ecosystem/budget-client.ts

const BUDGET_URL = process.env.BUDGET_API_URL ?? "http://localhost:3001/api";
const TIMEOUT_MS = 8000;

export class EcosystemError extends Error {
  constructor(
    public service: "budget" | "registry" | "tickets",
    public status: number | "timeout" | "network",
    message: string
  ) {
    super(message);
  }
}

async function ecoFetch(url: string, service: EcosystemError["service"]): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new EcosystemError(service, res.status, `${service} returned ${res.status} on ${url}`);
    return res;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new EcosystemError(service, "timeout", `${service} timed out after ${TIMEOUT_MS}ms`);
    if (err instanceof EcosystemError) throw err;
    throw new EcosystemError(service, "network", `Cannot reach ${service}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function getBudgetFields(): Promise<BudgetField[]> {
  const res = await ecoFetch(`${BUDGET_URL}/fields?all=true`, "budget");
  return res.json();
}

export async function getBudgetEnterprises(): Promise<BudgetEnterprise[]> {
  const res = await ecoFetch(`${BUDGET_URL}/enterprises`, "budget");
  return res.json();
}

export async function getBudgetProducts(): Promise<BudgetProduct[]> {
  const res = await ecoFetch(`${BUDGET_URL}/products`, "budget");
  return res.json();
}

export async function getBudgetSettings(): Promise<BudgetSettings> {
  const res = await ecoFetch(`${BUDGET_URL}/settings`, "budget");
  return res.json();
}
```

---

### Pattern 2: In-Process TTL Cache for Upstream API Responses

**What:** A simple Map-based cache with timestamp eviction. Shared across all API route invocations in the same Node.js process. TTL of 5 minutes (300 seconds).

**When to use:** Whenever organic-cert's UI triggers multiple API calls that all need the same upstream data (e.g., preview loads enterprises + fields + products in parallel, then commit reloads the same set).

**Trade-offs:** In-process only — does not survive Next.js cold starts or restarts. Correct for this use case (data freshness of 5 minutes is fine for manual compile operations). Not appropriate for production multi-instance deployments (single machine).

**Example:**
```typescript
// src/lib/ecosystem/eco-cache.ts

const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setInCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

export function bustedCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// Usage in budget-client.ts:
export async function getBudgetFields(): Promise<BudgetField[]> {
  const cached = getFromCache<BudgetField[]>("budget:fields");
  if (cached) return cached;
  const res = await ecoFetch(`${BUDGET_URL}/fields?all=true`, "budget");
  const data = await res.json();
  setInCache("budget:fields", data);
  return data;
}
```

---

### Pattern 3: Compile Engine — Preview/Commit Split

**What:** The compile operation always runs in two phases. Phase 1 (preview) runs all mappers and returns a `CompileDiff` — what would be created, updated, or skipped — without touching the database. Phase 2 (commit) re-runs the same logic and writes to the database. The UI always shows a preview before allowing commit.

**When to use:** Any operation that modifies data from an external source. Gives the user visibility before writes happen.

**Trade-offs:** Runs the mapping logic twice (preview + commit). Acceptable — the mapping is CPU-bound and fast (no second network round-trip because the cache serves the second run). The preview/commit consistency guarantee is worth the extra pass.

**Example:**
```typescript
// src/lib/compile/compile-engine.ts

export interface CompileDiff {
  cropYear: number;
  enterprisesToCreate: PreviewEnterprise[];
  enterprisesToUpdate: PreviewEnterprise[];
  materialUsagesToCreate: number;
  harvestEventsToCreate: number;
  unmatchedBudgetFields: string[];  // budget fields not found in organic-cert
  unmatchedTickets: string[];       // grain tickets not matchable to any enterprise
  errors: string[];                 // non-fatal mapping errors
}

export async function previewCompile(farmId: string, cropYear: number): Promise<CompileDiff> {
  const [enterprises, fields, products, settings, regFields, tickets] = await Promise.all([
    getBudgetEnterprises(),
    getBudgetFields(),
    getBudgetProducts(),
    getBudgetSettings(),
    getRegistryFields(),
    getTicketsByYear(cropYear),
  ]);
  // Run mappers without writing — return diff only
  return runMappers({ farmId, cropYear, enterprises, fields, products, settings, regFields, tickets, dryRun: true });
}

export async function commitCompile(farmId: string, cropYear: number): Promise<CompileResult> {
  const [enterprises, fields, products, settings, regFields, tickets] = await Promise.all([
    getBudgetEnterprises(),
    getBudgetFields(),
    getBudgetProducts(),
    getBudgetSettings(),
    getRegistryFields(),
    getTicketsByYear(cropYear),
  ]);
  // Run mappers WITH writes — return result counts
  return runMappers({ farmId, cropYear, enterprises, fields, products, settings, regFields, tickets, dryRun: false });
}
```

---

### Pattern 4: Rotation Snapshot — FieldHistory as Annual Archive

**What:** `FieldHistory` in organic-cert's schema is the 3-year rotation record needed for NOP compliance. Farm-budget is single-season (rebuilt every year). Therefore, organic-cert must preserve each season's data before the next compile overwrites it. A "snapshot" operation reads the current season's `FieldEnterprise` records and writes them as `FieldHistory` rows for that year.

**When to use:** Once per year — called explicitly by the user at season end before starting a new year's compile. Never called automatically.

**Trade-offs:** Manual trigger means it can be forgotten. Mitigation: the compile preview warns if no snapshot exists for the prior year. The snapshot operation itself is idempotent (upsert on `[fieldId, year]` unique constraint — already in schema).

**Example:**
```typescript
// src/lib/compile/snapshot-taker.ts

export async function takeRotationSnapshot(farmId: string, cropYear: number): Promise<SnapshotResult> {
  const enterprises = await prisma.fieldEnterprise.findMany({
    where: { field: { farmId }, cropYear },
    include: {
      field: true,
      harvestEvents: { orderBy: { harvestDate: "asc" }, take: 1 },
    },
  });

  const results = { created: 0, updated: 0, skipped: 0 };

  for (const ent of enterprises) {
    const harvest = ent.harvestEvents[0];
    await prisma.fieldHistory.upsert({
      where: { fieldId_year: { fieldId: ent.fieldId, year: cropYear } },
      create: {
        fieldId: ent.fieldId,
        year: cropYear,
        crop: ent.crop,
        organicStatus: ent.organicStatus,
        yieldPerAcre: harvest?.yieldPerAcre ?? null,
        yieldUnit: harvest?.yieldUnit ?? null,
        notes: `Snapshot from ${cropYear} compilation`,
      },
      update: {
        crop: ent.crop,
        organicStatus: ent.organicStatus,
        yieldPerAcre: harvest?.yieldPerAcre ?? null,
        yieldUnit: harvest?.yieldUnit ?? null,
      },
    });
    results.created++;
  }

  return results;
}
```

---

## Data Flow

### Compilation Flow (v3.0 Core Flow)

```
[User clicks "Preview Compile" in /compile/[year]]
      ↓ GET /api/compile/[year]/preview
[compile-engine.ts: previewCompile()]
      ↓ Promise.all — parallel fan-out
┌─────────────────────────────────────────────────────────────┐
│  budget-client.ts             registry-client.ts             │
│  GET /api/enterprises         GET /api/fields?active=true    │
│  GET /api/fields?all=true                                    │
│  GET /api/products            tickets-client.ts              │
│  GET /api/seeds               GET /api/tickets?crop=X&year=Y │
│  GET /api/settings                                           │
└─────────────────────────────────────────────────────────────┘
      ↓ all responses cached for 5 minutes (eco-cache.ts)
[nop-filter.ts: filter to organic enterprises only]
      ↓
[field-mapper.ts: match budget field names → organic-cert Fields via registry aliases]
      ↓
[input-mapper.ts: map budget product names → organic-cert Materials (dry run)]
      ↓
[harvest-mapper.ts: correlate grain tickets → FieldEnterprises (dry run)]
      ↓
[return CompileDiff to UI — no DB writes]

[User reviews diff, clicks "Commit Compile"]
      ↓ POST /api/compile/[year]
[compile-engine.ts: commitCompile()]
      ↓ same fan-out (cache hit — no new HTTP calls)
      ↓ with dryRun: false
[field-mapper: upsert Field records in organic-cert DB]
      ↓
[nop-filter: create FieldEnterprise records for organic fields]
      ↓
[input-mapper: upsert Material records, create MaterialUsage records]
      ↓
[harvest-mapper: create HarvestEvent records (skip if dataSource=SYNCED already present)]
      ↓
[logAudit for all creates/updates — existing audit-logger.ts]
      ↓
[return CompileResult: counts of created/updated/skipped]
```

### Rotation Snapshot Flow

```
[User clicks "Take Snapshot" for prior year at season end]
      ↓ POST /api/rotation-snapshot/[year]/take
[snapshot-taker.ts: takeRotationSnapshot(farmId, year)]
      ↓ prisma.fieldEnterprise.findMany({ where: { cropYear: year } })
      ↓ for each enterprise:
      ↓ prisma.fieldHistory.upsert({ where: { fieldId_year: { fieldId, year } } })
[FieldHistory row created/updated for each field]
      ↓
[Report assembler's 3-year history query (years: [current, current-1, current-2])
 now finds this FieldHistory row for the archived year]
```

### Existing Registry Sync Flow (Unchanged)

```
[User clicks "Sync Acres" on Fields page]
      ↓ POST /api/fields/sync-registry (existing route)
[fetch farm-registry GET /api/fields?active=true]
      ↓
[upsert Field.totalAcres, Field.organicAcres, Field.ownership, Field.registryId]
      ↓
[update Farm totals (ownedAcres, organicAcres, etc.)]
```

### PDF Report Flow (Unchanged — reads from local DB)

```
[User requests report at /api/reports/generate]
      ↓
[report-assembler.ts: assembleReportData(farmId, cropYear)]
      ↓ prisma queries — 100% local DB
[inspection-report.tsx → @react-pdf/renderer]
      ↓
[PDF served as binary response]
```

---

## Schema Changes Required

The following changes to `prisma/schema.prisma` are needed for v3.0. All are additive — no breaking changes to existing models.

### New Model: RotationSnapshot

Track when rotation snapshots were taken so the compile preview can warn if a snapshot is missing.

```prisma
model RotationSnapshot {
  id        String   @id @default(cuid())
  farmId    String
  cropYear  Int
  takenAt   DateTime @default(now())
  fieldCount Int     @default(0)
  notes     String?
  createdAt DateTime @default(now())

  @@unique([farmId, cropYear])
}
```

### Additive Columns on Existing Models

Add `externalSourceId` columns to tie compiled records back to their upstream source. These enable idempotent re-compilation (skip records already compiled from this source ID).

```prisma
// FieldEnterprise — add:
budgetFieldId  String?   // farm-budget field.id — used to detect re-imports
compiledAt     DateTime? // when this enterprise was last compiled from ecosystem

// MaterialUsage — add:
budgetInputId  String?   // farm-budget input.id on the field — dedup key for re-compile

// HarvestEvent — existing dataSource=SYNCED already present
// Add:
ticketId       String?   // grain-tickets ticket.id — ties back for dedup
```

---

## Integration Points

### New: organic-cert → farm-budget

| Endpoint | Used for | Notes |
|----------|----------|-------|
| `GET /api/enterprises` | Filter to organic enterprises only | Response: `[{ id, name, category, systemCodes }]`. Filter: `category === 'organic'` |
| `GET /api/fields?all=true` | Get all fields with crop/inputs/machinery assignments | Response includes: `enterpriseId`, `name`, `crop`, `acres`, `inputs[]`, `seed`, `machinery[]`, `yieldPerAcre` |
| `GET /api/products` | Map input product names to organic-cert Materials | Response: `[{ id, name, category }]`. Match on name to existing Materials. Create if new. |
| `GET /api/seeds` | Map seed variety data | Response: `[{ id, variety, brand, crop }]`. Used to enrich SeedUsage records. |
| `GET /api/settings` | Get `year` for the active crop year | Determines which cropYear to compile against. |

**Existing integration:** The import-plan route already calls `/api/enterprises`, `/api/fields?all=true`, and `/api/settings` using bare `fetch()`. The v3.0 compile engine extracts this pattern into a typed client with caching and structured errors.

### New: organic-cert → grain-tickets

| Endpoint | Used for | Notes |
|----------|----------|-------|
| `GET /api/tickets` | Fetch harvest loads by crop/year for HarvestEvent creation | Filter by `?farm=X` or `?crop=X`. Returns: `[{ id, date, farm, netWeight, moisture, crop, ticketNo, hbtBinNo }]` |
| `GET /api/stats` | Total loads, total weight by crop — for verification after compile | Optional — used for compile summary stats |

**Key constraint:** grain-tickets has no year-based filter on `GET /api/tickets` in its current implementation (as of v2.0). The tickets-client.ts will need to filter client-side by date range until grain-tickets adds a `?year=` filter param in v2.0 Phase 11+.

### Existing: organic-cert → farm-registry

Already implemented in `POST /api/fields/sync-registry`. The v3.0 compile engine reuses the same registry API for field name matching (field-mapper.ts calls the same `GET /api/fields?active=true` endpoint). No new registry API calls needed.

### Existing: organic-cert → Case IH FieldOps

Unchanged. The fieldops sync (operations, yield) continues to run independently via the existing `POST /api/admin/sync` route. The compile engine does not call Case IH — it only aggregates from farm-budget, farm-registry, and grain-tickets.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| compile API routes ↔ compile-engine | Direct TypeScript import | No HTTP. Both in organic-cert. |
| compile-engine ↔ ecosystem clients | Direct TypeScript import + eco-cache | Ecosystem clients are pure functions (fetch + return). No side effects. |
| compile-engine ↔ Prisma | Direct `prisma.X.upsert/create` calls | Engine holds transaction when committing (prisma.$transaction for batch writes) |
| report-assembler ↔ Prisma | Existing — unchanged | assembleReportData() still reads directly from DB. No changes needed. |

---

## Data Mapping: Budget → Organic-Cert

### Field Mapping (field-mapper.ts)

```
farm-budget field.name
    ↓ lowercase
    match against: organic-cert Field.name (lowercase)
    if no match: match against farm-registry field aliases
    if still no match: add to CompileDiff.unmatchedBudgetFields
    if match: use existing organic-cert Field.id
    if not found but registryId exists: create new Field in organic-cert
```

**Key:** Farm-budget field names and farm-registry field names should already agree (farm-budget syncs acres from registry). The registry aliases handle edge cases like "Kopp" vs "Kopps".

### Enterprise Mapping

```
farm-budget:                              organic-cert:
  field.name              →   FieldEnterprise.field (matched by field-mapper)
  field.crop              →   FieldEnterprise.crop
  enterprise.name/year    →   FieldEnterprise.cropYear (from settings.year)
  field.acres             →   FieldEnterprise.plantedAcres
  field.seed.variety      →   FieldEnterprise.variety
  field.id (budgetFieldId)→   FieldEnterprise.budgetFieldId (new column — dedup key)
  "ORGANIC"               →   FieldEnterprise.organicStatus (all compiled enterprises are organic)
```

**Unique constraint check:** `@@unique([fieldId, cropYear, crop, label])` on FieldEnterprise. Compile uses upsert on this constraint — idempotent re-runs don't create duplicates.

### Input/Material Mapping (input-mapper.ts)

```
farm-budget:                              organic-cert:
  product.name            →   Material.name (lookup by name, farmId)
  product.name (new)      →   Material.create({ nopStatus: APPROVED, category: OTHER })
  field.inputs[]:
    input.productName     →   MaterialUsage.material (FK to matched Material)
    input.rate            →   MaterialUsage.rate
    input.unit            →   MaterialUsage.rateUnit
    field.acres           →   MaterialUsage.acres
    (no date in budget)   →   MaterialUsage.applicationDate: Jan 1 of cropYear (placeholder)
    field.id (budgetInputId)→  MaterialUsage.budgetInputId (new column — dedup key)
```

**Note on application dates:** Farm-budget tracks input plans (product + rate), not application events with dates. The compile creates MaterialUsage records with a placeholder date of January 1 of the crop year. The actual date is filled in when the FieldOps sync runs (which brings real application dates from Case IH). This is a known data gap — document it clearly in the compile UI.

### Harvest Mapping (harvest-mapper.ts)

```
grain-tickets:                            organic-cert:
  ticket.farm (string)    →   FieldEnterprise.field.name (matched by field-mapper)
  ticket.crop             →   FieldEnterprise.crop (normalized crop name match)
  ticket.date             →   HarvestEvent.harvestDate
  ticket.netWeight        →   HarvestEvent.grossWeight + netWeight
  ticket.moisture         →   HarvestEvent.moisturePercent
  ticket.id               →   HarvestEvent.ticketId (new column — dedup key)
  "SYNCED"                →   HarvestEvent.dataSource
  computed: netWeight/plantedAcres → HarvestEvent.yieldPerAcre
```

**Dedup logic:** `HarvestEvent.ticketId IS NOT NULL AND ticketId = ticket.id` → skip. This ensures re-running compile does not create duplicate harvest events.

**Crop name normalization required:** Farm-budget crops: "Corn", "SRWW", "Org Peas". Grain-tickets crops: "Non-GMO Yellow Corn", "Organic SRWW", "Organic Peas". The harvest-mapper.ts needs a normalization table (a small Map or lookup) to match these. Document gaps explicitly in CompileDiff.unmatchedTickets.

---

## Build Order: What to Wire First

Phase ordering based on hard dependencies — each phase must be stable before the next starts.

```
Phase A: Ecosystem Client Layer (no UI, no DB writes)
  ├── src/lib/ecosystem/budget-client.ts (typed fetch wrappers)
  ├── src/lib/ecosystem/registry-client.ts (extract from sync-registry route)
  ├── src/lib/ecosystem/tickets-client.ts (new — grain-tickets API)
  ├── src/lib/ecosystem/eco-cache.ts (5-min TTL cache)
  └── src/lib/ecosystem/types.ts (BudgetField, RegistryField, GrainTicket)
  UNBLOCKS: Everything else
  TEST: Unit tests with mock servers (or direct manual fetch to running apps)

Phase B: NOP Filter + Field Mapper (read-only, no DB writes)
  ├── src/lib/compile/nop-filter.ts (extract organic enterprise filter from import-plan)
  ├── src/lib/compile/field-mapper.ts (budget field → organic-cert Field via registry aliases)
  ├── src/lib/compile/types.ts (CompileDiff, CompileResult, PreviewEnterprise)
  └── GET /api/compile/[year]/preview (calls ecosystem clients, returns diff, no writes)
  DEPENDENCY: Phase A
  UNBLOCKS: Phase C, D, E
  TEST: Can preview compile with real running apps and see unmatched fields

Phase C: Schema Migration + Enterprise Compile
  ├── Add RotationSnapshot model to schema.prisma
  ├── Add budgetFieldId + compiledAt to FieldEnterprise
  ├── Run prisma migrate dev
  ├── src/lib/compile/compile-engine.ts (orchestrator — enterprises only first)
  └── POST /api/compile/[year] (commit — writes FieldEnterprise records)
  DEPENDENCY: Phase B
  UNBLOCKS: Phase D, E
  TEST: Compile creates correct FieldEnterprise records for organic fields

Phase D: Input Mapper (depends on enterprises existing in DB)
  ├── Add budgetInputId to MaterialUsage in schema.prisma
  ├── src/lib/compile/input-mapper.ts (product → Material + MaterialUsage)
  └── Update compile-engine.ts to call input-mapper after enterprises
  DEPENDENCY: Phase C (FieldEnterprise records must exist as FKs for MaterialUsage)
  TEST: Inputs create Materials + MaterialUsages with correct rates

Phase E: Harvest Mapper (depends on enterprises + tickets DB existing)
  ├── Add ticketId to HarvestEvent in schema.prisma
  ├── src/lib/compile/harvest-mapper.ts (grain ticket → HarvestEvent)
  ├── src/lib/ecosystem/tickets-client.ts (may need crop-name normalization table)
  └── Update compile-engine.ts to call harvest-mapper after enterprises
  DEPENDENCY: Phase C (FieldEnterprise must exist); grain-tickets Phase 10 complete (tickets in PostgreSQL)
  TEST: Grain tickets create HarvestEvent records with correct yieldPerAcre

Phase F: Rotation Snapshot + UI
  ├── src/lib/compile/snapshot-taker.ts
  ├── POST /api/rotation-snapshot/[year]/take
  ├── GET /api/rotation-snapshot/[year] (snapshot status)
  └── app/(app)/compile/page.tsx (replaces import-plan page with compile + snapshot UI)
  DEPENDENCY: Phases A-E stable
  TEST: Snapshot creates correct FieldHistory rows; PDF report shows 3-year rotation
```

**Why this order:**

1. Ecosystem clients first — everything depends on reliable data fetching. No UI rework if client shapes change.
2. Preview before commit — build the read-only path first. Safer, and the UI can show a working preview before writes are implemented.
3. Enterprise compile before input compile — MaterialUsage has a FK to FieldEnterprise. Enterprises must exist before inputs can be attached.
4. Harvest mapper last among data phases — depends on grain-tickets Phase 10 being complete (tickets in PostgreSQL with stable API). If v2.0 is still in progress, harvest compile can be stubbed/skipped until that milestone lands.
5. Rotation snapshot with UI — not a dependency blocker for compilation itself, but needed for the 3-year NOP history to remain correct across years. Build alongside the UI phase since they ship together.

---

## Anti-Patterns

### Anti-Pattern 1: Writing Directly to Farm-Budget or Grain-Tickets from Organic-Cert

**What people do:** Organic-cert "fixes" data in upstream apps during compilation (e.g., normalizing crop names in farm-budget's data.json).

**Why it's wrong:** The "leech pattern" decision is explicit in PROJECT.md: "organic-cert reads from ecosystem APIs, never writes back." Writing back creates circular dependencies and makes farm-budget data owned by two apps. Upstream apps are not aware they have a consumer modifying their data.

**Do this instead:** Normalize incoming data in organic-cert's mappers (input-mapper, harvest-mapper). Accept fuzzy matching (case-insensitive, alias lookup). Log unmatched records in CompileDiff.unmatchedBudgetFields and surface them to the user. Never push changes back upstream.

---

### Anti-Pattern 2: Calling Upstream APIs Directly from Report Generation

**What people do:** When the user clicks "Generate PDF", the report route calls farm-budget/farm-registry/grain-tickets in real time to assemble the PDF.

**Why it's wrong:** PDF generation is already a slow, memory-intensive operation. Adding synchronous upstream HTTP calls means PDF generation fails or times out if any upstream app is not running. The PDF becomes non-deterministic — it changes if someone edits farm-budget while the PDF is rendering.

**Do this instead:** The compile step writes all upstream data into organic-cert's local PostgreSQL database. PDF generation reads only from the local database (the existing `assembleReportData()` function). The compile operation is the explicit "pull from ecosystem" trigger; the PDF is a read-only render of whatever is in the local DB.

---

### Anti-Pattern 3: Replacing Case IH Sync with Compile Sync

**What people do:** "Since we're now pulling from farm-budget, let's stop running the Case IH fieldops sync."

**Why it's wrong:** Farm-budget stores planned machinery passes, not confirmed field operations with actual dates. Case IH FieldOps provides actual application dates, equipment used, and precise acres worked from telematics. These are different data sources with different roles. The fieldops sync (FieldOperation records with `dataSource=SYNCED`) complements the compile (FieldEnterprise records with `dataSource=MANUAL` from planning data).

**Do this instead:** Keep both syncs running independently. The compile populates enterprise plans and inputs; the fieldops sync fills in confirmed operation dates and equipment. In the organic-cert DB, both are represented: `FieldOperation.dataSource` distinguishes MANUAL from SYNCED. The PDF report assembler already handles both.

---

### Anti-Pattern 4: Single-Call Compile with No Preview

**What people do:** A single "Compile Now" button that immediately runs the full compile and writes all data.

**Why it's wrong:** If field names don't match, if crop names are different between apps, or if the user compiled the wrong year, the writes are already done. Silent creation of wrong FieldEnterprise records pollutes the audit trail and requires manual cleanup.

**Do this instead:** Always preview first. The `GET /api/compile/[year]/preview` endpoint returns `CompileDiff` showing exactly what will be created/updated/skipped and what didn't match. The user reviews the diff and clicks "Commit Compile" only if it looks right. The preview is fast (cached upstream responses, no DB writes).

---

### Anti-Pattern 5: Blocking the Compile on Grain-Tickets Data Availability

**What people do:** The compile fails entirely if the grain-tickets app is down or returns no data.

**Why it's wrong:** Harvest records are a subset of what the compile produces. If grain-tickets is offline or has no data for a given crop/year, the compile should still create FieldEnterprise records and MaterialUsage records — it just won't have HarvestEvents. The user can run the compile again later when grain-tickets data is available.

**Do this instead:** Each ecosystem client returns a `{ data, error }` result. The compile engine proceeds with available data and records missing sources in `CompileDiff.errors`. A successful compile with partial data is better than a blocked compile. Only `farm-budget` is required; `farm-registry` and `grain-tickets` are supplemental.

---

## Existing Tech Debt to Fix Before v3.0

These are known issues from the v1.1 audit (documented in PROJECT.md) that interact with v3.0 work:

| Issue | Risk | Fix |
|-------|------|-----|
| `data.unmatched` crash in sync-registry route | Compile will call registry sync; crash would break compile flow | Fix before Phase B: `results.unmatched` is the correct property name in the route handler |
| Partial unique index not in schema.prisma | Environment rebuild creates schema divergence | Capture in schema.prisma before running Phase C migration |
| `take:3` enterprise query limit in existing routes | May undercount at 4+ enterprises per field | Fix any enterprise queries that use `take:3` before Phase C introduces new enterprises |
| API routes lacking `auth()` calls | Non-critical (internal tool) | Remains deferred per original design; note that compile routes should also be unguarded |

---

## Sources

- `organic-cert/src/app/api/import-plan/route.ts` — direct examination of existing budget API integration pattern (bare fetch, enterprise filter, field create/upsert logic)
- `organic-cert/src/app/api/fields/sync-registry/route.ts` — direct examination of existing registry client pattern (inline fetch, alias matching, transaction batch)
- `organic-cert/src/lib/fieldops-client.ts` — reference pattern for structured ecosystem client with token cache, retry, mock mode
- `organic-cert/src/lib/report-assembler.ts` — confirmed PDF assembly reads only from local DB; no upstream calls
- `organic-cert/prisma/schema.prisma` — complete schema: FieldEnterprise unique constraints, FieldHistory unique `[fieldId, year]`, DataSource enum (MANUAL/SYNCED already present)
- `farm-budget/server.js` — direct examination of all API endpoints and response shapes (enterprises, fields, products, seeds, settings)
- `grain-tickets/server.js` — confirmed `GET /api/tickets` exists; no `?year=` filter yet
- `farm-registry/server.js` — confirmed `GET /api/fields` with `?active=true` filter
- `organic-cert/.planning/PROJECT.md` — v3.0 target features, key decisions (leech pattern, yearly rotation snapshots, no writes back to upstream apps)

---

*Architecture research for: organic-cert v3.0 compilation engine — cross-app aggregation layer on Next.js App Router*
*Researched: 2026-03-01*
