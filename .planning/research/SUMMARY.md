# Project Research Summary

**Project:** grain-tickets v2.0 — Grain Traceability and Settlement Reconciliation
**Domain:** Farm-side grain management — chain-of-custody tracking, settlement import, multi-buyer reconciliation
**Researched:** 2026-03-01
**Confidence:** HIGH (stack and architecture grounded in direct codebase inspection; pitfalls grounded in USDA/extension sources; features grounded in commercial grain software patterns and farmer forum accounts)

## Executive Summary

This milestone adds a relational database layer, chain-of-custody tracking, settlement import, and reconciliation to an existing Express + flat-JSON grain ticket app. The well-documented path is Prisma 6 + PostgreSQL — specifically matching the versions already running in organic-cert (Prisma 6.19.2), avoiding a two-ORM monorepo and deferring Prisma 7 breaking changes until both apps upgrade together. The migration must be additive: the existing PWA, service worker, calc.js calculation engine, and all ticket/farm routes keep working throughout. No TypeScript migration, no new upload library, no background job infrastructure — each of these would conflate two changes into one phase and multiply delivery risk.

The feature dependency graph is strict: database migration must come first (all relational features are blocked on it), buyer registry must come second (every other entity references a buyer FK), and the reconciliation engine can only run after settlement data exists. The highest-value user-facing output is the unmatched load alert dashboard — the "what's missing?" view that commercial tools generate as a manual printout and that this system produces automatically. One missing load on a 55,000 lb corn delivery is worth $800–1,200; the payoff case for the whole system is a single recovered load.

The critical risks are not technical — they are data integrity risks during the JSON-to-PostgreSQL cutover, and domain modeling risks around weight reconciliation. A write-lock cutover procedure is mandatory to prevent ticket loss. Reconciliation must be designed around net weight in pounds (the physically measured quantity) rather than derived bushels, because every buyer computes bushels differently. Ticket number normalization (strip prefix, strip leading zeros) must be implemented before any matching code runs, because the existing data already shows the format divergence pattern. These three decisions — cutover lock, pound-first reconciliation, ticket number normalization — must be resolved before any code is written, not discovered during testing.

## Key Findings

### Recommended Stack

The grain-tickets stack additions are minimal by design. The project already has `multer` for file upload, `xlsx` for Excel parsing, and `express` 4.18 as the HTTP layer — none of these should be replaced or supplemented. What is genuinely new is the database layer: `prisma@6.19.2` + `@prisma/client@6.19.2` + `pg@8.x` + `dotenv@17.3.1`. These exactly match organic-cert, making tooling, migration CLI, and Prisma Studio consistent across the monorepo. Three supporting libraries — `csv-parse@6.1.0`, `zod@4.3.6`, and `date-fns@4.1.0` — are already in organic-cert's package.json and extend to grain-tickets without version risk. Reconciliation is synchronous on-demand (no `pg-boss` or Redis needed at 100–500 loads per season).

Full details in `.planning/research/STACK.md`.

**Core technologies:**
- `prisma@6.19.2` + `@prisma/client@6.19.2`: ORM, schema, and migration CLI — matches organic-cert exactly; pinned to 6.x to avoid Prisma 7 breaking changes (driver adapters, ESM-first, new generator)
- `pg@8.x`: PostgreSQL driver required as Prisma 6 peer dependency; same shared PostgreSQL server as organic-cert, separate database
- `dotenv@17.3.1`: runtime env var loading for DATABASE_URL; required at server startup before Prisma client initialization
- `csv-parse@6.1.0`: server-side CSV settlement parsing; already in organic-cert; streaming API handles large files cleanly
- `zod@4.3.6`: row-level validation on settlement import; already in organic-cert; `require('zod')` works in CommonJS
- `date-fns@4.1.0`: mixed settlement date format parsing (MM/DD/YYYY from elevators vs. ISO); already in organic-cert

**Do not add:** ExcelJS (xlsx already present), TypeORM/Sequelize (Prisma is the monorepo choice), pg-boss (not needed at this scale), Prisma 7 in grain-tickets only (creates split migration burden), TypeScript toolchain (incremental TS is a future milestone).

### Expected Features

The milestone delivers farm-side traceability: every load from combine to settlement, with discrepancies flagged automatically. The feature dependency chain is rigid. Database migration is the prerequisite gate; every feature is blocked until it is complete.

Full details and dependency graph in `.planning/research/FEATURES.md`.

**Must have (table stakes):**
- Database migration (Prisma + PostgreSQL replacing flat JSON) — prerequisite for all relational features
- Buyer/destination registry — first-class entity; all other new entities reference a buyer FK
- `destinationId` FK on tickets — replaces free-text destination buried in notes; required for buyer-scoped settlement matching
- `cropYear` integer on tickets — enables season scoping; without it cross-season matches contaminate reconciliation
- Settlement import (CSV with per-buyer column mapping UI and preview before commit) — primary digital buyer path
- Manual settlement entry form — at least one Hughes Farm buyer sends paper-only; this path is not optional
- Ticket-to-settlement matching by ticket number — exact match first (same buyer, same cropYear)
- Reconciliation status per ticket (unreconciled / matched / disputed / manual-override)
- Unmatched load alert dashboard — farm-only tickets and settlement-only lines, the primary value delivery
- Settlement summary view — farm total vs. buyer settled total per crop/buyer/season

**Should have (competitive — add in v2.x after first-season validation):**
- Weight discrepancy tolerance flagging with configurable threshold per crop
- Buyer column map persistence (save mapping after first import; re-import without re-mapping)
- Disputed ticket workflow (notes + resolvedAt)
- Multi-buyer season summary (all buyers on one screen)

**Defer (v3+):**
- Fuzzy settlement matching by date + weight (only if exact ticket number match leaves significant unmatched loads)
- Crop insurance yield report
- Contract management (forward, basis, HTA) — separate domain, extreme scope risk
- PDF settlement parsing via Claude Vision (only if paper buyer volume justifies vs. manual entry)

**Anti-features — never build:**
- Auto-adjusting farm weights to match elevator weights (destroys traceability evidence)
- Real-time futures price integration (wrong domain; contracts are already signed)
- Full elevator-side software features (farm is the seller, not the elevator)

### Architecture Approach

The architecture is a straightforward additive migration of a single Express app: add `db.js` (PrismaClient singleton), `prisma/schema.prisma`, and `migrate-json.js` to the existing grain-tickets directory without restructuring server.js, without splitting to a routes directory, and without TypeScript. The dual-store transition pattern (JSON + PostgreSQL in parallel during the cutover window) ensures the existing app stays functional throughout. The PWA service worker is transparent to the database migration because it already skips all `/api/` routes — only `CACHE_NAME` needs bumping when new `public/` files are added. The organic-cert Prisma singleton pattern (`globalThis` guard) does NOT apply to Express — a plain `new PrismaClient()` in a long-lived process is correct.

Full schema, component details, migration script, and build order in `.planning/research/ARCHITECTURE.md`.

**Major components:**
1. `db.js` (new) — exports single PrismaClient instance; imported by server.js and migrate-json.js; no globalThis guard needed
2. `prisma/schema.prisma` (new) — models: Ticket, CropConfig, FarmEntry, LoadDelivery, Buyer, Settlement, SettlementLine; MatchStatus enum (UNMATCHED / MATCHED / DISCREPANCY / WAIVED)
3. `migrate-json.js` (new) — one-shot ETL: reads data.json, creates Prisma records with upsert for idempotency, extracts HBT bin numbers from notes field, normalizes empty ticketNo to null
4. `server.js` (modified) — replace `loadData()` / `saveData()` / `withLock()` / in-memory store with Prisma queries; add settlement import route, reconciliation routes, buyer CRUD routes
5. `public/sw.js` (minor edit) — bump `CACHE_NAME` from `grain-tickets-v2` to `grain-tickets-v3` when any public/ file changes; add new files to PRECACHE array

**Key schema decisions:**
- `Ticket.id` as `String @id` (preserve existing `t_000001` format IDs — do NOT use `@default(cuid())`)
- `Ticket.ticketNo` as non-unique `@@index` (14 of 527 existing records have duplicate ticket numbers — unique constraint fails migration)
- `LoadDelivery` as optional 1:1 extension of Ticket (not every ticket has destination data yet)
- `MatchStatus.WAIVED` enum value (farm manager must be able to dismiss known acceptable variances)
- Reconciliation in pounds, not bushels (buyer-derived bushel figures are incomparable across buyer discount methods)

### Critical Pitfalls

Full details and prevention checklists in `.planning/research/PITFALLS.md`. Top pitfalls:

1. **JSON-to-PostgreSQL cutover data loss** — Tickets entered between "migration script runs" and "new code deploys" are silently lost. Prevention: enforce a 2–5 minute write-lock window; disable POST/PUT/DELETE while migration script runs against the live data.json; verify `SELECT COUNT(*)` matches `store.tickets.length` before re-enabling writes.

2. **Ticket number normalization failure on first real settlement import** — Existing data shows Hughes ticket numbers with `H` prefix; elevator systems strip prefix and leading zeros. Exact string match produces near-zero match rate. Prevention: implement `normalize(n) = n.replace(/\D/g,'').replace(/^0+/,'')` before writing any matching code; test against all 527 existing ticket numbers.

3. **Reconciliation comparing derived bushels instead of pounds** — Each buyer uses a different shrink method, making "our bushels vs their bushels" an apples-to-oranges comparison. Prevention: reconcile on net weight in pounds; store farm pounds and elevator pounds as separate immutable columns; never run `calc.computeTicket()` against buyer figures.

4. **calc.js duplication after migration** — The existing UMD module runs in both browser and Node.js; rewriting it in TypeScript during migration creates two implementations that drift. Prevention: lock in regression tests before touching anything; TypeScript layer must wrap via `require()`, not reimplement formulas.

5. **Settlement-level "complete" status bypassing per-load matching** — Marking a settlement complete when 3 of 47 loads are unmatched silently loses $800–1,200+ per load. Prevention: "Complete" action is disabled until zero unmatched lines remain; each line must be explicitly resolved.

6. **Buyer as free text on tickets** — Querying "all deliveries to the co-op" fails when free text produces `"Co-op"`, `"COOP"`, `"co op"` variants. Prevention: Buyer entity with `buyerId` FK on delivery records; ticket entry form enforces autocomplete selection.

7. **Service worker replays stale requests after migration** — Staff offline during migration have queued POST requests that replay against the new PostgreSQL-backed server. Prevention: bump `CACHE_NAME` before migration cutover; flush offline queue before deploying new server.js.

## Implications for Roadmap

Based on research, the feature dependency graph and data quality findings dictate a 5-phase build order. Each phase leaves the existing ticket entry and farm summary tabs fully functional — the app must never go dark.

### Phase 1: Database Foundation

**Rationale:** Every subsequent feature requires Prisma + PostgreSQL to be in place. This phase makes zero changes to server.js routes — the existing app continues reading/writing JSON unchanged. It is the safest possible first phase: if it fails, nothing is broken.
**Delivers:** Prisma client connected and verified against shared PostgreSQL; schema.prisma with Ticket, CropConfig, FarmEntry models; db.js singleton; `npx prisma migrate dev --name init` succeeds.
**Stack used:** prisma@6.19.2, @prisma/client@6.19.2, pg@8.x, dotenv@17.3.1
**Pitfalls to avoid:** Do not use `@default(cuid())` on Ticket.id; do not add unique constraint on ticketNo; do not touch server.js yet.
**Research flag:** Standard Prisma patterns — skip research-phase.

### Phase 2: JSON-to-PostgreSQL Migration and Cutover

**Rationale:** Tickets must be in PostgreSQL before any settlement matching is possible (settlement lines link to tickets by ticketNo). This phase has the highest data integrity risk and must execute with write-lock discipline. A migration runbook is a required deliverable.
**Delivers:** All 527 tickets, 63 farms, 37 crop configs in PostgreSQL; HBT bin numbers extracted from notes into LoadDelivery records; server.js routes switched from JSON to Prisma; saveData/withLock/loadData removed; data.json kept as read-only archive.
**Stack used:** migrate-json.js (one-shot script), Prisma upsert, batched createMany
**Pitfalls to avoid:** Write-lock cutover (CRITICAL — 2–5 minute window); verify ticket count before and after; spot-check 10 known ticket IDs; bump service worker CACHE_NAME before deploy; flush offline queue.
**Research flag:** Standard migration patterns — skip research-phase. Write migration runbook before executing.

### Phase 3: Buyer Registry and Schema Extension

**Rationale:** Buyer entity is the prerequisite for all settlement features. Schema extension (add Buyer, Settlement, SettlementLine, LoadDelivery models) happens here. New ticket entry UI gets a buyer autocomplete dropdown replacing free-text destination.
**Delivers:** Buyer CRUD API and UI; `destinationId` FK added to ticket entry; `cropYear` field added to tickets; Settlement/SettlementLine tables in schema; new Prisma migration run.
**Features addressed:** Buyer/destination registry, destination field on tickets, cropYear field
**Pitfalls to avoid:** Buyer must be a FK (`buyerId`), never a free-text field. Ticket entry form must enforce autocomplete selection for destination.
**Research flag:** Standard CRUD patterns — skip research-phase.

### Phase 4: Settlement Import and Manual Entry

**Rationale:** Settlement data must exist before the reconciliation engine can run. Import and manual entry are the two data ingestion paths; both must be built before matching logic is attempted.
**Delivers:** CSV import endpoint with per-buyer column mapping UI, 5-row preview before commit, raw file stored server-side (outside `public/`); manual settlement entry form; settlement line storage in PostgreSQL; buyer-level `importConfig` JSON for column name persistence.
**Features addressed:** Settlement import (CSV), manual settlement entry, buyer column map persistence (first pass)
**Stack used:** csv-parse@6.1.0 (CSV), existing xlsx@0.18.5 (Excel), multer (existing), zod@4.3.6 (row validation), date-fns@4.1.0 (date format handling)
**Pitfalls to avoid:** Per-buyer format profiles are mandatory (not a generic importer); preview step is mandatory before commit; raw file stored outside `public/` directory; PDF settlements go to manual entry form, not the import path.
**Research flag:** Needs sample settlement files from each Hughes Farm buyer before building column mapping UI. Collect actual CSV/Excel files from co-op, elevator, maltster, and specialty buyer in a one-time session with farm office staff before coding begins.

### Phase 5: Reconciliation Engine and Discrepancy UI

**Rationale:** Reconciliation is the core value delivery — it requires stable tickets (Phase 2), buyer entities (Phase 3), and settlement lines (Phase 4) to be in place first. UI is built last to avoid rework if API shape changes during earlier phases.
**Delivers:** Ticket number normalization function (strip non-numeric, strip leading zeros); ticket-to-settlement matching (exact ticketNo primary, crop+weight fallback); MatchStatus written per line; GET /api/reconciliation endpoint; unmatched load alert dashboard (farm-only and settlement-only views); settlement summary view (farm total vs. buyer settled total); "Complete" action disabled while unmatched lines exist; WAIVED status for confirmed acceptable variances; service worker CACHE_NAME bumped for new public JS files.
**Features addressed:** Ticket-to-settlement matching, reconciliation status per ticket, unmatched load alert dashboard, settlement summary view, discrepancy detection
**Pitfalls to avoid:** Reconcile in pounds (not derived bushels); three-tier status (MATCHED/DISCREPANCY/WAIVED); per-load status required before settlement can be marked complete; normalization tested against all ticket formats in data.json before matching code is written.
**Research flag:** Weight tolerance thresholds and buyer shrink methods require domain input from the farm manager — a brief conversation before Phase 5 design, not an external research task.

### Phase Ordering Rationale

- Phase 1 before Phase 2: Prisma schema must exist before migration can populate it.
- Phase 2 before Phase 3: Cutover before any new schema extensions avoids migrating an already-modified schema.
- Phase 3 before Phase 4: Buyer FK must exist before settlement lines can reference a buyer.
- Phase 4 before Phase 5: Settlement lines must exist before the reconciliation engine has anything to match.
- UI additions (Phase 5 public/ files) come last: API shape is stable by this point; building UI early risks rework if API shape changes during Phases 3–4.
- The PWA service worker CACHE_NAME bump happens at Phase 2 cutover (server change) and again at Phase 5 (new public/ files). Two deliberate bumps — neither can be skipped.

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 4 (Settlement Import):** Collect actual settlement file samples from each Hughes Farm buyer before building column mapping UI. Format diversity is the key variable — the architecture is known, the specific column names are not. A one-time sample collection session with the farm office staff is required before coding begins.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Database Foundation):** Prisma 6 + Express CJS integration is directly documented; organic-cert is the reference implementation in this repo.
- **Phase 2 (Migration):** Data migration patterns are well-established; the migration script is detailed in ARCHITECTURE.md and STACK.md.
- **Phase 3 (Buyer Registry):** Standard CRUD; no novel patterns.
- **Phase 5 (Reconciliation Engine):** Domain decisions (tolerance thresholds, shrink methods) need farm manager input, not external research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against organic-cert/package.json and grain-tickets/package.json directly. Prisma 6 CJS compatibility confirmed via official blog. No speculative additions. |
| Features | MEDIUM-HIGH | Grain settlement workflows confirmed from USDA extension, commercial grain software docs, and farmer forum accounts. Hughes Farm-specific buyer formats unknown until samples collected. |
| Architecture | HIGH | Based on direct examination of grain-tickets/server.js (628 LOC), data/data.json (527 tickets — 14 duplicate ticketNos confirmed by direct analysis), public/sw.js, and organic-cert Prisma reference. Patterns are established, not theoretical. |
| Pitfalls | HIGH | Weight tolerance thresholds grounded in USDA AMS official documents. ID preservation and cutover risks grounded in direct codebase analysis. Settlement format diversity grounded in known ag software ecosystem and shrink method differences confirmed by Penn State Extension. |

**Overall confidence:** HIGH

### Gaps to Address

- **Buyer settlement file formats:** The architecture for per-buyer column mapping is designed, but actual column headers for each Hughes Farm buyer (co-op, elevator, maltster, specialty buyer) are unknown. Collect sample settlement files before Phase 4 design. One buyer likely sends paper only — confirm which buyers before building the manual entry form so field layout matches their actual statement.
- **Weight discrepancy thresholds:** Research establishes that configurable per-crop tolerances are required and gives a starting point (1.0% or 500 lbs, whichever is greater), but the farm manager's own experience with normal scale variance is the authoritative input. Get this before Phase 5 design.
- **Buyer shrink methods:** Each buyer uses a different moisture-to-bushel conversion method. The specific method for each Hughes Farm buyer is not documented in the research. Collect during the same conversation as sample file formats.
- **HBT bin number meaning:** 507 of 527 existing tickets have `HBT# XXXX` in notes. The migration script extracts these into LoadDelivery records. What the bin numbers map to (physical elevator bins, storage contract identifiers) is unclear from data alone. Confirm with farm manager before building any bin-level inventory features — optional in v2.0 but the structured data will exist post-migration.

## Sources

### Primary (HIGH confidence)
- `organic-cert/package.json` — Prisma 6.19.2, csv-parse 6.1.0, zod 4.3.6, date-fns 4.1.0, dotenv 17.3.1 versions confirmed in active production use
- `grain-tickets/server.js` — CommonJS architecture, in-memory store structure, existing multer instance confirmed (628 LOC direct inspection)
- `grain-tickets/data/data.json` — 527 tickets, 63 farms, 37 crop configs; 14 duplicate ticketNos; 2 empty ticketNos; 507/527 records with HBT# pattern confirmed (direct analysis)
- `grain-tickets/public/sw.js` — network-first strategy, `/api/` skip, CACHE_NAME = 'grain-tickets-v2' confirmed
- `organic-cert/prisma/schema.prisma` — Prisma 6 reference pattern (datasource, generator, enum) confirmed
- USDA AMS — elevator scale acceptance tolerance 0.05% of capacity (official)
- Penn State Extension — shrink method vs. moisture discount; buyer-specific bushel calculation differences (extension publication)
- Iowa State Extension — grain cart scale accuracy ±0.5–1.0%; scale verification practices (extension publication)
- Prisma official blog — Prisma 7 breaking changes; `prisma-client-js` CJS support in Prisma 6 confirmed

### Secondary (MEDIUM confidence)
- Vertical Software grain farm software docs — settlement tracking, missing load discovery patterns
- GMS Grain Management ticket entry field documentation — complete ticket field list
- Agvance Help Center settlements docs — settlement data model, destination types
- JasBo Technologies coverage (Farm Progress) — "one missing load paid for the software itself" account
- NewAgTalk farmer forum — real-world missing load, contract misapplication, payment error accounts
- Tailscale engineering blog — phased dual-run JSON-to-database migration pattern
- J&M Manufacturing, Agrimatics — grain cart scale accuracy specs

### Tertiary (LOW confidence)
- SafetyCulture grain management software overview — ecosystem landscape only
- Vendor marketing pages (Stoneridge, Andersons) — settlement workflow confirmation

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
