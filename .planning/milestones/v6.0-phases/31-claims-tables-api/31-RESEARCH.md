# Phase 31: Claims Tables + API - Research

**Researched:** 2026-03-05
**Domain:** Supabase Schema + Storage Signed URL Upload + Next.js App Router API Routes
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Claim pipeline stages:**
- 6 stages: Notice of Loss → Filed → Adjuster Assigned → Under Review → Settled → Closed
- Stage stored as enum in claims table
- These stages map 1:1 to Kanban columns in Phase 32

**Deadline model:**
- Auto-calculated deadlines based on stage entry date + standard filing windows
- User can override any auto-calculated deadline
- Deadlines recalculate on stage transitions (e.g., moving to "Filed" sets next deadline)

**Multi-claim support:**
- Multiple claims allowed per policy (e.g., prevent planting + harvest loss on same crop year)
- policy_id is FK but not unique — one-to-many relationship

**Create-from-policy prefill:**
- Auto-fill from policy: crop, county, coverage type (RP/RP-HPE/YP), coverage level (%), effective guarantee
- User provides at creation: date of loss, brief description
- Initial stage: Notice of Loss

**Signed URL upload pattern (from v6.0 design decision):**
- Server generates upload URL → client PUT to Storage → client posts metadata
- Never route file bytes through a Server Action (1MB limit)

**Claims philosophy:**
- Decision support / tracking — NOT official FCIC filing
- Same philosophy as insurance module

**Schema dependency:**
- Claims must FK to insurance_policies (Phase 29 — already exists)

### Claude's Discretion

**On claims table:**
- Financial fields: estimated loss, indemnity, deductible, appraised value — pick what's reasonable for crop insurance tracking
- Whether claims link to clu_record_id in addition to policy_id
- Cause-of-loss field — structured dropdown of FCIC codes vs free text vs both
- Initial deadline auto-set on create-from-policy

**On document upload:**
- Allowed file types (PDF, JPG, PNG baseline — add spreadsheets if useful)
- File size limit per document (10-25MB range)
- Document categories/tags vs flat list
- Document access model — module-level vs claim-level RLS

**On timeline:**
- Auto-tracked events (baseline: created, stage change, doc upload, deadline change, financial update — add adjuster assignment if schema supports it)
- Manual note types — plain text vs tagged notes
- User tracking on timeline entries
- Immutable vs editable timeline entries (immutable recommended)
- DB triggers vs application code for auto-events

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLM-04 | User can upload documents to a claim via Supabase Storage | Signed URL pattern: `createSignedUploadUrl` → client PUT via `uploadToSignedUrl` → POST metadata to `/api/claims/[id]/documents`. RLS policy on `storage.objects` for INSERT. Signed download URL via `createSignedUrl` for reading. |
| CLM-07 | User can create a claim pre-filled from an insurance policy | POST `/api/claims` accepts `policy_id`. Route handler fetches policy, carries over crop, coverage_type (plan_type), coverage_level, effective guarantee. Returns created claim. Phase 32 UI builds on this endpoint. |
</phase_requirements>

---

## Summary

Phase 31 is a pure data/API phase — no UI. It creates three Supabase tables (`claims`, `claim_documents`, `claim_timeline`), a private Storage bucket (`claim-documents`), RLS policies, and Next.js App Router route handlers for all CRUD operations. Phase 32 (the Kanban UI) consumes everything built here.

The dominant technical challenge is the signed URL upload pattern. Supabase Storage exposes `createSignedUploadUrl` (server-side, generates a 2-hour upload token) and `uploadToSignedUrl` (client-side, sends file bytes directly to Storage using the token). This is the mandatory pattern for this project — file bytes must never go through a Next.js Server Action because Next.js imposes a 1MB body limit on server actions. The route handler generates the URL; the browser uploads directly; then the browser posts document metadata (path, filename, size, mime type) to a separate API endpoint that writes the `claim_documents` row.

The schema design follows the FK dependency chain established in Phases 27–30: `clu_records → insurance_policies → claims → claim_documents` and `claim_timeline`. The claims stage is a PostgreSQL enum. Timeline entries are immutable (append-only). The migration follows the established per-phase pattern: a new `scripts/migrate-31.ts` file that prints SQL for manual execution in the Supabase SQL editor and verifies columns after applying.

**Primary recommendation:** Build the schema migration script first (Task 1 of Plan 31-01), then CRUD route handlers, then the signed URL spike as Plan 31-02. Keep the signed URL logic isolated in a single endpoint (`/api/claims/[id]/upload-url`) that returns `{ path, token, signedUrl }`. The client uses `uploadToSignedUrl` from `@supabase/storage-js` (already installed via `@supabase/supabase-js`). After upload, the client POSTs to `/api/claims/[id]/documents` with metadata only (no file bytes).

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | installed | Supabase DB + Storage client | Project standard; `storage-js` is bundled |
| `@supabase/ssr` | installed | Server-side Supabase client with cookie auth | Used in all prior API routes |
| `next` | 14.x | App Router API routes (`route.ts`) | Project framework |

### No New Packages Required

All needed libraries are already in the project. The Storage client (`supabase.storage.from(...)`) is part of `@supabase/supabase-js`. No additional npm installs needed for Phase 31.

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | installed | Run TypeScript migration scripts | `npx tsx scripts/migrate-31.ts` |

**Installation:**
```bash
# No new packages — all dependencies already installed
```

---

## Architecture Patterns

### Recommended Project Structure

```
glomalin-portal/
├── scripts/
│   └── migrate-31.ts              # New: claims schema + Storage bucket SQL
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── claims/
│   │   │       ├── route.ts       # GET (list) + POST (create / create-from-policy)
│   │   │       └── [id]/
│   │   │           ├── route.ts   # GET (single) + PATCH (stage/fields) + DELETE
│   │   │           ├── documents/
│   │   │           │   └── route.ts  # GET (list docs) + POST (save metadata after upload)
│   │   │           ├── upload-url/
│   │   │           │   └── route.ts  # POST → returns { path, token, signedUrl }
│   │   │           └── timeline/
│   │   │               └── route.ts  # GET (list) + POST (add note)
│   │   └── (protected)/app/
│   │       └── claims/
│   │           └── page.tsx       # Shell page (Phase 32 replaces with Kanban)
│   ├── components/
│   │   └── claims/                # Empty — Phase 32 populates
│   └── lib/
│       └── claims/
│           └── calc.ts            # deadline auto-calc helpers
```

### Pattern 1: Claims Schema Design

**What:** Three tables with FK chain: `claims → insurance_policies`, `claim_documents → claims`, `claim_timeline → claims`.

**Stage enum:**
```sql
CREATE TYPE claim_stage AS ENUM (
  'notice_of_loss',
  'filed',
  'adjuster_assigned',
  'under_review',
  'settled',
  'closed'
);
```

**claims table:**
```sql
CREATE TABLE claims (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id             uuid NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  clu_record_id         uuid REFERENCES clu_records(id) ON DELETE SET NULL,  -- optional link
  stage                 claim_stage NOT NULL DEFAULT 'notice_of_loss',
  stage_entered_at      timestamptz NOT NULL DEFAULT now(),
  crop                  text,                   -- carried from policy
  county                text,                   -- carried from policy farm_name or FSA context
  coverage_type         text,                   -- RP / RP-HPE / YP (plan_type from policy)
  coverage_level        integer,                -- e.g., 80 (from policy)
  effective_guarantee   numeric(10,2),          -- carried from policy guarantee * coverage_level/100
  date_of_loss          date,
  cause_of_loss         text,                   -- free text with FCIC cause codes in parentheses
  description           text,
  -- Financial fields (decision support / tracking only)
  estimated_loss_bu     numeric(10,2),          -- estimated yield shortfall in bushels
  appraised_value       numeric(12,2),          -- adjuster appraised production value
  indemnity_amount      numeric(12,2),          -- final indemnity paid
  deductible_amount     numeric(12,2),          -- policy deductible applied
  -- Deadline tracking
  deadline_at           timestamptz,            -- auto-calculated, user-overridable
  deadline_overridden   boolean NOT NULL DEFAULT false,
  -- Metadata
  adjuster_name         text,
  adjuster_phone        text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

**claim_documents table:**
```sql
CREATE TABLE claim_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id      uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,        -- path in claim-documents bucket
  filename      text NOT NULL,        -- original filename shown to user
  file_size     integer,              -- bytes
  mime_type     text,                 -- e.g., application/pdf
  category      text,                 -- 'notice_of_loss' | 'adjuster_report' | 'photos' | 'settlement' | 'other'
  uploaded_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

**claim_timeline table:**
```sql
CREATE TABLE claim_timeline (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  event_type  text NOT NULL,   -- 'created' | 'stage_change' | 'doc_upload' | 'deadline_change' | 'financial_update' | 'adjuster_assigned' | 'note'
  event_data  jsonb,           -- structured payload (from_stage/to_stage for stage_change, etc.)
  note        text,            -- plain text for manual notes
  actor_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
  -- NO updated_at — immutable append-only
);
```

**Rationale on discretion decisions:**
- `clu_record_id` is optional FK — adds value for Phase 33 INT-03 (prevented planting trigger), set NULL if CLU deleted
- `cause_of_loss` is free text with FCIC code guidance in the UI — avoids hardcoding a full FCIC enum now, Phase 32 can add a typeahead
- Document categories are a flat list (`category` text column) — easier than a separate junction table, Phase 32 renders them as filter chips
- Timeline is append-only (no `updated_at`) — enforces audit trail integrity
- Timeline entries are written by application code, not DB triggers — simpler to reason about, matches existing project patterns (no Supabase Edge Functions in this project)
- User tracking on timeline: `actor_id` references `profiles(id)` — set by API route from `supabase.auth.getUser()`
- Financial fields: estimated_loss_bu (yield shortfall), appraised_value (adjuster), indemnity_amount (final paid), deductible_amount — these four cover the crop insurance claim lifecycle without over-engineering

### Pattern 2: RLS Policies

**What:** All three claims tables use the established `authenticated` role pattern from prior phases.

```sql
-- Enable RLS
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_timeline ENABLE ROW LEVEL SECURITY;

-- Authenticated read+write (same pattern as insurance_policies authenticated_write)
CREATE POLICY "authenticated_all" ON claims
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON claim_documents
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON claim_timeline
  FOR ALL USING (auth.role() = 'authenticated');
```

**Storage bucket + RLS on storage.objects:**
```sql
-- Create private bucket (done via migration script or Supabase Dashboard)
-- Private = all ops require auth + RLS pass

-- Storage objects RLS (applied to storage schema)
CREATE POLICY "authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'claim-documents');

CREATE POLICY "authenticated_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'claim-documents');

CREATE POLICY "authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'claim-documents');
```

**Important:** Storage bucket creation may need to be done via the Supabase Dashboard (`Storage → New bucket`) since the JS client's `createBucket` requires service_role and the migration script already uses it. Include both approaches in the migration script.

### Pattern 3: Signed URL Upload (the critical pattern for CLM-04)

**Three-step flow (established v6.0 design decision):**

**Step 1 — Server generates upload URL** (route handler, uses anon key client):
```typescript
// POST /api/claims/[id]/upload-url
// Body: { filename: string, mimeType: string }
// Returns: { path: string, token: string, signedUrl: string }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { filename, mimeType } = await request.json()

  // Verify claim exists and user has access
  const { data: claim } = await supabase.from('claims').select('id').eq('id', id).single()
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

  // Build storage path: claims/{claimId}/{timestamp}-{filename}
  const timestamp = Date.now()
  const path = `claims/${id}/${timestamp}-${filename}`

  const { data, error } = await supabase.storage
    .from('claim-documents')
    .createSignedUploadUrl(path)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl })
}
```

**Step 2 — Client uploads directly to Storage** (browser, no server involved):
```typescript
// In the client component (Phase 32 builds this UI)
import { createClient } from '@/lib/supabase/browser'

const supabase = createClient()

// Get signed URL from server
const { path, token } = await fetch(`/api/claims/${claimId}/upload-url`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename: file.name, mimeType: file.type }),
}).then(r => r.json())

// Upload directly to Storage — no server involved
const { error } = await supabase.storage
  .from('claim-documents')
  .uploadToSignedUrl(path, token, file, { contentType: file.type })

if (error) throw error
```

**Step 3 — Client posts metadata to API** (after successful upload):
```typescript
// POST /api/claims/[id]/documents
// Body: { path, filename, fileSize, mimeType, category }
await fetch(`/api/claims/${claimId}/documents`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    path, filename: file.name, fileSize: file.size,
    mimeType: file.type, category: 'other'
  }),
})
```

**Step 4 — Reading documents** (signed download URL):
```typescript
// In GET /api/claims/[id]/documents handler, for each document:
const { data } = await supabase.storage
  .from('claim-documents')
  .createSignedUrl(doc.storage_path, 3600) // 1 hour

// Return: { ...doc, signedUrl: data.signedUrl }
```

**Source:** Supabase official docs — `createSignedUploadUrl` (valid 2 hours), `uploadToSignedUrl` (client PUT), `createSignedUrl` (read access).

### Pattern 4: Create-from-Policy API (CLM-07)

```typescript
// POST /api/claims
// Body: { policy_id: string, date_of_loss: string, description: string }
// Returns: { claim }

const { data: policy } = await supabase
  .from('insurance_policies')
  .select('crop, plan_type, coverage_level, guarantee, farm_name')
  .eq('id', policy_id)
  .single()

if (!policy) return NextResponse.json({ error: 'Policy not found' }, { status: 404 })

const effectiveGuarantee = (policy.guarantee ?? 0) * ((policy.coverage_level ?? 75) / 100)

const { data: claim } = await supabase.from('claims').insert({
  policy_id,
  stage: 'notice_of_loss',
  stage_entered_at: new Date().toISOString(),
  crop: policy.crop,
  coverage_type: policy.plan_type,  // RP / RP-HPE / YP
  coverage_level: policy.coverage_level,
  effective_guarantee: effectiveGuarantee,
  date_of_loss,
  description,
  // Auto-calculate initial deadline: 15 days after date_of_loss (FCIC Notice of Loss window)
  deadline_at: addDays(new Date(date_of_loss), 15).toISOString(),
  deadline_overridden: false,
}).select().single()

// Write creation event to timeline
await supabase.from('claim_timeline').insert({
  claim_id: claim.id,
  event_type: 'created',
  event_data: { policy_id, stage: 'notice_of_loss' },
  actor_id: user.id,
})
```

**Note on deadline:** The USDA FCIC Notice of Loss window is 15 calendar days after the loss event (or after the final planting date for prevented planting). This is confirmed by the project's USDA Service Center skill (`CCC-576 filed within 15 calendar days` — Section III, IV). The auto-deadline should be `date_of_loss + 15 days`. All deadlines are user-overridable per the locked decision.

### Pattern 5: Stage Transition (PATCH /api/claims/[id])

```typescript
// PATCH body: { stage: claim_stage } OR other fields
// On stage change: update stage + stage_entered_at, recalculate deadline, write timeline event

if (patch.stage && patch.stage !== currentClaim.stage) {
  // Recalculate deadline based on new stage + today's date
  const deadlineMap: Record<string, number> = {
    'filed': 60,        // 60 days after filing to adjuster inspection
    'adjuster_assigned': 30,
    'under_review': 45,
    'settled': 30,
    'closed': null,
  }
  const daysFromNow = deadlineMap[patch.stage]
  updateData.stage_entered_at = new Date().toISOString()
  if (daysFromNow && !patch.deadline_overridden) {
    updateData.deadline_at = addDays(new Date(), daysFromNow).toISOString()
  }

  // Write stage change to timeline
  await supabase.from('claim_timeline').insert({
    claim_id: id,
    event_type: 'stage_change',
    event_data: { from_stage: currentClaim.stage, to_stage: patch.stage },
    actor_id: user.id,
  })
}
```

**Note on deadline days:** The intermediate stage deadlines above are reasonable defaults for crop insurance claim processing (not hard regulatory windows like the 15-day Notice of Loss). They are user-overridable per the locked decision.

### Pattern 6: Module Registration

```typescript
// Add to glomalin-portal/src/lib/modules.ts — same additive pattern as fsa-578 and insurance
{
  id: 'claims',
  label: 'Claims',
  sublabel: 'Crop Insurance Claims',
  route: '/app/claims',
}
```

### Pattern 7: Migration Script

Follow exact pattern from `migrate-30.ts`:
- `scripts/migrate-31.ts`
- Inline `.env.local` parser (no dotenv package)
- Service role client (`createClient` with `SUPABASE_SERVICE_ROLE_KEY`)
- Print SQL to console before attempting exec
- Attempt `exec_sql` RPC, fall back gracefully if not available
- Verify columns exist by querying a row
- Idempotent: `CREATE TYPE IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DO $$ IF NOT EXISTS` for policies

**Note:** `CREATE TYPE` does not support `IF NOT EXISTS` in older PostgreSQL versions. Use a `DO $$ EXCEPTION WHEN ... END$$` block:
```sql
DO $$ BEGIN
  CREATE TYPE claim_stage AS ENUM ('notice_of_loss','filed','adjuster_assigned','under_review','settled','closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
```

### Pattern 8: Deadline Calculation Helper (lib/claims/calc.ts)

```typescript
// lib/claims/calc.ts — pure functions, no Supabase
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export const INITIAL_DEADLINE_DAYS = 15  // Notice of Loss: 15 days from date_of_loss

// Stage deadline offsets from stage_entered_at (user-overridable)
export const STAGE_DEADLINE_DAYS: Partial<Record<string, number>> = {
  'filed': 60,
  'adjuster_assigned': 30,
  'under_review': 45,
  'settled': 30,
}
```

### Anti-Patterns to Avoid

- **Routing file bytes through Server Actions:** Next.js has a 1MB body limit on Server Actions. This is a hard architectural constraint for this project. Always use signed URL pattern.
- **Using service_role key in browser client:** Never expose SUPABASE_SERVICE_ROLE_KEY client-side. The signed upload URL pattern avoids this — the server generates the URL, the browser uses the anon key client with `uploadToSignedUrl`.
- **Missing storage.objects RLS policies:** Unlike table RLS, storage.objects requires explicit policies on the `storage` schema, not the public schema. A missing policy causes silent permission-denied errors that look like bucket-not-found.
- **Creating the Storage bucket without enabling RLS:** Private buckets require `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` — this is already enabled in Supabase's hosted environment by default, but the migration script should verify.
- **Not scoping timeline writes to the API layer:** Don't use PostgreSQL triggers for timeline auto-events. Application code writes them explicitly in PATCH/POST handlers. This matches the established pattern and avoids debugging trigger execution.
- **Making policy_id unique on claims:** One policy can have multiple claims (prevented planting + harvest loss on same crop year). No UNIQUE constraint on `policy_id`.
- **Using `CREATE TYPE ... IF NOT EXISTS`:** Not universally supported. Use the DO/EXCEPTION block pattern instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time-limited upload URLs | Custom presigned URL logic | `supabase.storage.from('bucket').createSignedUploadUrl(path)` | Built-in 2-hour tokens with Storage-level auth |
| File bytes routing | Server Action with FormData | `uploadToSignedUrl(path, token, file)` in browser | Avoids 1MB Server Action limit |
| Signed read URLs | Serving file bytes via API route | `createSignedUrl(path, expiresIn)` | Built-in temporary access URLs |
| Date arithmetic | Custom date helpers | `addDays()` in `lib/claims/calc.ts` — 6 lines of pure JS | No `date-fns` needed for this phase (only add/subtract days) |
| Immutable timeline | UPDATE/DELETE policies | Append-only table with no update route | Simplest audit trail — no state management needed |

**Key insight:** Supabase Storage's signed URL pattern handles all upload security concerns. The only role of the API layer is (1) auth check, (2) URL generation, (3) metadata persistence. The browser handles the actual upload.

---

## Common Pitfalls

### Pitfall 1: Storage Bucket RLS vs Table RLS

**What goes wrong:** Developer creates bucket (private), writes RLS policies on `public.claim_documents` table, but upload returns `StorageError: new row violates row-level security policy` on `storage.objects`.
**Why it happens:** Supabase Storage has its own RLS on `storage.objects` in the `storage` schema, separate from app table RLS. Both must be configured.
**How to avoid:** Migration script must include explicit `storage.objects` policies scoped to `bucket_id = 'claim-documents'`.
**Warning signs:** `PUT` to signedUrl returns 403 even when user is authenticated and table RLS passes.

### Pitfall 2: `createSignedUploadUrl` vs `createSignedUrl`

**What goes wrong:** Developer conflates `createSignedUrl` (read/download) with `createSignedUploadUrl` (write/upload).
**Why it happens:** Both return a URL. `createSignedUrl` is for GET access (reading files). `createSignedUploadUrl` returns `{ path, token, signedUrl }` where the token is used by `uploadToSignedUrl`.
**How to avoid:** Upload flow = `createSignedUploadUrl` → client uses `uploadToSignedUrl`. Read flow = `createSignedUrl(expiresIn)`.
**Warning signs:** `uploadToSignedUrl` fails with 400 if you pass a download URL's token.

### Pitfall 3: Next.js 15 Dynamic Route Params

**What goes wrong:** `params.id` access fails with a type error or Promise rejection.
**Why it happens:** Next.js 15+ typed dynamic route params as `Promise<{ id: string }>`, not `{ id: string }`. This was caught in Phase 29 and is the project pattern.
**How to avoid:** Always `await params` before accessing: `const { id } = await params`.
**Warning signs:** TypeScript error `Property 'id' does not exist on type 'Promise<{ id: string }>'`.

### Pitfall 4: `CREATE TYPE IF NOT EXISTS` Not Supported

**What goes wrong:** Migration script fails on re-run with `ERROR: type "claim_stage" already exists`.
**Why it happens:** PostgreSQL < 9.1 doesn't support `CREATE TYPE ... IF NOT EXISTS`. Supabase may vary by project version.
**How to avoid:** Use DO/EXCEPTION block for enum creation (documented in Pattern 7 above).

### Pitfall 5: Storage Bucket Creation in Migration Script

**What goes wrong:** `supabase.storage.createBucket('claim-documents', { public: false })` returns error on second run.
**Why it happens:** `createBucket` doesn't have an idempotent flag by default.
**How to avoid:** Wrap in try/catch and ignore `duplicate_object` error, or check `listBuckets()` first. Document that user may need to create via Supabase Dashboard if exec fails.

### Pitfall 6: Missing `updated_at` Trigger on claims Table

**What goes wrong:** `updated_at` column stays at creation time even after PATCH updates.
**Why it happens:** `updated_at` requires a DB trigger. The `set_updated_at()` function exists from schema.sql but must be bound to new tables.
**How to avoid:** Include `CREATE TRIGGER claims_updated_at BEFORE UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION set_updated_at()` in migration SQL.

### Pitfall 7: Signed URL Upload Token Is Single-Use

**What goes wrong:** Retry logic on client upload fails with 400 on second attempt with same token.
**Why it happens:** Supabase signed upload URLs are single-use (the token is consumed on first PUT).
**How to avoid:** On upload failure, client must call `/api/claims/[id]/upload-url` again to get a fresh token. Document this in upload component (Phase 32).

---

## Code Examples

Verified patterns from official Supabase documentation:

### createSignedUploadUrl (server → client)
```typescript
// Source: https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
// Valid for 2 hours. Returns { path, token, signedUrl }.
const { data, error } = await supabase.storage
  .from('claim-documents')
  .createSignedUploadUrl('claims/abc-123/1234567890-doc.pdf')

// data = { path: 'claims/abc-123/...', token: '...', signedUrl: 'https://...' }
```

### uploadToSignedUrl (browser only — no server bytes)
```typescript
// Source: https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl
// Uses the anon-key browser client + token from createSignedUploadUrl
const { error } = await supabase.storage
  .from('claim-documents')
  .uploadToSignedUrl(data.path, data.token, file, {
    contentType: file.type
  })
```

### createSignedUrl (signed download URL for reading)
```typescript
// Source: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
// expiresIn in seconds. Return includes signedUrl string.
const { data, error } = await supabase.storage
  .from('claim-documents')
  .createSignedUrl('claims/abc-123/doc.pdf', 3600) // 1 hour
```

### Route handler auth pattern (matches existing project)
```typescript
// Source: established project pattern — matches /api/insurance/policies/[id]/route.ts
const supabase = await createClient()
const { data: { user }, error: userError } = await supabase.auth.getUser()
if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const { id } = await params   // await required — Next.js 15+ Promise params
```

### Enum type creation (idempotent)
```sql
-- Source: PostgreSQL documentation — handles re-run safely
DO $$ BEGIN
  CREATE TYPE claim_stage AS ENUM (
    'notice_of_loss', 'filed', 'adjuster_assigned',
    'under_review', 'settled', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
```

### storage.objects RLS policies
```sql
-- Source: https://supabase.com/docs/guides/storage/security/access-control
-- Must use storage schema, scope to bucket_id
CREATE POLICY "claim_docs_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'claim-documents');

CREATE POLICY "claim_docs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'claim-documents');

CREATE POLICY "claim_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'claim-documents');
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Route file bytes through API | `createSignedUploadUrl` + `uploadToSignedUrl` | Supabase Storage v2 (2023) | Bypasses 1MB Server Action limit; scales to large files |
| `params.id` as sync value | `await params` | Next.js 15 (2024) | Project already uses this — see Phase 29 decision log |
| Database triggers for audit trail | Application-layer timeline writes | Project architectural choice | Simpler debugging, matches existing patterns |
| Single global upload policy | Bucket-scoped storage.objects policies | Supabase Storage v2 | Scoping avoids cross-bucket RLS pollution |

---

## Open Questions

1. **Storage bucket creation via migration script**
   - What we know: `supabase.storage.createBucket()` requires service_role, which the migration script has. Works fine.
   - What's unclear: Whether the exec_sql RPC path can create Storage buckets (it can't — Storage is a separate service). Bucket must be created via JS client or Dashboard.
   - Recommendation: Migration script creates bucket via `supabase.storage.createBucket('claim-documents', { public: false })` with try/catch for duplicate. Print manual fallback instructions.

2. **RLS on storage.objects — anon key vs service_role for createSignedUploadUrl**
   - What we know: The STATE.md blocker note says: "Spike signed upload URL + RLS behavior in this Supabase project before building upload UI (service_role vs anon key upload path differs by project config)."
   - What we know from docs: `createSignedUploadUrl` requires `INSERT` permission on `storage.objects`. With anon key client + authenticated user, this should work if the RLS `INSERT` policy exists for the `authenticated` role.
   - What's unclear: Whether this specific Supabase project has `storage.objects` RLS enabled and whether prior phases accidentally disabled it. The STATE.md blocker specifically calls this out.
   - Recommendation: Plan 31-02 is explicitly the "signed URL spike" — verify the pattern works against the real Supabase project before building the full upload UI. Test both the `createSignedUploadUrl` call (server) and `uploadToSignedUrl` call (browser) with a test file. If it fails, the migration script's storage.objects RLS additions are the fix.

3. **County field on claims**
   - What we know: CONTEXT.md says "auto-fill from policy: crop, county..." but `insurance_policies` has `farm_name` not an explicit `county` field.
   - Recommendation: Omit `county` as a separate field. The `farm_name` and `farm_number` from the policy provide FSA farm identity. Phase 32 UI can display these directly.

---

## Validation Architecture

> Skipped — `workflow.nyquist_validation` not present in `.planning/config.json` (only `workflow.research`, `plan_check`, `verifier` are defined). Nyquist validation is not enabled.

---

## Sources

### Primary (HIGH confidence)
- Supabase official docs: `createSignedUploadUrl` — https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- Supabase official docs: `uploadToSignedUrl` — https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl
- Supabase official docs: `createSignedUrl` — https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
- Supabase official docs: Storage Access Control — https://supabase.com/docs/guides/storage/security/access-control
- Project source: `glomalin-portal/scripts/migrate-29.ts` — migration script pattern
- Project source: `glomalin-portal/scripts/migrate-30.ts` — migration script pattern (confirmed working)
- Project source: `glomalin-portal/src/app/api/insurance/policies/[id]/route.ts` — PATCH + auth pattern
- Project source: `glomalin-portal/src/lib/supabase/server.ts` + `browser.ts` — client creation pattern
- Project source: `glomalin-portal/src/middleware.ts` — module access (module id = 'claims' for route /app/claims)
- Project source: `.agents/skills/usda-service-center.md` — 15-day CCC-576 filing window confirmation

### Secondary (MEDIUM confidence)
- Medium article — "Signed URL file uploads with NextJs and Supabase" — confirms two-step pattern matches docs
- WebSearch verified: `createSignedUploadUrl` valid for 2 hours, single-use token

### Tertiary (LOW confidence)
- Stage deadline days (filed=60, adjuster_assigned=30, etc.) — these are reasonable crop insurance processing norms, not hard FCIC regulatory windows. The 15-day Notice of Loss deadline IS confirmed from the USDA Service Center skill document.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing @supabase/supabase-js has Storage built in
- Architecture: HIGH — schema design follows established FK chain; migration pattern from prior 3 phases verified
- Signed URL pattern: HIGH — verified against official Supabase docs
- Deadline values (intermediate stages): LOW — reasonable defaults, not regulatory requirements; user override always available
- Storage bucket RLS edge cases: MEDIUM — STATE.md blocker note indicates this needs empirical validation in Plan 31-02 spike

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (Supabase Storage API is stable; Next.js App Router is stable; no expected breaking changes)
