# Project Research Summary

**Project:** organic-cert v3.0 — Compilation Engine
**Domain:** NOP organic crop certification — cross-app data aggregation, yearly rotation snapshots, NOP compliance rule engine, PDF generation from aggregated ecosystem data
**Researched:** 2026-03-01
**Confidence:** HIGH

## Executive Summary

organic-cert v3.0 is not a new app build — it is a data flow rewiring of an existing 85K LOC Next.js 16 app. The core problem is double-entry: a crop plan built in farm-budget must be manually re-keyed into organic-cert before every annual NOP inspection. v3.0 eliminates this by transforming organic-cert from a standalone data-entry app into a **compilation engine** that reads from farm-budget (port 3001), farm-registry (port 3005), and grain-tickets (port 3000) via localhost HTTP calls, compiles that data into the organic-cert PostgreSQL schema, and generates the inspection PDF from local data only. The recommended approach requires zero new npm packages — every needed capability (native fetch, react/cache, Zod refine, Prisma upsert, @react-pdf/renderer) is already installed and running in the existing app.

The architecture adds two new directory trees inside the existing organic-cert app: an ecosystem client layer (`src/lib/ecosystem/`) that wraps fetch calls with structured errors and a 5-minute TTL cache, and a compile layer (`src/lib/compile/`) that runs mappers (field, input, harvest) with a preview/commit split so users see a diff before any database writes. The PDF generation pipeline is completely unchanged — `report-assembler.ts` already reads from local PostgreSQL; once compilation writes ecosystem data into those tables, the PDF reflects it automatically. The one non-negotiable architectural decision from PROJECT.md is the leech pattern: organic-cert reads from source apps but never writes back.

The primary risks are all pre-existing tech debt that must be resolved before v3.0 can be built safely. Three bugs are blocking: the sync-registry runtime crash (`data.unmatched` undefined, two-line fix), the `take: 3` enterprise query limit that silently truncates split-field data, and the partial unique index that is absent from schema.prisma. Beyond those, the rotation snapshot mechanism is not optional — if compilation replaces manual data entry without implementing snapshots, the NOP-required 3-year field history will be permanently lost after farm-budget is rebuilt each season. All four issues must be addressed in Phase 1 before any new compilation logic is written.

---

## Key Findings

### Recommended Stack

The v3.0 stack requires zero new npm packages. All four capability areas (cross-app HTTP aggregation, rotation snapshot storage, NOP compliance rule engine, PDF from aggregated data) are satisfied by tools already installed in the organic-cert app.

Full details and code patterns in `.planning/research/STACK.md`.

**Core technologies — new usage of existing packages:**
- **Native `fetch` + `react/cache`**: cross-app HTTP calls to farm-budget/farm-registry/grain-tickets via `Promise.allSettled` (not `Promise.all`); `react/cache` deduplicates within a render pass; `cache: 'no-store'` for live NOP-compliance data
- **`zod` 4.3.6 (`zod/v4` subpath)**: NOP compliance rule assertions via `.refine()` and `.superRefine()` on compiled data types; already used throughout the app for import validation
- **`@prisma/client` 6.19.2**: two new additive models (`RotationSnapshot` to track snapshot metadata, `EcosystemSyncState`) plus additive columns on existing models; existing `FieldHistory` model is the snapshot target
- **`@react-pdf/renderer` 4.3.2 + `@ag-media/react-pdf-table` 2.0.3**: unchanged PDF rendering; the data source changes, not the renderer
- **`date-fns` 4.1.0**: `differenceInDays()` for manure application window compliance checks

The only installation step is a Prisma schema migration:
```bash
cd organic-cert && npx prisma migrate dev --name add-rotation-snapshot-and-ecosystem-sync
```

### Expected Features

v3.0's thesis is zero re-entry for the crop plan. The feature set directly maps to data sources that can be auto-pulled versus records that remain organic-cert-only.

Full dependency graph and NOP regulatory mapping in `.planning/research/FEATURES.md`.

**Must have (P1 — v3.0 core):**
- Fix farm-registry sync crash — prerequisite for all field matching; `data.unmatched` → `data.unchanged`, one-line fix
- Pull organic enterprises from farm-budget — crops, fields, acres, varieties come in automatically
- Pull input plans from farm-budget — MaterialUsage records created from budget inputs, staged for review
- Pull seed varieties from farm-budget — SeedLot stubs created; NOP status annotated once by farm manager and persists across seasons
- Rotation snapshot mechanism — end-of-season one-button snapshot writes current enterprises to FieldHistory; the only way to accumulate NOP 3-year history when farm-budget is rebuilt annually
- Compilation readiness dashboard — per-field status (green/yellow/red) before inspection
- Data source badges in UI — show origin of each record (farm-budget / grain-tickets / Case IH / manual)

**Should have (P2 — blocked on grain-tickets v2.0 field linkage):**
- Pull harvest weights from grain-tickets — real certified scale weights for mass balance accuracy
- Mass balance from real scale weights — tight mass balance significantly reduces inspection scrutiny

**Defer (P3 / out of scope):**
- Input plan vs. actual application diff — requires a full Case IH sync season of data to be meaningful
- Multi-certifier support (EU, state programs) — USDA NOP only for v3.0
- Inspector digital portal — print-ready PDF is correct UX per PROJECT.md v1.0 rationale
- Auto-compliance scoring — creates liability and false confidence; flag data completeness, never emit a compliance verdict

**Organic-cert-only records — keep manual entry, never eliminate:**
Buffer zones, adjacent land use documentation, equipment cleanout events, scouting logs, management actions, narrative sections. No API in the ecosystem provides these. They are physical observations and contextual decisions that only the farm manager can document.

### Architecture Approach

The compilation engine is added as two new directory trees inside the existing organic-cert app (`src/lib/ecosystem/` and `src/lib/compile/`). No separate service is warranted for a single-machine, single-user system. API routes are thin wrappers that call a single `compileForYear(farmId, cropYear)` function. The compile always runs in two phases: preview (returns `CompileDiff`, no DB writes) then commit (re-runs with writes using cached upstream data). The existing `report-assembler.ts` is unchanged — it reads from local PostgreSQL, and compilation writes there first.

Full data flow diagrams, mapping tables, schema changes, and anti-patterns in `.planning/research/ARCHITECTURE.md`.

**Major components:**
1. **`src/lib/ecosystem/`** — typed HTTP clients (budget-client, registry-client, tickets-client) with 8-second `AbortController` timeout, structured `EcosystemError` type, and a 5-minute TTL in-process cache (`eco-cache.ts`)
2. **`src/lib/compile/`** — orchestrator (`compile-engine.ts`) + mappers: `field-mapper.ts` (name → registry alias → organic-cert Field), `input-mapper.ts` (product → Material + MaterialUsage), `harvest-mapper.ts` (grain ticket → HarvestEvent with crop-name normalization), `nop-filter.ts` (organic-only enterprise gate), `snapshot-taker.ts` (FieldEnterprise → FieldHistory point-in-time copy)
3. **`app/api/compile/[year]/`** — preview (GET) and commit (POST) routes; `app/api/rotation-snapshot/[year]/take/` — snapshot execution route
4. **`app/(app)/compile/page.tsx`** — replaces the existing import-plan page; shows source availability, CompileDiff, commit button, snapshot status
5. **`prisma/schema.prisma`** — two new additive models + additive columns (`budgetFieldId` on FieldEnterprise, `budgetInputId` on MaterialUsage, `ticketId` on HarvestEvent)

**Build order (hard dependency sequence):**
Phase A (ecosystem clients) → Phase B (NOP filter + field mapper + preview API, no DB writes) → Phase C (schema migration + enterprise compile with writes) → Phase D (input mapper) → Phase E (harvest mapper, depends on grain-tickets Phase 10+) → Phase F (rotation snapshot + compile UI)

### Critical Pitfalls

Full pitfall details, warning signs, recovery strategies, and the "looks done but isn't" verification checklist in `.planning/research/PITFALLS.md`.

1. **Sync-registry runtime crash must be fixed before any v3.0 work** — `fields/page.tsx` line 128 reads `data.unmatched` but the route returns `data.unchanged`. One-line fix. Every downstream compilation call silently fails without this. Fix first.

2. **Rotation snapshot is a regulatory requirement, not an enhancement** — farm-budget is rebuilt every season. Without the snapshot mechanism shipping alongside the compilation engine, the NOP-required 3-year field history is permanently lost when farm-budget is rebuilt. Cannot be deferred to a later phase.

3. **Field identity mismatch will affect 5-10 of 56 fields** — farm-budget field names (Excel import), organic-cert names (separate entry), and farm-registry aliases evolved independently. String comparison silently drops unmatched fields from the compiled PDF. Build an explicit field mapping step with a resolution UI; store confirmed `farmBudgetFieldName` on the organic-cert Field row. Never assume names will match.

4. **`take: 3` enterprise query limit silently truncates split-field NOP history** — the existing `GET /api/fields` endpoint paginates enterprises at 3. For a 3-year NOP window on a split field (up to 9 enterprises), this drops 6 silently. The compilation engine must use `report-assembler.ts` or a dedicated endpoint, never the field list API. Audit this in Phase 1 before any aggregation code is written.

5. **Cross-app HTTP calls have no timeout by default** — `fetch()` in Node.js has no default timeout. If farm-budget is not running, compilation hangs indefinitely. Every ecosystem client must use `AbortController` with an 8-second timeout and `Promise.allSettled` so one unreachable app does not block the others. Design this into Phase 1 from the first HTTP call written.

6. **NOP compliance false positives from unmapped materials** — farm-budget products have no NOP status. Running compliance rules against unreviewed pulled inputs produces a PDF full of UNKNOWN warnings. Build the product-to-material mapping step (with "unresolved materials" UI) before applying any NOP compliance rules; unresolved materials are a workflow step, not a compliance finding.

---

## Implications for Roadmap

The research points to a 4-phase structure for v3.0. Phase boundaries are driven by hard data dependencies: field identity must be resolved before enterprises can be matched, enterprises must exist before inputs can be attached (FK constraint), and the snapshot mechanism must ship before farm-budget is rebuilt for a new season.

### Phase 1: Foundation — Pre-flight Fixes + Ecosystem Client Layer

**Rationale:** Three blocking bugs and one missing migration must be resolved before any compilation logic is written. Building on top of them produces silently corrupt output. These are hours of work but they gate everything downstream.

**Delivers:** Working ecosystem client layer (`src/lib/ecosystem/`) that reliably fetches from all three source apps with timeout, structured errors, and 5-minute TTL cache; `GET /api/fields` patched to remove `take: 3` limit for full enterprise retrieval; partial unique index captured in a Prisma migration; sync-registry crash fixed (`data.unmatched` → `data.unchanged`).

**Addresses:** Fix farm-registry sync crash; cross-app HTTP infrastructure foundation

**Avoids:** Pitfalls 1 (sync crash), 4 (take:3 truncation), 5 (no HTTP timeout), 6 (missing partial unique index)

**Research flag:** Standard patterns — `AbortController` timeout, `Promise.allSettled`, Prisma migration with raw SQL index are all well-documented. No research-phase needed.

---

### Phase 2: Field + Enterprise Compilation (Preview/Commit)

**Rationale:** Field matching and enterprise creation are the dependency root for all subsequent phases. `MaterialUsage` has a FK to `FieldEnterprise` — inputs cannot be attached until enterprises exist. The preview/commit split is built here, not retrofitted later, because it shapes the entire user experience and API contract.

**Delivers:** Working `/api/compile/[year]/preview` (GET, no writes, returns `CompileDiff`) and `/api/compile/[year]` (POST, commits FieldEnterprise records); `field-mapper.ts` with explicit unmatched-field reporting and registry alias resolution; `nop-filter.ts` for organic-only enterprise gate; a compile page replacing import-plan with source availability display and commit confirmation.

**Addresses:** Pull organic enterprises from farm-budget; pull field identities from farm-registry; compilation readiness dashboard (first iteration)

**Avoids:** Pitfall 3 (field identity mismatch — build the explicit mapping step, not string comparison); anti-pattern of single-call compile with no preview

**Research flag:** Field name alias matching, Prisma upsert on compound unique, and preview/commit split are standard patterns. No research-phase needed.

---

### Phase 3: Input + Seed Compilation + NOP Compliance Layer

**Rationale:** Inputs are the highest-pain manual re-entry task — the primary driver for building v3.0. But the product-to-material mapping step must be built before NOP compliance rules run against pulled data, or the inspection report will be full of false UNKNOWN warnings and be useless. The "sources of truth" matrix must also be formalized here to protect organic-cert-only records from elimination.

**Delivers:** `input-mapper.ts` and seed pull creating MaterialUsage and SeedLot records from farm-budget data; a "resolve unmapped materials" UI that lets the farm manager assign NOP status once per product (persists across seasons); `nop-compliance.ts` rule engine running against mapped materials only; data source badges on all pulled records; documented sources-of-truth matrix confirming manual entry paths for ScoutingLog, ManagementAction, CleanoutEvent, BufferZone, AdjacentLandUse remain intact.

**Addresses:** Pull input plans from farm-budget; pull seed varieties from farm-budget; NOP compliance checking (data completeness, not pass/fail verdicts)

**Avoids:** Pitfall 7 (NOP false positives from unmapped materials); Pitfall 8 (organic-cert-only records eliminated by over-aggressive automation)

**Research flag:** NOP rule accuracy for manure application windows, transition day counts, buffer zone distance requirements, and OMRI material classification requires verification against USDA NOP 7 CFR 205 before rule implementation. Rules are static TypeScript functions — once written they are stable — but getting them wrong produces a misleading inspection report. A targeted `/gsd:research-phase` pass on NOP rule specifics is recommended before Phase 3 plans are finalized.

---

### Phase 4: Rotation Snapshot + Harvest Compilation + PDF Null Safety

**Rationale:** The rotation snapshot is sequenced to Phase 4 but must ship before farm-budget is rebuilt for the next season — this is a hard calendar deadline, not just a phase ordering preference. Harvest compilation from grain-tickets is placed here because it depends on grain-tickets v2.0 Phase 10-11 (tickets in PostgreSQL with field linkage); if that work is incomplete, harvest compilation ships as a stub and activates when the dependency is ready.

**Delivers:** `snapshot-taker.ts` writing FieldHistory rows from current-year FieldEnterprise records; `/api/rotation-snapshot/[year]/take` POST endpoint; compile page shows snapshot status with warning if prior year has no snapshot; `harvest-mapper.ts` correlating grain tickets to HarvestEvents with crop-name normalization table (built empirically from live API data); null-safety validation layer that runs before any PDF rendering call and outputs "No records" placeholders for empty sections rather than crashing.

**Addresses:** Rotation snapshot mechanism; pull harvest weights from grain-tickets (or stub); mass balance from real scale weights; PDF null safety for aggregated data

**Avoids:** Pitfall 2 (rotation snapshot missing — NOP history permanently lost); Pitfall 9 (PDF silent truncation on null fields from grain-tickets migration)

**Research flag:** Crop name normalization between farm-budget and grain-tickets vocabulary is an empirical task — it requires running both APIs and auditing the actual crop name values in both systems before harvest-mapper.ts is written. This is a one-time mapping table, not a research-phase topic. Harvest compilation also depends on grain-tickets v2.0 Phase 11+ field linkage being in place; if not complete, harvest mapper ships as a documented stub.

---

### Phase Ordering Rationale

- **Fix blocking bugs before writing new code:** The three confirmed bugs (sync crash, take:3 limit, missing partial index) each silently corrupt output in ways that are hard to detect. Any new compilation code built before these are fixed inherits the silent failure modes.
- **Preview before commit:** The preview/commit split (Phase 2) must be the foundational API design, not a retrofit. Building the write path first and adding preview later is harder — the preview guarantee shapes every mapper's interface.
- **Enterprises before inputs:** `MaterialUsage` has a FK to `FieldEnterprise`. This is a schema constraint that cannot be worked around. Phase 3 cannot run before Phase 2 creates enterprise records.
- **Snapshot before season end:** The rotation snapshot mechanism ships in Phase 4. If the 2026 growing season ends before Phase 4 is complete, the farm manager must continue manual `FieldHistory` entry as they do today. There is no retroactive recovery path from a missed snapshot after farm-budget is rebuilt.
- **Harvest compilation gated on grain-tickets v2.0:** grain-tickets currently has freetext farm names on ticket records, not structured field IDs. The harvest mapper cannot reliably link tickets to organic-cert enterprises until grain-tickets Phase 11+ adds FK linkage. Phase 4 can ship harvest compilation as a documented stub and activate it when the dependency lands — this is correct design, not a workaround.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (NOP Compliance Layer):** NOP rule specifics for manure application windows, transition day counts, buffer zone requirements, and commercial availability search requirements should be verified against USDA NOP 7 CFR 205 and certifier guidance before rule implementation. Compliance rules are static TypeScript functions — but accuracy matters because a wrong rule produces a misleading inspection report.
- **Phase 4 (Harvest Mapper):** Crop name normalization between farm-budget and grain-tickets vocabulary requires running both APIs and auditing actual values. This is an empirical task requiring live access to both running apps, not an external research topic.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Bug fixes, `AbortController` timeout pattern, `Promise.allSettled`, and raw SQL Prisma migrations are all standard and well-documented. No research needed.
- **Phase 2 (Enterprise Compilation):** Preview/commit with Prisma upsert on compound unique and registry alias matching are established patterns. No research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against installed package.json, official Next.js 16 docs, Prisma 6 docs, Zod v4 docs, and the existing fieldops-client.ts as a reference pattern. Zero new packages — all findings are grounded in already-running code. |
| Features | HIGH | NOP regulatory requirements verified against USDA 7 CFR 205, Oregon Tilth recordkeeping guide, and OCIA C2.0 documentation. Ecosystem API shapes verified by direct reading of farm-budget/server.js, grain-tickets/server.js, farm-registry/server.js. |
| Architecture | HIGH | Based on direct examination of all source files: organic-cert/src/ (~85K LOC), prisma/schema.prisma, existing import-plan route, sync-registry route, fieldops-client.ts, and report-assembler.ts. Build order grounded in actual FK constraints in the schema. |
| Pitfalls | HIGH (integration pitfalls); MEDIUM (NOP compliance pitfalls) | The three blocking bugs are confirmed with file paths and line numbers from direct code reading. NOP compliance aggregation pitfalls are extrapolated from existing code patterns and regulatory requirements — behavioral patterns, not confirmed runtime bugs. |

**Overall confidence:** HIGH

### Gaps to Address

- **Prior-year field history state:** Before v3.0 ships, the `FieldHistory` table must have records for 2024 and 2025 for the NOP 3-year history to be complete. If those years were not manually entered, the farm manager must provide them from archived farm-budget data or paper records before Phase 4 closes. Verify `FieldHistory` row count for 2024 and 2025 before Phase 4 planning.

- **farm-budget organic enterprise filtering:** farm-budget uses both `systemCode` (e.g., "ORG") and enterprise `category` fields to indicate organic designation. The exact filter logic for reliably excluding conventional-designated fields requires a live query against the running farm-budget app. The `nop-filter.ts` should check both fields defensively and be validated against real data in Phase 2.

- **Crop name normalization table (Phase 4):** farm-budget uses short crop codes ("SRWW", "Org Peas", "Corn"); grain-tickets uses longer labels ("Organic SRWW", "Organic Peas", "Non-GMO Yellow Corn"). The complete normalization table cannot be derived from research — it requires reading the actual crop values from both running APIs. Build the table empirically before harvest-mapper.ts is written.

- **grain-tickets API year filtering:** grain-tickets `GET /api/tickets` currently has no `?year=` filter parameter. The harvest-mapper.ts will need to filter client-side by date range until grain-tickets v2.0 Phase 11+ adds the parameter. At current volume (527 tickets), the performance impact is acceptable; flag for review if ticket volume grows beyond ~2,000.

---

## Sources

### Primary (HIGH confidence)
- `organic-cert/package.json` — confirmed exact versions of all installed packages
- `organic-cert/prisma/schema.prisma` — confirmed existing model structure and FK constraints
- `organic-cert/src/lib/fieldops-client.ts` — reference pattern for structured ecosystem client with timeout and retry
- `organic-cert/src/app/api/fields/sync-registry/route.ts` — confirmed response shape (matched/created/updated/unchanged)
- `organic-cert/src/app/(app)/fields/page.tsx` line 128 — confirmed `data.unmatched` crash (runtime TypeError, direct code reading)
- `organic-cert/src/app/api/fields/route.ts` line 18 — confirmed `take: 3` enterprise query limit (direct code reading)
- `organic-cert/src/lib/report-assembler.ts` — confirmed no take/skip limits; safe for compilation data aggregation
- `farm-budget/server.js` — confirmed API endpoints, response shapes, 500ms debounced save pattern
- `grain-tickets/server.js` — confirmed `GET /api/tickets` exists, no `?year=` filter parameter
- `farm-registry/server.js` — confirmed `GET /api/fields?active=true`
- `.planning/codebase/CONCERNS.md` — partial unique index missing from schema.prisma; take:3 tech debt; sync crash documented
- `.planning/PROJECT.md` — ecosystem architecture, leech pattern decision, yearly rotation snapshot key decision
- `https://nextjs.org/docs/app/getting-started/fetching-data` — `cache: 'no-store'`, `react/cache` deduplication, Next.js 16 fetch semantics (fetched 2026-03-01)
- `https://zod.dev/v4` — `.refine()` / `.superRefine()` stable APIs, `zod/v4` subpath import recommended
- USDA NOP eCFR 7 CFR 205.103 — recordkeeping requirements, 5-year retention, audit trail
- USDA NOP eCFR 7 CFR 205.201 — organic system plan requirements, pest management documentation
- Oregon Tilth — The Trail of Records (recordkeeping guide) — five mandatory record categories, mass balance audit, yield plausibility check

### Secondary (MEDIUM confidence)
- `https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields` — Json field type for immutable snapshot payload storage
- USDA AMS buffer zone guidance (NOP) — 25 ft minimum buffer requirement
- OCIA C2.0 Crop Production Overview — 36-month field histories, acreage summary format
- `https://www.omri.org/omri-lists` — no public OMRI API confirmed; `omriListed` boolean on Material model is correct pattern
- WebSearch: confirmed no JavaScript/TypeScript library exists for USDA NOP compliance checking; confirmed `json-rules-engine` and similar tools are designed for dynamic runtime rule configuration (not static NOP domain logic)
- USDA NOP Strengthening Organic Enforcement rule (effective March 2024) — codified mock audit requirement, enhanced traceability requirements

---

*Research completed: 2026-03-01*
*Ready for roadmap: yes*
