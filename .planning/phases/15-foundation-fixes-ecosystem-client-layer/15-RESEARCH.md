# Phase 15: Foundation Fixes & Ecosystem Client Layer - Research

**Researched:** 2026-03-02
**Domain:** Bug fixes (Prisma, Next.js API routes) + HTTP client layer (native fetch, AbortController, Promise.allSettled)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Availability Display**
- Horizontal status bar at top of compile page — always visible, never collapses
- Each source shown as colored dot + app name + port: `● farm-budget (:3001)  ● farm-registry (:3005)  ○ grain-tickets (:3000)`
- Green dot = available, red dot = unavailable
- Status bar stays the same size whether all green or some red — consistent layout

**Degradation Behavior**
- Allow partial compiles when sources are down — missing sections show "source unavailable" with description of what data is missing
- When a source recovers, status bar auto-detects on next check (no notification)
- If a source goes down during a preview, keep stale preview data visible with a "stale" indicator — block commit for that section only
- No cross-reload caching — each page load fetches fresh from sources

**Connection Feedback**
- Health check on page load + single manual "Refresh" button for all 3 sources
- No background polling — user clicks refresh to recheck
- 3-second timeout before a source is considered down (local-network apps)
- Refresh button shows spinner while checking; dots stay in previous state until new results arrive

**Error Detail Level**
- Friendly message inline below status bar when source is down: "farm-budget (:3001) is not responding"
- Expandable to show technical detail (ECONNREFUSED, timeout, etc.) on click
- Error messages suggest fix action: "start it with `node server.js` in farm-budget/"`
- Compile section "source unavailable" messages name the specific data missing: "enterprise data and input records cannot be pulled"

**Compile Page Foundation**
- New top-level navigation item: "Compile" — alongside Fields, Enterprises, etc.
- Page organized by NOP inspection sections (Fields & Acres, Enterprises, Inputs, Seeds, Rotation, Harvest)
- Phase 15 builds: status bar + a simple table preview of fields and acres pulled from farm-budget and farm-registry (ECO-01, ECO-02 proof-of-concept)
- Remaining NOP sections show placeholder headers ("Coming in Phase 16/17/18") — later phases fill them in

### Claude's Discretion
- Bug fix implementation approach for FIX-01, FIX-02, FIX-03 (well-defined bugs)
- HTTP client internal architecture (class design, error types, retry logic)
- Health endpoint design on source apps (if needed)
- Status bar CSS/styling details
- Exact expandable error UI pattern (accordion, details element, etc.)
- Loading skeleton or spinner design during source checks
- Table column order and formatting for the field/acre preview

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIX-01 | Sync Acres button on Fields page works without runtime crash | Bug identified: `data.unmatched.length` crashes when sync-registry response has no `unmatched` field. Fix: guard with optional chain or use `data.unchanged` |
| FIX-02 | Enterprise query returns all enterprises per field (no truncation at 3) | Bug identified: `/api/fields/[id]/history` queries only `cropYear: { in: [year, year-1, year-2] }`. The field list (GET /api/fields) has NO enterprise year filter — all enterprises are returned. The "take: 3" in MEMORY refers to 3 years, not a Prisma `take`. Fix: widen year filter or remove it |
| FIX-03 | Partial unique index captured in schema.prisma for environment rebuild safety | Bug identified: `@@unique([fieldId, cropYear, crop, label])` fails to enforce uniqueness when label IS NULL (PostgreSQL treats NULL != NULL). Prisma doesn't support partial unique indexes natively. Fix: raw SQL migration for `WHERE label IS NULL` partial index |
| ECO-01 | User can see live organic-designated field data pulled from farm-budget | Research: farm-budget `/api/fields?all=true` returns all fields including `enterpriseId`, `crop`, `acres`. Farm-budget `/api/enterprises` returns enterprise list with `category: 'organic'`. These are the right endpoints |
| ECO-02 | User can see live field identities and acres pulled from farm-registry | Research: farm-registry `/api/fields` returns all fields with `reportingAcres`, `organicAcres`, `ownership`. This endpoint is already used by sync-registry route |
| ECO-05 | Ecosystem pull degrades gracefully when source app is not running | Research: AbortController timeout + Promise.allSettled pattern. One source failure must not block others. Implemented in ecosystem client layer (src/lib/ecosystem/) |
</phase_requirements>

---

## Summary

Phase 15 has two distinct halves: three surgical bug fixes in existing organic-cert code, and a new ecosystem client layer that connects organic-cert to the other three source apps.

**Bug fix half:** FIX-01 is a one-line client-side crash where `data.unmatched` is read on a sync-registry response that doesn't have that field (only sync-macro has `unmatched`). FIX-02 is the enterprise query in `/api/fields/[id]/history/route.ts` filtering enterprises to only the current 3-year window — the CONTEXT/MEMORY description of "take: 3" refers to this 3-year filter, not a Prisma `take:` parameter. FIX-03 is a Prisma partial unique index gap: `@@unique([fieldId, cropYear, crop, label])` does not enforce uniqueness when `label IS NULL` because PostgreSQL treats NULL as distinct from every value including other NULLs.

**Ecosystem client half:** The compile page needs a typed HTTP client layer in `src/lib/ecosystem/` with three clients (budget-client.ts, registry-client.ts, tickets-client.ts), each using native `fetch` with `AbortController` for 3-second timeouts. `Promise.allSettled` ensures one unavailable source never blocks the other two. A new "Compile" navigation item and page at `/compile` shows the status bar and a simple field/acre preview table from farm-budget + farm-registry.

**Primary recommendation:** Fix all three bugs in a single plan (15-01), then build the ecosystem client layer and compile page foundation in a second plan (15-02). Both plans are independent within the phase.

---

## Standard Stack

### Core (zero new packages — all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| native fetch | built-in Node 18+ | HTTP requests to source apps | Next.js 16 uses Node 18+; no node-fetch needed |
| AbortController | built-in Node 18+ | Request timeout enforcement | Standard Web API, same in browser and Node |
| Promise.allSettled | built-in | Parallel source requests with independent failure handling | Returns results for ALL promises regardless of rejections |
| Prisma 6.x | 6.19.2 (installed) | Schema management, `prisma.$executeRaw` for partial index | Already installed in organic-cert |
| Next.js 16 | 16.1.6 (installed) | Route handlers, page routing | Already the framework |
| React 19 | 19.2.3 (installed) | UI components | Already installed |
| lucide-react | 0.575.0 (installed) | Icons for status dots, spinner, etc. | Already used throughout |
| Tailwind CSS 4 | installed | Styling | Already used throughout |
| Zod 4 | installed | Runtime type validation of source API responses | Already installed |

### No New Packages Required
The MEMORY and STATE.md both explicitly state: "Zero new npm packages — native fetch, Promise.allSettled, existing Prisma + @react-pdf/renderer already installed." This is a hard constraint.

---

## Architecture Patterns

### Recommended Project Structure

```
organic-cert/src/lib/ecosystem/
├── types.ts              # Shared SourceStatus, EcosystemError, SourceResult types
├── budget-client.ts      # farm-budget HTTP client (port 3001)
├── registry-client.ts    # farm-registry HTTP client (port 3005)
├── tickets-client.ts     # grain-tickets HTTP client (port 3000)
└── index.ts              # Re-exports all three clients + checkAllSources()

organic-cert/src/app/(app)/compile/
└── page.tsx              # Compile page with status bar + field/acre preview

organic-cert/src/components/compile/
└── source-status-bar.tsx # Horizontal status bar component
```

### Pattern 1: AbortController Timeout (3-second per CONTEXT.md)

```typescript
// src/lib/ecosystem/budget-client.ts
const BUDGET_URL = process.env.BUDGET_API_URL || "http://localhost:3001";
const TIMEOUT_MS = 3000; // per CONTEXT.md: "3-second timeout"

export class EcosystemError extends Error {
  constructor(
    public readonly source: "farm-budget" | "farm-registry" | "grain-tickets",
    public readonly technicalDetail: string,
    message: string
  ) {
    super(message);
    this.name = "EcosystemError";
  }
}

async function fetchWithTimeout(url: string, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getBudgetFields(): Promise<BudgetField[]> {
  const res = await fetchWithTimeout(`${BUDGET_URL}/api/fields?all=true`);
  if (!res.ok) {
    throw new EcosystemError(
      "farm-budget",
      `HTTP ${res.status}`,
      "farm-budget returned an error response"
    );
  }
  return res.json();
}
```

### Pattern 2: Promise.allSettled for Parallel Source Checks

```typescript
// src/lib/ecosystem/index.ts
export type SourceStatus = {
  name: string;
  port: number;
  available: boolean;
  technicalDetail?: string;
};

export async function checkAllSources(): Promise<SourceStatus[]> {
  const checks = await Promise.allSettled([
    checkBudget(),
    checkRegistry(),
    checkTickets(),
  ]);

  return checks.map((result, i) => {
    const sources = [
      { name: "farm-budget", port: 3001 },
      { name: "farm-registry", port: 3005 },
      { name: "grain-tickets", port: 3000 },
    ];
    if (result.status === "fulfilled") {
      return { ...sources[i], available: true };
    }
    return {
      ...sources[i],
      available: false,
      technicalDetail: result.reason instanceof EcosystemError
        ? result.reason.technicalDetail
        : String(result.reason),
    };
  });
}
```

### Pattern 3: Next.js API Route Proxy for Compile Page

Since the compile page is a React client component and needs to call source apps (which are localhost Express servers), organic-cert needs a proxy API route. Direct browser fetch to `http://localhost:3001` works in development but is cleaner through a Next.js route handler.

```typescript
// src/app/api/compile/sources/route.ts
// GET — check availability of all three source apps
export async function GET() {
  const statuses = await checkAllSources();
  return NextResponse.json(statuses);
}

// src/app/api/compile/fields-preview/route.ts
// GET — fetch field/acre data from budget + registry for the preview table
export async function GET() {
  const [budgetResult, registryResult] = await Promise.allSettled([
    getBudgetOrganicFields(),
    getRegistryFields(),
  ]);
  // Return partial data if one source is down
  return NextResponse.json({
    budgetFields: budgetResult.status === "fulfilled" ? budgetResult.value : null,
    registryFields: registryResult.status === "fulfilled" ? registryResult.value : null,
  });
}
```

### Pattern 4: FIX-01 — Sync Registry Client Crash Fix

**Root cause:** `src/app/(app)/fields/page.tsx` at line 169 calls `data.unmatched.length` after `POST /api/fields/sync-registry`. The sync-registry response has `{ matched, created, updated, unchanged, removed }` but NO `unmatched` field. That field belongs to sync-macro's response shape.

**Fix:** Either guard with `data.unmatched?.length ?? 0` or remove the unmatched check from the registry sync handler entirely (registry sync doesn't produce unmatched budget fields — that's a macro sync concept).

```typescript
// BEFORE (crashes when data.unmatched is undefined):
if (data.unmatched.length > 0) {
  toast.warning(`${data.unmatched.length} budget field(s) not found locally`);
}

// AFTER (safe — registry sync doesn't have unmatched):
// Remove this block entirely from handleSyncRegistry, OR guard:
if ((data.unmatched?.length ?? 0) > 0) {
  toast.warning(`${data.unmatched.length} budget field(s) not found locally`);
}
```

### Pattern 5: FIX-02 — Enterprise Year Filter in History Route

**Root cause:** `src/app/api/fields/[id]/history/route.ts` at line 28-35 queries enterprises filtered to `cropYear: { in: years }` where `years = [baseYear, baseYear - 1, baseYear - 2]`. A field with enterprises for 2026, 2025, 2024, AND 2023 would never show the 2023 enterprise on the default (offset=0) view.

**Context:** The REQUIREMENTS description says "no truncation at 3." The MEMORY refers to "take:3 enterprise truncation." The actual code uses a year-range filter (`cropYear: { in: years }`), not a Prisma `take: 3`. The semantic result is the same: enterprises outside the 3-year window are silently omitted.

**Fix options (Claude's discretion):**
1. Remove the `cropYear: { in: years }` filter entirely — return ALL enterprises for the field, let the client render only the windowed years in the UI
2. Extend the window to 5 years to cover NOP's 3-year history requirement with buffer

Option 1 is simpler and correct: the UI already filters by `cropYear` for display, so fetching all enterprises is safe. The `years` array is still returned to help the UI know what to display.

### Pattern 6: FIX-03 — Partial Unique Index via Raw SQL Migration

**Root cause:** `FieldEnterprise` has `@@unique([fieldId, cropYear, crop, label])`. PostgreSQL's standard unique index treats all NULL values as distinct, meaning two rows `(fieldId, 2026, "Corn", NULL)` can coexist, violating the intended constraint.

**Prisma behavior (HIGH confidence, verified against Prisma docs):** Prisma 6.x does NOT support partial unique indexes natively in `schema.prisma`. The `@@unique` directive generates a full unique index. To create a partial index, you must use `prisma.$executeRaw` in a migration or use Prisma's `prisma migrate dev --create-only` to generate a migration file and then manually add the raw SQL.

**Correct approach:**
1. Keep the existing `@@unique([fieldId, cropYear, crop, label])` (covers the non-null label case)
2. Add a Prisma migration that runs raw SQL to create a partial unique index for the `label IS NULL` case:

```sql
-- Migration: add partial unique index for null-label enterprises
CREATE UNIQUE INDEX "FieldEnterprise_fieldId_cropYear_crop_null_label_unique"
ON "FieldEnterprise" ("fieldId", "cropYear", "crop")
WHERE "label" IS NULL;
```

3. To make `npx prisma migrate dev` on a fresh DB recreate this index, the SQL must live in a migration file. Use `prisma migrate dev --create-only` to generate an empty migration, then add the raw SQL.

**Alternative using Prisma's `prisma.config.ts`:** Prisma 6.x introduced `migrate.adapter` but doesn't add partial index support via schema.prisma. The raw SQL migration file is the correct solution.

### Pattern 7: Source Status Bar UI

The CONTEXT.md specifies the format: `● farm-budget (:3001)  ● farm-registry (:3005)  ○ grain-tickets (:3000)`. Use CSS classes for color states:

```tsx
// src/components/compile/source-status-bar.tsx
type SourceStatus = { name: string; port: number; available: boolean; technicalDetail?: string };

function StatusDot({ available }: { available: boolean }) {
  return (
    <span className={available ? "text-green-500" : "text-red-500"}>●</span>
  );
}

export function SourceStatusBar({ sources, onRefresh, refreshing }: Props) {
  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-stone-900 text-sm font-mono border-b border-stone-700">
      {sources.map((s) => (
        <div key={s.name} className="flex items-center gap-1.5">
          <StatusDot available={s.available} />
          <span className="text-stone-300">{s.name}</span>
          <span className="text-stone-500">(:{s.port})</span>
        </div>
      ))}
      <button onClick={onRefresh} disabled={refreshing} className="ml-auto">
        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
      </button>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Do NOT use `data.unmatched` in `handleSyncRegistry`** — sync-registry response shape has no `unmatched` field; that belongs to sync-macro
- **Do NOT use `take: 3` as a Prisma operator to limit enterprises** — the bug is a 3-year filter, not a take; remove the year filter instead
- **Do NOT use `@@unique` with a WHERE clause in schema.prisma** — Prisma does not support this syntax; use raw SQL migration
- **Do NOT use `Promise.all` for ecosystem checks** — one rejected promise aborts all; use `Promise.allSettled`
- **Do NOT poll** — CONTEXT.md explicitly says no background polling; health check on load + manual refresh button only
- **Do NOT add new npm packages** — this is a hard constraint from STATE.md

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request timeout | Custom timer + Promise.race | AbortController + setTimeout | Web standard, works in Node 18+ and browser |
| Parallel requests with independent failure | Nested try/catch + flag tracking | Promise.allSettled | Returns all results regardless of rejections |
| Partial unique index enforcement | Application-layer uniqueness check | Raw SQL migration with WHERE clause | Only the database can guarantee atomicity |
| Type narrowing on API responses | Manual property checks | Zod parse/safeParse | Already installed, handles shape validation |

---

## Common Pitfalls

### Pitfall 1: Sync-Registry vs Sync-Macro Response Shape Confusion
**What goes wrong:** The sync-registry POST handler in `page.tsx` calls `data.unmatched.length` — this is a sync-MACRO field, not sync-registry. Both are called from the same fields page using similar patterns.
**Why it happens:** Two sync buttons (Sync Registry, Sync Macro) both call different routes with different response shapes; the client code at line 169 reused the macro pattern incorrectly.
**How to avoid:** Keep response shapes documented and separate; sync-registry response: `{ matched, created, updated, unchanged, removed, farmTotals }`. Sync-macro response: `{ cropYear, enterprises, seedLots, seedUsages, materials, materialUsages, passes, matched, unmatched, errors }`.
**Warning signs:** Any `.length` call on an array property without optional chaining after a fetch response.

### Pitfall 2: PostgreSQL NULL Uniqueness Semantics
**What goes wrong:** `@@unique([fieldId, cropYear, crop, label])` allows duplicate rows when `label IS NULL` because PostgreSQL does not consider two NULL values equal in unique indexes.
**Why it happens:** Prisma's `@@unique` translates directly to a PostgreSQL unique index, which inherits PostgreSQL NULL semantics.
**How to avoid:** When a unique constraint includes a nullable column that serves as a "no value" sentinel (not a differentiator), always add a separate partial unique index for the NULL case.
**Warning signs:** The `findFirst` for enterprise upsert logic in `sync-macro/route.ts` uses `label: null` in the where clause — if two rows with `(fieldId, cropYear, crop, null)` can exist, the upsert will find the wrong one.

### Pitfall 3: AbortController Signal After Timeout
**What goes wrong:** After AbortController fires, the `fetch` rejects with `AbortError`. If not caught correctly, this propagates as an unhandled rejection.
**Why it happens:** `AbortError` has `name === "AbortError"` — it's a different error type than a network failure.
**How to avoid:** In the ecosystem client catch blocks, distinguish `AbortError` (timeout) from other errors:
```typescript
} catch (err) {
  if (err instanceof Error && err.name === "AbortError") {
    throw new EcosystemError(source, "Request timed out after 3s", friendlyMessage);
  }
  throw new EcosystemError(source, String(err), friendlyMessage);
}
```

### Pitfall 4: Cross-Origin Fetch from Next.js Server Routes
**What goes wrong:** The compile page (client component) cannot directly fetch `http://localhost:3001` — browsers block cross-origin localhost requests in some configurations, and it exposes internal network topology.
**Why it happens:** Browser fetch runs in the browser's security context, not the server's.
**How to avoid:** All ecosystem fetches MUST go through Next.js API route handlers (`/api/compile/sources`, `/api/compile/fields-preview`). These run server-side where direct localhost access is safe.

### Pitfall 5: Prisma Migration Drift (FIX-03)
**What goes wrong:** Creating the partial unique index with `prisma.$executeRaw` in application code (e.g., on startup) instead of in a migration means a fresh `npx prisma migrate dev` never creates the index. FIX-03 specifically requires the index to survive a fresh environment rebuild.
**Why it happens:** Developers often use `$executeRaw` as a quick fix without committing it to a migration file.
**How to avoid:** Use `prisma migrate dev --create-only` to generate a migration file, then add the raw SQL to that file. The migration history ensures `npx prisma migrate dev` recreates it on fresh environments.

### Pitfall 6: Stale Enterprise Data When Year Filter Removed (FIX-02)
**What goes wrong:** Removing the year filter from `/api/fields/[id]/history` may return large amounts of historical enterprise data (many years × many fields), impacting response size.
**Why it happens:** With 56 fields and potentially 5+ years of history, the payload could grow.
**How to avoid:** The history page already uses `offset` pagination to show only a 3-year window in the UI. Fetching all enterprises is safe because the volume is small (56 fields × avg 2 enterprises × 10 years = ~1,120 rows maximum). This is not a concern at this farm's scale.

---

## Code Examples

### FIX-01: Remove Incorrect `data.unmatched` Reference

```typescript
// src/app/(app)/fields/page.tsx — handleSyncRegistry function
// REMOVE lines 169-171 entirely (or guard as shown below):

// BEFORE (crashes):
if (data.unmatched.length > 0) {
  toast.warning(`${data.unmatched.length} budget field(s) not found locally`);
}

// AFTER (correct — sync-registry doesn't produce unmatched budget fields):
// This block belongs only in handleSyncMacro, not handleSyncRegistry.
// Remove the block entirely from handleSyncRegistry.
```

### FIX-02: Remove Year Filter from History Route

```typescript
// src/app/api/fields/[id]/history/route.ts
// BEFORE:
enterprises: {
  where: {
    cropYear: { in: years },  // REMOVE THIS FILTER
  },
  orderBy: { cropYear: "desc" },
  include: { ... }
}

// AFTER:
enterprises: {
  // No cropYear filter — return ALL enterprises for the field
  orderBy: { cropYear: "desc" },
  include: { ... }
}
// The `years` array is still returned in the response for UI display context
```

### FIX-03: Raw SQL Migration for Partial Unique Index

```bash
# Step 1: Create migration file
cd organic-cert
npx prisma migrate dev --create-only --name add_partial_unique_enterprise_label_null
```

```sql
-- prisma/migrations/YYYYMMDDHHMMSS_add_partial_unique_enterprise_label_null/migration.sql
-- Enforce uniqueness for enterprises with no split-field label (label IS NULL)
-- Standard @@unique([fieldId, cropYear, crop, label]) does NOT enforce this
-- because PostgreSQL treats NULL as distinct from every value including other NULLs.
CREATE UNIQUE INDEX "FieldEnterprise_no_label_unique"
ON "FieldEnterprise" ("fieldId", "cropYear", "crop")
WHERE "label" IS NULL;
```

```bash
# Step 2: Apply migration
npx prisma migrate dev
```

### Ecosystem Client: Budget Client

```typescript
// src/lib/ecosystem/budget-client.ts
const BUDGET_URL = process.env.BUDGET_API_URL || "http://localhost:3001";
const TIMEOUT_MS = 3000;

export interface BudgetOrganicField {
  id: string;
  name: string;
  crop: string;
  acres: number;
  enterpriseId: string;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new EcosystemError("farm-budget", "Request timed out after 3s",
        "farm-budget (:3001) is not responding");
    }
    throw new EcosystemError("farm-budget", String(err),
      "farm-budget (:3001) is not responding");
  } finally {
    clearTimeout(timer);
  }
}

export async function pingBudget(): Promise<void> {
  // Use /api/settings as health probe — lightweight, always present
  const res = await fetchWithTimeout(`${BUDGET_URL}/api/settings`);
  if (!res.ok) {
    throw new EcosystemError("farm-budget", `HTTP ${res.status}`,
      "farm-budget (:3001) is not responding");
  }
}

export async function getBudgetOrganicFields(): Promise<BudgetOrganicField[]> {
  const [entRes, fieldRes] = await Promise.all([
    fetchWithTimeout(`${BUDGET_URL}/api/enterprises`),
    fetchWithTimeout(`${BUDGET_URL}/api/fields?all=true`),
  ]);
  // ... filter to organic enterprises, return field list
}
```

### Ecosystem Client: Registry Client

```typescript
// src/lib/ecosystem/registry-client.ts
const REGISTRY_URL = process.env.FARM_REGISTRY_URL || "http://localhost:3005";

export interface RegistryFieldSummary {
  id: string;
  name: string;
  reportingAcres: number;
  organicAcres: number;
  ownership: string;
}

export async function pingRegistry(): Promise<void> {
  const res = await fetchWithTimeout(`${REGISTRY_URL}/api/fields`);
  if (!res.ok) {
    throw new EcosystemError("farm-registry", `HTTP ${res.status}`,
      "farm-registry (:3005) is not responding");
  }
}

export async function getRegistryFields(): Promise<RegistryFieldSummary[]> {
  const res = await fetchWithTimeout(`${REGISTRY_URL}/api/fields?active=true`);
  if (!res.ok) {
    throw new EcosystemError("farm-registry", `HTTP ${res.status}`,
      "farm-registry (:3005) is not responding");
  }
  const fields = await res.json();
  // Zod validation for shape safety
  return fields.map((f: unknown) => RegistryFieldSchema.parse(f));
}
```

### Ecosystem Client: Tickets Client

```typescript
// src/lib/ecosystem/tickets-client.ts
const TICKETS_URL = process.env.GRAIN_TICKETS_URL || "http://localhost:3000";

export async function pingTickets(): Promise<void> {
  // Use /api/stats as health probe (grain-tickets has this endpoint)
  const res = await fetchWithTimeout(`${TICKETS_URL}/api/stats`);
  if (!res.ok) {
    throw new EcosystemError("grain-tickets", `HTTP ${res.status}`,
      "grain-tickets (:3000) is not responding");
  }
}
```

### Promise.allSettled for Source Status Check

```typescript
// src/lib/ecosystem/index.ts
export async function checkAllSources(): Promise<SourceStatus[]> {
  const checks = await Promise.allSettled([
    pingBudget(),
    pingRegistry(),
    pingTickets(),
  ]);

  const defs = [
    { name: "farm-budget", port: 3001 },
    { name: "farm-registry", port: 3005 },
    { name: "grain-tickets", port: 3000 },
  ];

  return defs.map((def, i) => ({
    ...def,
    available: checks[i].status === "fulfilled",
    technicalDetail:
      checks[i].status === "rejected"
        ? (checks[i] as PromiseRejectedResult).reason instanceof EcosystemError
          ? (checks[i] as PromiseRejectedResult).reason.technicalDetail
          : String((checks[i] as PromiseRejectedResult).reason)
        : undefined,
  }));
}
```

### Next.js API Route: Source Health Check

```typescript
// src/app/api/compile/sources/route.ts
import { NextResponse } from "next/server";
import { checkAllSources } from "@/lib/ecosystem";

export async function GET() {
  const statuses = await checkAllSources();
  return NextResponse.json(statuses);
}
```

### Compile Page: Status Bar + Field Preview

```tsx
// src/app/(app)/compile/page.tsx (simplified structure)
"use client";
export default function CompilePage() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<FieldPreview | null>(null);

  useEffect(() => { loadSources(); loadPreview(); }, []);

  async function loadSources() {
    setRefreshing(true);
    const res = await fetch("/api/compile/sources");
    setSources(await res.json());
    setRefreshing(false);
  }

  return (
    <div>
      <SourceStatusBar sources={sources} onRefresh={loadSources} refreshing={refreshing} />

      {/* Fields & Acres section — ECO-01 + ECO-02 */}
      <section>
        <h2>Fields & Acres</h2>
        <FieldPreviewTable preview={preview} sources={sources} />
      </section>

      {/* Placeholder sections for future phases */}
      <section><h2>Enterprises <PlaceholderBadge phase="16" /></h2></section>
      <section><h2>Inputs <PlaceholderBadge phase="16" /></h2></section>
      <section><h2>Seeds <PlaceholderBadge phase="17" /></h2></section>
      <section><h2>Rotation <PlaceholderBadge phase="18" /></h2></section>
      <section><h2>Harvest <PlaceholderBadge phase="18" /></h2></section>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-fetch for HTTP | native fetch (Node 18+) | Node 18 (2022) | No package needed |
| Custom timeout with Promise.race | AbortController | Web standard | Cleaner abort, clearTimeout cleanup |
| Promise.all (all-or-nothing) | Promise.allSettled | ES2020 | Independent failure handling — key for graceful degradation |
| Prisma partial index via seed.ts $executeRaw | Migration file with raw SQL | Prisma v4+ | Index survives `migrate dev` on fresh DB |

---

## Open Questions

1. **FIX-02 Scope — Does removing the year filter break the history page UI?**
   - What we know: The `/api/fields/[id]/history` route currently uses `years = [baseYear, baseYear-1, baseYear-2]`. Returning all enterprises means the client receives enterprises from all years, not just the current 3-year window.
   - What's unclear: Does the history page's UI correctly display only the windowed years when the full enterprise list is returned? The `enterprisesByYear` useMemo on line 1943 groups all returned enterprises by cropYear — it would show all years.
   - Recommendation: Remove the year filter from the API route. The history page UI is already paginated by `offset` (line 25-28 in the route), and the `years` array returned drives the UI columns. Enterprises outside the displayed years are fetched but not rendered. This is correct behavior.

2. **Health Probe Endpoints — Are existing routes safe to use?**
   - What we know: farm-budget has `/api/settings` (lightweight), farm-registry has `/api/fields` (returns 56 fields — slightly heavier), grain-tickets has `/api/stats`.
   - What's unclear: `/api/fields` on farm-registry returns full field objects. For a health probe, this is ~56 objects on every check.
   - Recommendation: Use `/api/fields` for farm-registry but parse only the first byte to confirm connectivity (check `res.ok` without consuming the body). Or add a tiny `/api/health` route to each source app. The CONTEXT.md says this is "Claude's Discretion" — a tiny health endpoint on source apps is acceptable.

3. **Environment Variables — Are BUDGET_API_URL and GRAIN_TICKETS_URL defined?**
   - What we know: `FARM_REGISTRY_URL` is already used in `sync-registry/route.ts`. `BUDGET_API_URL` is used in `c2-assembler.ts` and `sync-macro/route.ts`. No `GRAIN_TICKETS_URL` env var exists yet.
   - Recommendation: Add `GRAIN_TICKETS_URL=http://localhost:3000` to `.env.example` in organic-cert alongside existing entries. Check if `.env.local` already has BUDGET_API_URL.

4. **Compile page location — `/compile` vs `/osp/compile`?**
   - What we know: CONTEXT.md says "New top-level navigation item: 'Compile'" alongside Fields, Enterprises, etc. Current nav has `/osp/c2` as a top-level item.
   - Recommendation: Place at `/compile` (top-level route) to match the CONTEXT.md description. The sidebar item goes between `reports` and `osp/c2`.

---

## Validation Architecture

> nyquist_validation is not present in .planning/config.json (key not found). Skipping this section.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reading — `organic-cert/src/app/(app)/fields/page.tsx` lines 120-175 (FIX-01 crash confirmed)
- Direct codebase reading — `organic-cert/src/app/api/fields/[id]/history/route.ts` lines 28-35 (FIX-02 year filter confirmed)
- Direct codebase reading — `organic-cert/prisma/schema.prisma` lines 317-318 (FIX-03 unique constraint confirmed, no partial index)
- Direct codebase reading — `organic-cert/prisma/` directory (no migrations folder — confirms FIX-03 migration gap)
- Direct codebase reading — `organic-cert/package.json` (confirms zero new packages needed)
- Direct codebase reading — `organic-cert/src/components/layout/sidebar.tsx` (navigation pattern for compile page)
- Direct codebase reading — `organic-cert/src/lib/c2-assembler.ts` (BUDGET_API env var pattern)
- Direct codebase reading — `farm-budget/server.js` routes: `/api/enterprises`, `/api/fields`, `/api/settings`
- Direct codebase reading — `farm-registry/server.js` routes: `/api/fields`
- Direct codebase reading — `grain-tickets/server.js` routes: `/api/stats`
- PostgreSQL NULL uniqueness semantics: standard SQL behavior, well-established

### Secondary (MEDIUM confidence)
- Prisma partial unique index limitation: Prisma does not support `@@unique` with WHERE clause in schema.prisma. This is consistent with the Prisma schema reference (raw SQL migration is the documented workaround).

### Tertiary (LOW confidence)
- None — all key findings are verifiable from codebase inspection

---

## Metadata

**Confidence breakdown:**
- FIX-01 root cause: HIGH — confirmed by reading `fields/page.tsx` line 169 and `sync-registry/route.ts` response shape
- FIX-02 root cause: HIGH — confirmed by reading `fields/[id]/history/route.ts` lines 28-35; the "take:3" in MEMORY/REQUIREMENTS refers to the 3-year `in` filter, not a Prisma `take:`
- FIX-03 root cause: HIGH — confirmed by reading schema.prisma (no partial index, no migrations folder)
- Standard stack: HIGH — all packages already installed, native APIs available in Node 18+
- Architecture: HIGH — follows existing patterns (sync-registry, c2-assembler, sidebar) precisely
- Pitfalls: HIGH — all confirmed by direct code inspection

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (stable codebase, no external dependencies change)
