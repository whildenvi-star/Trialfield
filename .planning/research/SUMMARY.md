# Project Research Summary

**Project:** Organic Certification Audit System — Case IH Field Ops Integration + USDA NOP Audit Reporting
**Domain:** Regulatory compliance software (agricultural / USDA NOP organic certification)
**Researched:** 2026-02-23
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone adds two major capabilities to an existing `organic-cert` Next.js application: (1) automated field operation data ingestion from the Case IH FieldOps API, and (2) a print-ready USDA NOP inspection report PDF. The existing app already has Prisma/PostgreSQL, NextAuth/RBAC, lot number generation, mass balance logic, CSV import/export, and `@react-pdf/renderer` in place — this is an extension milestone, not a greenfield build. The right approach is to port the working `farm-budget/fieldops/client.js` and `sync.js` to TypeScript, harden the existing `AuditLog` model with SHA-256 hash chaining and PostgreSQL role-level write restrictions, and assemble a compliant NOP inspection report from normalized data. Two new packages are all that is required: `pg-boss` (durable background sync jobs on top of existing PostgreSQL, no Redis) and `@ag-media/react-pdf-table` (table components for the PDF report).

The critical regulatory constraint is that USDA NOP requires tamper-evident, append-only records with 5-year retention, full lot-to-field traceability, and mass balance reconciliation at every annual inspection. The SOE 2024 rule (effective March 2024) added fraud prevention plan requirements and made mass balance audits mandatory at every inspection rather than just initial certification. Missing any of the table-stakes record types (3-year field history, input application records with approval status, seed source documentation, harvest records with lot linkage, buffer zone documentation) means the inspection report cannot be generated in a passing state regardless of how complete the rest of the system is.

The top risks are: (1) CNH FieldOps "Linked Account" exclusion silently returning zero data post-auth — detect and surface this immediately during onboarding; (2) audit store immutability enforced only in the application layer without PostgreSQL role-level protection — enforce via `REVOKE UPDATE, DELETE` or RLS before any audit data is written; (3) NOP report built to look complete but missing inspector traceback linkages — consult an actual certifier inspection worksheet before building any PDF layout. Build the sync service first, then harden the audit store, then build the field history UI for data validation, then generate the report. This dependency order reflects the data pipeline: the report is purely read-only aggregation of what the first three phases produce.

---

## Key Findings

### Recommended Stack

The existing stack requires only two net-new production packages. `pg-boss@12.13.0` replaces the in-memory `node-cron` pattern for Case IH sync jobs — it uses the existing PostgreSQL connection, provides job deduplication and retry across server restarts, and is appropriate for the 1-2 daily cron jobs this system needs (no Redis required). `@ag-media/react-pdf-table@2.0.3` provides the `<Table>`, `<TR>`, `<TH>`, `<TD>` primitives that `@react-pdf/renderer` lacks natively, enabling the input records tables, field history tables, and mass balance table required in the NOP report.

The Case IH FieldOps integration uses Node 22's native `fetch` (no axios) with an `OAuth2 client_credentials` flow whose token URL and endpoint paths are already verified in `farm-budget/fieldops/client.js`. The tamper-evidence layer uses Node's built-in `crypto` module (no third-party hashing library) to compute SHA-256 hash chains stored in two new columns on the existing `AuditLog` table: `entryHash` and `previousHash`. Do not add a separate `TamperEvidentLog` table.

**Core technologies:**
- `pg-boss@12.13.0`: Durable background sync jobs — uses existing PostgreSQL, no Redis, survives server restarts
- `@ag-media/react-pdf-table@2.0.3`: Table components for PDF — fills react-pdf's missing table primitive, peer-dep compatible with existing `@react-pdf/renderer@4.3.2`
- Node `crypto` (built-in): SHA-256 hash chain for audit tamper-evidence — zero new dependencies
- Native `fetch` (Node 22): Case IH API HTTP calls — already proven in `farm-budget/fieldops/client.js`
- `zod` (verify if already present): Runtime validation of CNH API response payloads — defensive parsing before Prisma writes

**Critical version note:** `pg-boss@12.x` requires PostgreSQL 14+ for `SKIP LOCKED` support. Verify before installing.

### Expected Features

Full details in `.planning/research/FEATURES.md`. Summary:

**Must have (inspection fails without these — 7 CFR Part 205 + SOE 2024):**
- Case IH Field Ops API integration (OAuth2 pull for tillage, planting, application, harvest)
- 3-year field history per parcel with substance application records
- Harvest records with lot linkage (lot → field traceability chain per SOE 2024)
- Input application records with OMRI/certifier-approved status per input
- Mass balance calculation (full harvest-to-sale chain per crop/lot)
- Print-ready USDA NOP inspection report (PDF, all inspector-required sections)
- Append-only audit store with SHA-256 tamper evidence
- Seed source records including commercial availability search log
- Buffer zone documentation with adjacent land use notation
- Equipment cleaning/contamination prevention log

**Should have (reduce inspection risk, faster prep — implement post-core):**
- Prohibited input pre-validation (flags before or on record save if material is not on approved list)
- Audit report pre-flight completeness check (surfaces gaps before inspector arrives)
- Photo evidence attachments on field records
- Fraud prevention plan documentation (SOE 2024 new requirement in OSP)
- Manure 90/120-day interval enforcer
- Field correction/annotation workflow (append-only correction model, not edit-in-place)
- Configurable retention/archive policy (5-year minimum enforced, soft-archive older records)
- Audit log export for regulator (CSV/PDF, date range, entity type filter)

**Defer to v2+:**
- Organic Integrity Database cross-reference (external API, high complexity)
- Transition status auto-advance (requires accurate historical data)
- Background sync + pg-boss snapshot jobs (infrastructure; manual trigger sufficient for v1)
- Case IH prescription (Rx) file send (reverse integration, out of audit scope)
- Native mobile app (already deferred in PROJECT.md)

**Anti-features (deliberately do not build):**
- Automated compliance pass/fail scoring — USDA does not delegate certification decisions to software; builds false confidence or legal liability
- Inspector portal with direct login — print-ready PDF is the correct inspector interface
- Real-time push for field events — farming environments have poor connectivity; background sync is correct
- Blockchain for audit records — SHA-256 hash chains on PostgreSQL provide equivalent tamper evidence at a fraction of the complexity

### Architecture Approach

The system uses a four-layer architecture: UI (React/RSC) → API Routes → Service Layer (Case IH Sync Service, Audit Store Service, Report Generator) → Data Layer (Prisma + PostgreSQL). The critical design rule is that raw Case IH API data never writes directly to Prisma domain models — it always passes through `fieldops-normalizer.ts`, which maps FieldOps JSON to the Prisma shape, performs field-name matching, and produces typed `NormalizedOperation[]` records. This isolation means a CNH API schema change (they added live telemetry in 2025) only requires updating the normalizer, not the sync logic or database writes. The organic-cert `Field` model is the master; FieldOps enriches but never auto-creates Field records (auto-creation would produce NOP-incomplete records with null organic status and transition dates).

PDF generation runs server-side exclusively via `renderToBuffer()` in a Next.js API route — sensitive farm data (yields, inputs, cert numbers) never leaves the server as JSON for client-side rendering. The `NopAuditReport.tsx` React component is purely a render tree; all async data assembly happens in `report-generator.ts` which is a separate testable module.

**Major components:**
1. `fieldops-client.ts` — OAuth2 token management and Case IH API polling (TypeScript port of `farm-budget/fieldops/client.js`)
2. `fieldops-normalizer.ts` — Impedance mapping: FieldOps JSON → Prisma model shapes; stateless pure function
3. `fieldops-sync.ts` — Dedup logic, Prisma writes, audit event emission; triggered via `POST /api/admin/sync` (ADMIN-only)
4. `audit-logger.ts` (extended) — SHA-256 hash chain within Prisma `$transaction`; PostgreSQL RLS blocks UPDATE/DELETE
5. `report-generator.ts` — Read-only Prisma queries assembling all NOP report data; separate from PDF rendering
6. `NopAuditReport.tsx` — `@react-pdf/renderer` document component; server-rendered only

### Critical Pitfalls

Full details in `.planning/research/PITFALLS.md`. Top 5:

1. **CNH Linked Account silent data exclusion** — After successful OAuth, if the operator's equipment is registered under a dealership "Linked Account," the API returns an empty array with no error. Detect immediately post-auth: call the field list endpoint and verify a non-empty response before marking the connection active; surface an explicit "Linked Account detected" message if empty.

2. **Audit store immutability at application layer only** — Without `REVOKE UPDATE, DELETE` on the PostgreSQL role, any direct DB access, seed script, or future migration can silently modify audit records. Apply PostgreSQL RLS (`FORCE ROW LEVEL SECURITY`) before any audit data is written. This cannot be retrofitted without invalidating the existing hash chain.

3. **Dual-write audit event skipped on transaction timeout** — Prisma middleware fires audit writes after the main write. Under transaction timeout, the entity record commits but the audit entry is discarded — producing a record with no audit provenance. Write audit events inside the same `$transaction` as the entity write, not in afterCreate hooks.

4. **NOP traceback gap: seed lot not linked to field** — The mass balance/traceback chain requires: Sale → Harvest → Field Operation (planting) → Seed Lot → Invoice. If the data model does not enforce `fieldId` on the seed source record, the traceback exercise fails at inspection. This is a data model requirement, not a UI gap — it must be enforced before the report is built.

5. **NOP report missing inspector-required fields** — The report can look complete but fail the inspection if it lacks the certifier lot code format, mass balance table, 3-year substance application history per field, and OSP reference number. Review an actual certifier inspection worksheet (CCOF, Oregon Tilth, MOSA) before writing any PDF layout code.

---

## Implications for Roadmap

The architecture research and feature dependency graph both converge on the same four-phase build order. Each phase produces artifacts that gate the next phase; there are no viable parallel paths.

### Phase 1: Case IH Field Ops Sync Service

**Rationale:** Everything else is downstream of having normalized field operation records in the database. The audit store needs data to hash-chain; the field history UI needs operations to display; the report generator needs records to aggregate. Building sync first also allows the CNH Linked Account limitation to be detected and documented before it blocks a later phase.

**Delivers:** Normalized field operations, harvest events, and material usage records in PostgreSQL; per-field sync status and last-sync timestamp; `POST /api/admin/sync` endpoint for manual and scheduled triggers; FIELDOPS_USE_MOCK=true fallback for development without live credentials.

**Addresses features:** Case IH Field Ops API integration, field operation → audit record mapping, harvest records with lot linkage (initial data population), background sync infrastructure.

**Must avoid:** OAuth2 token refresh race condition (implement proactive refresh + DB-persisted token storage from day one); Linked Account silent empty response (verify non-empty field list immediately post-auth); Subscription Key environment mismatch (health check on startup); blocking farmer data entry on sync completion (manual record creation must work independently of sync state); data latency misrepresented as current (display sync timestamp everywhere synced data appears).

**Research flag:** NEEDS research — CNH FieldOps full API response schema is behind a login-gated developer portal. The `farm-budget/fieldops/mock-data.js` in this repo is the best available shape reference. Build against mock first; validate response shapes during development with real credentials. The field mapper UI may need iteration once real API responses are seen.

---

### Phase 2: Append-Only Audit Store Hardening

**Rationale:** The hash chain must be in place before Phase 3 and Phase 4 generate significant write activity. Retrofitting SHA-256 hash chaining onto an already-populated audit log requires a migration script that rehashes all existing rows — expensive and risky. Doing this immediately after Phase 1 ensures every sync-generated record is hash-chained from its first write. The PostgreSQL RLS policy cannot be applied retroactively in a meaningful way either.

**Delivers:** SHA-256 hash chain on all audit entries (two new columns: `entryHash`, `previousHash`); PostgreSQL RLS blocking UPDATE/DELETE for the app role; `source` column on AuditLog for filtering sync vs. manual entries; audit viewer UI with filtering by date, user, entity type, source; CSV export with hash column for external verification; hash chain integrity verification before every export.

**Addresses features:** Append-only audit store with tamper evidence, audit log export for regulator.

**Must avoid:** Audit store application-only immutability without DB enforcement; dual-write gap via middleware; skipping hash chaining until "later" (impossible to retrofit without invalidating existing chain).

**Research flag:** STANDARD PATTERNS — SHA-256 hash chain in PostgreSQL is a well-documented pattern. PostgreSQL RLS documentation is official and high-confidence. Prisma `$transaction` pattern is confirmed. No additional research needed.

---

### Phase 3: Field History and Record Completion

**Rationale:** The field history UI and manual record entry screens provide the feedback loop that validates whether sync data is correct before it is committed to an inspection report. Building this before the report generator means the farm manager can review and correct records in the UI rather than discovering problems during PDF generation. This phase also covers the remaining table-stakes record types that cannot be auto-populated from Case IH data.

**Delivers:** 3-year field history view per parcel (combines Case IH sync data + manual entry); input application records with OMRI/approval status per input; seed source records with commercial availability search log; buffer zone documentation with adjacent land use notation; equipment cleaning log; transition status indicators per field; FieldOps sync status indicator per field (last sync date, source badge); field correction/annotation workflow (append-only, references original record ID).

**Addresses features:** 3-year field history, input application records + approval status, seed source records, buffer zone documentation, equipment cleaning log, field correction workflow.

**Must avoid:** NOP traceback gap (seed lot must carry `fieldId` foreign key — enforce in data model at this phase, not at report generation time); 5-year retention vs. 3-year history confusion (archive policy minimum must be 5 years, hard floor in UI); auto-creating Field records from FieldOps data (surface unmatched fields in sync UI, require manual Field creation with NOP metadata).

**Research flag:** STANDARD PATTERNS for UI components and form design. NEEDS attention on NOP-specific field history data model — consult `7 CFR 205.202` and `205.203` to ensure the schema captures every inspector-required field before building the UI (schema migration is expensive to retrofit).

---

### Phase 4: NOP Inspection Report Generator

**Rationale:** Report generation is pure read-only aggregation of what phases 1-3 produce. It has no upstream write dependencies and cannot be meaningfully built until the underlying records exist. Doing this last also allows a farm manager or experienced inspector to review an actual draft report before the layout is finalized — the most valuable validation gate in the entire milestone.

**Delivers:** `report-generator.ts` (all Prisma read queries, data assembly, mass balance calculation); `NopAuditReport.tsx` (`@react-pdf/renderer` document with all inspector-required sections); `GET /api/reports/nop?year=YYYY` API route (server-side PDF stream, ADMIN/OFFICE gated); report download UI with year selector; audit report pre-flight completeness check surfacing missing records before generation; "Data current as of" timestamp and "Sync before generating" prompt on report generation screen.

**Addresses features:** Print-ready NOP inspection report PDF, mass balance calculation (full chain), audit report pre-flight check, data freshness warnings.

**Must avoid:** PDF report missing inspector-required fields — review a certifier inspection worksheet (CCOF, Oregon Tilth, MOSA) before any layout work; building PDF before data model is complete; rendering PDF client-side (use `renderToBuffer()` on server exclusively); blocking on large report generation (if report exceeds 30 pages or takes >10s, move to background job with polling).

**Research flag:** NEEDS inspector worksheet review before layout work — obtain an actual CCOF or Oregon Tilth inspection worksheet and map every field to a data model column. This is a non-negotiable pre-condition for Phase 4. The mass balance calculation also needs validation against the existing C5.0 logic in the codebase to ensure the full harvest-to-sale chain is covered, not just the partial implementation.

---

### Phase Ordering Rationale

- **Data before display before report:** The report is a synthesis layer that requires all underlying records. Building it earlier produces an incomplete document that obscures data model gaps.
- **Audit hardening before bulk writes:** Hash chaining cannot be retrofitted onto an existing chain without invalidating it. Phase 2 must precede any phase that generates significant audit volume.
- **Field history UI as validation gate:** Displaying sync data in the UI before committing it to a report provides a human review step that catches mapping errors in `fieldops-normalizer.ts` before they appear in an official inspection document.
- **CNH Linked Account risk front-loaded:** If the farm's Case IH account is a Linked Account and returns no data, Phase 1 will detect this immediately. It is far better to discover this in Phase 1 than in Phase 4 when the report generates an empty inspection packet.
- **Manual entry decoupled from sync from day one:** Farmers must be able to enter records before the first sync completes. This architectural decision must be made in Phase 1 — retrofitting it later means merging two separate data stores.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (Case IH Sync):** CNH FieldOps full API response schema is login-gated. Build against `farm-budget/fieldops/mock-data.js` initially. Validate field shapes with real credentials before Phase 3. The field mapper UI may require iteration.
- **Phase 4 (NOP Report):** Obtain and review an actual certifier inspection worksheet before any layout work. Map every inspector-required field to a data model column. Validate mass balance logic against existing C5.0 implementation.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Audit Store):** SHA-256 hash chains, PostgreSQL RLS, and Prisma `$transaction` patterns are all well-documented with high-confidence sources. Implement directly from STACK.md and ARCHITECTURE.md guidance.
- **Phase 3 (Field History UI):** Standard Next.js CRUD with Prisma. The NOP regulatory requirements are documented in FEATURES.md from official sources. Data model decisions are the risk, not implementation patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Two new packages identified with verified versions. Existing stack dependencies confirmed against package.json. No speculative additions. Token URL and endpoint paths verified against working production code in `farm-budget/fieldops/`. |
| Features | HIGH | Table-stakes features derived from 7 CFR Part 205 (official federal regulation) and SOE 2024 final rule. Inspector report sections validated against CCOF, Oregon Tilth, and MOSA certifier documentation. Feature dependency graph is internally consistent. |
| Architecture | MEDIUM | Component structure and data flow patterns are well-grounded. The specific CNH FieldOps API response schema is behind a login-gated portal — `farm-budget/fieldops/mock-data.js` is the best available shape reference but may not reflect all current fields. Architecture will need minor adjustment once real API responses are examined. |
| Pitfalls | MEDIUM-HIGH | CNH-specific pitfalls (Linked Account exclusion, Subscription Key mismatch) confirmed from official CNH developer portal docs. Audit store pitfalls confirmed from PostgreSQL and Prisma ecosystem documentation. NOP traceback gap confirmed from official USDA audit findings (NOP OTCO and TDA audit reports showing 18 of 25 mass balance exercises had multiple deficiencies). |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **CNH FieldOps API response schema:** Full field-level schema for `/v1/applications`, `/v1/yield`, and `/v1/telemetry` requires authenticated developer portal access. Treat `farm-budget/fieldops/mock-data.js` as the working shape reference. Validate during Phase 1 development with real credentials; expect the normalizer to need one revision cycle after seeing actual responses.

- **CNH OAuth2 flow — client_credentials vs. authorization_code:** The existing `farm-budget` implementation uses `client_credentials`. The CNH Developer Portal describes an `authorization_code` flow for user-consented access. For server-to-server sync with credentials managed by the farm operator, `client_credentials` is appropriate. However, if the farm wants a "Connect your FieldOps account" user-facing flow in a future version, `authorization_code` would be required. This architectural decision should be documented in Phase 1.

- **Certifier inspection worksheet:** The NOP inspection report must be validated against an actual certifier worksheet (CCOF, Oregon Tilth, or MOSA). This is not a gap that research can close — it requires obtaining and reading a real inspector's working document before Phase 4 layout work begins.

- **Mass balance C5.0 scope:** The existing organic-cert app has partial mass balance logic (C5.0). The scope of what "full chain" means (harvest qty vs. sales qty per crop/lot including storage transfers) must be validated against the existing implementation before Phase 4 to avoid building a duplicate or conflicting calculation.

- **PostgreSQL version:** `pg-boss@12.x` requires PostgreSQL 14+ for `SKIP LOCKED`. Verify the deployed PostgreSQL version before installing `pg-boss`.

---

## Sources

### Primary (HIGH confidence)
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/fieldops/client.js` — OAuth2 token URL, API base URL, scopes, subscription key header, mock fallback pattern (working production code)
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/fieldops/sync.js` — API endpoint paths, field matching logic, dedup and sync metadata pattern
- `https://www.ecfr.gov/current/title-7/subtitle-B/chapter-I/subchapter-M/part-205` — 7 CFR Part 205 NOP regulations (field history, input records, crop rotation, 36-month lookback, 5-year retention)
- `https://www.federalregister.gov/documents/2023/01/19/2023-00702/national-organic-program-nop-strengthening-organic-enforcement` — SOE 2024 final rule (mass balance at every inspection, fraud prevention plan, lot traceability)
- `https://www.postgresql.org/docs/current/ddl-rowsecurity.html` — PostgreSQL RLS policy syntax for INSERT-only enforcement
- `https://www.ams.usda.gov/sites/default/files/media/NOP%20OTCO.pdf` — Official USDA audit findings confirming mass balance deficiencies (18 of 25 exercises)
- `https://develop.cnh.com/get-started/fieldops-portals` — Official CNH confirmation of Linked Account data exclusion limitation
- `https://develop.cnh.com/troubleshooting/faq/field-ops-api` — CNH rate limits (120 req/s), token TTL (3600s production, 21600s staging), 401 causes

### Secondary (MEDIUM confidence)
- `https://develop.cnh.com/api-guides/fieldops-api` — CNH API endpoint categories (login-gated for full schema)
- `https://tilth.org/mastering-organic-recordkeeping/` — Oregon Tilth (accredited certifier) recordkeeping requirements
- `https://mosaorganic.org/education-resources/organic-cultivator-newsletter/mass-balance-and-traceback-inspection-audits-explained/` — MOSA traceback chain requirements
- `https://logsnag.com/blog/deep-dive-into-background-jobs-with-pg-boss-and-typescript` — pg-boss TypeScript cron scheduling pattern
- `https://nango.dev/blog/concurrency-with-oauth-token-refreshes` — Distributed lock pattern for OAuth2 token refresh race condition
- `https://dev.to/veritaschain/building-a-tamper-evident-audit-log-with-sha-256-hash-chains-zero-dependencies-h0b` — SHA-256 hash chain with canonical JSON
- `https://github.com/prisma/prisma/issues/1902` — Prisma middleware + `$transaction` incompatibility; timeout-related audit write failures

### Tertiary (LOW-MEDIUM confidence)
- `https://www.farmstandapp.com/30165/7-best-record-keeping-tools-for-organic-certification/` — Competitor feature landscape (aggregator article)
- npm registry: `pg-boss@12.13.0`, `@ag-media/react-pdf-table@2.0.3` — Current versions confirmed

---

*Research completed: 2026-02-23*
*Ready for roadmap: yes*
