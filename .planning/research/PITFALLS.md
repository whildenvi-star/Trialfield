# Pitfalls Research

**Domain:** Grain traceability and settlement reconciliation — adding relational data, chain-of-custody tracking, and multi-buyer settlement matching to an existing Express + JSON flat-file grain ticket app
**Researched:** 2026-03-01
**Confidence:** HIGH for migration and weight-discrepancy pitfalls (grounded in the actual codebase and established ag industry patterns); MEDIUM for settlement format parsing (grain-industry specific docs are sparse online, patterns extrapolated from payment reconciliation literature and known ag software behavior)

---

## Critical Pitfalls

### Pitfall 1: Cutover Day Data Loss — JSON and PostgreSQL Diverge During the Transition Window

**What goes wrong:**
The plan is: migrate data.json to PostgreSQL, update server.js to read/write PostgreSQL, deploy. But between "migration script runs" and "deploy completes," new tickets are entered against the JSON file. Those tickets never make it into PostgreSQL. The migration script ran on yesterday's snapshot; today's loads are gone. With 100-500 loads per season and daily entry during harvest, a 2-hour deploy window can lose a dozen tickets.

**Why it happens:**
Migrations get treated as one-time ETL scripts run once before deployment. The app keeps running during the migration script execution (it's Express on a single machine — staff are using it). Nobody accounts for the write gap between "script complete" and "new code live." In a flat-file system there is no transaction or replication mechanism to close this gap automatically.

**How to avoid:**
- The migration script must read the current data.json at deploy time, not a snapshot taken hours earlier.
- Use a cutover window: (1) put the app in read-only mode (disable POST/PUT/DELETE) for a 2-minute window, (2) run the migration script against the live file, (3) swap to the PostgreSQL-backed server, (4) re-enable writes. The read-only period should be announced and should be under 5 minutes.
- Alternatively: run a dry migration first, validate counts match, then do the real migration with a write lock in place.
- After cutover, keep the original data.json as a read-only archive for 30 days. If a discrepancy is found, you can diff against it.
- Count tickets before and after: `SELECT COUNT(*) FROM tickets` must match `store.tickets.length` from data.json.

**Warning signs:**
- Migration script was run more than 1 hour before the new server.js went live.
- Staff entered tickets between when the migration ran and when the new code deployed.
- Post-cutover ticket count in PostgreSQL is less than pre-cutover count in data.json.

**Phase to address:** Database migration phase — the cutover procedure must be defined and documented as part of the migration plan, not left as an afterthought. Treat it like a financial close.

---

### Pitfall 2: String IDs (`t_000001`, `f_001`) Break When Referencing from New Relational Tables

**What goes wrong:**
The existing tickets use string IDs (`t_000001`, `t_` + timestamp + random). The new settlement, delivery, and chain-of-custody tables need foreign keys back to tickets. Prisma's default is integer or UUID primary keys. If you migrate the ticket IDs as-is into a `String` primary key in PostgreSQL, you lose the ability to use integer sequences, and new tickets created post-migration get a different ID format than migrated tickets. Joins that assume a consistent ID shape break. Worse: if you reassign IDs (convert to integers), every reference in the UI, scan results, and CSV exports becomes invalid.

**Why it happens:**
The existing ID format (`t_` + `Date.now().toString(36)` + random) was fine for JSON lookups but was never designed as a stable relational foreign key. Developers adding the new schema generate fresh UUIDs for migrated records without preserving the original IDs, then discover the front-end has hardcoded references to the old format.

**How to avoid:**
- Keep the existing string IDs as the primary key in PostgreSQL. Prisma handles `String @id` without issue.
- The Prisma schema for tickets should have `id String @id` — not `@default(cuid())` or `@default(uuid())`. Migrated records keep their `t_000001` etc. IDs; new records get the same `t_` + timestamp + random format the server already generates.
- Add a `cuid()` or UUID as a separate `externalId` field only if needed for future API purposes — do not replace the existing ID.
- Verify: after migration, run `SELECT id FROM tickets ORDER BY id` and confirm existing IDs are present verbatim.

**Warning signs:**
- The Prisma schema uses `@default(cuid())` or `@default(uuid())` on the tickets table.
- A migration script reassigns numeric IDs to migrated tickets.
- Front-end ticket-detail URLs break after migration (e.g., `/tickets/t_000001` returns 404).

**Phase to address:** Database migration phase — the schema design decision about primary key format must be made explicitly before writing the Prisma schema, not discovered during testing.

---

### Pitfall 3: Weight Discrepancy Treated as an Error Instead of an Expected Business Condition

**What goes wrong:**
The reconciliation system flags every difference between the farm's recorded net weight and the elevator's scale ticket weight as a "discrepancy requiring resolution." Office staff spend hours chasing down weight differences that are normal and expected. On the other hand, the threshold is set too loose and real discrepancies (short weights, missing loads) get buried in noise.

The grain buggy (farm) scale and the certified elevator scale will ALWAYS differ. Grain buggy scales are typically accurate to ±0.5–1.0% on a 5-point calibration system. USDA elevator scale acceptance tolerance is 0.05% of scale capacity. A 55,000 lb load with a 0.5% buggy scale error = ±275 lbs. At 500 loads per season, this is a constant source of false alarms if treated naively.

**Why it happens:**
Developers model weight reconciliation as "farm weight equals elevator weight" because that is conceptually correct. The practical reality — that two calibrated but different instrument types will produce different readings — is not reflected in the matching logic. There is no tolerance band, no per-crop tolerance (soybeans and rye have different moisture change rates in transit), and no distinction between "within normal variance" and "something is wrong."

**How to avoid:**
- Define explicit tolerance thresholds per crop type (moisture-sensitive crops like corn and rye warrant wider tolerance than dry beans).
- A practical starting threshold: flag loads where elevator weight differs from farm weight by more than 1.0% OR more than 500 lbs — whichever is greater. This should be configurable, not hardcoded.
- Three-tier status: MATCHED (within tolerance), REVIEW (outside tolerance but no other anomaly), DISPUTED (outside tolerance AND another anomaly — missing load, wrong crop, etc.).
- Show the weight delta and percentage in the reconciliation view, not just a red/green flag.
- Log the raw farm weight and elevator weight independently; never overwrite the farm record with the elevator figure.

**Warning signs:**
- The reconciliation logic uses `farmWeight === elevatorWeight` or a fixed ±100 lb tolerance.
- All discrepancy rows look the same regardless of whether the delta is 50 lbs or 2,000 lbs.
- Staff report spending more than 15 minutes per day resolving "discrepancies" that turn out to be normal scale variation.

**Phase to address:** Settlement reconciliation engine phase — tolerance logic must be designed before any matching code is written. Get the farm manager's input on what constitutes a real discrepancy vs. normal variation for each crop they deliver.

---

### Pitfall 4: Moisture Shrink Calculation Differences Between Buyers Make Weight Reconciliation Impossible by Net Bushels

**What goes wrong:**
Hughes Farm records net weight in pounds (the farm scale reading). Buyer A settles by "shrink method" — they reduce gross bushels by a shrink factor based on moisture above standard. Buyer B settles by "moisture discount" — they pay on gross bushels but apply a per-bushel price deduction. Buyer C settles by net weight after adjusting for moisture and FM. When you try to reconcile "what we shipped" against "what they paid for," the bushel figures are computed differently and will never match exactly — even with identical grain and identical weights.

**Why it happens:**
Settlement reconciliation is modeled as "our bushels vs. their bushels." But bushels are a derived unit — the path from raw net weight to "bushels paid for" involves buyer-specific formulas for moisture shrink, FM dockage, and test weight deductions. Without normalizing to a common unit (pounds), the comparison is apples to oranges.

**How to avoid:**
- Primary reconciliation must be on **net weight in pounds**, not derived bushels. This is the only figure both parties measure independently with a physical scale.
- Store the buyer's settlement figures (their bushels, their price, their deductions) alongside the raw pounds figure. Do not try to back-calculate their pounds from their bushels.
- Track which shrink method each buyer uses as a buyer-level configuration field.
- The discrepancy display should show: Farm weight (lbs) | Elevator weight (lbs) | Delta (lbs) | Buyer bushels | Buyer payment method.
- Do not run the existing `Calc.computeTicket()` against the buyer's figures — it applies Hughes Farm's formula, not the buyer's formula.

**Warning signs:**
- Reconciliation compares `farmBushels` to `elevatorBushels` as the primary matching criterion.
- The system uses `Calc.computeTicket()` to validate buyer settlement figures.
- Different buyers' settlement sheets produce different "correct" bushel figures for loads that are clearly the same delivery.

**Phase to address:** Settlement data model phase — buyer configuration (shrink method, discount schedule) must be captured before building any reconciliation math. This is a design-first decision.

---

### Pitfall 5: Settlement Import Assumes a Consistent Format That Never Exists

**What goes wrong:**
You build a CSV importer for buyer settlement sheets. It works perfectly for Buyer A's format. Buyer B sends an Excel file with merged cells and a summary row at the top. Buyer C sends a PDF scanned from paper. Buyer D sends an email with a table pasted as plain text. Next season, Buyer A changes their CSV column order. The import breaks silently — no error, just wrong data or skipped rows.

**Why it happens:**
Settlement data in grain agriculture has no standard format. Each elevator, co-op, and broker uses their own software (TKC Grain, AgVantage, Vertical Software, Oakland Corp, AGRIS) which produces its own export format. None of these systems are designed to interoperate with each other. Developers build for the first buyer they test with and discover the diversity problem at the second buyer.

**How to avoid:**
- Design the import system around per-buyer format profiles: a buyer-level configuration object specifies column mappings, date formats, header row location, and whether to skip summary rows.
- Build the manual entry path first and make it the primary path for all buyers. Import is a convenience, not a requirement.
- For PDF/paper buyers, the settlement entry form is the right solution — manual entry with validation, not OCR parsing.
- When importing, always show a preview of parsed data before committing. Let staff correct misreads before records are created.
- Store the raw import file alongside the parsed records. If parsing logic changes, the raw file can be re-parsed.
- Add a "buyer format version" field — when Buyer A changes their format next season, you can create v2 of their profile without breaking v1 imports from prior seasons.

**Warning signs:**
- The importer uses hard-coded column indices (`row[2]` for weight) rather than named column mappings.
- No preview step before import commits records.
- The system has a single generic CSV importer used for all buyers.
- PDFs are handled by the same path as structured data files.

**Phase to address:** Settlement import phase — per-buyer format profiles must be the design foundation before any import code is written. Start with the manual entry path for all buyers; add import as an enhancement.

---

### Pitfall 6: Ticket Number Matching Fails on Formatting Differences (Prefix, Leading Zeros, Case)

**What goes wrong:**
Hughes Farm records ticket `H066666`. The elevator's settlement sheet shows `66666` (no prefix), `H-066666` (hyphen added), or `h066666` (lowercase). The reconciliation engine does exact string matching and finds zero matches for the entire settlement sheet. Staff must manually link every load, defeating the purpose of automated reconciliation.

This is guaranteed to happen. The existing data already shows Hughes Blue Ticket numbers in the `ticketNo` field. Elevator systems often strip the first letter (which may identify the farm or scale location) from their settlement exports.

**Why it happens:**
Ticket number formatting is a farm-side convention (the "H" prefix may stand for Hughes). The elevator's software records the number from their own scale system, which may use a different representation. Exact string matching is the first instinct and it fails at the first real buyer's data.

**How to avoid:**
- Normalize ticket numbers during matching: strip non-numeric characters, strip leading zeros, compare numeric core only.
- Matching function: `normalize(ticketNo) = ticketNo.replace(/\D/g, '').replace(/^0+/, '')`. Match on this normalized form, fall back to fuzzy matching on Levenshtein distance for near-matches (distance <= 2).
- Flag near-matches (normalized differs by 1-2 characters) for human confirmation rather than auto-accepting or rejecting.
- Store the buyer's raw ticket number alongside the matched farm ticket number. Never overwrite the farm's original ticket number.
- Build a manual link UI: when auto-matching fails, show side-by-side load lists and let staff drag-link a farm load to a settlement line.

**Warning signs:**
- The matching engine uses `farmTicketNo === settlementTicketNo` without normalization.
- There is no near-match / fuzzy match fallback.
- After running reconciliation on the first real settlement sheet, the match rate is below 80%.

**Phase to address:** Settlement reconciliation engine phase — ticket number normalization must be in place before any matching logic is built. Test against the actual data.json ticket numbers and a sample settlement sheet.

---

### Pitfall 7: calc.js Calculation Engine Duplicated Instead of Shared After PostgreSQL Migration

**What goes wrong:**
The existing `calc.js` is a shared UMD module that runs in both browser (`window.Calc`) and Node.js (`module.exports`). After adding Prisma and TypeScript (or even just restructuring the server), the module loading pattern breaks. A developer writes a TypeScript version of the calc functions. Now there are two implementations. They drift. The server computes different netBU than the client. Settlement reconciliation reports different totals than the ticket entry screen.

**Why it happens:**
The dual-environment UMD pattern (`typeof module !== 'undefined' && module.exports ? module.exports : (window.Calc = {})`) is a maintenance time-bomb when the project structure changes. It works perfectly until someone adds TypeScript, moves to ES modules, or restructures the public directory — at which point it's easier to rewrite than to fix, and the rewrite introduces subtle formula differences.

**How to avoid:**
- Do not rewrite `calc.js` during the database migration phase. Keep it as-is and require it from server.js exactly as today.
- When TypeScript is introduced, create a thin TypeScript wrapper that delegates to `calc.js` via `require('../public/calc.js')` rather than reimplementing the formulas.
- Add a regression test suite for `computeTicket()` before touching anything: the import.js file already validates against the Data2 sheet — extract those test cases into a formal test file that runs on every build.
- Any future refactor of calc.js must pass all regression tests before merging.

**Warning signs:**
- Two files compute grossBU or netBU: one in server.js and one elsewhere.
- The TypeScript build has a `types/calc.ts` that contains arithmetic formulas (not just types).
- The farm summary screen and the settlement screen show different total bushels for the same set of tickets.

**Phase to address:** Database migration phase — before any other changes, lock in the calc.js regression tests. This is the canonical computation; protect it.

---

### Pitfall 8: Delivery Destination Stored as Free Text, Making Cross-Buyer Queries Impossible

**What goes wrong:**
The current `notes` field contains free text like `HBT# 5652 WR Trk# 41`. Destination, truck, and hauler are embedded in the notes string. When settlement reconciliation is added, staff enter the buyer name as a free-text field on each delivery. `"Co-op"`, `"COOP"`, `"co op"`, and `"Local Co-op"` all appear for the same buyer. Querying "all deliveries to the co-op" returns 60% of actual deliveries. Settlement sheets cannot be linked to a buyer entity.

**Why it happens:**
The existing system was built for ticket entry, not for cross-ticket analysis. Free text worked for the original purpose. When reconciliation requires "group all loads by buyer and match against each buyer's settlement sheet," the absence of a normalized buyer entity becomes a blocker. Developers add a `buyer` text field to tickets and staff enter it inconsistently from day one.

**How to avoid:**
- Create a `Buyer` entity table with a canonical name and aliases. The delivery record references `buyerId` (foreign key), not a free text buyer name.
- The ticket entry form must use a lookup/autocomplete for buyer selection, not a text field.
- Existing tickets in data.json that have destination information in `notes` should be migrated with `buyerId = null` (unknown) and manually assigned during the first reconciliation cycle.
- Never store destination as free text on the ticket record. If a new buyer appears, create the buyer record first.

**Warning signs:**
- The delivery or ticket table has a `buyer String` column rather than a `buyerId` foreign key.
- Staff are allowed to type a buyer name rather than selecting from a list.
- SQL queries for "loads by buyer" require ILIKE or text normalization.

**Phase to address:** Schema design phase — the Buyer entity and its foreign key relationship to deliveries must be in the schema from the start. This cannot be retrofitted after settlement data accumulates.

---

### Pitfall 9: The Existing PWA / Offline Mode Writes to the Old JSON Endpoint After Migration

**What goes wrong:**
The app has PWA support (service worker). Staff using the app in the field with spotty connectivity have requests cached and replayed. After the PostgreSQL migration, the service worker caches the old API responses and replays POST requests to `/api/tickets` against the old endpoint. If the server now reads from PostgreSQL but the service worker replays a stale request, the ticket either creates a duplicate or goes to a dead endpoint. Worse: staff in the field don't realize the submission failed and drive away.

**Why it happens:**
Service worker cache invalidation is notoriously easy to get wrong. The migration changes the backend data store but not the API surface (the routes stay the same). Staff have cached service worker registrations that predate the migration. Any offline tickets queued before the migration are replayed post-migration — and may fail if the request body format has changed.

**How to avoid:**
- Before migration, bump the service worker cache version in the public JS to force all clients to re-register. Verify this clears old cached requests.
- After migration, implement a `/api/version` endpoint. The service worker should check the version on reconnect and refuse to replay cached requests from a prior API version.
- Audit the PWA's offline queue: are there any pending POST requests in IndexedDB or workbox queues before the migration cutover? Flush them against the old JSON-backed server first.
- Document the service worker cache-bust procedure as a required step in the migration runbook.

**Warning signs:**
- The service worker cache version was not incremented before migration.
- Post-migration, some tickets appear in the UI as submitted but are not in PostgreSQL.
- Staff report "I submitted it but it disappeared" after coming back online.

**Phase to address:** Database migration phase — service worker cache invalidation must be part of the migration checklist, executed before deployment.

---

### Pitfall 10: Settlement "Paid" Status Is Set Without Verifying Individual Load Match

**What goes wrong:**
A settlement sheet arrives for 47 loads. The system imports it, matches 44 by ticket number, and 3 are unmatched. A developer marks the settlement as "reconciled" or "paid" at the settlement level — because the totals are close. The 3 unmatched loads are never individually resolved. One of them is a 60,000 lb load that was never paid — it was on the settlement sheet under a different ticket number format. The farm loses revenue on a single load worth $800-1,200. Multiplied across 4 buyers and 3 seasons, the exposure is significant.

**Why it happens:**
Reconciliation UI designs tend toward "summary first" — show a total match/mismatch and let the user approve the whole thing. The assumption is that close-enough totals mean individual loads are correct. In grain settlement this assumption is wrong: buyers can have the total dollars right but be paying for a different set of loads than what was delivered.

**How to avoid:**
- Settlement status must track at the individual load level, not the settlement level. A settlement with 3 unmatched loads is NOT reconciled, even if dollar totals match.
- The UI must require resolution of every unmatched line before allowing the settlement to be marked complete.
- "Unmatched from farm" (load we recorded, not on settlement) and "Unmatched from buyer" (on settlement, not in our records) must be surfaced separately — they indicate different problems.
- Provide an explicit "mark as confirmed missing" action for loads that the farm verifies were never delivered, and an "add missing ticket" action for loads found on the buyer sheet that weren't entered.

**Warning signs:**
- The settlement has a single `status: 'reconciled' | 'pending'` field with no per-load reconciliation status.
- The UI shows "44 of 47 matched" but has a "Mark as Complete" button that ignores the 3 unmatched.
- Dollar total match is used as a proxy for load-level reconciliation.

**Phase to address:** Settlement reconciliation UI phase — the per-load reconciliation status must be in the data model from the start. The UI must enforce resolution of all unmatched loads.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep buyer name as free text on tickets instead of a foreign key to a Buyer table | Faster first pass, no schema design needed | Cannot reliably group loads by buyer; settlement matching requires fuzzy text search | Never — buyer entity must exist before settlement data accumulates |
| Use the same `/api/tickets` POST endpoint for both raw ticket entry and delivery-linked tickets | No API changes needed | Delivery and ticket concepts conflate; adding chain-of-custody requires retrofitting a field that should have been structural | Never — the distinction between a raw load ticket and a delivery record is architectural |
| Skip the cutover write-lock during JSON-to-PostgreSQL migration | Faster deployment | Up to several hours of tickets created post-migration-script and pre-deploy are silently lost | Never — the write-lock window is 2-5 minutes and the risk is data loss |
| Hard-code the weight discrepancy tolerance to ±100 lbs | Simpler, ships faster | Every buyer/crop combo has different normal variance; 100 lbs is too tight for some loads and too loose for others | Never — tolerance must be configurable from day one |
| Let settlement import overwrite the farm's recorded weight with the elevator's weight | Simpler reconciliation logic (one weight to compare) | Farm's original measurement is lost; audits cannot show what the farm measured independently | Never — farm weight is the farm's record; elevator weight is the buyer's record; both must survive |
| Use exact string match on ticket numbers for settlement reconciliation | Simple to implement | First real buyer's data will not match due to prefix/format differences; match rate will be unacceptably low | Never — normalization and fuzzy matching must be in the initial implementation |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Farm registry (`/api/fields` at port 3005) | Using farm name string to look up field data, which fails on name variation ("Airport" vs "Airport Farm") | Use farm registry's `FarmRegistry.autocomplete()` for field selection; store `fieldRegistryId` as the canonical identifier on delivery records |
| Buyer settlement CSV import | Assuming column positions are stable across seasons and buyers | Per-buyer format profile with named column mappings and a version field; preview before commit |
| PDF settlement sheets | Trying to parse PDF as structured data | PDF settlements require manual entry or Claude Vision scanning; do not build a PDF parser expecting reliable extraction |
| Existing PWA service worker | Not invalidating the service worker cache before migration cutover | Bump the service worker version string before migration; verify all offline queues are flushed |
| Existing `calc.js` UMD module | Rewriting in TypeScript instead of wrapping | Wrap via `require()` in the TypeScript layer; add regression tests before touching the module |
| PostgreSQL via Prisma connection pool | Running Prisma from a single long-lived Express process without a pool limit | Set `connection_limit` in the Prisma datasource URL; default pool size is `num_cpus * 2 + 1` which is fine for this scale |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all 527+ tickets into memory for settlement matching (replicating the current in-memory store pattern) | Matching slows as ticket count grows; eventually OOM on a low-memory machine | Use database queries with indexes for settlement matching — do not replicate the in-memory store pattern in the PostgreSQL version | The current JSON store is ~160KB and 527 tickets — fine in memory. At 3,000 tickets (6 seasons) this pattern stays fine but settlement matching across a full season of unmatched loads should use SQL |
| Recomputing farm summaries on every GET /api/farms (replicating farmSummaryCache) | Farm summary endpoint slows when ticket count grows | Keep the memoized cache pattern from the existing server, but invalidate on any ticket or farm write — same as today | The current cache is correct; the risk is losing it during migration and defaulting to unbounded recomputation |
| Parsing a 47-row settlement sheet PDF with Claude Vision per-row | Each row is a separate API call; 47 rows = 47 API calls at $0.01 each | Parse the entire sheet in one Claude Vision call; structure the prompt to return all rows as a JSON array | Any settlement sheet with more than 5 rows |
| Full table scan for ticket number match during reconciliation | Reconciliation queries take seconds on 3,000+ tickets | Add a B-tree index on `ticketNo` in the Prisma migration; the existing code already uses an in-memory `ticketByNo` Map — replace with an indexed DB query | Becomes noticeable above ~2,000 tickets; acceptable to defer until after migration |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing raw settlement sheets (PDF, Excel) in the public directory | Financial documents accessible to anyone who knows the URL | Store uploaded settlement files in a server-side directory outside the Express `static` root; serve via authenticated endpoint only |
| No authentication on PostgreSQL-backed write routes | Same risk as today's JSON routes — anyone on the LAN can POST tickets | The existing app has no auth (acceptable for farm LAN); if the app is ever exposed beyond the farm LAN, add auth before deploying. This is a known and accepted risk for now. |
| Logging raw settlement data (including prices and quantities) at DEBUG level | Settlement financial data in plain-text log files readable by anyone with server access | Use structured logging with a settlement-specific log level; never log full settlement row contents at DEBUG |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Settlement reconciliation UI requires navigating away from the ticket list to resolve each discrepancy | Staff context-switch repeatedly; miss discrepancies; give up and go back to Excel | Show unresolved discrepancies inline, in the same view as the settlement summary; resolution should be a single click or a short form in a modal |
| Requiring staff to re-enter field/farm data when linking a ticket to a delivery for the farm registry | Double-entry friction; staff skip the linkage step | Pre-populate the delivery form from the ticket's existing `farm` field using the registry autocomplete; staff confirm or correct, not re-enter from scratch |
| Displaying weight discrepancy as a raw pound delta without context | "This load is 312 lbs off" means nothing without knowing the total | Show delta as both pounds and percentage: "312 lbs (0.57%) — within normal scale variance" vs. "2,100 lbs (3.8%) — REVIEW REQUIRED" |
| Marking a settlement as "complete" before all loads are matched | Office closes the books; a missed load is never collected | "Complete" button is disabled until zero unmatched lines remain; unresolved lines must be explicitly marked as "confirmed no-load" or "confirmed discrepancy accepted" |
| Settlement import that processes silently without a preview | Wrong column mapping imports garbage data; discovery happens after data is committed | Always show an import preview with the first 5 rows rendered as structured data before committing; staff must explicitly approve |

---

## "Looks Done But Isn't" Checklist

- [ ] **Database migration:** Ticket count in PostgreSQL matches `store.tickets.length` in data.json — verify the count, not just that the migration script ran without errors.
- [ ] **ID preservation:** Existing ticket IDs (`t_000001` through current) are present verbatim in PostgreSQL — verify by spot-checking 5 known ticket IDs from data.json against the database.
- [ ] **calc.js regression:** The PostgreSQL-backed server returns the same `grossBU` and `netBU` values for existing tickets as the JSON-backed server — verify by running both servers against the same data and comparing output for 10 tickets.
- [ ] **Service worker:** After migration, staff using the app in Chrome confirm no offline-queued submissions are stuck in the service worker — check the DevTools Application > Service Workers panel on a device that was offline during migration.
- [ ] **Weight tolerance:** The reconciliation engine correctly categorizes a 200 lb delta as MATCHED and a 2,000 lb delta as REVIEW for a 55,000 lb corn load — verify both cases in the test suite.
- [ ] **Ticket number normalization:** A load recorded as `H066666` matches a settlement line with `66666` — verify the normalization function strips the prefix correctly for all known ticket number formats in the existing data.
- [ ] **Per-load status:** A settlement with 3 unmatched lines cannot be marked complete — verify the "Mark Complete" button is disabled and shows the count of unmatched lines.
- [ ] **Buyer entity:** The ticket entry form does not allow typing a buyer name; it requires selecting from the buyer list — verify by attempting to submit a ticket with a free-text destination.
- [ ] **Settlement raw file:** The raw settlement CSV or Excel file is stored server-side and not accessible via a direct URL without authentication — verify by navigating to the file path directly in a browser.
- [ ] **Farm weight preserved:** After matching a ticket to a settlement line, the original farm-recorded net weight is unchanged in the database — verify `farmNetWeight` and `elevatorNetWeight` are stored as separate columns.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Ticket data loss during JSON-to-PostgreSQL cutover | HIGH | Diff data.json backup against PostgreSQL ticket count; identify missing IDs; re-enter missing tickets from the physical blue tickets in the office file; document which loads were recovered manually |
| Calc.js formula drift discovered post-migration | HIGH | Roll back to the previous server version while the formula is corrected; run regression test suite against both implementations; re-compute all affected settlement records after fix |
| Settlement import with wrong column mapping commits bad data | MEDIUM | Identify the settlement ID and delete all lines from that import; re-run with corrected column mapping; add format version to prevent recurrence |
| Weight tolerance set too tight, generating 200+ false discrepancies | LOW | Update the tolerance threshold in buyer configuration; re-run reconciliation for affected settlements; mark previously-flagged normal-variance loads as MATCHED |
| Service worker replays stale requests after migration | MEDIUM | Identify duplicate or ghost tickets created by replayed service worker requests; delete duplicates by comparing against physical blue tickets; force service worker update on all devices; verify no more queued requests |
| Buyer entity missing — settlement matching returns 0 results | LOW | Create the buyer entity; bulk-link existing unmatched settlement lines to the correct buyer via a one-time admin operation; prevent recurrence by enforcing the buyer FK on new deliveries |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| JSON-to-PostgreSQL cutover data loss | Database migration phase | Ticket count matches before and after; write-lock procedure documented and executed |
| String ID breaks in relational tables | Database migration phase (schema design) | Prisma schema uses `id String @id` on tickets; existing IDs present verbatim post-migration |
| Weight discrepancy as error vs. expected variance | Settlement reconciliation engine phase | Three-tier status (MATCHED/REVIEW/DISPUTED) implemented; configurable tolerance per buyer |
| Moisture shrink method differences by buyer | Settlement data model phase | Buyer configuration captures shrink method; reconciliation compares pounds, not derived bushels |
| Settlement import format diversity | Settlement import phase | Per-buyer format profiles exist; preview step required before commit; manual entry path available for all buyers |
| Ticket number normalization failure | Settlement reconciliation engine phase | Normalization function tested against all ticket formats in existing data.json; near-match fuzzy fallback implemented |
| calc.js drift after migration | Database migration phase | Regression test suite added before any migration work; TypeScript layer wraps, not reimplements |
| Buyer as free text instead of foreign key | Schema design phase | `buyerId` foreign key on delivery records; ticket entry form enforces selection |
| PWA service worker cache after migration | Database migration phase | Service worker version bumped; offline queue flushed before cutover |
| Settlement-level "complete" bypasses per-load matching | Settlement reconciliation UI phase | "Complete" action disabled with unmatched lines outstanding; per-load status enforced in data model |

---

## Sources

- USDA AMS — [Testing a Bulk-Weighing Scale for Accuracy](https://www.ams.usda.gov/resources/testing-bulk-weighing-scale-accuracy) — Confirmed: elevator scale acceptance tolerance 0.05% of capacity; maintenance tolerance 0.1%. HIGH confidence (official USDA).
- USDA AMS — [Operation of a Bulk Weighing Scale](https://www.ams.usda.gov/resources/operation-bulk-weighing-scale) — Confirmed: accumulated error tolerance standards. HIGH confidence (official USDA).
- J&M Manufacturing — [Grain Cart Scale System](https://jm-inc.com/grain-cart-scales.html) — Confirmed: grain cart scales accurate to ±0.5% (5-point) to ±1.0% (3-point). MEDIUM confidence (manufacturer spec).
- Penn State Extension — [Understanding Grain Discount Schedules](https://extension.psu.edu/understanding-grain-discount-schedules) — Confirmed: shrink method vs. moisture discount method; identical grain delivered to different buyers yields different payment; $50+ difference on same load. HIGH confidence (extension publication).
- Iowa State Extension — [Keep Monitors, Sensors and Scales Accurate During Harvest](https://crops.extension.iastate.edu/cropnews/2022/09/keep-monitors-sensors-and-scales-accurate-during-harvest) — Confirmed: growers verify grain cart scales against truck net weights from elevator tickets; good practice throughout season. HIGH confidence (extension publication).
- Tailscale Engineering Blog — [An Unlikely Database Migration](https://tailscale.com/blog/an-unlikely-database-migration) — Confirmed: phased dual-run approach for JSON-to-database migration; write latency drops dramatically post-migration; migration being "unnoticeable" is the goal. MEDIUM confidence (engineering post-mortem).
- Vertical Software — [Grain Farm Software](https://www.verticalsoftware.net/grain-farm-software/) — Confirmed: common problems include missing loads discovered during settlement reconciliation; manual ticket entry leads to errors. MEDIUM confidence (vendor documentation).
- Iowa State Extension — [Crop Marketing Terms — Shrink](https://www.extension.iastate.edu/agdm/crops/html/a2-05.html) — Confirmed: "invisible shrink" varies significantly from one grain buyer to another. HIGH confidence (extension publication).
- Agrimatics — [Grain Cart Scale System](https://agrimatics.com/grain-cart-scales) — Confirmed: grain cart scale manufacturer spec ±0.5-1.0%. MEDIUM confidence (manufacturer).
- Existing codebase analysis — `server.js`, `calc.js`, `import.js`, `data/data.json` — Confirmed: 527 tickets, string IDs `t_000001`, free-text notes containing truck/bin data, PWA support, 4-dependency package.json, no authentication. HIGH confidence (direct code review).

---
*Pitfalls research for: Grain traceability and settlement reconciliation — adding to existing Express + JSON grain ticket app*
*Researched: 2026-03-01*
