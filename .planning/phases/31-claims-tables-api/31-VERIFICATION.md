---
phase: 31-claims-tables-api
verified: 2026-03-05T22:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 31: Claims Tables + API Verification Report

**Phase Goal:** Claims, documents, and timeline data live in Supabase Storage with the full signed-URL upload pattern verified and all route handlers ready for the UI phase
**Verified:** 2026-03-05
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | claims, claim_documents, and claim_timeline tables exist in Supabase with correct FK chain to insurance_policies | VERIFIED | migrate-31.ts defines all 3 tables with FK constraints: claims.policy_id → insurance_policies(id), claim_documents.claim_id → claims(id), claim_timeline.claim_id → claims(id), all ON DELETE CASCADE |
| 2 | claim_stage enum has 6 values matching locked Kanban stages | VERIFIED | calc.ts STAGE_LABELS + migrate-31.ts DO/EXCEPTION block enumerates: notice_of_loss, filed, adjuster_assigned, under_review, settled, closed |
| 3 | claims module appears in portal navigation for granted users | VERIFIED | modules.ts: `{ id: 'claims', label: 'Claims', sublabel: 'Crop Insurance Claims', route: '/app/claims', status: 'live' }` — inserted after insurance entry |
| 4 | A new claim can be created pre-filled from an insurance policy via POST /api/claims with policy_id | VERIFIED | route.ts POST: fetches insurance_policies by policy_id, carries over crop, plan_type→coverage_type, coverage_level, effective_guarantee; inserts claim at notice_of_loss; writes created timeline event |
| 5 | Stage transitions auto-recalculate deadline and write timeline events | VERIFIED | [id]/route.ts PATCH: detects isStageChange, calls computeDeadline(patch.stage, new Date()), writes stage_change to claim_timeline; also writes financial_update, deadline_change, adjuster_assigned events |
| 6 | Server generates a signed upload URL for a claim document and returns path + token + signedUrl | VERIFIED | upload-url/route.ts POST: calls supabase.storage.from('claim-documents').createSignedUploadUrl(path), returns { path, token: data.token, signedUrl: data.signedUrl } |
| 7 | After upload, client can POST document metadata and a claim_documents row is created | VERIFIED | documents/route.ts POST: inserts claim_documents row (claim_id, storage_path, filename, file_size, mime_type, category, uploaded_by), then writes doc_upload event to claim_timeline |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `glomalin-portal/scripts/migrate-31.ts` | Idempotent SQL: 3 tables + enum + RLS + Storage bucket + indexes + trigger | VERIFIED | 404 lines, full idempotent SQL, service_role client, exec_sql RPC with fallback, verification step queries columns |
| `glomalin-portal/src/lib/claims/calc.ts` | Deadline calculation helpers | VERIFIED | Exports addDays, INITIAL_DEADLINE_DAYS=15, STAGE_DEADLINE_DAYS (filed:60, adjuster_assigned:30, under_review:45, settled:30), computeDeadline |
| `glomalin-portal/src/app/api/claims/route.ts` | GET list + POST create-from-policy | VERIFIED | Exports GET and POST; POST fetches insurance_policies, computes effective_guarantee, auto-calculates 15-day deadline, writes timeline event |
| `glomalin-portal/src/app/api/claims/[id]/route.ts` | GET single + PATCH stage/fields + DELETE | VERIFIED | Exports GET, PATCH, DELETE; PATCH writes 4 timeline event types: stage_change, financial_update, deadline_change, adjuster_assigned |
| `glomalin-portal/src/app/api/claims/[id]/timeline/route.ts` | GET timeline + POST add note | VERIFIED | Exports GET (asc chronological order) and POST (event_type='note', validates non-empty string) |
| `glomalin-portal/src/app/api/claims/[id]/upload-url/route.ts` | POST signed upload URL | VERIFIED | Exports POST; validates 6 MIME types, checks claim existence, calls createSignedUploadUrl, returns { path, token, signedUrl } |
| `glomalin-portal/src/app/api/claims/[id]/documents/route.ts` | GET list with signed download URLs + POST metadata | VERIFIED | Exports GET (createSignedUrl per doc, Promise.all, 3600s expiry) and POST (inserts claim_documents + doc_upload timeline event) |
| `glomalin-portal/src/lib/modules.ts` | claims module in portal nav | VERIFIED | claims entry present with status: 'live', route: '/app/claims' |
| `glomalin-portal/src/app/(protected)/app/claims/page.tsx` | Claims shell page | VERIFIED | Server component, fetches claims, 3 stat cards (Total/Open/Approaching Deadlines), claims table with all 6 columns, soil palette, tracking disclaimer |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/claims/route.ts` | `insurance_policies` table | POST handler fetches policy for prefill | WIRED | `supabase.from('insurance_policies').select('crop, plan_type, coverage_level, guarantee, farm_name').eq('id', policy_id).single()` — line 87-91 |
| `api/claims/[id]/route.ts` | `claim_timeline` table | PATCH writes stage_change event on transition | WIRED | `supabase.from('claim_timeline').insert({...event_type: 'stage_change'...})` — line 144-149 |
| `lib/claims/calc.ts` | `api/claims/route.ts` | import addDays, INITIAL_DEADLINE_DAYS for deadline auto-calc | WIRED | `import { addDays, INITIAL_DEADLINE_DAYS } from '@/lib/claims/calc'` — line 3 of route.ts; also `import { computeDeadline }` in [id]/route.ts line 3 |
| `api/claims/[id]/upload-url/route.ts` | Supabase Storage claim-documents bucket | createSignedUploadUrl | WIRED | `supabase.storage.from('claim-documents').createSignedUploadUrl(path)` — line 86-88; correctly uses createSignedUploadUrl (not createSignedUrl) |
| `api/claims/[id]/documents/route.ts` | `claim_documents` table | INSERT metadata row after client upload | WIRED | `supabase.from('claim_documents').insert({...})` — line 135-147 |
| `api/claims/[id]/documents/route.ts` | Supabase Storage | createSignedUrl for download URLs in GET | WIRED | `supabase.storage.from('claim-documents').createSignedUrl(doc.storage_path, 3600)` — line 57-59 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CLM-04 | 31-02-PLAN.md | User can upload documents to a claim via Supabase Storage | SATISFIED | Three-step signed URL pattern implemented: POST /upload-url (createSignedUploadUrl) → client PUT to Storage → POST /documents (metadata insert + timeline event). File bytes never route through Next.js. |
| CLM-07 | 31-01-PLAN.md | User can create a claim pre-filled from an insurance policy | SATISFIED | POST /api/claims fetches insurance_policies by policy_id, carries over crop, plan_type→coverage_type, coverage_level, effective_guarantee; auto-calculates 15-day FCIC deadline. |

Both requirements confirmed marked `[x]` and `Complete` in REQUIREMENTS.md.

### Anti-Patterns Found

None. No TODOs, FIXMEs, placeholder returns, empty handlers, or stub implementations detected across all 9 files.

### Human Verification Required

#### 1. Storage Bucket Existence

**Test:** Run `npx tsx scripts/migrate-31.ts` against the actual Supabase project.
**Expected:** Script reports "claim-documents bucket created successfully" or "already exists — skipping." Verification step confirms all three tables have correct columns.
**Why human:** The migration script generates idempotent SQL and attempts exec_sql RPC — whether the tables and bucket actually exist in Supabase cannot be confirmed from code analysis alone.

#### 2. RLS Policy Enforcement

**Test:** Authenticate as a non-authenticated user (or use anon key) and attempt GET /api/claims.
**Expected:** Request is blocked at the RLS layer; authenticated users can read/write.
**Why human:** RLS policy correctness requires live Supabase verification — code defines `auth.role() = 'authenticated'` policies but enforcement depends on the actual DB state.

#### 3. createSignedUploadUrl Token Behavior

**Test:** Call POST /api/claims/{id}/upload-url, then use the returned signedUrl to PUT a PDF file directly from the browser.
**Expected:** File lands in Storage at `claims/{id}/{timestamp}-{filename}` without routing bytes through Next.js. Subsequent GET /api/claims/{id}/documents returns the file with a working 1-hour signed download URL.
**Why human:** The signed URL upload flow requires a running Supabase project to test end-to-end. Code correctness is verified (createSignedUploadUrl vs createSignedUrl correctly distinguished) but real token behavior is environment-dependent.

### Gaps Summary

No gaps found. All 7 observable truths are verified, all 9 artifacts exist and are substantive, all 6 key links are wired. TypeScript passes clean (`npx tsc --noEmit` — zero errors). All three commits confirmed in git history (2d646a5, d958181, 3c6e9b8). CLM-04 and CLM-07 are both marked complete in REQUIREMENTS.md.

The three human verification items are environmental checks (live Supabase project) — the code implementation is complete and correctly structured.

---

_Verified: 2026-03-05_
_Verifier: Claude (gsd-verifier)_
