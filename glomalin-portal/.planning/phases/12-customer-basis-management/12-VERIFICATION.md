---
phase: 12-customer-basis-management
verified: 2026-06-27T00:00:00Z
status: gaps_found
score: 9/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Customers/[id] PATCH is scoped to the caller's farmId and only allowlists safe fields"
    status: failed
    reason: "CR-01: organic-cert PATCH handler passes raw request body directly to prisma.customer.update({ data: body }), allowing farmId and createdAt mass-assignment. Existence check does not scope by farmId."
    artifacts:
      - path: "organic-cert/src/app/api/marketing/customers/[id]/route.ts"
        issue: "Line 41: data: body — no field allowlist, no farmId scope on findUnique at line 37"
    missing:
      - "Field allowlist in prisma.customer.update — only name/type/shortCode/contactName/phone/email/organicCertNum/notes"
      - "farmId constraint on the pre-check findUnique({ where: { id, farmId } })"
      - "Same farmId scope fix on GET and DELETE existence checks in this file"
  - truth: "fetchCertServiceWithAuth always wins — Authorization header cannot be overridden by callers"
    status: failed
    reason: "CR-02: In proxy.ts lines 84-88, ...options?.headers is spread AFTER the Authorization header, allowing any caller that passes options.headers with an Authorization key to silently replace the validated Supabase token."
    artifacts:
      - path: "src/app/api/mobile/_lib/proxy.ts"
        issue: "Lines 85-86: Authorization set first, then ...options?.headers overwrites it"
    missing:
      - "Move ...options?.headers before the Authorization line so Authorization always wins"
human_verification: []
---

# Phase 12: Customer & Basis Management Verification Report

**Phase Goal:** Enable Sandy (office role) to manage marketing customers and log basis quotes; provide glomalin-portal with proxy API routes forwarding authenticated requests to organic-cert; deliver UI pages for Customers and Basis Quotes under /app/marketing/.
**Verified:** 2026-06-27
**Status:** gaps_found — 2 security gaps (CR-01, CR-02) block a clean pass; CR-03 is noted as a WARNING
**Re-verification:** No — initial verification

---

## Preliminary Notes

No PLAN.md or SUMMARY.md files exist in `.planning/phases/12-customer-basis-management/`. The only planning artifact present is `12-REVIEW.md` (a code-review report authored 2026-06-27). Must-haves were derived from the phase goal statement, the requirement IDs supplied by the caller, and the REVIEW.md's own file list (which serves as the definitive scope boundary). The requirement IDs CUSTOMER-01 through -03 and BASIS-01 through -02 do not appear in any REQUIREMENTS.md file in the repository — REQUIREMENTS.md was deleted from this milestone's working tree. All five IDs are verified by tracing their implied semantics against the actual code.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sandy (office role) can navigate to /app/marketing/customers | VERIFIED | `marketing-nav.tsx` includes Customers nav item with `stub: false`; `customers/page.tsx` exists with RSC auth guard |
| 2 | Sandy can see a list of existing customers | VERIFIED | `customers/page.tsx` calls `fetchCertServiceWithAuth('/api/marketing/customers', accessToken)` and passes result to `CustomerListClient` |
| 3 | Sandy can create a new customer (name + type required) | VERIFIED | `customer-form.tsx` POSTs to `/api/cert-proxy/marketing/customers`; cert-proxy forwards to organic-cert; POST route on organic-cert validates name/type and writes to Prisma |
| 4 | Sandy can edit an existing customer | VERIFIED (with CR-01 caveat) | `customer-form.tsx` PATCHes to `/api/cert-proxy/marketing/customers/{id}`; cert-proxy route exists and forwards; organic-cert PATCH handler updates record. Mass-assignment flaw does not block the intended edit flow but creates a security gap. |
| 5 | Sandy can navigate to /app/marketing/basis-quotes | VERIFIED | `marketing-nav.tsx` includes Basis Quotes nav item with `stub: false`; `basis-quotes/page.tsx` exists |
| 6 | Sandy can see existing basis quotes, filtered by grain variant | VERIFIED | `basis-quotes/page.tsx` fetches quotes + variants in parallel via `fetchCertServiceWithAuth`; `BasisQuoteListClient` renders filter select driven by variants |
| 7 | Sandy can log a new basis quote | VERIFIED | `basis-quote-form.tsx` POSTs to `/api/cert-proxy/marketing/basis-quotes`; cert-proxy route exists; organic-cert POST route writes to Prisma with farmId, variantId, basisValue, futuresMonth, quoteDate, location, source, confidenceTier |
| 8 | Proxy routes forward authenticated requests — non-authenticated callers receive 401 | VERIFIED (with CR-02 caveat) | All four cert-proxy routes check `session?.access_token` and return 401 if absent; forwarding uses `fetchCertServiceWithAuth` which sets Authorization header. CR-02 is a latent overridability bug, not a current functional breakage. |
| 9 | organic-cert marketing routes check role — office cannot delete, cannot access financial fields | VERIFIED | `marketing-auth.ts` permission matrix: `office` has customers.read/write, basis_quotes.read/write but not .delete. `requireOwnerForDelete()` guards DELETE on both customers/[id] and basis-quotes/[id]. |
| 10 | Customers PATCH is scoped to caller's farm and uses an allowlist | FAILED | `organic-cert/src/app/api/marketing/customers/[id]/route.ts` line 41: `data: body` passes raw body to Prisma. No field allowlist. `findUnique({ where: { id } })` has no farmId scope. |
| 11 | fetchCertServiceWithAuth Authorization header cannot be overridden by caller options | FAILED | `src/app/api/mobile/_lib/proxy.ts` lines 84-88: `...options?.headers` spread is AFTER `Authorization`, allowing caller override. |

**Score:** 9/11 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(protected)/app/marketing/layout.tsx` | Marketing layout with nav | VERIFIED | Renders `<MarketingNav />` + `{children}` |
| `src/app/(protected)/app/marketing/customers/page.tsx` | RSC page for customers | VERIFIED | Auth guard + `fetchCertServiceWithAuth` + `CustomerListClient` |
| `src/app/(protected)/app/marketing/basis-quotes/page.tsx` | RSC page for basis quotes | VERIFIED | Auth guard + parallel fetch (quotes + variants) + `BasisQuoteListClient` |
| `src/app/api/cert-proxy/marketing/customers/route.ts` | GET+POST proxy | VERIFIED | Both handlers present; use `getSession()` auth check + `fetchCertServiceWithAuth` |
| `src/app/api/cert-proxy/marketing/customers/[id]/route.ts` | PATCH+DELETE proxy | VERIFIED | Both handlers present |
| `src/app/api/cert-proxy/marketing/basis-quotes/route.ts` | GET+POST proxy | VERIFIED | Both handlers present |
| `src/app/api/cert-proxy/marketing/basis-quotes/[id]/route.ts` | DELETE proxy | VERIFIED | DELETE handler present |
| `src/components/marketing/customer-list.tsx` | Customer list client component | VERIFIED | Substantive — sortable table, edit drawer, `Add Customer` button |
| `src/components/marketing/customer-form.tsx` | Customer create/edit form | VERIFIED | Substantive — all fields, validation, error mapping including Duplicate message |
| `src/components/marketing/basis-quote-list.tsx` | Basis quote list client | VERIFIED | Substantive — variant filter, sorted table, confidence/source badges, `Log Quote` button |
| `src/components/marketing/basis-quote-form.tsx` | Basis quote form | VERIFIED | Substantive — all required fields with validation |
| `src/components/marketing/marketing-nav.tsx` | Marketing sub-nav | VERIFIED | Customers and Basis Quotes live (stub: false); Contracts and Deliveries stubbed |
| `src/lib/supabase/marketing-guard-rsc.ts` | RSC auth guard for marketing | VERIFIED | getUser() first, then getSession() for token forwarding — correct pattern |
| `organic-cert/src/app/api/marketing/customers/route.ts` | customers GET+POST | VERIFIED | Auth-gated, farmId-scoped, field-allowlisted on POST |
| `organic-cert/src/app/api/marketing/customers/[id]/route.ts` | customers GET+PATCH+DELETE | STUB (CR-01) | PATCH passes raw body to Prisma; findUnique not scoped to farmId |
| `organic-cert/src/app/api/marketing/basis-quotes/route.ts` | basis-quotes GET+POST | VERIFIED | Auth-gated, farmId-scoped |
| `organic-cert/src/app/api/marketing/basis-quotes/[id]/route.ts` | basis-quotes DELETE | VERIFIED | Owner-only delete with requireOwnerForDelete() |
| `organic-cert/src/app/api/marketing/grain-variants/route.ts` | grain-variants GET | WARNING (CR-03) | No auth check — see CR-03 below |
| `organic-cert/src/lib/marketing-auth.ts` | Permission matrix + auth helpers | VERIFIED | 18 owner permissions, 9 office permissions; getMarketingAuthContext uses supabaseAdmin.auth.getUser(token) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `customers/page.tsx` | `organic-cert /api/marketing/customers` | `fetchCertServiceWithAuth` → cert-proxy NOT used (RSC direct) | WIRED | Page calls cert service directly, not through cert-proxy; cert-proxy is for client-side form submits |
| `customer-form.tsx` | `/api/cert-proxy/marketing/customers` | `fetch('/api/cert-proxy/marketing/customers')` | WIRED | POST and PATCH calls confirmed at lines 107-109 |
| `basis-quotes/page.tsx` | `organic-cert /api/marketing/basis-quotes` + `/grain-variants` | `fetchCertServiceWithAuth` (direct) | WIRED | Promise.all at lines 12-15 |
| `basis-quote-form.tsx` | `/api/cert-proxy/marketing/basis-quotes` | `fetch(...)` | WIRED | Line 95 confirmed |
| `cert-proxy/customers/route.ts` | `organic-cert /api/marketing/customers` | `fetchCertServiceWithAuth` | WIRED | Lines 12-14 of route.ts |
| `cert-proxy/basis-quotes/route.ts` | `organic-cert /api/marketing/basis-quotes` | `fetchCertServiceWithAuth` | WIRED | Lines 12-14 of route.ts |
| `organic-cert routes` | Prisma `Customer` + `BasisQuote` models | `prisma.customer.*` / `prisma.basisQuote.*` | WIRED | Both models confirmed in schema.prisma at lines 1299 and 1216 |
| `marketing-auth.ts` | Supabase JWT validation | `supabaseAdmin.auth.getUser(token)` | WIRED | Line 114 — server-side token validation against Supabase Auth |
| `marketing-guard-rsc.ts` | Supabase user+session | `getUser()` then `getSession()` | WIRED | Correct pattern: identity check before token extraction |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `CustomerListClient` | `customers` prop | `prisma.customer.findMany({ where: { farmId } })` in organic-cert GET route | Yes — farmId-scoped DB query | FLOWING |
| `BasisQuoteListClient` | `quotes` prop | `prisma.basisQuote.findMany({ where: { farmId }, include: { variant } })` in organic-cert GET route | Yes — farmId-scoped DB query with variant join | FLOWING |
| `BasisQuoteListClient` | `variants` prop | `prisma.grainVariant.findMany({ include: { commodity } })` in grain-variants GET | Yes — DB query | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — marketing routes require live Supabase auth + organic-cert service. Cannot test without running services.

---

## Probe Execution

Step 7c: No probe scripts declared or found for this phase.

---

## Requirements Coverage

The requirement IDs CUSTOMER-01 through -03 and BASIS-01 through -02 do not appear in any committed REQUIREMENTS.md file. The file was deleted from this milestone's working tree (confirmed by absence of REQUIREMENTS.md in `.planning/` and all milestone subdirectories for the glomalin-portal). Coverage is assessed by matching the implied semantics of the IDs against the phase goal description and codebase evidence.

| REQ-ID | Implied Description | Status | Evidence |
|--------|---------------------|--------|----------|
| CUSTOMER-01 | Sandy can view and manage the customer list (read/write) | SATISFIED | `customers/page.tsx` + `CustomerListClient` + `customer-list.tsx` + cert-proxy routes + organic-cert routes all wired |
| CUSTOMER-02 | Customer CRUD on organic-cert with farmId isolation and RBAC | PARTIAL | POST creates with farmId; GET lists with farmId. PATCH is missing farmId scope + allowlist (CR-01). DELETE is owner-only gated. |
| CUSTOMER-03 | Customers UI accessible to office role, delete restricted to owner | SATISFIED | `getMarketingAuthContext(['owner','office'])` guards both pages; `requireOwnerForDelete()` enforced on DELETE |
| BASIS-01 | Sandy can view and log basis quotes filtered by grain variant | SATISFIED | `basis-quotes/page.tsx` + `BasisQuoteListClient` + `BasisQuoteForm` + cert-proxy + organic-cert all wired |
| BASIS-02 | Basis quote write (office) and delete (owner-only) enforced server-side | SATISFIED | `hasMarketingPermission(ctx.role, 'basis_quotes.write')` guards POST; `requireOwnerForDelete()` guards DELETE |

**CUSTOMER-02 is PARTIAL** due to CR-01.

---

## Security Findings (from 12-REVIEW.md, validated against codebase)

### BLOCKER — CR-01: PATCH customers/[id] allows mass-assignment of farmId

**File:** `organic-cert/src/app/api/marketing/customers/[id]/route.ts:41`
**Confirmed:** Line 41 reads `data: body` — no field allowlist. Line 37 `findUnique({ where: { id } })` has no farmId constraint.
**Impact:** An authenticated user can reassign a customer to a different farmId, breaking per-farm data isolation. Also enables cross-farm existence enumeration via GET and DELETE.
**Required fix before Phase 13 depends on this route:** Yes — Phase 13 contracts reference customer records.

### BLOCKER — CR-02: Authorization header overridable in fetchCertServiceWithAuth

**File:** `src/app/api/mobile/_lib/proxy.ts:85-88`
**Confirmed:** Headers object spreads `...options?.headers` after `Authorization`, allowing caller override.
**Impact:** Not currently triggered (all callers only pass Content-Type), but the function is exported and a future refactor that forwards incoming headers wholesale would bypass auth silently.
**Required fix:** Move `...options?.headers` before `Authorization` line.

### WARNING — CR-03: grain-variants GET route is unauthenticated

**File:** `organic-cert/src/app/api/marketing/grain-variants/route.ts:7`
**Confirmed:** No call to `getMarketingAuthContext`. Comment at line 5 says "no auth required (reference data)".
**Impact:** The route is on the internal network (port 3004) and is currently reachable via cert-proxy only through authenticated RSC pages. But an incorrect nginx config or dev proxy exposure would leak crop-year and variety data without credentials.
**Severity:** WARNING (not BLOCKER for current single-farm deployment) — but should be fixed before any multi-tenant or public-network exposure.

---

## Additional Warnings (from 12-REVIEW.md)

| ID | File | Issue | Severity |
|----|------|-------|----------|
| WR-01 | `basis-quote-list.tsx:125-129` | Date sort uses `new Date('')` which returns NaN; comparator returns NaN for dateless quotes, producing unstable sort | Warning |
| WR-02 | `basis-quote-form.tsx:73` | `!form.basisValue` passes whitespace; `parseFloat(' ')` returns NaN which JSON-serializes as null, hitting a Prisma constraint error as 500 instead of user-readable 400 | Warning |
| WR-03 | `basis-quote-list.tsx:49` | `role` prop accepted but never used in component body; Log Quote button always visible; delete gating will require it | Warning |
| WR-04 | `customer-list.tsx:58,69` | `localCustomers` state declared and populated but never mutated; `void setLocalCustomers` suppresses lint warning for dead state | Warning |
| WR-05 | All four cert-proxy route handlers | `getSession()` without prior `getUser()` — valid only because middleware runs `getUser()` on every protected path; removing the middleware PUBLIC_PREFIXES protection would silently remove the identity check | Warning |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `customer-form.test.tsx` | 50-53 | `expect(true).toBeDefined()` — stub test for Duplicate error mapping that always passes | Info | Test provides no regression coverage for the Duplicate → human-readable message branch in customer-form.tsx:119 |
| `basis-quote-list.test.tsx` | 31,40 | Test fixtures use `confidence: 'HIGH'` and `'MEDIUM'` which are not in the production CONFIDENCE_LABELS map | Info | Tests exercise graceful fallback paths, not real display paths |
| `customer-list.tsx` | 69 | `void setLocalCustomers` lint suppression for dead state | Warning | Inflates component state; comment claims optimistic update but `handleSaved` uses `router.refresh()` — no optimistic path exists |
| `basis-quote-list.tsx` | 126-129 | `new Date('').getTime()` returns NaN in sort comparator | Warning | Unstable sort for dateless quotes (possible with test fixtures; API schema marks quoteDate non-nullable but component type marks it nullable) |
| `marketing-nav.tsx` | 34-36 | Stub nav items use `pointer-events-none` but remain keyboard-activatable via Enter on some screen readers | Info | IN-03: Keyboard accessibility gap for stub links |

No TBD, FIXME, or XXX markers were found in any of the 19 source files reviewed.

---

## Human Verification Required

No items requiring human verification were identified. All functional wiring (auth, data fetch, form submit, RBAC enforcement) is verifiable statically. The security gaps (CR-01, CR-02, CR-03) are code defects, not UX judgments.

---

## Gaps Summary

Two gaps block a clean phase pass:

**Gap 1 — CR-01: Mass-assignment on PATCH customers/[id] (organic-cert)**
Root cause: `data: body` passed directly to Prisma without field allowlist. The `findUnique` existence check also lacks a `farmId` constraint, enabling cross-farm record existence probing.
File: `organic-cert/src/app/api/marketing/customers/[id]/route.ts`
Fix: Allowlist fields in the PATCH data object; add `farmId` to all `findUnique({ where: ... })` calls in this file.

**Gap 2 — CR-02: Authorization header overridable in proxy (glomalin-portal)**
Root cause: `...options?.headers` spread follows the `Authorization` assignment in `fetchCertServiceWithAuth`, violating the "explicit always wins" pattern used elsewhere.
File: `src/app/api/mobile/_lib/proxy.ts:83-88`
Fix: Reorder to `{ 'Content-Type': 'application/json', ...options?.headers, 'Authorization': \`Bearer ${accessToken}\` }`.

These two gaps should be resolved before Phase 13, which will introduce grain contracts that reference customer records — at that point CR-01's farmId bypass becomes a higher-priority exploit surface.

CR-03 (grain-variants unauthenticated) is documented as a WARNING. It is not a current BLOCKER given the service is internal-only, but should be resolved in the same fix batch as CR-01/CR-02.

---

_Verified: 2026-06-27_
_Verifier: Claude (gsd-verifier)_
