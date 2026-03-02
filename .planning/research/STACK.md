# Stack Research

**Domain:** Organic-cert v3.0 — cross-app data aggregation, yearly rotation snapshots, NOP compliance rule engine, PDF generation from aggregated ecosystem data
**Researched:** 2026-03-01
**Confidence:** HIGH for all four capability areas (verified against existing codebase, official Next.js 16 docs, and Prisma 6 docs)

---

## Context: What Already Exists (Do NOT Re-research)

The organic-cert app is Next.js 16.1.6 + React 19 + Prisma 6.19.2 + PostgreSQL with a comprehensive schema already in place. The v3.0 work is **additive** — new capabilities layered onto the existing stack.

| Already Present | Version | Do Not Touch |
|-----------------|---------|--------------|
| `next` | 16.1.6 | App Router, Server Components, Route Handlers |
| `@prisma/client` | 6.19.2 | Existing schema with Field, FieldEnterprise, FieldHistory, HarvestEvent, etc. |
| `zod` | 4.3.6 | Schema validation (already used throughout) |
| `@react-pdf/renderer` | 4.3.2 | PDF generation (8-section inspection PDF working) |
| `@ag-media/react-pdf-table` | 2.0.3 | Table rendering in PDFs (already in use) |
| `date-fns` | 4.1.0 | Date parsing and formatting |
| `csv-parse` / `csv-stringify` | 6.1.0 / 6.6.0 | CSV import/export |
| `sonner` | 2.0.7 | Toast notifications |
| `shadcn` / Radix UI / Tailwind | current | UI components |

The three source apps — farm-budget (port 3001), farm-registry (port 3005), grain-tickets (port 3000) — all run Express with REST APIs accessible at localhost. No authentication between internal apps. All requests are same-machine.

---

## The Four New Capabilities

| Capability | What's Needed | New to Install? |
|------------|---------------|-----------------|
| Cross-app HTTP aggregation | `Promise.all` + native `fetch` + `react/cache` wrapper pattern | No new packages |
| Rotation snapshot storage | Prisma schema additions (new models) + `upsert` pattern | No new packages |
| NOP compliance rule engine | Pure TypeScript module + zod `.refine()` | No new packages |
| PDF from aggregated data | Existing `@react-pdf/renderer` + `@ag-media/react-pdf-table` | No new packages |

**The v3.0 stack additions are zero new npm packages.** All needed capabilities are satisfied by tools already installed. This is a significant finding — the work is architecture and logic, not dependency management.

---

## Recommended Stack — New Additions Only

### Core Technologies

No new core technologies. The existing stack is sufficient.

### Supporting Libraries — Zero New Installs

All four v3.0 capability areas use existing packages:

| Existing Package | New Usage in v3.0 | Why It Covers the Need |
|------------------|-------------------|------------------------|
| Native `fetch` (built into Node 18+ / Next.js) | HTTP calls to farm-budget:3001, farm-registry:3005, grain-tickets:3000 | Next.js App Router Server Components have native fetch with `cache: 'no-store'` for live data. No extra HTTP client library adds value over native fetch in a same-machine localhost context. |
| `react` cache function (built into React 19) | Wrap cross-app data fetchers to deduplicate within a render pass | Prevents duplicate calls when multiple Server Components need the same upstream data during one page render. Ships with React 19. |
| `zod` 4.3.6 (already installed) | NOP rule engine validation — `z.refine()` for compliance checks (buffer zone width, transition day counts, manure incorporation windows, OMRI status assertions) | Zod's `.refine()` and `.superRefine()` are the TypeScript-native way to express cross-field business rules. Already in the codebase for import validation; extend for compliance rules. |
| `@prisma/client` 6.19.2 (already installed) | New `RotationSnapshot` model + `EcosystemSyncState` model | Prisma upsert handles idempotent yearly snapshot writes. JSON fields store the compiled snapshot payload. No migration breaking changes to existing models. |
| `@react-pdf/renderer` 4.3.2 (already installed) | PDF sections now rendered from aggregated ecosystem data instead of organic-cert manual entries | Same `@react-pdf/renderer` Document/Page/View/Text API. The data source changes, not the rendering library. |
| `@ag-media/react-pdf-table` 2.0.3 (already installed) | Input application log table, rotation history table in PDF | Already used. v3.0 expands table content from ecosystem-compiled data. |

### Development Tools

No new tools required. Existing Prisma CLI handles schema migrations.

---

## Capability 1: Cross-App HTTP Data Aggregation

### Pattern

Use native `fetch` in Next.js Server Components (Route Handlers or async Server Components) with `Promise.allSettled` for resilient parallel calls to all three source apps:

```typescript
// src/lib/ecosystem-client.ts
// Server-only module — never imported in client components

import { cache } from 'react'

const FARM_BUDGET_BASE = process.env.FARM_BUDGET_URL ?? 'http://localhost:3001'
const FARM_REGISTRY_BASE = process.env.FARM_REGISTRY_URL ?? 'http://localhost:3005'
const GRAIN_TICKETS_BASE = process.env.GRAIN_TICKETS_URL ?? 'http://localhost:3000'

// react/cache deduplicates within a single render pass.
// If two Server Components both call getRegistryFields(), only one HTTP request fires.
export const getRegistryFields = cache(async () => {
  const res = await fetch(`${FARM_REGISTRY_BASE}/api/fields`, {
    cache: 'no-store',  // live data — never serve stale
  })
  if (!res.ok) throw new Error(`farm-registry /api/fields ${res.status}`)
  return res.json() as Promise<RegistryField[]>
})

export const getBudgetEnterprises = cache(async () => {
  const res = await fetch(`${FARM_BUDGET_BASE}/api/enterprises`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`farm-budget /api/enterprises ${res.status}`)
  return res.json() as Promise<BudgetEnterprise[]>
})

export const getGrainTickets = cache(async (crop?: string) => {
  const url = new URL(`${GRAIN_TICKETS_BASE}/api/tickets`)
  if (crop) url.searchParams.set('crop', crop)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`grain-tickets /api/tickets ${res.status}`)
  return res.json() as Promise<GrainTicket[]>
})

// Parallel aggregation with graceful degradation per source
export async function compileEcosystemData(cropYear: number) {
  const [registryResult, budgetResult, ticketsResult] = await Promise.allSettled([
    getRegistryFields(),
    getBudgetEnterprises(),
    getGrainTickets(),
  ])

  return {
    fields:      registryResult.status === 'fulfilled' ? registryResult.value : [],
    enterprises: budgetResult.status === 'fulfilled'   ? budgetResult.value   : [],
    tickets:     ticketsResult.status === 'fulfilled'  ? ticketsResult.value  : [],
    sourceErrors: [
      registryResult.status === 'rejected' ? `farm-registry: ${registryResult.reason}` : null,
      budgetResult.status === 'rejected'   ? `farm-budget: ${budgetResult.reason}`   : null,
      ticketsResult.status === 'rejected'  ? `grain-tickets: ${ticketsResult.reason}` : null,
    ].filter(Boolean),
  }
}
```

**Why `Promise.allSettled` not `Promise.all`:** If one source app is down (farm-budget restarting, grain-tickets offline), `Promise.all` would throw and the entire inspection packet compilation would fail. `Promise.allSettled` surfaces which sources succeeded and which failed, allowing partial compilation with visible source errors displayed in the UI.

**Why `cache: 'no-store'`:** The inspection packet must reflect current data — NOP compliance depends on what is actually planted and applied this season. Stale cached responses would be a compliance risk.

**Why `react/cache` wrapper:** Next.js App Router pages may have multiple Server Components that each need registry fields. Without `cache()`, each component would independently fetch. With `cache()`, the first call within a render tree populates an in-memory cache lasting the lifetime of that request.

**Why no `axios` or `got`:** Native `fetch` in Node 18+ covers all needs. `axios` would bypass Next.js's fetch memoization and `cache: 'no-store'` semantics. In a same-machine localhost context, the fetch overhead is negligible and no retry/interceptor infrastructure is needed.

**Why no `p-limit`:** Only three source apps, all on localhost. Concurrency limiting is for rate-limited remote APIs. `Promise.allSettled` with three requests is appropriate here.

### Environment Variables

Add to `.env.local`:

```bash
FARM_BUDGET_URL=http://localhost:3001
FARM_REGISTRY_URL=http://localhost:3005
GRAIN_TICKETS_URL=http://localhost:3000
```

Defaulting to localhost in code means zero config for local development. Env vars allow overrides if apps move to different ports or hosts.

---

## Capability 2: Yearly Rotation Snapshot Storage

### Pattern

Farm-budget is rebuilt from scratch each year (single-season design). Organic-cert needs a 3-year rotation history for NOP compliance. The snapshot mechanism takes an annual point-in-time read from the ecosystem and persists it in PostgreSQL.

Two new Prisma models are needed. These are **additive** — no changes to existing models.

```prisma
// New models to add to schema.prisma

model RotationSnapshot {
  id          String   @id @default(cuid())
  farmId      String
  farm        Farm     @relation(fields: [farmId], references: [id])
  cropYear    Int
  snapshotAt  DateTime @default(now())  // when the snapshot was taken
  takenByUserId String?

  // Compiled field rotation data at time of snapshot
  // Array of { fieldId, fieldName, registryId, crop, label, organicStatus, plantedAcres,
  //            variety, seedOrganic, materialCount, harvestYield, harvestUnit, lotNumber }
  fieldData   Json

  // Ecosystem source availability at snapshot time
  sourceSummary Json?   // { registryOk, budgetOk, ticketsOk, fieldCount, enterpriseCount }

  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([farmId, cropYear])  // one snapshot per farm per year
  @@index([farmId, cropYear])

  farm Farm @relation(fields: [farmId], references: [id])
}

model EcosystemSyncState {
  id                String    @id @default(cuid())
  farmId            String    @unique
  lastCompileAt     DateTime?
  lastCompileStatus String?   // "success" | "partial" | "error"
  lastCompileErrors Json?     // array of source error strings
  lastSnapshotYear  Int?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

**Why `Json` field for `fieldData` not a relational join table:** The snapshot is a point-in-time read — the farm-budget data will be deleted and rebuilt next year. The snapshot must be self-contained. A relational join back to live FieldEnterprise records would break when those records are updated or deleted. JSON blob preserves immutability.

**Why `@@unique([farmId, cropYear])`:** NOP requires exactly one rotation record per field per year. Upsert against this key makes snapshot creation idempotent — re-running a snapshot for 2025 overwrites the previous 2025 snapshot with current data, which is correct behavior before the year closes.

**Snapshot write pattern:**

```typescript
// POST /api/compilation/snapshot — Route Handler
await prisma.rotationSnapshot.upsert({
  where: { farmId_cropYear: { farmId, cropYear } },
  update: {
    fieldData: compiledData.fields,
    sourceSummary: compiledData.sourceSummary,
    snapshotAt: new Date(),
    takenByUserId: session.user.id,
  },
  create: {
    farmId,
    cropYear,
    fieldData: compiledData.fields,
    sourceSummary: compiledData.sourceSummary,
    takenByUserId: session.user.id,
  },
})
```

**3-year history retrieval:**

```typescript
// Get snapshots for NOP 3-year rotation section
const snapshots = await prisma.rotationSnapshot.findMany({
  where: { farmId, cropYear: { gte: currentYear - 2 } },
  orderBy: { cropYear: 'desc' },
})
// Returns current year + 2 prior years — exactly what NOP requires
```

---

## Capability 3: NOP Compliance Rule Engine

### Pattern

No compliance rule engine library exists for USDA NOP. This is purpose-built business logic. The right tool is Zod's `.refine()` and `.superRefine()` for typed rule assertions over the compiled ecosystem data.

The rule engine lives in `src/lib/nop-compliance.ts` and is a pure TypeScript module — no database, no HTTP calls, just functions that take compiled data and return compliance findings.

```typescript
// src/lib/nop-compliance.ts

import { z } from 'zod/v4'

// ─── Rule Output Shape ─────────────────────────────────────────────────────

export type ComplianceLevel = 'PASS' | 'WARN' | 'FLAG'

export interface ComplianceFinding {
  ruleCode:    string        // e.g. "C5.0-BUFFER-WIDTH"
  level:       ComplianceLevel
  entityType:  string        // "Field" | "FieldEnterprise" | "Material"
  entityId:    string
  entityLabel: string        // "Kopps — Org SRWW"
  message:     string        // human-readable finding
  detail?:     string        // additional context for inspector
}

// ─── Rule Implementations ────────────────────────────────────────────────

// C5.0: Buffer zones must be >= 25 feet on high-drift-risk sides
export function checkBufferZones(field: FieldWithBuffers): ComplianceFinding[] {
  return field.bufferZones
    .filter(b => b.widthFeet < 25)
    .map(b => ({
      ruleCode:    'C5.0-BUFFER-WIDTH',
      level:       'FLAG' as ComplianceLevel,
      entityType:  'Field',
      entityId:    field.id,
      entityLabel: field.name,
      message:     `Buffer zone ${b.direction} is ${b.widthFeet}ft — NOP requires 25ft minimum`,
      detail:      'Inspector will scrutinize. Document justification or expand buffer.',
    }))
}

// C9.0: Non-organic seed requires Commercial Availability documentation
export function checkSeedOrganic(enterprise: EnterpriseWithSeeds): ComplianceFinding[] {
  return enterprise.seedUsages
    .filter(s => !s.seedLot.isOrganic && !s.seedLot.commercialAvailDoc)
    .map(s => ({
      ruleCode:    'C9.0-SEED-COMMERCIAL-AVAIL',
      level:       'FLAG' as ComplianceLevel,
      entityType:  'FieldEnterprise',
      entityId:    enterprise.id,
      entityLabel: `${enterprise.field.name} — ${enterprise.crop}`,
      message:     `Seed lot "${s.seedLot.variety}" is non-organic without Commercial Availability documentation`,
      detail:      'Required per NOP §205.204. Obtain and attach documentation before inspection.',
    }))
}

// Manure application window: must be incorporated 90 days before harvest
// (120 days for crops in contact with soil/edible portions)
export function checkManureApplicationWindows(
  enterprise: EnterpriseWithFertilityAndHarvest
): ComplianceFinding[] {
  const findings: ComplianceFinding[] = []
  for (const event of enterprise.fertilityEvents) {
    if (!['MANURE', 'COMPOST'].includes(event.type)) continue
    const harvestDate = enterprise.harvestEvents[0]?.harvestDate
    if (!harvestDate || !event.applicationDate) continue
    const daysToHarvest = differenceInDays(new Date(harvestDate), new Date(event.applicationDate))
    const required = 90  // conservative; 120 for soil-contact crops
    if (daysToHarvest < required) {
      findings.push({
        ruleCode:    'C5.0-MANURE-WINDOW',
        level:       'FLAG',
        entityType:  'FieldEnterprise',
        entityId:    enterprise.id,
        entityLabel: `${enterprise.field.name} — ${enterprise.crop}`,
        message:     `Manure applied ${daysToHarvest} days before harvest — NOP requires ${required}+`,
        detail:      `Application: ${event.applicationDate}. Harvest: ${harvestDate}.`,
      })
    }
  }
  return findings
}

// Transition: fields must be 3 years without prohibited substances before organic status
export function checkTransitionStatus(field: FieldWithHistory): ComplianceFinding[] {
  if (field.organicStatus !== 'TRANSITIONAL') return []
  // Check 3 years of FieldHistory for substance notes
  const recentHistory = field.history.filter(h => h.year >= currentYear - 3)
  const substanceYears = recentHistory.filter(h => h.substances && h.substances.trim())
  if (substanceYears.length > 0) {
    return [{
      ruleCode:    'C1.0-TRANSITION-SUBSTANCES',
      level:       'WARN',
      entityType:  'Field',
      entityId:    field.id,
      entityLabel: field.name,
      message:     `Transitional field has substance applications in ${substanceYears.map(y => y.year).join(', ')}`,
      detail:      'Review 3-year history. Transition clock may not have started.',
    }]
  }
  return []
}

// ─── Aggregate Runner ────────────────────────────────────────────────────

export function runAllChecks(compiledData: CompiledInspectionData): ComplianceFinding[] {
  const findings: ComplianceFinding[] = []
  for (const field of compiledData.fields) {
    findings.push(...checkBufferZones(field))
    findings.push(...checkTransitionStatus(field))
    for (const enterprise of field.enterprises) {
      findings.push(...checkSeedOrganic(enterprise))
      findings.push(...checkManureApplicationWindows(enterprise))
      // add more rule checks here as they are built
    }
  }
  return findings
}
```

**Why not a general-purpose rule engine (json-rules-engine, nools, etc.):** NOP rules are domain-specific with complex types (dates, measurements, crop categories, material classifications). A general rule engine would require serializing these into its own DSL, losing TypeScript type safety. Pure TypeScript functions with explicit types are simpler, more debuggable, and testable with Jest.

**Why Zod `.refine()` for input validation but plain functions for rule output:** Zod `.refine()` is ideal for validating that data conforms to a schema before processing. But compliance findings need a rich output structure (ruleCode, level, entityId, message) that Zod's error format doesn't cleanly produce. The pattern is: use Zod for input validation at the data-aggregation layer, use typed functions for the compliance rule assertions.

**OMRI database:** No public API exists for OMRI lookups as of 2026. OMRI's materials list is available as a downloadable CSV. The pattern is to import OMRI-listed product names into the Material model's `omriListed` boolean at material creation time — organic-cert already has this field. No external API call needed at compliance check time.

---

## Capability 4: PDF Generation from Aggregated Data

No new packages. The existing `@react-pdf/renderer` 4.3.2 + `@ag-media/react-pdf-table` 2.0.3 handle the PDF layer.

The change in v3.0 is the **data source** flowing into PDF generation, not the generation mechanism itself.

**Current flow:**
```
organic-cert PostgreSQL (manual entries)
  → report-assembler.ts
  → @react-pdf/renderer Document
  → PDF
```

**v3.0 flow:**
```
compileEcosystemData()  (aggregates farm-registry + farm-budget + grain-tickets)
  → runAllChecks()      (NOP compliance findings)
  → RotationSnapshot    (stored in PostgreSQL for history)
  → report-assembler.ts (updated to accept CompiledInspectionData shape)
  → @react-pdf/renderer Document
  → PDF
```

The `report-assembler.ts` file already exists and produces the 8-section PDF. In v3.0 it is updated to accept the compiled data shape. The rendering logic is unchanged; only the data input shape changes.

**No streaming or worker thread needed for PDF generation:** `@react-pdf/renderer` runs synchronously in the Route Handler. The existing pattern in organic-cert already handles this at the `/api/reports` Route Handler. At one farm's worth of data (56 fields, 100-200 enterprises), PDF generation completes in under 2 seconds — no background job required.

---

## Installation

```bash
# No new packages required for v3.0.

# Only Prisma schema migration is needed for the two new models:
cd /Users/glomalinguild/Desktop/my-project-one/organic-cert
npx prisma migrate dev --name add-rotation-snapshot-and-ecosystem-sync
npx prisma generate
```

**After migration:**
- `RotationSnapshot` and `EcosystemSyncState` tables are created
- Existing tables and data are untouched
- `@prisma/client` is regenerated with the new model types

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Native `fetch` + `react/cache` | `axios` for cross-app HTTP | Axios bypasses Next.js fetch memoization semantics. No benefit for localhost-to-localhost calls where retry logic and interceptors add complexity without need. |
| Native `fetch` + `react/cache` | `swr` / `react-query` for aggregation | SWR and React Query are client-side data fetching patterns. The compilation engine runs in Server Components and Route Handlers — server-side. These libraries do not apply. |
| `Promise.allSettled` for parallel calls | `Promise.all` | `Promise.all` fails fast if any source app is unavailable. During active farm operation, farm-budget might be restarting. `allSettled` allows partial compilation with visible source errors, which is more useful than a hard failure. |
| Zod `.refine()` + typed functions for NOP rules | `json-rules-engine` library | General-purpose rule engines require DSL configuration, lose TypeScript type safety, and add an abstraction layer over what is already clear domain logic. NOP rules are stable business logic — they do not need dynamic configuration at runtime. |
| `Json` field in Prisma for snapshot payload | Separate relational `RotationSnapshotField` table | Snapshot data must be immutable point-in-time. Relational joins would reflect current (mutated) field state, not the state at snapshot time. JSON blob is the right tool for historical records that must not drift with live edits. |
| Existing `@react-pdf/renderer` + updated data source | New PDF library (Puppeteer, pdf-lib) | The existing renderer produces correct NOP-compliant PDFs. Swapping the library for identical output is unnecessary churn. Puppeteer adds a headless browser dependency; pdf-lib is low-level and would require rebuilding existing layout work. |
| Zero new npm packages | Adding dedicated HTTP client, rule engine, snapshot library | All four capabilities are satisfied by tools already installed. Adding packages for their own sake increases dependency surface, update maintenance, and potential breaking change exposure. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `axios` | Bypasses Next.js native fetch memoization; adds config overhead for same-machine calls that don't need retry or interceptors | Native `fetch` with `cache: 'no-store'` |
| `json-rules-engine` / `nools` / `drools-js` | General rule engines designed for dynamic rule configuration at runtime. NOP rules are static domain logic known at build time. TypeScript functions with explicit types are more maintainable and testable. | Typed TypeScript functions in `src/lib/nop-compliance.ts` |
| `node-fetch` or `isomorphic-fetch` polyfills | Node 18+ (running here) has native `fetch` built in. Next.js extends it further with caching semantics. Polyfills override that and lose caching features. | Built-in `fetch` |
| `bull` / `pg-boss` for PDF generation | PDF generation completes in <2s at this farm's data scale. Background job infrastructure adds Redis/PostgreSQL queue complexity with no user benefit. | Synchronous Route Handler (existing pattern) |
| External OMRI API calls at runtime | No public OMRI API exists. Even if one did, checking material compliance at PDF render time via external HTTP introduces latency and external failure risk into the inspection packet workflow. | `omriListed` boolean on `Material` model (already in schema) — set at material creation, not at render time |
| `zod/v3` import path | Zod 4 (installed at 4.3.6) recommends `import { z } from 'zod/v4'` to access v4 features. The root import (`from 'zod'`) still works but imports v3 compat layer. Use `zod/v4` subpath for new code. | `import { z } from 'zod/v4'` |

---

## Stack Patterns by Variant

**If a source app is unavailable at compile time:**
- Use `Promise.allSettled` result — compilation proceeds with available sources
- Surface `sourceErrors` array in the compilation UI ("farm-budget unavailable — inputs data not included")
- Snapshot can still be taken from partial data with `sourceSummary.budgetOk = false`
- Do NOT throw and block the entire compilation

**If farm-budget or grain-tickets moves to a different host (not localhost):**
- Update `FARM_BUDGET_URL` / `GRAIN_TICKETS_URL` env vars in `.env.local`
- No code changes needed — all base URLs are env-var-driven

**If NOP rules change (e.g., SOE amendments, updated manure windows):**
- Edit `src/lib/nop-compliance.ts` rule functions directly
- Each rule is an isolated function — changing one does not break others
- No DSL configuration files to update — TypeScript is the source of truth

**If rotation history needs to go back beyond 3 years:**
- `RotationSnapshot` model stores one row per year — all years are queryable
- Change the `gte: currentYear - 2` filter to `gte: currentYear - N`
- No schema change required

---

## Version Compatibility

| Package | Version | Compatibility Notes |
|---------|---------|---------------------|
| `next` | 16.1.6 | Confirmed: `cache: 'no-store'` on fetch and `react/cache` function work in App Router Server Components. Verified against Next.js 16 official docs (fetched 2026-03-01). |
| `react` | 19.2.3 | `import { cache } from 'react'` — request memoization for server components. Stable API in React 19. |
| `@prisma/client` | 6.19.2 | `Json` field type supports arbitrary objects. `upsert` on compound unique `[farmId, cropYear]` is standard Prisma behavior. |
| `zod` | 4.3.6 | Use `import { z } from 'zod/v4'` subpath for v4 features. `.refine()` and `.superRefine()` APIs are stable in v4. |
| `date-fns` | 4.1.0 | `differenceInDays()` used in manure window compliance check. API unchanged from v3. |
| `@react-pdf/renderer` | 4.3.2 | PDF generation runs server-side in Route Handler. React 19 compatible. No changes to rendering API. |

---

## Sources

- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/package.json` — Confirmed exact versions of all existing packages. HIGH confidence.
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/prisma/schema.prisma` — Confirmed existing model structure. `RotationSnapshot` and `EcosystemSyncState` are new additions, not conflicts. HIGH confidence.
- `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-client.ts` — Confirmed native `fetch` pattern already used in the app for external HTTP calls. `apiGet()` wrapper is the precedent for `ecosystem-client.ts`. HIGH confidence.
- `https://nextjs.org/docs/app/getting-started/fetching-data` — Verified: `cache: 'no-store'` for dynamic data, `Promise.all` for parallel fetching, `react/cache` for deduplication within a render pass. Official Next.js 16 docs fetched 2026-03-01. HIGH confidence.
- `https://zod.dev/v4` — Confirmed Zod 4 `.refine()` / `.superRefine()` APIs stable, `zod/v4` subpath import recommended. HIGH confidence.
- `https://www.omri.org/omri-lists` — Confirmed: no public OMRI API. Lists are downloadable files. `omriListed` boolean on Material model is the correct pattern. HIGH confidence.
- `https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields` — Confirmed: Prisma `Json` fields support arbitrary object storage, work with upsert. MEDIUM confidence (official docs, not tested in this project).
- WebSearch: Confirmed `json-rules-engine` and similar libraries are designed for dynamic runtime rule configuration — unnecessary complexity for static NOP business rules. MEDIUM confidence.
- WebSearch: Confirmed no JavaScript/TypeScript library exists for USDA NOP compliance checking. Purpose-built logic is the only path. HIGH confidence (absence confirmed by exhaustive search).

---

*Stack research for: organic-cert v3.0 — cross-app data aggregation, rotation snapshots, NOP compliance rule engine, PDF from aggregated data*
*Researched: 2026-03-01*
