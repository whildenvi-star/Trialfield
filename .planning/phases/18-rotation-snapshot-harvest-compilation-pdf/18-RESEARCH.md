# Phase 18: Rotation Snapshot & Harvest Compilation & PDF - Research

**Researched:** 2026-03-03
**Domain:** NOP rotation snapshot persistence, grain-tickets harvest compilation, @react-pdf/renderer null-safety
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Snapshot UX**
- "Take Snapshot" button lives on the compile page alongside other compilation actions (fields, enterprises, inputs, seeds)
- If a snapshot already exists for the crop year, show a confirmation dialog: "A snapshot already exists for [year]. Replace it?" — overwrite allowed
- Yellow warning banner at the top of the compile page when no snapshot exists for the current crop year: "No rotation snapshot for [year] — Take snapshot before generating PDF"
- After successful snapshot, show a green "Snapshot taken" status badge with field count (e.g., "42 fields snapshotted for 2025")

**Rotation History View**
- Table layout on the existing Fields page (tab or expandable section)
- Fields as rows, years as columns — easy to scan rotation across years for any field
- Each cell shows crop + acres (e.g., "Org SRWW — 120 ac")
- Years with no snapshot data show a dash "—" with a tooltip: "No snapshot for [year]"

**Harvest Compilation**
- Only compile deliveries for fields with organic enterprises in organic-cert (not all grain-ticket deliveries)
- Use the same normalizeCropName() pattern established in Phase 17 seed-mapper for crop name auto-matching
- Unmatched crops go to a review list in the preview
- Same preview/commit flow as Phase 16/17 compile operations — preview shows harvest events to be created with match status, user commits to write HarvestEvent records

**PDF Report**
- All 8 sections always render — sections with no compiled data show "No records for [section name]" placeholder text
- PDF generates even if some compilation steps haven't been run yet — allows incremental previewing
- Cover page shows: farm name, crop year, date generated, and a compile checklist showing which data sources were compiled (fields check, inputs check, seeds X, etc.)
- Refresh all 8 sections to pull from compiled ecosystem data (FieldEnterprise, MaterialUsage, SeedUsage, HarvestEvent) instead of old data paths — AND add null-safety throughout

### Claude's Discretion
- Exact table styling and column widths for rotation history
- How to handle split-field enterprises in rotation table cells (multiple crops per field-year)
- Harvest mapper internal implementation (batch size, transaction strategy)
- PDF section ordering and internal table formatting
- How normalizeCropName() handles edge cases in harvest matching beyond the Phase 17 patterns

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROT-01 | User can take a yearly rotation snapshot capturing field-crop-acre assignments from farm-budget | FieldEnterprise → FieldHistory upsert; POST /api/rotation-snapshot/[year]/take route pattern established |
| ROT-02 | Rotation snapshots accumulate to provide 3-year NOP field history | FieldHistory table has @@unique([fieldId, year]) — one snapshot per field per year survives seasonal rebuilds |
| ROT-03 | User sees a warning when no snapshot exists for the current crop year | Compile page already checks similar pre-conditions; add COUNT(FieldHistory WHERE year=cropYear) check |
| HRV-01 | User can compile harvest/delivery records from grain-tickets into organic-cert harvest events | getTicketsForCropYear() already exists in tickets-client.ts; needs harvest-mapper.ts + POST route |
| HRV-02 | Harvest compilation normalizes crop names between grain-tickets and organic-cert | normalizeCropName() from seed-mapper.ts is the established pattern — extend it for harvest side |
| PDF-01 | 8-section NOP inspection PDF renders correctly from compiled ecosystem data | report-assembler.ts already queries FieldEnterprise/MaterialUsage/HarvestEvent; cover page compile checklist addition |
| PDF-02 | PDF handles null/missing compiled data gracefully (no rendering artifacts) | All 8 sections need null-guard audit; empty-array fallbacks on assembler + "No records" placeholder in each section |
</phase_requirements>

---

## Summary

Phase 18 closes the v3.0 compilation loop by adding three capabilities to organic-cert: (1) rotation snapshots that write FieldEnterprise state into FieldHistory records annually, surviving farm-budget seasonal rebuilds; (2) a harvest-mapper that pulls grain-ticket delivery totals into HarvestEvent records for organic fields with crop-name normalization; and (3) null-safe PDF rendering across all 8 NOP sections with a cover page compile checklist.

All three capabilities build directly on patterns already proven in Phases 15-17. The FieldHistory Prisma model already exists with @@unique([fieldId, year]) — the snapshot operation is a bulk upsert of current FieldEnterprise rows into FieldHistory. The grain-tickets client (getTicketsForCropYear) already exists in tickets-client.ts and returns the needed TicketRecord shape. The PDF infrastructure (InspectionReport, report-assembler.ts, 8 section files) is fully in place; the work is adding empty-state guards and a cover page compile checklist.

The one dependency to audit before planning: FieldHistory rows for 2024 and 2025 must exist for 3-year history to be complete (STATE.md blocker). This is an empirical check at implementation time, not a blocker for planning.

**Primary recommendation:** Implement in three clean files: `snapshot-taker.ts` (pure function, reads FieldEnterprise, writes FieldHistory), `harvest-mapper.ts` (reads grain-tickets, returns HarvestPreviewRow[]), and a null-safety pass over all 8 PDF section files. Follow the exact preview/commit API shape established by inputs (POST body `{preview: boolean}`) and seeds routes.

---

## Standard Stack

### Core (zero new packages — constraint from STATE.md v3.0 decisions)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 6.x (organic-cert installed) | FieldHistory upsert, HarvestEvent create | Already installed; upsert pattern established in Phase 16 |
| @react-pdf/renderer | existing | PDF rendering | Already installed; all 8 section files in place |
| native fetch | Node built-in | grain-tickets HTTP client | getTicketsForCropYear() already uses fetchWithTimeout |
| date-fns | existing | Date formatting in PDF sections | Already used throughout PDF sections |
| React | 19 (Next.js 16 app) | PDF section components | All sections are React components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/server NextResponse | built-in | API route responses | All compile routes use it |
| Promise.allSettled | built-in | Parallel fetches with graceful degradation | Established ecosystem client pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma upsert for FieldHistory | deleteMany + createMany | Upsert is safer (preserves existing notes if snapshot is repeated) |
| Flat loop for HarvestEvent commit | prisma.$transaction | Transaction provides atomicity; use for commit step, not preview |

**Installation:** No new packages. Zero new npm packages is a locked project constraint.

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 18:
```
organic-cert/src/
├── lib/compile/
│   ├── snapshot-taker.ts        # new: reads FieldEnterprise, builds FieldHistory upsert payload
│   └── harvest-mapper.ts        # new: reads grain-tickets, returns HarvestPreviewRow[]
├── app/api/
│   ├── rotation-snapshot/
│   │   └── [year]/
│   │       ├── take/
│   │       │   └── route.ts     # new: POST /api/rotation-snapshot/[year]/take
│   │       └── status/
│   │           └── route.ts     # new: GET /api/rotation-snapshot/[year]/status
│   └── compile/
│       └── [year]/
│           └── harvest/
│               └── route.ts     # new: POST /api/compile/[year]/harvest  (preview+commit)
└── lib/pdf/sections/
    ├── cover-page.tsx            # modified: add compile checklist section
    ├── operation-overview.tsx    # modified: null-guard fields[], enterprises[]
    ├── field-list.tsx            # modified: null-guard fields[]
    ├── field-history.tsx         # modified: null-guard fields[], history[]
    ├── application-log.tsx       # modified: null-guard allApplications[]
    ├── harvest-log.tsx           # modified: null-guard allHarvests[]
    └── mass-balance.tsx          # modified: null-guard massBalance[]
```

### Pattern 1: Snapshot Taker — Read FieldEnterprise, Write FieldHistory

**What:** snapshot-taker.ts is a pure async function that reads all FieldEnterprise records for the given cropYear+farmId, builds FieldHistory upsert payloads, and returns a preview before any writes. The POST route calls it and commits on `preview: false`.

**When to use:** Triggered by "Take Snapshot" button on compile page. Overwrites existing FieldHistory for the same year (@@unique enforces one row per field per year).

**FieldHistory schema (confirmed in prisma/schema.prisma):**
```typescript
// FieldHistory has: fieldId, year, crop, coverCrop, organicStatus,
// yieldPerAcre, yieldUnit, substances, notes
// @@unique([fieldId, year]) — safe to upsert once per year

// snapshot-taker.ts pattern
export async function buildSnapshotPreview(farmId: string, cropYear: number) {
  const enterprises = await prisma.fieldEnterprise.findMany({
    where: { field: { farmId }, cropYear },
    include: { field: { select: { name: true, organicStatus: true } } },
  });

  // Group by fieldId — split fields produce one row per enterprise
  // For FieldHistory we want one row per field, so collapse to primary crop
  // (first non-fallow enterprise, or "FALLOW" if all are fallow)
  const byField = new Map<string, typeof enterprises[0][]>();
  for (const e of enterprises) {
    if (!byField.has(e.fieldId)) byField.set(e.fieldId, []);
    byField.get(e.fieldId)!.push(e);
  }

  const rows: SnapshotPreviewRow[] = [];
  for (const [fieldId, ents] of byField) {
    const primary = ents.find(e => !e.isFallow) ?? ents[0];
    const splitNote = ents.length > 1
      ? ents.map(e => `${e.crop} (${e.plantedAcres.toFixed(1)} ac)`).join(', ')
      : null;
    rows.push({
      fieldId,
      fieldName: primary.field.name,
      year: cropYear,
      crop: ents.length > 1
        ? ents.filter(e => !e.isFallow).map(e => e.crop).join(' / ')
        : primary.crop,
      organicStatus: primary.field.organicStatus,
      notes: splitNote,
      // existing FieldHistory for this field+year (to show update vs new)
      existing: null, // populated by caller after prisma.fieldHistory.findMany
    });
  }
  return rows;
}
```

**Upsert pattern (matches Phase 16 established approach):**
```typescript
// In the POST route commit path
await prisma.$transaction(
  rows.map(row =>
    prisma.fieldHistory.upsert({
      where: { fieldId_year: { fieldId: row.fieldId, year: cropYear } },
      create: {
        fieldId: row.fieldId,
        year: cropYear,
        crop: row.crop,
        organicStatus: row.organicStatus,
        notes: row.notes,
      },
      update: {
        crop: row.crop,
        organicStatus: row.organicStatus,
        notes: row.notes,
      },
    })
  )
);
```

### Pattern 2: Harvest Mapper — grain-tickets → HarvestEvent

**What:** harvest-mapper.ts reads grain-tickets via the existing getTicketsForCropYear() client, matches tickets to organic FieldEnterprise records using field name normalization, groups by field+crop, and returns HarvestPreviewRow[].

**Key constraint from STATE.md:** Harvest compilation may ship as a documented stub if grain-tickets field linkage is incomplete. In practice, tickets have a `farm` field (free-text field name) that must be matched against organic-cert Field names.

**Data shape from grain-tickets /api/tickets:**
```typescript
// Confirmed from tickets-client.ts TicketRecord:
interface TicketRecord {
  id: number;
  farm: string;       // free-text field name — must match organic-cert Field.name
  crop: string;       // grain-tickets crop name (e.g., "Org SRWW", "Hybrid Rye")
  netWeight: number;  // lbs
  cropYear: number;
  date: string;       // YYYY-MM-DD
  ticketNo: string;
}
```

**Harvest matching logic:**
1. Call `getTicketsForCropYear(cropYear)`
2. Get all organic FieldEnterprise records for the farm+year with their field names
3. For each ticket: match `ticket.farm` (case-insensitive) against Field.name and Field.farmBudgetFieldName
4. Normalize `ticket.crop` using `normalizeCropName()` from seed-mapper.ts
5. Also match normalized ticket crop against enterprise.crop (case-insensitive)
6. Unmatched tickets (no field match OR no crop match) go to `unmatched[]` in preview
7. Matched tickets are grouped by fieldEnterpriseId, summed for total netWeight

**HarvestPreviewRow type (to add to types.ts):**
```typescript
export interface HarvestPreviewRow {
  fieldName: string;
  fieldEnterpriseId: string;
  crop: string;                  // normalized from ticket.crop
  harvestDate: string;           // use last delivery date for the group
  totalLoads: number;
  totalNetWeight: number;        // sum of ticket netWeight (lbs)
  acresHarvested: number;        // from enterprise.plantedAcres
  matchMethod: 'name' | 'alias' | 'stored-mapping';
  action: 'new' | 'update' | 'unchanged';
  dataSource: 'SYNCED';
}

export interface HarvestUnmatchedRow {
  ticketFarm: string;
  ticketCrop: string;
  ticketCount: number;
  totalNetWeight: number;
  reason: 'no-field-match' | 'no-crop-match';
}

export interface HarvestCompileResult {
  preview: HarvestPreviewRow[];
  unmatched: HarvestUnmatchedRow[];
  summary: { new: number; update: number; unchanged: number; unmatched: number };
}
```

**HarvestEvent commit (single per field-enterprise per crop-year):**
```typescript
// In commit path: delete SYNCED HarvestEvents for these enterprises, then create new
await prisma.$transaction(async (tx) => {
  await tx.harvestEvent.deleteMany({
    where: {
      fieldEnterpriseId: { in: enterpriseIds },
      dataSource: 'SYNCED',
    },
  });
  await tx.harvestEvent.createMany({
    data: rows.map(row => ({
      fieldEnterpriseId: row.fieldEnterpriseId,
      harvestDate: new Date(row.harvestDate),
      acresHarvested: row.acresHarvested,
      netWeight: row.totalNetWeight,
      dataSource: 'SYNCED',
      notes: `Compiled from grain-tickets: ${row.totalLoads} loads`,
    })),
  });
});
```

### Pattern 3: PDF Null-Safety — Defensive Empty-State Guards

**What:** Each of the 8 PDF sections must handle empty/null data without crashing. The core issue is that `data.fields`, `data.allApplications`, `data.allHarvests`, `data.massBalance` may be empty arrays when compilation hasn't been run, and individual records may have null Date values, null strings, etc.

**Report assembler currently throws if farm not found:**
```typescript
// In report-assembler.ts line 208:
if (!farm) {
  throw new Error(`Farm not found: ${farmId}`);
}
```
This is correct — the PDF shouldn't generate without a farm. But within valid data, all array-typed fields are already returned as `[]` when empty (Prisma returns `[]` for empty relations). The null-safety issue is at the React component level where individual field properties may be null.

**Confirmed null-risk points in existing PDF sections:**
1. `cover-page.tsx`: `farm.logoPath` — already guarded with conditional render. `farm.certNumber ?? "N/A"` — already guarded.
2. `field-list.tsx`: `field.enterprises` filtered by cropYear — if empty, renders nothing. No explicit "No records" placeholder for empty fields array.
3. `field-history.tsx`: `yearEnterprises.length === 0` — already returns "No crop recorded" placeholder. This section is already null-safe.
4. `application-log.tsx`: Checks `currentYearHarvests.length === 0` (from harvest-log.tsx pattern) — need to verify application-log has same guard.
5. `harvest-log.tsx`: `currentYearHarvests.length === 0` — already returns "No harvest events recorded" placeholder. Already null-safe.
6. `mass-balance.tsx`: `massBalance.length === 0` — already returns "No harvest data available" placeholder. Already null-safe.
7. `operation-overview.tsx`: Accesses `data.fields` for stats — if empty, calculations produce 0, which renders fine.
8. `toc-page.tsx`: No data references — static content only.

**Sections needing audit/work:**
- `cover-page.tsx`: Add compile checklist (NEW work, not null-safety)
- `field-list.tsx`: Add explicit "No fields compiled" message when `data.fields.length === 0`
- `application-log.tsx`: Confirm empty-state guard exists (likely already present based on harvest-log pattern)
- `operation-overview.tsx`: Confirm stat calculations handle `data.fields = []` without NaN

**Cover page compile checklist (new addition per locked decision):**
The compile checklist needs to know which sections have been compiled. This requires passing compile status data to the cover page. Options:
1. Add compile status to `ReportData` (pass from report-assembler) — cleanest, assembler can compute counts
2. Pass as a separate prop — breaks existing `InspectionReport` signature

Recommendation: Add `compileStatus` to `ReportData` type in report-assembler.ts. The assembler already runs after all compilation; it can count records to derive status.

```typescript
// Add to ReportData in report-assembler.ts
export interface CompileChecklist {
  fields: boolean;       // any FieldEnterprise records for cropYear?
  enterprises: boolean;  // same as fields
  inputs: boolean;       // any SYNCED MaterialUsage for cropYear?
  seeds: boolean;        // any SYNCED SeedUsage for cropYear?
  harvest: boolean;      // any SYNCED HarvestEvent for cropYear?
  snapshot: boolean;     // any FieldHistory for cropYear?
}

export interface ReportData {
  // ... existing fields ...
  compileChecklist: CompileChecklist;  // new
}
```

The assembler can derive these counts from the already-fetched data without extra queries.

### Pattern 4: Rotation History Table on Fields Page

**What:** A table below the existing field cards on the Fields page showing all fields as rows and the last 3 years as columns. Each cell shows crop + acres from FieldHistory.

**API needed:** GET /api/rotation-snapshot — returns all FieldHistory grouped by field for the last N years.

```typescript
// GET /api/rotation-snapshot?years=3
// Returns: { fields: RotationRow[] }
interface RotationRow {
  fieldId: string;
  fieldName: string;
  history: Record<number, { crop: string; acres: number } | null>;
  // e.g. { 2025: { crop: "Org SRWW", acres: 120 }, 2024: { crop: "Corn", acres: 120 }, 2023: null }
}
```

The Fields page already loads all fields — this table can be a collapsible section or separate tab, fetched on demand.

**Split-field handling in rotation table:** When a field has multiple enterprises for a year (split field), the FieldHistory.crop field should contain the concatenated crops ("Corn / Org SRWW") and the cell shows this composite string. This is set at snapshot time by snapshot-taker.ts.

### Pattern 5: Compile Page Warning Banner

**What:** Yellow banner at top of compile page when no FieldHistory exists for the current cropYear.

**Implementation:** The compile page already fetches preview data from `/api/compile/[year]/preview`. The snapshot status can be returned alongside that data, OR fetched separately from GET /api/rotation-snapshot/[year]/status.

Recommendation: Separate lightweight GET /api/rotation-snapshot/[year]/status endpoint that returns `{ exists: boolean; fieldCount: number; takenAt: Date | null }`. The compile page fetches this in parallel with the enterprise preview.

### Anti-Patterns to Avoid

- **Writing FieldHistory from FieldEnterprise without checking organicStatus:** Snapshot should include ALL organic-cert Fields (ORGANIC, TRANSITIONAL, SPLIT), not just ORGANIC. NOP requires history for transitional fields too.
- **Grouping harvest tickets without de-duplicating by ticket number:** grain-tickets allows duplicate ticketNo values (known from schema design). Group by ticket.id (not ticketNo) when summing loads.
- **Treating ticket.farm as an exact match:** It is free-text; must use case-insensitive comparison and check both Field.name and Field.farmBudgetFieldName.
- **Crash on null Date in PDF:** `format(null, "MM/dd/yyyy")` crashes date-fns — always use `date ?? new Date()` or a null guard before calling format().
- **Skipping preview mode on harvest compile:** All other compile routes support `{ preview: boolean }` body — harvest must match this contract for the UI to use the established pattern.
- **Using migrate dev inside organic-cert:** Established pattern is manual SQL migration + migrate resolve --applied (Phase 16 decision). Phase 18 adds no schema changes, so no migration needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Crop name normalization | Custom regex per Phase 18 | normalizeCropName() from seed-mapper.ts | Already handles ORG/CONV/IRR prefixes; reuse |
| Field name matching | New matching logic | Same case-insensitive + farmBudgetFieldName lookup as Phase 16/17 | Already battle-tested in compile-engine.ts |
| Year-keyed history | Custom data structure | `Record<number, HistoryCell | null>` — plain object | Simple, JSON-serializable, no library needed |
| PDF table empty state | Custom crash handler | Existing pattern from harvest-log.tsx and mass-balance.tsx | Pattern already proven in 4 sections |
| Compile status check | New query logic | Count FieldEnterprise / MaterialUsage / SeedUsage / HarvestEvent by cropYear + dataSource | Prisma count() with existing relations |

**Key insight:** This phase is entirely about applying established patterns to new use cases. The snapshot operation is the same upsert pattern as Phase 16 enterprise compile. The harvest mapper is the same preview/commit pattern as Phase 17 input mapper. The PDF null-safety is applying the existing `mass-balance.tsx` empty-state pattern to the two sections that lack it.

---

## Common Pitfalls

### Pitfall 1: FieldHistory Unique Constraint Direction
**What goes wrong:** Trying to upsert with wrong compound key argument. The model has `@@unique([fieldId, year])` which Prisma names `fieldId_year`. Supplying the wrong key name in the `where` clause causes a runtime error.
**Why it happens:** Prisma compound unique name is auto-generated; developers assume `field_id_year` or similar.
**How to avoid:** Verify generated Prisma client type via `src/generated/prisma/models/FieldHistory.ts`.
**Warning signs:** TypeScript error on `prisma.fieldHistory.upsert({ where: { fieldId_year: ... } })`.

### Pitfall 2: Snapshot Capturing Fallow Enterprises as Blank History
**What goes wrong:** A field with only a fallow enterprise gets FieldHistory.crop = "FALLOW" instead of meaningful data. NOP expects crop rotation history, not placeholder values.
**Why it happens:** The snapshot loop processes every enterprise including fallow.
**How to avoid:** When all enterprises for a field are `isFallow=true`, set `crop` to "Fallow" explicitly as a meaningful string; otherwise filter out fallow and use non-fallow crops.
**Warning signs:** Rotation table shows "FALLOW" for fields that actually had crops (indicates enterprise tagging bug).

### Pitfall 3: HarvestEvent Duplicate on Re-Compile
**What goes wrong:** Re-running harvest compile without deleting existing SYNCED HarvestEvents creates duplicates under the same FieldEnterprise. HarvestEvent has no unique constraint (unlike MaterialUsage which is already controlled by delete+recreate).
**Why it happens:** HarvestEvent model has no compound unique index — only `@@index([fieldEnterpriseId, harvestDate])`.
**How to avoid:** Follow the exact delete+createMany pattern from input-mapper (Phase 17): `await tx.harvestEvent.deleteMany({ where: { fieldEnterpriseId: { in: enterpriseIds }, dataSource: 'SYNCED' } })` before creating new records.
**Warning signs:** PDF harvest log shows duplicate rows for the same field after second compile.

### Pitfall 4: PDF renderToBuffer Crash on Null Date
**What goes wrong:** `format(harvest.date, "MM/dd/yyyy")` throws when `harvest.date` is null (possible if a HarvestEvent was created with a null harvestDate via SYNCED path).
**Why it happens:** The schema has `harvestDate DateTime` (non-nullable), but TypeScript inference from prisma.fieldEnterprise include may type it as nullable depending on the query.
**How to avoid:** Add null guard: `harvest.harvestDate ? format(harvest.harvestDate, "MM/dd/yyyy") : "Unknown"`.
**Warning signs:** PDF generation throws "Invalid time value" error in renderToBuffer.

### Pitfall 5: Cover Page Checklist Query Cost
**What goes wrong:** Adding 6 COUNT queries to assembleReportData() significantly slows PDF generation, which is already slow due to renderToBuffer.
**Why it happens:** Wanting accurate checklist without careful query design.
**How to avoid:** Derive checklist from already-fetched data (count harvestEvents in the enterprise loop rather than a separate query); only use one extra COUNT for FieldHistory (snapshot status).
**Warning signs:** PDF generation response time exceeds 30 seconds.

### Pitfall 6: Rotation History Table Performance with 50+ Fields
**What goes wrong:** Fetching FieldHistory for 50+ fields across 3 years in the Fields page makes the page slow to load.
**Why it happens:** FieldHistory is fetched per field on page load.
**How to avoid:** Fetch rotation history on demand (collapsible section, fetched when expanded) not on initial Fields page load. The GET /api/rotation-snapshot endpoint should be called lazily.
**Warning signs:** Fields page load time doubles after implementing rotation table.

---

## Code Examples

### Rotation Snapshot API Route Pattern
```typescript
// POST /api/rotation-snapshot/[year]/take
// Body: { preview?: boolean }
// Mirrors the established compile route contract from Phase 16/17

export async function POST(
  request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  const { year: yearParam } = await params;
  const year = parseInt(yearParam, 10);

  const body = await request.json().catch(() => ({}));
  const previewMode = (body as { preview?: boolean }).preview !== false;

  const farm = await prisma.farm.findFirst();
  if (!farm) return NextResponse.json({ error: "No farm configured." }, { status: 400 });

  const rows = await buildSnapshotPreview(farm.id, year);

  if (previewMode) {
    return NextResponse.json({
      preview: rows,
      summary: { new: rows.filter(r => r.action === 'new').length,
                 update: rows.filter(r => r.action === 'update').length,
                 unchanged: rows.filter(r => r.action === 'unchanged').length },
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Commit: upsert FieldHistory for each row
  await prisma.$transaction(
    rows.map(row =>
      prisma.fieldHistory.upsert({
        where: { fieldId_year: { fieldId: row.fieldId, year } },
        create: { fieldId: row.fieldId, year, crop: row.crop,
                  organicStatus: row.organicStatus, notes: row.notes },
        update: { crop: row.crop, organicStatus: row.organicStatus, notes: row.notes },
      })
    )
  );

  return NextResponse.json({ committed: rows.length },
    { headers: { 'Cache-Control': 'no-store' } });
}
```

### Harvest Mapper — Crop Name Normalization for grain-tickets
```typescript
// harvest-mapper.ts
// grain-tickets crop names use formats like "Org SRWW", "Hybrid Rye",
// "Org Peas", "soybeans" — NOT the "ORG SRWW" format from farm-budget.
// normalizeCropName() from seed-mapper handles "ORG " prefix stripping.
// For grain-tickets we also need lowercase + title-case normalization.

import { normalizeCropName } from './seed-mapper';

function normalizeTicketCrop(ticketCrop: string): string {
  // "Org SRWW" -> normalizeCropName removes "Org " -> "SRWW"
  // "Hybrid Rye" -> no prefix, passthrough -> "Hybrid Rye"
  // "soybeans" -> passthrough -> "soybeans" (case-insensitive match at use site)
  return normalizeCropName(ticketCrop).trim();
}

function matchTicketToEnterprise(
  normalizedTicketCrop: string,
  enterprises: Array<{ crop: string; id: string }>
): string | null {
  const target = normalizedTicketCrop.toLowerCase();
  // Exact match first
  const exact = enterprises.find(e => e.crop.toLowerCase() === target);
  if (exact) return exact.id;
  // Partial match (ticket "SRWW" matches enterprise "Org SRWW" after normalization)
  const partial = enterprises.find(e =>
    normalizeCropName(e.crop).toLowerCase() === target
  );
  return partial?.id ?? null;
}
```

### PDF Empty State Placeholder Pattern
```typescript
// Standard pattern (already in harvest-log.tsx and mass-balance.tsx)
// Apply consistently to all 8 sections:

{data.allApplications.length === 0 ? (
  <Text style={emptyTextStyle}>
    No input applications recorded for crop year {data.cropYear}.
    Compile inputs from farm-budget to populate this section.
  </Text>
) : (
  /* table content */
)}
```

### Compile Checklist in Cover Page
```typescript
// In assembleReportData(), derive checklist from fetched data:
const compileChecklist: CompileChecklist = {
  fields: farm.fields.length > 0,
  enterprises: farm.fields.some(f => f.enterprises.some(e => e.cropYear === cropYear)),
  inputs: farm.fields.some(f =>
    f.enterprises.some(e =>
      e.cropYear === cropYear && e.materialUsages.length > 0
    )
  ),
  seeds: false, // derive similarly from seedUsages if included in query
  harvest: farm.fields.some(f =>
    f.enterprises.some(e =>
      e.cropYear === cropYear && e.harvestEvents.some(h => h.dataSource === 'SYNCED')
    )
  ),
  snapshot: false, // add COUNT(FieldHistory WHERE year=cropYear) query
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual FieldHistory entry | Compiled from FieldEnterprise snapshot | Phase 18 | Eliminates manual data entry; survives seasonal farm-budget rebuilds |
| Report assembler throws on empty data | Assembler returns empty arrays; PDF sections render "No records" | Phase 18 | PDF generates at any point in compilation cycle |
| Cover page: farm info only | Cover page: farm info + compile checklist | Phase 18 | Inspector immediately sees data completeness before reading sections |
| HarvestEvent: manual entry only | HarvestEvent: compiled from grain-tickets (SYNCED) + manual | Phase 18 | Eliminates double-entry for organic deliveries |

**Deprecated/outdated:**
- Old `sync-macro` FieldHistory path: The existing Fields page has a "Sync from Macro" button that called `/api/fields/sync-macro`. This wrote FieldHistory via a different path. Phase 18 snapshot replaces that for annual rotation records — they coexist but snapshot is the canonical path for NOP 3-year history.

---

## Open Questions

1. **Prior-year FieldHistory data (2024, 2025)**
   - What we know: STATE.md flags "FieldHistory table must have records for 2024 and 2025 for NOP 3-year history to be complete."
   - What's unclear: Whether any FieldHistory rows exist yet for 2024/2025, and whether farm-budget still has 2024/2025 enterprise data to snapshot from.
   - Recommendation: Plan 18-01 must include an empirical check step: `prisma.fieldHistory.count()` before implementation begins. If zero rows exist for prior years, document this as a known gap (prior years can only be added manually if farm-budget no longer has that data).

2. **grain-tickets ticket.farm field format**
   - What we know: TicketRecord.farm is a free-text string entered at ticket creation time. The existing ticket data has field names like farm names, not necessarily matching organic-cert Field.name.
   - What's unclear: Whether the 2025 grain-tickets data uses organic-cert Field names or different naming conventions.
   - Recommendation: Plan 18-02 must include an empirical audit step — run getTicketsForCropYear(2025) and compare ticket.farm values against organic-cert Field names before writing the matching logic. If field names don't align, the harvest mapper may need to fall back to crop-only matching (skip field match, group by crop only).

3. **dataSource: 'SYNCED' on HarvestEvent — schema check**
   - What we know: HarvestEvent has `dataSource DataSource @default(MANUAL)` and `DataSource` enum has `MANUAL` and `SYNCED`.
   - What's unclear: Whether the HarvestEvent route that already exists (POST /api/field-enterprises/[id]/harvest) will conflict with SYNCED harvest events on the same enterprise.
   - Recommendation: SYNCED HarvestEvents are controlled entirely by the compile route (delete+create). Manual HarvestEvents (dataSource=MANUAL) are never touched by compilation. The delete query `WHERE dataSource='SYNCED'` is safe.

---

## Validation Architecture

> Nyquist validation is not enabled in .planning/config.json (workflow.nyquist_validation is absent/false). Skipping this section.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `/organic-cert/prisma/schema.prisma` — FieldHistory, FieldEnterprise, HarvestEvent models confirmed; @@unique constraints verified
- Codebase: `/organic-cert/src/lib/compile/seed-mapper.ts` — normalizeCropName() implementation confirmed; can be imported directly
- Codebase: `/organic-cert/src/lib/ecosystem/tickets-client.ts` — getTicketsForCropYear() confirmed; TicketRecord shape confirmed
- Codebase: `/organic-cert/src/app/api/compile/[year]/inputs/route.ts` — preview/commit contract confirmed (body `{preview?: boolean}`, delete+createMany pattern)
- Codebase: `/organic-cert/src/app/api/compile/[year]/seeds/route.ts` — upsert + delete+createMany pattern confirmed
- Codebase: `/organic-cert/src/lib/pdf/inspection-report.tsx` — 8 section imports confirmed; Document structure confirmed
- Codebase: `/organic-cert/src/lib/report-assembler.ts` — assembleReportData() structure confirmed; null-risk points mapped
- Codebase: `/organic-cert/src/lib/pdf/sections/harvest-log.tsx` — empty-state pattern confirmed (reference implementation)
- Codebase: `/organic-cert/src/lib/pdf/sections/mass-balance.tsx` — empty-state pattern confirmed (reference implementation)
- Codebase: `/organic-cert/src/lib/pdf/sections/field-history.tsx` — already null-safe; confirmed

### Secondary (MEDIUM confidence)
- STATE.md decisions — v3.0 architectural decisions (leech pattern, zero new packages, preview/commit contract, harvest dependency note) — documented from prior sessions
- REQUIREMENTS.md — ROT-01..03, HRV-01..02, PDF-01..02 requirements text confirmed

### Tertiary (LOW confidence)
- STATE.md blocker: "Prior-year history: FieldHistory table must have records for 2024 and 2025" — flagged as empirical check needed at implementation time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, all existing libraries verified in codebase
- Architecture: HIGH — all patterns directly derived from Phase 16/17 existing code, confirmed in codebase
- Pitfalls: HIGH — derived from actual schema constraints and existing code patterns, not speculation
- Open questions: MEDIUM — the two open questions (prior-year data, ticket.farm naming) are empirical gaps that require running the apps, not researchable from code alone

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable stack, 30-day window)
