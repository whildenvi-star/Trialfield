# Stack Research

**Domain:** Organic certification audit system — Case IH Field Ops integration + USDA NOP audit reporting
**Researched:** 2026-02-23
**Confidence:** MEDIUM-HIGH (Case IH API verified against existing working code; PDF approach verified against npm registry; audit store patterns verified against PostgreSQL official docs and 2025 community resources)

---

## Context: What Already Exists (Do Not Re-add)

The organic-cert app already has the following. This research covers only the **new additions** needed for this milestone.

| Already Present | Do Not Touch |
|-----------------|--------------|
| `@react-pdf/renderer` 4.3.2 | PDF infrastructure exists |
| Prisma 6 + PostgreSQL | Database layer exists |
| `audit-logger.ts` + `AuditLog` model | Basic audit log exists (needs hardening) |
| `next-auth` 5.0.0-beta.30 | Auth exists |
| `node-cron` 3.0.0 (in farm-budget) | Cron pattern exists but not in organic-cert |
| `date-fns` 4.1.0 | Date utilities exist |

---

## Recommended Stack — New Additions Only

### Case IH Field Ops API Integration

The farm-budget app already has a working implementation in `/farm-budget/fieldops/client.js` and `/farm-budget/fieldops/sync.js`. Port this to TypeScript for organic-cert. No new libraries needed for the HTTP layer — Node 22's native `fetch` handles it.

**Verified endpoints from existing working code:**

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `https://identity.cnhind.com/oauth2/aus78lla80kTGmPFf1t7/v1/token` | Token acquisition | Basic Auth (client_id:client_secret) |
| `https://ag.api.cnhind.com/v1/fields` | Field list | Bearer + Ocp-Apim-Subscription-Key |
| `https://ag.api.cnhind.com/v1/fields/{id}/boundary` | Field boundary GeoJSON | Bearer + Ocp-Apim-Subscription-Key |
| `https://ag.api.cnhind.com/v1/applications` | Input applications (seed/fertilizer/pesticide) | Bearer + Ocp-Apim-Subscription-Key |
| `https://ag.api.cnhind.com/v1/yield` | Harvest yield data | Bearer + Ocp-Apim-Subscription-Key |
| `https://ag.api.cnhind.com/v1/equipment` | Machine fleet | Bearer + Ocp-Apim-Subscription-Key |
| `https://ag.api.cnhind.com/v1/telemetry` | Machine telemetry (hours, fuel, operations) | Bearer + Ocp-Apim-Subscription-Key |

**OAuth2 flow:** `client_credentials` grant. Scopes: `fields equipment yield applications telemetry`. Tokens are short-lived; cache with 60-second buffer before expiry.

**Required env vars:**
```
FIELDOPS_CLIENT_ID=
FIELDOPS_CLIENT_SECRET=
FIELDOPS_SUBSCRIPTION_KEY=
FIELDOPS_TOKEN_URL=https://identity.cnhind.com/oauth2/aus78lla80kTGmPFf1t7/v1/token
FIELDOPS_API_BASE=https://ag.api.cnhind.com
FIELDOPS_USE_MOCK=false
```

**Confidence:** HIGH — token URL and endpoint paths verified against existing working farm-budget/fieldops/client.js code. Authorization URL pattern also confirmed via CNH Developer Portal web search (`identity.cnhind.com/authorize?client_id=...&scope=offline_access&connection=PROD-ADFS-CONN`).

**Note on authorization_code vs client_credentials:** The CNH Developer Portal describes an authorization_code flow (user logs into FieldOps and consents). The existing farm-budget code uses client_credentials. For server-to-server sync (what this system needs), client_credentials is appropriate. For a user-facing "Connect your FieldOps account" flow, authorization_code would be used instead. This milestone should use client_credentials with credentials managed by the farm operator — matching the existing pattern. Confidence: MEDIUM (not confirmed against paid CNH developer account; test with FIELDOPS_USE_MOCK=true first).

---

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Native `fetch` (Node 22) | Built-in | CNH FieldOps API HTTP calls | Already available in Node 22, no new dependency. The farm-budget implementation proves this works. |
| Node.js `crypto` module | Built-in | SHA-256 hash chain for audit tamper-evidence | Zero dependency; Web Crypto API available in both Node 22 and browser. No need for third-party hashing library. |
| `pg-boss` | 12.13.0 | Scheduled Field Ops sync + audit snapshot jobs | Runs on top of existing PostgreSQL — no Redis required. `client_credentials` token refresh and periodic sync fit its cron-based scheduling model. Unlike node-cron (which is already in farm-budget but runs in-process), pg-boss provides job persistence, deduplication, and retry across restarts. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@ag-media/react-pdf-table` | 2.0.3 | Table layout inside @react-pdf/renderer PDFs | Use for the NOP inspection report's input records table, crop rotation table, and mass balance table. @react-pdf/renderer has no built-in Table component; this fills that gap cleanly. |
| `zod` | Already in ecosystem (verify if present) | Runtime validation of CNH API response payloads | Use to validate that CNH API responses match expected shape before persisting to Postgres. CNH API shape is not formally versioned; defensive parsing prevents silent data corruption. |

**Check first:** Run `grep -r '"zod"' /Users/glomalinguild/Desktop/my-project-one/organic-cert/package.json` — if zod is already installed, no action needed. If not, add it.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript strict mode | Type-checking the FieldOps client and audit store | The existing `tsconfig.json` should already enforce strict mode; verify it's set. |
| `FIELDOPS_USE_MOCK=true` env flag | Local development without live CNH credentials | The farm-budget pattern of falling back to mock data is the right model to replicate in organic-cert. Implement mock-data.ts alongside the real client. |

---

## Append-Only Tamper-Evident Audit Store

### Current State Assessment

The existing `AuditLog` Prisma model and `audit-logger.ts` implement basic event logging (CREATE/UPDATE/DELETE with JSON snapshots). What it **lacks** for regulatory-grade tamper-evidence:

1. No `prevHash` column — entries are independent, not chained
2. No hash of entry content — a database admin can silently edit rows
3. No PostgreSQL-level write protection — the app role can UPDATE/DELETE audit rows via Prisma
4. No `GRANT`/`REVOKE` enforcement separating the audit writer from an audit destroyer

### Recommended Implementation: SHA-256 Hash Chain in PostgreSQL

**Do not add a new table.** Extend the existing `AuditLog` table with two columns:

```sql
-- Migration to add tamper-evidence columns
ALTER TABLE "AuditLog" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "prevHash"    TEXT;

-- Deny UPDATE and DELETE on AuditLog to the application database role
-- (Run as superuser/owner, not the app role)
REVOKE UPDATE, DELETE ON "AuditLog" FROM your_app_db_role;
```

**Hash chain logic (application layer, in audit-logger.ts):**

```typescript
import { createHash } from 'crypto';

function hashEntry(entry: {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  newData: unknown;
  timestamp: Date;
  prevHash: string | null;
}): string {
  // Canonical JSON: sorted keys, deterministic output
  const canonical = JSON.stringify({
    id: entry.id,
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    newData: entry.newData,
    timestamp: entry.timestamp.toISOString(),
    prevHash: entry.prevHash,
  }, Object.keys({
    id: 1, userId: 1, action: 1, entityType: 1,
    entityId: 1, newData: 1, timestamp: 1, prevHash: 1,
  }).sort());

  return createHash('sha256').update(canonical).digest('hex');
}
```

**Why this approach:**

- Uses Node's built-in `crypto` module — zero new dependencies
- Each row's `contentHash` = SHA-256 of the row's own fields + `prevHash` of the prior row
- Any modification to a historical row breaks all subsequent hashes — detectable on audit export
- `REVOKE UPDATE, DELETE` at the PostgreSQL role level prevents application-layer tampering (the app can still INSERT via Prisma)
- NOP inspectors don't need to understand cryptography; the hash chain is verified at export time and surfaced as "Audit integrity: VERIFIED" on the PDF report

**Confidence:** HIGH — SHA-256 hash chain pattern confirmed via DEV Community December 2025 post and PostgreSQL wiki. REVOKE approach confirmed via PostgreSQL 18 official documentation on row security policies. Node `crypto` module is stable and built-in.

**What NOT to use:**

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| pgaudit extension | Requires PostgreSQL superuser installation, logs at the session level (not row level), cannot be queried by the application, and adds ops complexity. Overkill for a single-app audit trail. | Application-layer hash chain with REVOKE |
| Trillian / Certificate Transparency logs | Google's distributed ledger system. Massive operational overhead. Appropriate for public certificate issuance, not a farm audit trail with dozens of users. | SHA-256 hash chain in PostgreSQL |
| BullMQ | Requires Redis as a separate infrastructure dependency. The system already runs PostgreSQL; pg-boss uses the same database. | pg-boss 12.x |
| Separate `AuditLogTamperEvident` table | Tempting to keep concerns separate, but adds schema complexity and a join on every audit query. Extend the existing table with new columns instead. | ALTER TABLE AuditLog ADD COLUMN |

---

## PDF Report Generation

### Current State Assessment

`@react-pdf/renderer` 4.3.2 is already installed and in use. The NOP inspection report is a data-dense document: field history tables, input records, crop rotation records, mass balance calculations, and a cover page. The library handles this well.

### Required Addition: `@ag-media/react-pdf-table`

Version: `2.0.3` (current as of 2026-02-23, verified via npm)

Why: `@react-pdf/renderer` has no built-in table primitive. `@ag-media/react-pdf-table` provides `<Table>`, `<TR>`, `<TH>`, `<TD>` components designed specifically for react-pdf. It handles cell borders, column widths, and page-break-safe row wrapping — all required for inspector-ready tabular data.

**NOP Report Structure (what the PDF must contain):**

Based on 7 CFR Part 205 (specifically 205.202 and 205.203) and NOP certification requirements:

1. **Cover Page** — Farm name, operator, certifier, inspection date, certification year
2. **Field Summary Table** — Field name, acres, crop, lot number, certification status per field
3. **3-Year Land History** — Each field: crop per year, any prohibited substance applications (36-month lookback per 205.202)
4. **Input Records Table** — Date, field, product name, EPA/OMRI status, application rate, purpose (per 205.203)
5. **Crop Rotation Plan** — Current year vs prior 3 years per field (205.205)
6. **Harvest Records** — Date, field, yield, equipment used, lot number
7. **Mass Balance Summary** — Inputs vs outputs per crop lot (C5.0 compliance — already calculated)
8. **Audit Log Section** — Last 12 months of system audit events, hash chain verification status
9. **Page footers** — Page X of Y, farm name, "Generated: [date]", "USDA NOP Certification Report"

**Fixed headers/footers:** Use `@react-pdf/renderer`'s `fixed` prop on `<View>` to repeat header and footer on every page.

**Confidence:** MEDIUM-HIGH — report structure derived from 7 CFR Part 205 regulatory text and NOP 2601 certification process guidance. Specific form field requirements vary by certifying agency; the structure above covers the regulatory minimum.

---

## Background Sync Jobs

### Recommended: `pg-boss` 12.13.0

**Why pg-boss over node-cron:**

node-cron (already in farm-budget) runs in-process — if the server restarts during a sync, the job is lost silently. pg-boss stores jobs in PostgreSQL with guaranteed delivery and retry. For a sync that imports regulatory data (field operations, applications, harvest records), silent failures are unacceptable.

**Install in organic-cert only:**
```bash
npm install pg-boss
```

**Cron job: FieldOps daily sync**
```typescript
// src/jobs/fieldops-sync-job.ts
import PgBoss from 'pg-boss';

const boss = new PgBoss(process.env.DATABASE_URL!);

await boss.start();

// Sync FieldOps data every day at 2 AM
await boss.schedule('fieldops-sync', '0 2 * * *', {});

boss.work('fieldops-sync', async () => {
  // call the FieldOps client and upsert into Prisma models
});
```

**Cron job: Audit log snapshot (weekly)**
```typescript
await boss.schedule('audit-snapshot', '0 3 * * 0', {});
boss.work('audit-snapshot', async () => {
  // Export and verify hash chain integrity, archive to backup table
});
```

**Confidence:** MEDIUM — pg-boss 12.x cron API confirmed via npm and LogSnag blog (TypeScript deep-dive, 2025). Job deduplication and retry verified against pg-boss GitHub README.

---

## Installation

```bash
# In organic-cert directory

# New dependencies
npm install pg-boss @ag-media/react-pdf-table

# No new dev dependencies needed — TypeScript, ESLint, tsx already present
```

**Do not install:**
- `axios` — native fetch in Node 22 handles the CNH API calls
- `bull` / `bullmq` — requires Redis; pg-boss uses existing PostgreSQL
- `pgaudit` — PostgreSQL extension requiring superuser; not needed for app-layer hash chain
- `jose` / `jsonwebtoken` — CNH uses standard OAuth2 Bearer tokens, no JWT verification needed in the client

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| pg-boss 12.x | node-cron 4.x | Use node-cron only if you don't care about job persistence across restarts and the task is non-critical. For regulatory data sync, use pg-boss. |
| pg-boss 12.x | BullMQ | Use BullMQ if you already have Redis deployed and need high-throughput job queuing (thousands of jobs/second). For 1-2 daily cron jobs, Redis overhead is not justified. |
| Native crypto SHA-256 | bcrypt for audit hashing | bcrypt is for password hashing (intentionally slow). SHA-256 is correct for tamper-detection hash chains (fast, deterministic, chainable). |
| @ag-media/react-pdf-table | Manual View+Text tables in react-pdf | Manual layout works for 2-3 column simple tables but breaks on dynamic row counts and complex borders. Use @ag-media/react-pdf-table for any table that needs column headers and multi-row data. |
| Extend existing AuditLog table | New TamperEvidentLog table | A second table is cleaner in theory but doubles the schema surface and requires joining for the audit viewer. Extend the existing table — the app is already built around it. |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| pg-boss@12.13.0 | PostgreSQL 14+ | Uses SKIP LOCKED and advisory locks. Verify PostgreSQL version is 14+. |
| pg-boss@12.13.0 | Node 22 | ESM and CJS both supported. Use `import PgBoss from 'pg-boss'` in TypeScript. |
| @ag-media/react-pdf-table@2.0.3 | @react-pdf/renderer@4.x | Peer dependency is `@react-pdf/renderer >= 3.0.0`. Compatible with 4.3.2. |
| pg-boss@12.13.0 | Prisma 6 | pg-boss manages its own PostgreSQL connection (separate from Prisma client). No conflict; they use separate connection pools. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `axios` for CNH API calls | No benefit over native fetch in Node 22; adds a dependency for no gain | Native `fetch` (already available) |
| `bullmq` | Requires Redis infrastructure; this project already has PostgreSQL | `pg-boss` |
| `pgaudit` PostgreSQL extension | Requires superuser/DBA installation, logs at session level not row level, not queryable by app, operational overhead | Application-layer SHA-256 hash chain + REVOKE in PostgreSQL |
| `jsonwebtoken` / `jose` | CNH tokens are opaque Bearer tokens, not JWTs that need client-side verification | Not needed; just pass Bearer token in Authorization header |
| A second `TamperEvidentLog` Prisma model | Splits the audit record across two tables; requires migration and schema changes that ripple into the audit viewer, export, and PDF | Extend existing `AuditLog` with `contentHash` and `prevHash` columns |
| `pdfmake` or `puppeteer` for PDF | App already uses @react-pdf/renderer; adding a second PDF library creates inconsistency and bundle bloat | Continue with @react-pdf/renderer + @ag-media/react-pdf-table |
| `authorization_code` OAuth2 flow for CNH sync | Requires user interaction to grant consent each session; unsuitable for server-side nightly sync | `client_credentials` flow (already implemented in farm-budget) |

---

## Stack Patterns by Variant

**If CNH credentials are not yet available:**
- Set `FIELDOPS_USE_MOCK=true` in `.env`
- Implement `fieldops/mock-data.ts` in organic-cert matching the farm-budget pattern
- Build all sync and display code against mock data; swap to live when credentials arrive

**If pg-boss adds too much complexity for v1:**
- Use the existing `node-cron` pattern from farm-budget as a simpler alternative
- Acceptable trade-off: sync jobs don't survive server restarts, acceptable if the app runs continuously
- Migrate to pg-boss when reliability requirements increase

**If the NOP report PDF becomes very large (50+ pages):**
- Use `@react-pdf/renderer`'s `PDFDocument` streaming API rather than buffering the full PDF in memory
- Stream to `res` in the Next.js API route handler instead of `await pdf.toString()`

---

## Sources

- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/fieldops/client.js` — Token URL, API base URL, scope, subscription key header, and mock fallback pattern. HIGH confidence (working production code in this repo).
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/fieldops/sync.js` — API endpoint paths (`/v1/fields`, `/v1/applications`, `/v1/yield`, `/v1/equipment`, `/v1/telemetry`). HIGH confidence.
- `https://develop.cnh.com/api-guides/fieldops-api` — API endpoint categories confirmed (Tokens, Vehicle Telemetry, Equipment, Farm Setup, Operations By Vehicle, Files, Webhooks). MEDIUM confidence (public portal, no auth required to view overview).
- `https://develop.cnh.com/get-started` — OAuth2 authorization_code flow pattern; Auth0 callback URL; company email domain requirement. MEDIUM confidence.
- WebSearch: CNH FieldOps OAuth2 authorization URL pattern with `offline_access` scope and `identity.cnhind.com` identity provider. MEDIUM confidence (search result synthesis, not direct doc access).
- npm registry: `@ag-media/react-pdf-table@2.0.3` — current version, peer dep on react-pdf >=3.0.0. HIGH confidence.
- npm registry: `pg-boss@12.13.0` — current version. HIGH confidence.
- npm registry: `@react-pdf/renderer@4.3.2` — confirmed existing version. HIGH confidence.
- `https://dev.to/veritaschain/building-a-tamper-evident-audit-log-with-sha-256-hash-chains-zero-dependencies-h0b` — SHA-256 hash chain pattern with canonical JSON and Web Crypto API. MEDIUM confidence (community post, 2025).
- PostgreSQL official docs (row security policies, REVOKE): `https://www.postgresql.org/docs/current/ddl-rowsecurity.html` — REVOKE UPDATE/DELETE pattern. HIGH confidence.
- 7 CFR Part 205 (NOP regulations): `https://www.ecfr.gov/current/title-7/subtitle-B/chapter-I/subchapter-M/part-205` — Field history, input records, crop rotation, 36-month lookback requirements. HIGH confidence (official federal regulation).
- `https://logsnag.com/blog/deep-dive-into-background-jobs-with-pg-boss-and-typescript` — pg-boss TypeScript cron scheduling pattern. MEDIUM confidence (third-party blog, 2025).

---

*Stack research for: Organic audit system — Case IH Field Ops integration + USDA NOP audit reporting*
*Researched: 2026-02-23*
