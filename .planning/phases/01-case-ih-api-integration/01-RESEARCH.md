# Phase 1: Case IH API Integration - Research

**Researched:** 2026-02-24
**Domain:** Case IH FieldOps OAuth2 API + Next.js App Router + Prisma + PostgreSQL
**Confidence:** HIGH (core stack, token flow, mock pattern verified from live working code in this repo; architecture patterns verified from prior project research documents)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**OAuth Connection Flow**
- Admin-only permission to connect/disconnect the Case IH account
- One Case IH account per farm operation (not per-operator)
- After connecting, show the farm/field list pulled from Case IH so admin can verify it's the right account
- Manual field matching screen: admin links each Case IH field to an organic-cert field (50+ fields — needs search/filter)
- Unmatched Case IH fields prompt admin to create a new field record (admin fills in organic-specific details)
- Field mappings are persistent but editable — admin can re-map later in settings
- Case IH uses full grower → farm → field → boundary (GFFB) hierarchy
- Disconnect/reconnect option available in settings
- API credentials (client ID, client secret, subscription key) are already available
- OAuth2 flow type uncertain — researcher should investigate whether CNH requires client_credentials or authorization_code for this use case

**Sync Trigger & Feedback**
- Manual sync only (no scheduled background jobs in v1.0)
- "Sync Now" button triggers data pull
- Progress bar with details during sync: show which fields are syncing, operation counts, real-time progress
- Initial sync pulls last 3 years of data (NOP compliance lookback)
- Validate API connection only when sync is attempted (no startup health check)

**Data Mapping & Review**
- Review-before-commit workflow: synced operations land in a staging area, admin reviews and confirms before they become official audit records
- Operation type mapping: first time a new Case IH operation type appears, admin maps it to NOP category (tillage, input application, harvest, etc.) — mapping auto-applies to subsequent syncs
- Approved inputs list: maintain a list of NOP-approved inputs — auto-match known products, flag unknowns for admin review
- Conflict resolution: manually entered data always wins — synced data does not overwrite manual records

**Mock/Dev Mode**
- Auto-detect: if no API credentials configured, automatically use mock data (zero-config dev experience)
- Base mock data on existing farm-budget/fieldops/mock-data.js, extend as needed for organic cert scenarios
- Mock mode disabled in production — dev/staging only

### Claude's Discretion
- Where to place the connection setup in the app (settings page vs dedicated wizard)
- Error surfacing for expired tokens or broken connections (banner vs alert on sync)
- Post-sync summary format (per-field breakdown vs totals)
- Credential storage approach (env variables vs encrypted DB)
- Mock data volume (small vs realistic scale)
- Testing strategy (mocks in CI, integration tests approach)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| API-01 | Farm manager can connect their Case IH FieldOps account via OAuth2 | OAuth2 flow type, token URL, scopes, and credential env vars confirmed from farm-budget/fieldops/client.js. client_credentials flow is correct for server-to-server sync. |
| API-02 | Farm manager can trigger a data sync to pull field operations from Case IH | Sync pattern ported from farm-budget/fieldops/sync.js. Endpoint paths /v1/fields, /v1/applications, /v1/yield, /v1/equipment, /v1/telemetry confirmed. Staging area pattern supports review-before-commit. |
| API-03 | System normalizes Case IH data into structured records (tillage, planting, application, harvest) | FieldOpType enum already exists in schema.prisma. Normalizer maps FieldOps types → Prisma enums. SyncedOperation staging model designed. |
| API-04 | System displays sync status and last-sync timestamp per field | FieldOpsSyncState model added to schema. lastSync, lastStatus, operationsImported, unmatchedFields tracked per field mapping. |
| API-05 | System detects and alerts if Case IH account returns no data (Linked Account limitation) | CNH developer portal confirms Linked Account exclusion. Empty array post-auth is a warning state, not success. Detection logic built into sync service. |
</phase_requirements>

---

## Summary

This phase connects the organic-cert Next.js app to the Case IH FieldOps API, allowing an admin to authenticate via OAuth2, match Case IH fields to organic-cert field records, trigger a data sync, review staged operations before committing them, and see per-field sync status. The project already has a fully working JavaScript implementation in `farm-budget/fieldops/client.js` and `farm-budget/fieldops/sync.js` that uses the correct OAuth2 `client_credentials` flow, token URL, endpoint paths, and mock-data fallback pattern. This phase is primarily a TypeScript port + significant extension (staging area, field matching UI, review workflow) rather than greenfield integration work.

The biggest technical clarification needed was OAuth2 flow type. The existing `farm-budget/fieldops/client.js` uses `client_credentials` — this is correct for server-to-server sync where the farm's credentials are managed server-side. The CNH Developer Portal also describes an `authorization_code` flow for user-facing consent, but that requires the user to log into a CNH-hosted page. Since the farm uses one CNH account managed by the admin, `client_credentials` is the right choice and is already proven to work.

The most significant architectural additions beyond a simple port are: (1) a `SyncedOperation` staging table so operations can be reviewed before becoming official audit records; (2) a `CaseIHFieldMapping` table for persistent field-to-field mappings; (3) a `FieldOpsSyncState` table for per-field sync status; and (4) an operation type mapping table so the admin can classify Case IH operation types (FERTILIZER, HERBICIDE, PLANTING, etc.) into NOP categories on first encounter.

**Primary recommendation:** Port `farm-budget/fieldops/client.js` directly to TypeScript as `src/lib/fieldops-client.ts`. Extend with a normalizer and staging table pattern. The sync trigger is a `POST /api/admin/sync` route (ADMIN-only via existing RBAC). Progress feedback uses Server-Sent Events (SSE) from Next.js App Router. The field matching UI uses the existing `cmdk` package (already installed) for search/filter across 50+ fields.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `fetch` (Node 22) | Built-in | Case IH API HTTP calls | Already used in farm-budget/fieldops/client.js. No new dependency needed. |
| Prisma Client | ^6.19.2 | All DB writes for staging, mapping, sync state | Already installed and used throughout organic-cert. |
| next-auth v5 | ^5.0.0-beta.30 | Session auth, ADMIN role check on sync routes | Already installed. Use `auth()` from `@/lib/auth` in route handlers. |
| `cmdk` | ^1.1.1 | Command palette / search for field matching UI (50+ fields) | Already installed in organic-cert/package.json. |
| `sonner` | ^2.0.7 | Toast notifications for sync status, review confirmations | Already installed. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | ^4.1.0 | Date formatting for sync timestamps, 3-year lookback calculation | Already installed. Use for `subYears(new Date(), 3)` to compute sync start date. |
| `zod` | Not yet installed | Runtime validation of Case IH API response payloads | Add it. CNH API shape is undocumented (login-gated). Defensive parsing prevents silent data corruption when API shape changes. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-Sent Events for sync progress | WebSockets | SSE is one-directional (server → client) which is all that's needed for progress reporting. Simpler than WebSockets in Next.js App Router. No additional package. |
| `cmdk` for field search | Custom filtered list | `cmdk` is already installed and provides keyboard navigation, search, and accessible command palette out of the box. No reason to rebuild. |
| `client_credentials` OAuth2 | `authorization_code` flow | `authorization_code` requires the user to log into CNH's hosted page and grant consent. Unnecessary for a single-farm admin-managed account. `client_credentials` is already proven in this repo. |

**Installation:**
```bash
# In organic-cert directory
npm install zod
```

No other new packages needed for the API integration core.

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 1 (existing files in parentheses):

```
organic-cert/
├── prisma/
│   └── schema.prisma               # EXTEND: add CaseIHFieldMapping, SyncedOperation,
│                                   #   FieldOpsSyncState, OperationTypeMapping models
├── src/
│   ├── lib/
│   │   ├── fieldops-client.ts      # NEW: TypeScript port of farm-budget/fieldops/client.js
│   │   ├── fieldops-normalizer.ts  # NEW: FieldOps JSON → SyncedOperation staging shape
│   │   └── fieldops-sync.ts        # NEW: orchestrates sync, writes staging rows, updates sync state
│   ├── app/
│   │   └── api/
│   │       └── admin/
│   │           ├── sync/
│   │           │   └── route.ts    # NEW: POST /api/admin/sync (ADMIN only, triggers sync)
│   │           ├── sync-stream/
│   │           │   └── route.ts    # NEW: GET /api/admin/sync-stream (SSE progress stream)
│   │           ├── fieldops/
│   │           │   ├── fields/
│   │           │   │   └── route.ts # NEW: GET CNH field list for matching UI
│   │           │   ├── mappings/
│   │           │   │   └── route.ts # NEW: GET/POST/PUT field mappings
│   │           │   └── op-types/
│   │           │       └── route.ts # NEW: GET/POST operation type mappings
│   │           └── staged-ops/
│   │               ├── route.ts    # NEW: GET staged ops (pending review)
│   │               └── [id]/
│   │                   └── route.ts # NEW: POST /approve or /reject staged op
│   └── app/
│       └── (app)/
│           └── admin/
│               ├── fieldops/
│               │   ├── page.tsx    # NEW: FieldOps connection + settings page
│               │   ├── matching/
│               │   │   └── page.tsx # NEW: Field matching UI (cmdk search)
│               │   └── review/
│               │       └── page.tsx # NEW: Staged operations review UI
│               └── layout.tsx      # (existing)
```

### Pattern 1: TypeScript Port of Existing FieldOps Client

**What:** Direct port of `farm-budget/fieldops/client.js` to TypeScript. Zero logic changes. Add Zod validation on API responses.

**When to use:** `fieldops-client.ts` is the single source for all Case IH API calls.

**Example:**
```typescript
// src/lib/fieldops-client.ts
// Source: farm-budget/fieldops/client.js (working production code)

import { z } from 'zod';

const TOKEN_URL = process.env.FIELDOPS_TOKEN_URL ??
  'https://identity.cnhind.com/oauth2/aus78lla80kTGmPFf1t7/v1/token';
const API_BASE = process.env.FIELDOPS_API_BASE ?? 'https://ag.api.cnhind.com';

let tokenCache: { accessToken: string | null; expiresAt: number } = {
  accessToken: null,
  expiresAt: 0,
};

export function isConfigured(): boolean {
  return !!(
    process.env.FIELDOPS_CLIENT_ID &&
    process.env.FIELDOPS_CLIENT_SECRET &&
    process.env.FIELDOPS_SUBSCRIPTION_KEY
  );
}

export function useMock(): boolean {
  return process.env.FIELDOPS_USE_MOCK === 'true' || !isConfigured();
}

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'fields equipment yield applications telemetry',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        Buffer.from(
          `${process.env.FIELDOPS_CLIENT_ID}:${process.env.FIELDOPS_CLIENT_SECRET}`
        ).toString('base64'),
      'Ocp-Apim-Subscription-Key': process.env.FIELDOPS_SUBSCRIPTION_KEY!,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`FieldOps token request failed (${response.status}): ${body}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.accessToken;
}
```

### Pattern 2: Staging Area (Review-Before-Commit)

**What:** All synced operations land in a `SyncedOperation` table with `status: 'PENDING'`. Admin reviews and approves/rejects. Only `APPROVED` ops are used in audit records. This is a new pattern required by the user's "review-before-commit" decision.

**When to use:** Every Case IH API record ingestion. Manual records bypass staging entirely.

**Schema additions:**
```prisma
// In schema.prisma — NEW models for Phase 1

enum SyncedOpStatus {
  PENDING
  APPROVED
  REJECTED
}

model SyncedOperation {
  id                String          @id @default(cuid())
  farmId            String
  // Case IH source identifiers
  fieldopsExternalId String         // e.g. "fo-app-003" — for dedup
  sourceEndpoint    String          // "applications" | "yield" | "telemetry"
  // Normalized operation data
  caseIHFieldId     String          // Case IH field ID from GFFB hierarchy
  caseIHFieldName   String          // for display in review UI
  mappedFieldId     String?         // organic-cert Field.id (from CaseIHFieldMapping)
  operationDate     DateTime?
  rawOpType         String          // Case IH type: "FERTILIZER", "HERBICIDE", etc.
  mappedNopCategory String?         // admin-mapped: "SPRAYING", "PLANTING", etc.
  products          Json?           // raw products array from Case IH
  acresWorked       Float?
  rawPayload        Json            // full Case IH API response for traceability
  status            SyncedOpStatus  @default(PENDING)
  syncRunId         String          // groups all ops from one sync run
  reviewedAt        DateTime?
  reviewedByUserId  String?
  rejectedReason    String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@unique([farmId, fieldopsExternalId])
  @@index([farmId, status])
  @@index([syncRunId])
}

model CaseIHFieldMapping {
  id              String   @id @default(cuid())
  farmId          String
  caseIHFieldId   String   // Case IH GFFB field ID
  caseIHFieldName String   // for display
  caseIHFarmName  String?  // from GFFB farm level
  organicCertFieldId String // organic-cert Field.id
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([farmId, caseIHFieldId])
}

model OperationTypeMapping {
  id            String   @id @default(cuid())
  farmId        String
  rawOpType     String   // "FERTILIZER", "HERBICIDE", "PLANTING", "INSECTICIDE", etc.
  nopCategory   String   // "SPRAYING", "PLANTING", "CULTIVATION", "HARVEST", etc.
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([farmId, rawOpType])
}

model FieldOpsSyncState {
  id                  String   @id @default(cuid())
  farmId              String   @unique
  lastSyncAt          DateTime?
  lastSyncStatus      String?  // "success" | "partial" | "error" | "no_data"
  lastSyncRunId       String?
  totalFieldsMapped   Int      @default(0)
  totalUnmatched      Int      @default(0)
  lastSyncError       String?
  linkedAccountWarning Boolean @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

### Pattern 3: Server-Sent Events for Sync Progress

**What:** `GET /api/admin/sync-stream` returns an SSE stream. The sync job writes progress events as it processes each field. The client's progress bar updates in real-time without polling.

**When to use:** The "Sync Now" button triggers both the sync POST and opens the SSE stream for progress.

**Example:**
```typescript
// src/app/api/admin/sync-stream/route.ts
// Source: Next.js App Router Response streaming pattern
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // The sync job writes progress via a shared EventEmitter or
      // the client polls this endpoint after triggering the sync POST.
      // Simple implementation: client POSTs to /api/admin/sync, which
      // runs sync synchronously and streams progress via this SSE endpoint.
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

**Alternative (simpler):** For v1, the sync POST runs synchronously and returns a JSON result. Progress is simulated client-side (per-field count increments). The SSE approach is more correct but adds complexity. This is Claude's discretion — recommend the simpler JSON response for v1.

### Pattern 4: Field Matching UI with cmdk

**What:** The field matching page shows 50+ Case IH fields on the left. Admin searches and selects the corresponding organic-cert field for each. Uses `cmdk` (already installed) for search/filter.

**When to use:** After OAuth connection, before first sync. Also accessible from settings for re-mapping.

**Anti-Patterns to Avoid**
- **Writing FieldOps records directly to domain tables (FieldOperation, HarvestEvent):** Do not bypass the staging area. All Case IH data must go through `SyncedOperation` first. Manual records never flow through staging.
- **Auto-creating organic-cert Field records from FieldOps data:** Unmatched Case IH fields go into the field matching UI for admin to handle. Auto-created fields would have null `organicStatus`, `transitionDate`, and `fsaTractNumber` — invalid for NOP records.
- **Overwriting manual records with synced data:** Conflict resolution rule: manual record always wins. Check for existing manual records before committing a staged operation.
- **Storing OAuth token in `localStorage` or a non-httpOnly cookie:** Token stays server-side only. `client_credentials` tokens don't involve a user session, so they're stored in server memory (token cache) or env vars, not client storage.
- **Treating an empty Case IH API response as success:** Empty field list after successful auth = Linked Account warning. Surface this immediately with `FieldOpsSyncState.linkedAccountWarning = true`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token acquisition + caching | Custom token manager with Redis | Port farm-budget/fieldops/client.js as-is | It already handles token caching with 60s buffer. Zero new dependencies. Proven in this repo. |
| Field search across 50+ items | Custom debounced search input | `cmdk` (already installed) | `cmdk` provides keyboard nav, accessible combobox, fuzzy search. Already a dependency. |
| API response validation | Inline type assertions | `zod` schemas | Case IH API shape is undocumented (login-gated portal). Runtime validation catches shape changes before they silently corrupt DB records. |
| Progress reporting | WebSocket server | Server-Sent Events (SSE) | SSE is built into the browser and Next.js. Unidirectional (server → client) is all that's needed for sync progress. No extra package. |
| Toast notifications | Custom alert components | `sonner` (already installed) | Already used throughout the app. Consistent UX. |

**Key insight:** The entire HTTP + token layer is already built and proven. The work is TypeScript typing, schema additions, staging area, and UI. Don't rebuild the wheel.

---

## Common Pitfalls

### Pitfall 1: Linked Account Data Exclusion (API-05)
**What goes wrong:** OAuth completes, token is valid, API returns 200 — but the field list is an empty array. No error code. The sync appears to succeed but writes zero records. This is the CNH "Linked Account" limitation: agronomic data from accounts connected through a dealer/fleet program is not accessible via the API.

**Why it happens:** Developers treat successful auth as proof that data is accessible. The empty-array case is not an error in HTTP terms.

**How to avoid:** After obtaining the token, immediately call `GET /v1/fields`. If the response is an empty array, set `FieldOpsSyncState.linkedAccountWarning = true` and show a specific alert: "Your Case IH account returned no fields. This may be a Linked Account limitation — contact CNH support." Do not proceed to sync.

**Warning signs:** Auth flow completes but field list is empty. Farm manager confirms equipment is visible in the FieldOps portal UI.

### Pitfall 2: Subscription Key / Environment Mismatch
**What goes wrong:** A 401 error that looks identical to a bad access token. Developers rotate credentials and re-trigger OAuth when the real issue is using a staging subscription key against the production endpoint (or vice versa).

**Why it happens:** CNH has separate subscription keys per environment. The subscription key is easy to miss when updating credentials.

**How to avoid:** Treat `FIELDOPS_SUBSCRIPTION_KEY` as required alongside `FIELDOPS_CLIENT_ID` and `FIELDOPS_CLIENT_SECRET`. Log specific error context on 401 (include which header is likely wrong based on the error body if CNH provides it). Document environment-key pairing in the `.env.example`.

**Warning signs:** 401 persists after successful token refresh. Errors only appear after a deployment.

### Pitfall 3: Sync Progress Blocking the UI
**What goes wrong:** The "Sync Now" button triggers a long-running sync (3 years × 50+ fields) that blocks the HTTP response for 60+ seconds. Next.js route handlers time out. The farm manager sees a hanging spinner.

**Why it happens:** Sync is implemented as a synchronous route handler that returns only when all API calls and DB writes complete.

**How to avoid:** For v1, the sync runs synchronously but returns a progress summary immediately after each field. Use SSE or a simple polling approach (POST returns a job ID, client polls `GET /api/admin/sync/status`). The simplest v1 approach: POST triggers sync, returns progress JSON with `{ fieldsProcessed, totalFields, operationsStaged, errors }` — client updates the progress bar based on this final response. If sync takes > 30s, move to a background job in v2.

**Warning signs:** Sync POST response takes > 5 seconds for a single field.

### Pitfall 4: Duplicate Operations on Re-Sync
**What goes wrong:** Re-running sync creates duplicate `SyncedOperation` rows for operations already imported.

**Why it happens:** The dedup check is missing or uses the wrong unique key.

**How to avoid:** `SyncedOperation` has a `@@unique([farmId, fieldopsExternalId])` constraint. The sync service uses `upsert` with this key. Operations with `status: 'APPROVED'` or `'REJECTED'` are never overwritten — only `PENDING` rows can be updated on re-sync. The sync service skips any external ID that already has an `APPROVED` or `REJECTED` row.

**Warning signs:** Running sync twice creates twice the row count in `SyncedOperation`.

### Pitfall 5: Manual Records Overwritten by Sync
**What goes wrong:** A farm manager manually enters a tillage record. Sync runs and creates a `SyncedOperation` for the same field/date. Admin approves the staged op, creating a duplicate `FieldOperation` record.

**Why it happens:** The approval step doesn't check for existing manual records.

**How to avoid:** Before committing an approved `SyncedOperation` to `FieldOperation`, check for existing records with matching `fieldEnterpriseId + operationDate + type`. If a manual record exists, surface it in the review UI: "A manual record already exists for this date and operation type — synced data will be skipped." Manually entered data always wins (confirmed user decision).

**Warning signs:** Duplicate FieldOperation rows for the same field/date/type.

---

## Code Examples

### OAuth2 Token Acquisition (client_credentials)
```typescript
// Source: farm-budget/fieldops/client.js — working implementation, ported to TypeScript
// Token URL confirmed: https://identity.cnhind.com/oauth2/aus78lla80kTGmPFf1t7/v1/token
// Scopes confirmed: 'fields equipment yield applications telemetry'

const params = new URLSearchParams({
  grant_type: 'client_credentials',
  scope: 'fields equipment yield applications telemetry',
});

const response = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: 'Basic ' + Buffer.from(
      `${process.env.FIELDOPS_CLIENT_ID}:${process.env.FIELDOPS_CLIENT_SECRET}`
    ).toString('base64'),
    'Ocp-Apim-Subscription-Key': process.env.FIELDOPS_SUBSCRIPTION_KEY!,
  },
  body: params.toString(),
});
// Returns: { access_token, expires_in: 3600 (production), token_type: 'Bearer' }
```

### API GET Wrapper
```typescript
// Source: farm-budget/fieldops/client.js — direct port
async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(path, API_BASE);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Ocp-Apim-Subscription-Key': process.env.FIELDOPS_SUBSCRIPTION_KEY!,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`FieldOps API ${response.status} on ${path}`);
  }
  return response.json() as Promise<T>;
}
```

### Mock/Real Toggle
```typescript
// Source: farm-budget/fieldops/client.js — pattern to replicate exactly
export function useMock(): boolean {
  return process.env.FIELDOPS_USE_MOCK === 'true' || !isConfigured();
}

// Usage in every exported function:
export async function getFields() {
  if (useMock()) return mockData.getFields();
  return apiGet<FieldOpsField[]>('/v1/fields');
}
```

### Linked Account Detection
```typescript
// New logic for Phase 1 — detects API-05 requirement
export async function validateConnection(farmId: string): Promise<{
  ok: boolean;
  linkedAccountWarning: boolean;
  fieldCount: number;
}> {
  const fields = await getFields();
  if (fields.length === 0) {
    await prisma.fieldOpsSyncState.upsert({
      where: { farmId },
      create: { farmId, linkedAccountWarning: true, lastSyncStatus: 'no_data' },
      update: { linkedAccountWarning: true, lastSyncStatus: 'no_data' },
    });
    return { ok: false, linkedAccountWarning: true, fieldCount: 0 };
  }
  return { ok: true, linkedAccountWarning: false, fieldCount: fields.length };
}
```

### Sync Route (ADMIN-gated)
```typescript
// src/app/api/admin/sync/route.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await auth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session?.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await runFieldOpsSync(session.user.farmId);
  return NextResponse.json(result);
}
```

### 3-Year Lookback Date Calculation
```typescript
// Source: date-fns (already installed)
import { subYears, startOfYear, formatISO } from 'date-fns';

// NOP requires 3-year field history (205.202 lookback)
const syncFromDate = formatISO(startOfYear(subYears(new Date(), 3)));
// Pass as query param: GET /v1/applications?from=2023-01-01
```

### Zod Schema for FieldOps Field Response
```typescript
// src/lib/fieldops-normalizer.ts
import { z } from 'zod';

export const FieldOpsFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  farmName: z.string().optional(),
  area: z.object({ value: z.number(), unit: z.string() }).optional(),
  boundary: z.object({
    type: z.literal('Feature'),
    geometry: z.object({ type: z.string(), coordinates: z.unknown() }),
    properties: z.record(z.unknown()).optional(),
  }).optional(),
});

export type FieldOpsField = z.infer<typeof FieldOpsFieldSchema>;
```

### Field Name Normalization for Matching
```typescript
// Source: farm-budget/fieldops/sync.js — proven matching logic
function normalizeFieldName(name: string): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Auto-match suggestion: when admin opens the matching UI,
// pre-populate suggestions where Case IH field name matches
// an organic-cert field name after normalization.
function findSuggestedMatch(
  caseIHName: string,
  organicCertFields: { id: string; name: string }[]
): string | null {
  const normalized = normalizeFieldName(caseIHName);
  return (
    organicCertFields.find(
      (f) => normalizeFieldName(f.name) === normalized
    )?.id ?? null
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Port JS sync code as-is | Port to TypeScript + Zod validation | Phase 1 | Type safety, runtime validation on undocumented API |
| Write directly to FieldOperation table | Staging area (SyncedOperation) + review workflow | Phase 1 (new design decision) | Admin can review and reject bad data before it enters audit records |
| Field name auto-matching | Manual field matching UI with auto-suggestions | Phase 1 (50+ fields decision) | Admin verifies GFFB → organic-cert mapping explicitly |
| Automatic sync on schedule | Manual "Sync Now" trigger only for v1.0 | Phase 1 (user decision) | Simpler for v1; no background job complexity |

**Confirmed patterns from existing code (do not change):**
- `client_credentials` OAuth2 flow — already working
- Token URL: `https://identity.cnhind.com/oauth2/aus78lla80kTGmPFf1t7/v1/token` — confirmed
- API base: `https://ag.api.cnhind.com` — confirmed
- Required header: `Ocp-Apim-Subscription-Key` — confirmed
- Scopes: `fields equipment yield applications telemetry` — confirmed
- Token cache with 60s buffer — already implemented, port as-is
- `FIELDOPS_USE_MOCK=true` auto-fallback — confirmed pattern

---

## Open Questions

1. **CNH API `from` date parameter syntax for 3-year lookback**
   - What we know: The existing sync.js uses `season: String(year)` for yield and applications — a year string, not a date range. CNH API endpoints may support a `from`/`to` date filter or only a `season` year.
   - What's unclear: Whether `GET /v1/applications?season=2023` returns all of 2023 or only the current year's data within the season. Full API spec is login-gated at develop.cnh.com.
   - Recommendation: Test with `season=2023` and `season=2024` separately for the 3-year lookback. Iterate seasons in the sync loop rather than relying on a date range. If season-based, the sync calls each endpoint 3 times (2023, 2024, 2025).

2. **SyncedOperation → FieldOperation commit: which Prisma models?**
   - What we know: The user's design says "synced operations become official audit records" after approval. The existing schema has `FieldOperation`, `HarvestEvent`, and `MaterialUsage` as the target models.
   - What's unclear: Whether TILLAGE/PLANTING/CULTIVATION operations should map to `FieldOperation`, and whether FERTILIZER/HERBICIDE/INSECTICIDE applications should map to `MaterialUsage` (which requires a `Material` record). The `Material` model requires NOP status — Case IH won't have this.
   - Recommendation: TILLAGE, PLANTING, CULTIVATION → `FieldOperation`. For application types (FERTILIZER, HERBICIDE, INSECTICIDE), create a simplified staging-to-committed flow that creates the `SyncedOperation` row with all detail but defers full `MaterialUsage` linkage to Phase 2 (when the inputs management UI exists). Flag application-type ops as requiring manual material linkage in the review UI.

3. **Field matching UI: where in app navigation?**
   - What we know: Context.md marks this as Claude's discretion.
   - Recommendation: Place the FieldOps connection setup at `/(app)/admin/fieldops`. This page has three sub-states: (a) "Not connected" — shows Connect button; (b) "Connected, pending matching" — shows field matching UI; (c) "Connected and matched" — shows sync button, sync status, last-sync timestamp. This is a dedicated admin settings area, not a wizard overlay, because the field mapping needs to be revisitable (50+ fields may require multiple sessions).

---

## Sources

### Primary (HIGH confidence)
- `farm-budget/fieldops/client.js` — OAuth2 token URL, API base URL, scopes, subscription key header, token cache with 60s buffer, mock fallback pattern. Working production code in this repo.
- `farm-budget/fieldops/sync.js` — API endpoint paths (/v1/fields, /v1/applications, /v1/yield, /v1/equipment, /v1/telemetry), field name normalization, dedup pattern, sync result metadata shape.
- `farm-budget/fieldops/mock-data.js` — Complete FieldOps API response shapes: fields, equipment, yield data, applications (with FERTILIZER, HERBICIDE, INSECTICIDE, PLANTING types), telemetry.
- `organic-cert/prisma/schema.prisma` — Existing target models (FieldOperation, HarvestEvent, MaterialUsage, FieldOpType enum, PassStatus enum). All new Prisma models for Phase 1 extend this schema.
- `organic-cert/src/lib/auth.ts` — `auth()` function usage pattern for ADMIN role check in route handlers.
- `organic-cert/src/lib/rbac.ts` — Permission matrix. ADMIN role has all permissions. Sync route must check `role === 'ADMIN'`.
- `.planning/research/STACK.md` — Token URL, API base URL, scope list, env var names, confirmed against this repo's working code. Researched 2026-02-23.
- `.planning/research/ARCHITECTURE.md` — System architecture diagram, normalizer pattern, data flow, anti-patterns. Researched 2026-02-23.
- `.planning/research/PITFALLS.md` — Linked Account pitfall, subscription key mismatch, token refresh race, sync timestamp display. Researched 2026-02-23.

### Secondary (MEDIUM confidence)
- CNH Developer Portal (https://develop.cnh.com/get-started/fieldops-portals) — Staging vs production environments, Linked Account data exclusion: "Agronomic data from a Linked Account in the FieldOps portal is not made available through the FieldOps API." Confirmed MEDIUM (public portal, full spec login-gated).
- CNH Developer Portal (https://develop.cnh.com/troubleshooting/faq/field-ops-api) — Rate limit: 120 req/s, 120 concurrent users. Token TTL: 3600s production. Linked Account exclusion. MEDIUM confidence.
- `.planning/codebase/INTEGRATIONS.md` — FieldOps env var names, staging vs production environment configuration. Researched 2026-02-23.

### Tertiary (LOW confidence)
- OAuth2 `authorization_code` flow details for CNH — the portal describes this flow but the existing working code uses `client_credentials`. The question of which flow is "required" is unresolved without a paid CNH developer account. **Current recommendation stands: use `client_credentials` as proven in farm-budget.** If CNH requires `authorization_code` for the organic-cert use case, this would require adding a browser-based consent step — flag as risk but do not block planning.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already installed in the project except `zod`; the OAuth2 client code is proven in this repo
- Architecture: HIGH — staging area, field mapping, and sync patterns are clearly specified by the user and supported by existing code patterns
- Pitfalls: HIGH — Linked Account pitfall, subscription key mismatch, and dedup requirements all confirmed from CNH developer portal and existing code analysis
- API endpoint paths: HIGH — confirmed from working code in `farm-budget/fieldops/client.js` and `sync.js`
- Full CNH API schema (field-level response shape): MEDIUM — schema inferred from mock-data.js which mirrors real API responses; full spec is login-gated

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days — Case IH API is stable; mock-data.js already reflects real response shapes)
