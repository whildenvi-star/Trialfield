# Architecture Research

**Domain:** Organic certification audit system — Case IH Field Ops integration + USDA NOP audit reporting
**Researched:** 2026-02-23
**Confidence:** MEDIUM — Case IH API surface confirmed from existing codebase + developer portal; NOP recordkeeping confirmed from 7 CFR 205.103; append-only patterns confirmed from PostgreSQL RLS documentation. Full FieldOps API schema (endpoint response format) is behind a login wall at develop.cnh.com; mock-data.js in this codebase is the best available shape reference.

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                     Next.js App (organic-cert)                      │
│                                                                     │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │  UI Layer    │  │   API Routes   │  │  Background Sync     │   │
│  │  (React/RSC) │  │  /api/**       │  │  /api/admin/sync     │   │
│  └──────┬───────┘  └───────┬────────┘  └──────────┬───────────┘   │
│         │                  │                       │               │
├─────────┼──────────────────┼───────────────────────┼───────────────┤
│         │            Service Layer                 │               │
│  ┌──────▼───────┐  ┌───────▼────────┐  ┌──────────▼───────────┐   │
│  │  Report      │  │  Audit Store   │  │  Case IH Sync        │   │
│  │  Generator   │  │  Service       │  │  Service             │   │
│  └──────┬───────┘  └───────┬────────┘  └──────────┬───────────┘   │
│         │                  │                       │               │
├─────────┼──────────────────┼───────────────────────┼───────────────┤
│                       Data Layer (Prisma + PostgreSQL)              │
│  ┌──────▼───────┐  ┌───────▼────────┐  ┌──────────▼───────────┐   │
│  │  @react-pdf  │  │  AuditLog      │  │  FieldOpsSync        │   │
│  │  PDF stream  │  │  (append-only) │  │  FieldOperation      │   │
│  └──────────────┘  └────────────────┘  │  HarvestEvent        │   │
│                                        │  MaterialUsage       │   │
│                                        └──────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ OAuth2 client_credentials
                          ┌─────────┴──────────┐
                          │  Case IH FieldOps  │
                          │  ag.api.cnhind.com │
                          │  /v1/fields         │
                          │  /v1/applications   │
                          │  /v1/yield          │
                          │  /v1/equipment      │
                          │  /v1/telemetry      │
                          └────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| Case IH Sync Service | OAuth2 token management, API polling, field name matching, data normalization | Case IH API (outbound), Prisma write (inbound to DB), AuditStore (emits SYNC_IMPORT events) |
| Audit Store Service | Single write path for all audit-relevant records; enforces append-only; computes entry checksum | Prisma (AuditLog model), all other services that produce write events |
| Report Generator | Assembles inspector-ready NOP report from normalized records; streams PDF | Prisma (read-only queries), @react-pdf/renderer, Next.js API route handler |
| Field History Tracker | 3-year crop rotation view, per-field substance history | FieldHistory + FieldEnterprise + MaterialUsage + FertilityEvent models |
| Audit Viewer UI | Filterable log viewer for internal review and regulator export | /api/audit-log route, CSV export endpoint |

---

## Recommended Project Structure

The existing `organic-cert/src/` structure already works. Add the following:

```
organic-cert/src/
├── lib/
│   ├── audit-logger.ts          # EXISTING — extend with checksum chaining
│   ├── fieldops-client.ts       # NEW — TypeScript port of farm-budget/fieldops/client.js
│   ├── fieldops-sync.ts         # NEW — TypeScript port of farm-budget/fieldops/sync.js, writes to Prisma
│   ├── fieldops-normalizer.ts   # NEW — maps FieldOps shape → Prisma models (FieldOperation, HarvestEvent, etc.)
│   └── report-generator.ts      # NEW — assembles NOP audit report data, calls @react-pdf/renderer
├── app/
│   └── api/
│       ├── admin/
│       │   └── sync/
│       │       └── route.ts     # NEW — POST /api/admin/sync triggers Case IH sync (ADMIN only)
│       ├── audit-log/
│       │   └── route.ts         # EXISTING — extend with export (CSV) endpoint
│       └── reports/
│           └── nop/
│               └── route.ts     # NEW — GET /api/reports/nop?year=2025 returns PDF stream
├── components/
│   └── reports/
│       └── NopAuditReport.tsx   # NEW — @react-pdf/renderer document component
└── prisma/
    └── schema.prisma            # EXTEND — add FieldOpsSync, tamper-evident AuditLog columns
```

### Structure Rationale

- **lib/fieldops-client.ts + fieldops-sync.ts:** Isolated from HTTP layer; testable pure TypeScript. Port of existing farm-budget JS logic — no reinvention, just typed translation.
- **lib/fieldops-normalizer.ts:** The impedance mismatch between FieldOps flat JSON and Prisma relational models is significant enough to warrant its own module. Keeps sync.ts readable.
- **lib/report-generator.ts:** Report assembly (database queries + data shaping) is separate from PDF rendering (component tree). This lets you unit-test the data assembly without rendering PDFs.
- **components/reports/NopAuditReport.tsx:** @react-pdf/renderer component. Server-rendered via Next.js API route, not client-rendered. This avoids font/worker issues in browser and keeps sensitive farm data server-side.

---

## Architectural Patterns

### Pattern 1: Append-Only Audit Store with Entry Checksum

**What:** Every write to the AuditLog table includes a SHA-256 hash computed over the entry's content fields plus the hash of the most recent preceding entry (hash chaining). The hash is stored in a `entryHash` column. A PostgreSQL row-level security (RLS) policy blocks all UPDATE and DELETE on the AuditLog table from the application role. The application role only has INSERT + SELECT.

**When to use:** All compliance-critical event recording — manual field edits, Case IH sync imports, report generation events.

**Trade-offs:**
- Hash chain gives tamper evidence detectable at the application layer without external infrastructure (no Merkle tree, no HSM required at this scale)
- Chaining means reordering is detectable but concurrent inserts (rare for farm-scale volume) can create brief ordering ambiguity — acceptable here
- RLS blocks application-level deletes; admin SQL access still bypasses this (document in PITFALLS)

**Example:**
```typescript
// lib/audit-logger.ts — extend existing logAudit()
import { createHash } from 'crypto';

async function computeEntryHash(
  data: Omit<AuditLogInput, 'entryHash'>,
  previousHash: string | null
): Promise<string> {
  const payload = JSON.stringify({
    userId: data.userId ?? null,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    newData: data.newData ?? null,
    previousHash: previousHash ?? '0000000000000000',
  });
  return createHash('sha256').update(payload).digest('hex');
}

export async function logAudit(input: AuditLogInput) {
  // Get previous hash in a transaction to maintain chain integrity
  return prisma.$transaction(async (tx) => {
    const prev = await tx.auditLog.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { entryHash: true },
    });
    const entryHash = await computeEntryHash(input, prev?.entryHash ?? null);
    return tx.auditLog.create({
      data: { ...input, entryHash },
    });
  });
}
```

### Pattern 2: Case IH Sync Service as a Triggered Background Job

**What:** The Case IH sync runs as a Next.js API route (`POST /api/admin/sync`) that is ADMIN-only and can be triggered manually from the UI or via an external cron scheduler (e.g., a system cron `curl`-ing the endpoint with an API key). The sync is NOT run in-process on startup (avoids serverless cold-start issues and race conditions).

**When to use:** This deployment is self-hosted Node.js (not Vercel serverless), so a persistent process works. However, keeping the sync as an HTTP-triggered route rather than an in-process `setInterval` makes it observable, auditable, and restartable without redeploying.

**Trade-offs:**
- Simpler than adding BullMQ/Redis to the stack
- Manual trigger satisfies the farm manager use case ("sync before inspection")
- Scheduled trigger can be added via system cron or a simple `node-cron` wrapper around the HTTP call without changing architecture
- Token caching (already implemented in farm-budget client) handles token reuse across sync calls

**Example:**
```typescript
// app/api/admin/sync/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runFieldOpsSync } from '@/lib/fieldops-sync';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await runFieldOpsSync();
  return Response.json(result);
}
```

### Pattern 3: Normalizer-First Import — No Direct FieldOps Writes to Primary Tables

**What:** Raw Case IH API data is never written directly to Prisma domain models (FieldOperation, HarvestEvent, etc.). It always passes through `fieldops-normalizer.ts` which maps FieldOps JSON to the Prisma shape, applies field-name matching against the existing Field table, and produces a normalized record. The normalizer returns a `SyncCandidate[]` array; the sync service then decides create-or-skip based on external ID dedup.

**When to use:** Every Case IH API record ingestion. Critically, if Case IH changes their API shape (they have already added live telemetry in 2025), only the normalizer needs updating, not the sync or the database.

**Trade-offs:**
- Adds one module but isolates change — the sync logic and database writes are stable even if the upstream API evolves
- The normalizer is also the right place to handle NOP-specific transformations (e.g., mapping FieldOps `FERTILIZER` type to a check against the Material NOP status table)

**Example:**
```typescript
// lib/fieldops-normalizer.ts
export interface NormalizedOperation {
  fieldName: string;             // for matching to Field.name
  externalId: string;            // FieldOps record ID, for dedup
  type: FieldOpType;             // mapped from FieldOps operationType
  operationDate: Date;
  equipmentName?: string;
  acresWorked?: number;
  sourceSystem: 'fieldops';
  rawPayload: unknown;           // stored on the record for traceability
}

export function normalizeOperation(
  foRecord: FieldOpsTelemetry
): NormalizedOperation {
  return {
    fieldName: foRecord.fieldName,
    externalId: `fo-${foRecord.equipmentId}-${foRecord.date}-${foRecord.fieldId}`,
    type: mapOpType(foRecord.operationType),  // HARVEST|TILLAGE|PLANTING→FieldOpType
    operationDate: new Date(foRecord.date),
    acresWorked: foRecord.areaWorked?.value,
    sourceSystem: 'fieldops',
    rawPayload: foRecord,
  };
}
```

### Pattern 4: Report Generation as Server-Side PDF Stream

**What:** The NOP audit report is assembled server-side in the Next.js API route handler, rendered to a PDF buffer using `@react-pdf/renderer`'s `renderToBuffer()`, and returned as a binary response with `Content-Type: application/pdf`. The UI simply links to the endpoint; no client-side PDF rendering.

**When to use:** Always for this use case. Sensitive farm data (input applications, yields) should not leave the server in JSON form for client-side rendering.

**Trade-offs:**
- Rendering large reports (3+ years, 20+ fields) can be slow server-side — acceptable for this use case (farm managers don't generate reports on a hot loop)
- @react-pdf/renderer has a known Node.js compatibility issue with canvas in some environments; use `renderToBuffer()` not `renderToStream()` for Next.js App Router route handlers

**Example:**
```typescript
// app/api/reports/nop/route.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { NopAuditReport } from '@/components/reports/NopAuditReport';
import { assembleReportData } from '@/lib/report-generator';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()));
  const data = await assembleReportData(year);
  const buffer = await renderToBuffer(<NopAuditReport data={data} />);
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="nop-audit-${year}.pdf"`,
    },
  });
}
```

---

## Data Flow

### Case IH API → Normalized Records → Audit Store

```
Case IH API (ag.api.cnhind.com)
  │
  │  OAuth2 client_credentials → Bearer token (cached 3600s)
  │  GET /v1/fields, /v1/applications, /v1/yield, /v1/equipment, /v1/telemetry
  │
  ▼
fieldops-client.ts
  │  Raw JSON: { id, fieldName, date, type, products[], area, ... }
  │
  ▼
fieldops-normalizer.ts
  │  Field name → Field.id lookup (fuzzy match: normalize whitespace, lowercase)
  │  FieldOps types → Prisma enums (FieldOpType, etc.)
  │  External ID construction for dedup
  │  Missing field → flagged in sync result, not auto-created in organic-cert
  │    (organic-cert Fields are master; FieldOps enriches, never creates)
  │
  ▼
fieldops-sync.ts
  │  Dedup check: externalId already in FieldOperation.fieldopsExternalId? → skip
  │  Create: prisma.fieldOperation.create() / prisma.harvestEvent.create() / etc.
  │  Emit: logAudit({ action: 'CREATE', entityType: 'FieldOperation', source: 'fieldops-sync' })
  │
  ▼
PostgreSQL (Prisma)
  │  FieldOperation, HarvestEvent, MaterialUsage, FieldHistory rows created
  │  AuditLog row appended with entryHash (SHA-256 chain)
  │
  ▼
FieldOpsSync metadata record updated
  │  lastSync, lastStatus, fieldsMatched, operationsImported, errors[]
```

### User Edit → Audit Store

```
Farm manager edits HarvestEvent in UI
  │
  ▼
PUT /api/field-enterprises/[id]/harvest/[recordId]
  │  RBAC check (ADMIN or OFFICE role)
  │  Read current record (oldData snapshot)
  │
  ▼
prisma.harvestEvent.update()
  │
  ▼
logAudit({ action: 'UPDATE', entityType: 'HarvestEvent', oldData, newData })
  │  Transaction: get previousHash → compute SHA-256 → insert AuditLog row
```

### Audit Store → PDF Report

```
Farm manager clicks "Generate NOP Report 2025"
  │
  ▼
GET /api/reports/nop?year=2025  (ADMIN or OFFICE role)
  │
  ▼
report-generator.ts assembleReportData(2025)
  │  Queries (all in one farm context via session):
  │    Farm (name, operator, cert numbers, NOP ID)
  │    Fields (all, with organicStatus, fsaTract, acres)
  │    FieldHistory (3 years back: crop, substances, yieldPerAcre)
  │    FieldEnterprise (2025 crop year, with seedUsages, materialUsages,
  │                     fieldOperations, fertilityEvents, harvestEvents)
  │    CropLot + StorageTransfer + LoadoutEvent + SaleDelivery (mass balance)
  │    Equipment + CleanoutEvent (shared equipment docs)
  │    NarrativeSection (C3.0 soil/water/biodiversity narratives)
  │
  ▼
NopAuditReport React component (@react-pdf/renderer)
  │  Sections mirror NOP OSP structure:
  │    Cover page (farm, operator, cert number, inspection year)
  │    Field inventory (all fields, acres, organic status, transition date)
  │    3-year field history per field
  │    Input application records (seed, fertility, pest control per field)
  │    Harvest records (yield, moisture, equipment, operator)
  │    Storage & mass balance (bin cleanouts, transfers, loadouts)
  │    Equipment list (shared equipment, cleanout documentation)
  │    Audit trail summary (AuditLog entries for the report period)
  │
  ▼
renderToBuffer() → PDF binary
  │
  ▼
Response (application/pdf, Content-Disposition: attachment)
```

### AuditLog Integrity Verification

```
Inspector or auditor requests log export
  │
  ▼
GET /api/audit-log?export=csv&from=2025-01-01&to=2025-12-31
  │
  ▼
Verification pass: iterate rows in timestamp order,
  recompute SHA-256 of each entry + previousHash,
  compare to stored entryHash → flag any mismatch as tampered
  │
  ▼
CSV download with entryHash column for external verification
```

---

## Suggested Build Order

Build order follows dependency direction: each phase produces artifacts consumed by the next.

```
Phase 1: Case IH Sync Service
  ├── fieldops-client.ts (TypeScript port, token caching)
  ├── fieldops-normalizer.ts (FieldOps → Prisma shape mapping)
  ├── fieldops-sync.ts (dedup logic, Prisma writes)
  ├── Prisma schema additions (fieldopsExternalId on FieldOperation/HarvestEvent,
  │   FieldOpsSync metadata model)
  └── POST /api/admin/sync route (ADMIN-gated trigger)

  Produces: Normalized field operation records in PostgreSQL

Phase 2: Append-Only Audit Store Enhancement
  ├── Extend AuditLog Prisma model (add entryHash column, previousHash column)
  ├── Extend audit-logger.ts (SHA-256 chain, transaction-safe)
  ├── PostgreSQL RLS policy (INSERT-only for app role on audit_log table)
  ├── Extend /api/audit-log route (filtering by source, entityType, date range)
  └── Audit viewer UI (table with filters, CSV export)

  Depends on: Phase 1 (sync service emits audit events on import)
  Produces: Tamper-evident, filterable audit log

Phase 3: Field History Tracking UI
  ├── 3-year field history view (FieldHistory model — already exists, needs UI)
  ├── Per-field substance history aggregation (MaterialUsage + FertilityEvent)
  ├── Crop rotation visualization (CropRotation model — already exists)
  └── FieldOps sync status indicator per field (last sync date, source badge)

  Depends on: Phase 1 (sync populates FieldOperation records)
  Produces: Inspector-ready field history view in the web app

Phase 4: NOP Audit Report Generator
  ├── report-generator.ts (assembleReportData — all Prisma queries)
  ├── NopAuditReport.tsx (@react-pdf/renderer document structure)
  ├── GET /api/reports/nop route (ADMIN/OFFICE-gated, PDF stream)
  └── Report preview UI (link to download, year selector)

  Depends on: Phase 2 (audit trail section in report), Phase 3 (field history data)
  Produces: Print-ready NOP inspection report PDF
```

**Why this order:**
- The sync service must run first because it populates the records that everything else displays and reports on. An empty database produces nothing useful in later phases.
- Audit store enhancement is second because it must be in place before Phase 3 and 4 generate significant write activity — retrofitting hash chaining on a populated log requires a migration script.
- Field history UI is third: it validates that the sync data looks correct before you commit it to a PDF report. Inspecting the UI is faster feedback than generating PDFs.
- Report generation is last because it is purely read-only aggregation of what the first three phases produce. It has no upstream dependencies that aren't satisfied by phases 1-3.

---

## Append-Only Audit Store: Fitting Into Existing Prisma/PostgreSQL Setup

### What Already Exists

The `AuditLog` model in `schema.prisma` (line 760) is a plain insert-only table with no DELETE route in any API handler. This is correct behavior by convention but not enforced at the database layer. No tamper-evidence mechanism exists yet (no `entryHash` column).

### What to Add to the Schema

```prisma
model AuditLog {
  id           String      @id @default(cuid())
  userId       String?
  userName     String?
  action       AuditAction
  entityType   String
  entityId     String
  oldData      Json?
  newData      Json?
  ipAddress    String?
  source       String?     // "ui", "fieldops-sync", "import" — NEW
  entryHash    String?     // SHA-256 of content + previousHash — NEW
  previousHash String?     // hash of immediately preceding row — NEW
  timestamp    DateTime    @default(now())

  @@index([entityType, entityId])
  @@index([timestamp])
  @@index([source])         // NEW — filter sync vs manual entries
}
```

### PostgreSQL RLS Policy

Applied via a Prisma migration raw SQL step:

```sql
-- Enable RLS on audit_log
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;

-- Application role may only INSERT and SELECT (never UPDATE or DELETE)
CREATE POLICY audit_log_insert ON "AuditLog"
  FOR INSERT TO app_user WITH CHECK (true);

CREATE POLICY audit_log_select ON "AuditLog"
  FOR SELECT TO app_user USING (true);

-- No UPDATE policy = UPDATE blocked
-- No DELETE policy = DELETE blocked
```

**Important:** The PostgreSQL role used by the Prisma connection (`DATABASE_URL`) must be `app_user` (not superuser) for this policy to apply. The `FORCE ROW LEVEL SECURITY` clause applies the policy even to table owners.

### Handling Hash Chaining Under Concurrent Load

At farm-scale (one or two concurrent users), the simple transaction approach (get last hash → compute new hash → insert) works without contention. If concurrent writes become an issue, use a PostgreSQL advisory lock keyed on a constant (e.g., `pg_advisory_xact_lock(hashtext('audit_log_chain'))`).

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Case IH FieldOps API (ag.api.cnhind.com) | OAuth2 `client_credentials` flow; Bearer token cached 3600s; polling via triggered sync | Staging: `mkt.fieldops.caseih.com`. Production: `fieldops.caseih.com`. Token endpoint: `https://identity.cnhind.com/oauth2/aus78lla80kTGmPFf1t7/v1/token`. Requires `Ocp-Apim-Subscription-Key` header in addition to Bearer token. Rate limit: 120 req/s, 120 concurrent users. |
| FieldOps Data Availability Warning | Agronomic data accessed through Linked Accounts in the FieldOps portal is NOT accessible via the FieldOps API | CNH developer docs state this explicitly. Data from partner integrations may not come through the API. Verify with a real account before relying on applications/yield data being present. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| fieldops-sync.ts ↔ audit-logger.ts | Direct function call: `logAudit()` after each Prisma write | Sync emits one audit event per created record; use `source: 'fieldops-sync'` to distinguish from manual writes |
| fieldops-sync.ts ↔ fieldops-normalizer.ts | Returns `NormalizedRecord[]` array; sync iterates and deduplicates | Normalizer is stateless pure function — no Prisma access |
| report-generator.ts ↔ Prisma | Read-only queries; no writes | Report generation must not mutate any records; wrap in a read-only transaction if multi-query consistency is needed |
| NopAuditReport.tsx ↔ report-generator.ts | Data object passed as props; report component is pure render | Keep all async data fetching in report-generator.ts, not inside the React PDF component tree |
| /api/admin/sync ↔ fieldops-sync.ts | HTTP POST triggers sync; sync result JSON returned | ADMIN role only; log the sync trigger itself as an AuditLog event (`entityType: 'FieldOpsSync'`) |

---

## Anti-Patterns

### Anti-Pattern 1: Writing FieldOps Records Directly to Prisma Without Normalizer

**What people do:** Call `prisma.fieldOperation.create()` directly inside `fieldops-sync.ts` using raw FieldOps JSON fields.

**Why it's wrong:** FieldOps schema has already changed (live telemetry added in 2025 per CNH news). Direct writes couple your database writes to the API shape. A field rename in the FieldOps API breaks sync silently.

**Do this instead:** All FieldOps writes go through `fieldops-normalizer.ts`. The normalizer owns the impedance mapping. The sync service works with normalized types.

### Anti-Pattern 2: Mutating AuditLog Rows (Corrections via UPDATE)

**What people do:** When a field operation is corrected, update the AuditLog row that recorded the original to reflect the correction.

**Why it's wrong:** Destroys the audit trail. Inspectors and regulators need to see that a correction was made and what the original record said.

**Do this instead:** Always append a new AuditLog entry with `action: 'UPDATE'`, `oldData` containing the original, and `newData` containing the corrected value. The RLS policy blocks UPDATE at the database layer regardless.

### Anti-Pattern 3: Rendering the NOP PDF in the Browser

**What people do:** Fetch report data as JSON from an API, pass to `@react-pdf/renderer` in a client component, render in-browser.

**Why it's wrong:** Farm data (yields, input applications, organic cert numbers) leaves the server as JSON. Browser rendering also has issues with web workers and fonts in Next.js App Router.

**Do this instead:** `renderToBuffer()` on the server in an API route handler. Return binary PDF. The browser just downloads the file.

### Anti-Pattern 4: Auto-Creating organic-cert Fields From FieldOps Data

**What people do:** If a FieldOps field name does not match any existing `Field` in organic-cert, create a new Field automatically.

**Why it's wrong:** Organic-cert Field records carry NOP-critical metadata (organicStatus, transitionDate, FSA numbers, buffer zones, adjacent land use). None of that is available from FieldOps. Auto-creating produces incomplete records that could show up in inspection reports with null NOP fields.

**Do this instead:** Log unmatched FieldOps fields in the sync result (`unmatchedFields: string[]`). Surface them in the sync status UI. Farm manager manually creates the Field record with all required NOP fields, then re-runs sync.

---

## Scaling Considerations

This is a single-farm, single-tenant system at launch. Scale is not a concern. The architectural choices are sized appropriately:

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 users (current) | Single Prisma connection, hash chain with simple transaction, sync triggered manually |
| 5-50 users (multi-farm SaaS if scope expands) | Add `farmId` scope to AuditLog RLS; consider pg-boss for durable sync job queue; separate report generation to a worker |
| 50+ users | Not in scope for v1 |

**First bottleneck if scope expands:** Report generation — PDF rendering blocks the Node.js event loop for large reports. Move to a background job with polling or WebSocket notification before adding more farms.

---

## Sources

- CNH Developer Portal — FieldOps API: [https://develop.cnh.com/api-guides/fieldops-api](https://develop.cnh.com/api-guides/fieldops-api) (MEDIUM confidence — login required for full spec; surface confirmed)
- CNH Developer Portal — FieldOps Portals: [https://develop.cnh.com/get-started/fieldops-portals](https://develop.cnh.com/get-started/fieldops-portals) (HIGH confidence — staging/production URLs, availability warning confirmed)
- CNH Developer Portal — FieldOps API FAQs: [https://develop.cnh.com/troubleshooting/faq/field-ops-api](https://develop.cnh.com/troubleshooting/faq/field-ops-api) (HIGH confidence — rate limits: 120 req/s, token TTL: 3600s production confirmed)
- Existing codebase: `farm-budget/fieldops/client.js` — OAuth2 token flow, scopes, endpoint paths (HIGH confidence — actual working implementation)
- Existing codebase: `farm-budget/fieldops/sync.js` — Field matching logic, dedup, sync metadata pattern (HIGH confidence)
- Existing codebase: `farm-budget/fieldops/mock-data.js` — FieldOps API response shapes (HIGH confidence — mirrors real API responses)
- 7 CFR 205.103 — Recordkeeping by certified operations: [https://www.law.cornell.edu/cfr/text/7/205.103](https://www.law.cornell.edu/cfr/text/7/205.103) (HIGH confidence — primary regulation; 5-year record retention, audit trail requirement confirmed)
- USDA AMS Organic Records: [https://www.ams.usda.gov/services/organic-certification/organic-records](https://www.ams.usda.gov/services/organic-certification/organic-records) (HIGH confidence — official forms and documentation templates)
- PostgreSQL Row Level Security documentation: [https://www.postgresql.org/docs/current/ddl-rowsecurity.html](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) (HIGH confidence — RLS policy syntax confirmed)
- Tamper-evident audit log hash chain pattern: [https://www.designgurus.io/answers/detail/how-do-you-design-tamperevident-audit-logs-merkle-trees-hashing](https://www.designgurus.io/answers/detail/how-do-you-design-tamperevident-audit-logs-merkle-trees-hashing) (MEDIUM confidence — WebSearch, pattern is well-established industry practice)
- Prisma Row Level Security extensions: [https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security](https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security) (MEDIUM confidence — official Prisma GitHub)
- @react-pdf/renderer server-side rendering in Next.js: [https://github.com/diegomura/react-pdf/discussions/2402](https://github.com/diegomura/react-pdf/discussions/2402) (MEDIUM confidence — community discussion, renderToBuffer pattern confirmed)

---

*Architecture research for: Case IH Field Ops API integration + USDA NOP audit reporting on organic-cert Next.js app*
*Researched: 2026-02-23*
