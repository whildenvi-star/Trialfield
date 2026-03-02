# Pitfalls Research

**Domain:** Organic cert compilation engine — adding cross-app HTTP aggregation, rotation snapshot history, NOP compliance logic, and live PDF generation to an existing 85K LOC Next.js app that currently has its own manual data entry
**Researched:** 2026-03-01
**Confidence:** HIGH for integration topology pitfalls (grounded in actual codebase analysis — sync-registry route code, CONCERNS.md, fields/page.tsx crash confirmed); HIGH for snapshot history pitfalls (grounded in farm-budget single-season design and PROJECT.md Key Decisions); MEDIUM for NOP compliance aggregation pitfalls (regulatory rules confirmed against USDA NOP 7 CFR Part 205, behavioral patterns extrapolated from the existing mass-balance and report-assembler code)

---

## Critical Pitfalls

### Pitfall 1: Fix the Sync-Registry Runtime Crash Before Building On Top of It

**What goes wrong:**
The existing "Sync Acres" button in organic-cert's Fields page throws a runtime TypeError every time it runs. The API route (`POST /api/fields/sync-registry`) returns a response with keys `matched`, `created`, `updated`, and `unchanged`. The client in `fields/page.tsx` reads `data.unmatched` at line 128, which is `undefined` — calling `.length` on `undefined` crashes. The button appears to complete (the try/catch swallows the error as "Could not reach Farm Registry") but the field reload never happens and the user sees a false error.

**Why it happens:**
The sync-registry route was refactored after the client UI was written. The route's response shape changed (dropping the `unmatched` array in favor of the `unchanged` array) but the UI was never updated to match. The mismatch was not caught because no tests exist for this code path and the error is masked as a generic network failure.

v3.0 builds the entire field data pull on top of this same sync-registry mechanism. If the bug is still present, every field pull in the compilation engine will silently fail, producing a PDF with no field data and no visible error.

**How to avoid:**
Fix this before v3.0 starts. Two-line fix: the response from `sync-registry` returns `unchanged` not `unmatched` — update `fields/page.tsx` line 128 to read `data.unchanged?.length`. Fix it in Phase 1 of v3.0 or as a pre-milestone patch. Do not build the compilation engine on top of a broken foundation.

Verify: after fix, click "Sync Acres" with farm-registry running and confirm toast messages fire correctly for matched/updated/unchanged fields.

**Warning signs:**
- "Sync Acres" button shows "Could not reach Farm Registry" even when farm-registry is running on port 3005.
- Browser DevTools console shows `TypeError: Cannot read properties of undefined (reading 'length')` in fields/page.tsx.
- Field list does not refresh after a successful sync operation.

**Phase to address:** Phase 1 (API foundation / cross-app wiring) — fix before any other v3.0 work. Mark as a known bug fix in the phase plan, not a new feature.

---

### Pitfall 2: farm-budget JSON Store Has No Transactions — Reads Can Return Partially-Written State

**What goes wrong:**
farm-budget stores all data in a single `data.json` file. Writes use a debounced save with a 500ms coalescing window. During any write operation (user edits a field, adds an input, changes a seed record), the in-memory `store` is updated immediately but the file may not be written yet. More critically, when multiple writes are queued, intermediate states exist where, for example, a field has a new enterprise but its inputs haven't been saved yet.

When organic-cert calls `GET /api/fields` from farm-budget, it gets a snapshot of the in-memory store. If the user is actively editing farm-budget at the same time, organic-cert may pull a state where:
- Fields exist but their inputs haven't been updated yet
- An enterprise shows a crop but its seed usage is still empty
- Totals are inconsistent across nested objects

This produces a PDF with missing input records, incomplete seed sourcing documentation, or incorrect mass balance — all without any error. The PDF looks valid. The NOP inspector sees incomplete records.

**Why it happens:**
JSON file stores are eventually consistent on writes. There are no transactions, no isolation levels, no MVCC. The problem is benign when data entry and reads happen in different sessions. It becomes critical when organic-cert pulls data during an active farm-budget editing session — which is exactly when a farmer would want to generate a draft inspection report to see how it looks.

**How to avoid:**
- Treat all farm-budget API reads in organic-cert as potentially stale. Add a `generatedAt` timestamp to every compiled report that captures when the pull happened.
- The compilation engine should pull all farm-budget data in a single batch request (or as few sequential requests as possible) to minimize the time window for inconsistency. Do not spread farm-budget API calls across multiple HTTP roundtrips that could straddle a write.
- Document clearly in the UI: "Data compiled from farm-budget as of [timestamp]. Re-compile to refresh." Do not silently use cached aggregation data.
- For report generation specifically: add a "lock for report" endpoint concept — pull all data once and cache it in the organic-cert PostgreSQL snapshot table before generating the PDF. The PDF always renders from the snapshot, not from a live pull.

**Warning signs:**
- A compiled report shows a field with no inputs even though farm-budget clearly shows inputs for that field.
- The mass balance section shows harvested quantity but zero sold quantity because the SaleDelivery records hadn't been written yet when the pull happened.
- Report totals change between two consecutive generations without the user changing anything in farm-budget.

**Phase to address:** Phase 1 (cross-app data aggregation) — the snapshot strategy must be designed before any pull logic is written. Decide: does the compilation engine pull live and compile in-memory, or pull once and persist to a snapshot table? The snapshot table approach is safer for NOP audit purposes.

---

### Pitfall 3: farm-budget Field Identity Does Not Match organic-cert Field Identity

**What goes wrong:**
farm-budget field names are free text set when the field was imported from Excel. organic-cert field names came from a different import or manual entry. The field matching in `sync-registry` uses lowercase name comparison with alias fallback — which works for farm-registry-to-organic-cert. But farm-budget fields have no alias system. A farm-budget field named "Kopps" will not match an organic-cert field named "Kopp" or "Kopp East" without alias resolution.

When organic-cert tries to pull inputs for "Kopps" from farm-budget, it receives that field's data correctly. But when it tries to attach that data to the organic-cert "Kopp East" enterprise, the name mismatch means the data is either not matched (silently dropped) or matched to the wrong field (silently wrong). Either failure produces a PDF that omits material applications or misattributes them to the wrong field — both are audit failures.

**Why it happens:**
Three independent naming sources (farm-budget, organic-cert, farm-registry) evolved separately. farm-budget was built first from an Excel import; organic-cert was built second with its own data entry; farm-registry was added third as the canonical source. The canonical IDs (`registryId` in organic-cert's Field model) were supposed to resolve this — but farm-budget has no `registryId` column. It only knows fields by name.

**How to avoid:**
- The compilation engine must use farm-registry as the identity anchor, not field name string matching. Flow: organic-cert field → get `registryId` → look up registry aliases → use aliases to find the matching farm-budget field name.
- Store the farm-budget field name (as resolved at sync time) in the organic-cert snapshot table alongside the `registryId`. If no match is found, flag that field as "unresolved from farm-budget" — do not silently omit it.
- Build a one-time field name reconciliation step as part of Phase 1. Display a mapping UI that shows: organic-cert field → proposed farm-budget field match → confirm/override. Save the confirmed mapping as a `farmBudgetFieldName` on the organic-cert Field row.
- Never build the field resolution on the assumption that names will match. They will not for at least 5-10 of the 56 fields.

**Warning signs:**
- The compilation engine fetches farm-budget fields and matches by name to organic-cert fields, finding a match rate below 90%.
- A PDF report shows zero inputs for a field that clearly has inputs in farm-budget.
- Two different organic-cert fields map to the same farm-budget field (aliasing ambiguity).

**Phase to address:** Phase 1 (cross-app wiring) — field identity resolution must be solved before any data aggregation. The field mapping must be explicitly verified, not assumed.

---

### Pitfall 4: Rotation Snapshot Mechanism Missing Means 3-Year NOP History Is Lost After Each Rebuild

**What goes wrong:**
farm-budget is rebuilt every year. The current year's farm-budget data is replaced with a new `data.json`. Previous season data is gone. NOP certification requires 3-year field history (7 CFR Part 205.103). If organic-cert pulls rotation history from farm-budget at compile time, it only gets the current season. The prior two years of crop history — critical for proving 3-year transition compliance — are simply not present.

The organic-cert `FieldHistory` table exists and is the right place to store this. But nothing currently writes to it from an automated source. It's populated by manual entry. If v3.0 replaces manual entry without implementing the snapshot mechanism, it eliminates the only path by which prior-year history was being recorded.

**Why it happens:**
The "yearly rotation snapshot" is listed as a Key Decision in PROJECT.md ("farm-budget is single-season (rebuilt yearly); organic-cert must accumulate rotation history via annual snapshots") but no implementation exists. It's easy to build the compilation engine without the snapshot because the current season works fine. The prior-year problem doesn't manifest until after the season ends and farm-budget is rebuilt — at which point 12 months of history are gone.

**How to avoid:**
- The snapshot mechanism is not optional. It must be built in the same phase that replaces manual data entry. If you build the live pull without the snapshot, you will silently destroy prior-year history.
- Design: at end-of-season (configurable trigger date, or manual "take snapshot" button), the compilation engine must call farm-budget and grain-tickets, pull the current season's full field data, and write it as `FieldHistory` rows in organic-cert's PostgreSQL with `year = currentCropYear`.
- Snapshots must be immutable once written. A `FieldHistory` row for year 2024 should not be overwritten when the 2026 season is compiled.
- Before replacing manual data entry, confirm that `FieldHistory` rows exist for the prior two years (2024, 2025). If they don't, the user must manually enter them or import from archived farm-budget exports before v3.0 goes live.
- The snapshot also captures material usage (inputs) and harvest quantities for that year — not just the crop planted. A "2024: Soft Red Winter Wheat" FieldHistory entry is insufficient. It needs yield, inputs, and NOP status.

**Warning signs:**
- A compiled PDF shows only the current year in the field history section. Prior years show no data.
- After farm-budget is rebuilt for the new season, re-running the compilation engine for the prior year returns empty results.
- The `FieldHistory` table in organic-cert has zero rows for years before the current season.

**Phase to address:** Phase 2 (rotation snapshot mechanism) — this must be a standalone phase that ships before any phase that replaces manual data entry. Do not combine with Phase 1.

---

### Pitfall 5: NOP Compliance Rules Applied to Aggregated Data Produce False Positives Without Context

**What goes wrong:**
organic-cert's existing compliance logic (material NOP status checks, day-to-harvest rules, compost C:N ratio) operates on records that were manually entered by a user who understood the context. When the compilation engine pulls inputs from farm-budget, it gets raw product names, rates, and dates. It does not know:

- Whether the product has been reviewed and approved for NOP use on this operation
- Whether an OMRI certificate is on file (farm-budget doesn't track this)
- Whether the application was on a conventional field or an organic field (farm-budget uses a `systemCode` on the enterprise, not an `organicStatus` field)

The existing compliance rules will flag every unreviewed input as UNKNOWN or RESTRICTED. A farm with 200 input records will generate a PDF with 200 compliance warnings, making the report useless. Or worse: the compilation engine silently skips compliance checking on aggregated data because the compliance function requires fields that don't exist in the farm-budget response.

**Why it happens:**
Compliance state (APPROVED, RESTRICTED, PROHIBITED, EXEMPT per NOP) is tracked in organic-cert's `Material.nopStatus` and `MaterialUsage` tables. farm-budget tracks products by name and cost — it has no NOP status concept. When organic-cert pulls a product named "14-0-0 Liquid Fertilizer" from farm-budget, there is no NOP status attached. The compilation engine must either (a) map the farm-budget product to an existing organic-cert Material record, (b) create a new Material record with UNKNOWN status, or (c) skip the compliance check.

**How to avoid:**
- Build a product-to-material mapping layer: when the compilation engine pulls farm-budget inputs, it must match each product name to an existing organic-cert Material record. Maintain this mapping explicitly (similar to the CaseIH field mapping pattern that already exists in organic-cert).
- Products that cannot be mapped get flagged as "unresolved materials" — not added as UNKNOWN status or silently dropped.
- Present the unresolved materials to the user before generating the PDF: "These 5 products from farm-budget do not have an NOP status in organic-cert. Assign status before generating the inspection report."
- Never run NOP compliance rules against input records that lack a material mapping. The PDF section for those records should show "Awaiting material review" rather than a false RESTRICTED or UNKNOWN status.
- Filter farm-budget enterprises by `systemCode` or enterprise category to confirm they are organic-designated before pulling their inputs. Do not pull conventional-designated field inputs into the organic NOP report.

**Warning signs:**
- A compiled PDF application log is filled with UNKNOWN status flags for every input record.
- The compliance rules count 0 APPROVED materials and 180 UNKNOWN materials even though the farm has well-documented OMRI approvals on file.
- Conventional field inputs appear in the organic inspection report because the enterprise filtering was not applied.

**Phase to address:** Phase 3 (NOP compliance layer) — material mapping must be built before NOP compliance rules are applied to aggregated data. The product resolution UI must ship as part of Phase 3, not as a follow-on.

---

### Pitfall 6: take:3 Enterprise Query Limit Silently Undercounts Split-Field Operations

**What goes wrong:**
The existing `GET /api/fields` route in organic-cert queries enterprises with `take: 3` (line 18 of `src/app/api/fields/route.ts`). This was designed for the list view — showing the three most recent enterprises per field is sufficient for display purposes. But if the compilation engine calls this same endpoint to aggregate field data, fields with 4+ enterprises in the lookback window (the NOP 3-year window means enterprises from 2024, 2025, 2026 = up to 9 enterprises for a 3x split-field) will silently return only 3.

A split field in 2026 with 3 enterprises (corn, soybeans, fallow) combined with the prior two years = 9 total enterprises. The take:3 limit returns 3. The compilation engine sees 3 enterprises, computes mass balance on 3 enterprises, generates the PDF from 3 enterprises. The other 6 years of enterprises — and all their attached inputs, operations, and harvest records — are silently absent from the NOP report.

**Why it happens:**
The `take:3` was a deliberate performance optimization for the field list UI view and was never meant to serve a comprehensive data pull. The compilation engine will naturally reach for the existing API endpoints, not realizing that the endpoints were designed with display pagination in mind, not data completeness in mind.

**How to avoid:**
- The compilation engine must NOT use `GET /api/fields` for its data aggregation. It must use the existing `assembleReportData()` function in `report-assembler.ts` (which has no take limit) OR a new dedicated `/api/reports/compile` endpoint that explicitly queries enterprises without pagination.
- If new API endpoints are built for the compilation engine, they must never include `take:` on enterprise queries. The NOP lookback window is 3 years × up to 3 split enterprises = potentially 9 enterprises per field.
- Audit every organic-cert API endpoint that the compilation engine will call. Check for any `take:`, `skip:`, or `limit:` parameters on enterprise, materialUsage, harvestEvent, or fieldOperation queries.
- Test specifically with a field that has the maximum enterprise configuration: 3 enterprises in each of 3 years = 9 enterprises. Verify all 9 appear in the compiled output.

**Warning signs:**
- The compilation engine calls `GET /api/fields?farmId=X` to get field data.
- A compiled report for a split field in 2026 shows only the current year's data and nothing from 2024 or 2025.
- Mass balance totals are lower than expected because prior-year harvest records were truncated by the take limit.

**Phase to address:** Phase 1 (API foundation) — identify every organic-cert API endpoint the compilation engine will call and verify no pagination limits exist on critical data paths. Use `report-assembler.ts` as the data aggregation layer, not the field list API.

---

### Pitfall 7: PDF Report Generation Fails Silently When Aggregated Data Has Unexpected Nulls

**What goes wrong:**
The existing PDF generation pipeline was built against a known data shape: every record was manually entered by a human and validated by the API routes before it reached the PDF renderer. The compilation engine will introduce a new data shape: programmatically assembled from 3 external HTTP calls with heterogeneous schemas (farm-budget JSON, farm-registry JSON, grain-tickets PostgreSQL).

When the PDF renderer encounters an unexpected null — for example, a harvest record from grain-tickets that has no `yieldPerAcre` because that field wasn't populated during migration — `@react-pdf/renderer` can silently render a blank where the number should be, produce a page with broken layout (zero-height row), or throw an uncaught exception that produces a truncated PDF (ends mid-page) instead of an error response.

This is worse than a visible error because the user downloads a PDF that looks complete but is missing data. The inspector receives an incomplete packet.

**Why it happens:**
`@react-pdf/renderer` has different null-handling behavior than React DOM. `null` and `undefined` render as empty strings in React DOM but can produce layout anomalies in react-pdf. The existing PDF sections were written with the assumption that `report-assembler.ts` guarantees non-null values for required fields. When aggregation replaces manual entry, that guarantee no longer holds — grain-tickets records may have `null` for fields that were never filled in during migration.

**How to avoid:**
- Before passing aggregated data to the PDF renderer, run it through a "report readiness validation" step. This step checks all fields the PDF sections require and either fills defaults (zero, "—", "Unknown") or fails loudly with a structured error listing what is missing.
- Never let `undefined` reach the PDF renderer. Use explicit `?? "—"` coalescing in every PDF section that consumes aggregated data.
- Add a "preview mode" for compiled reports that shows the data in a web view (HTML table) before generating the PDF. If the preview looks wrong, the user catches it before generating the PDF.
- Test PDF generation with the worst-case aggregated data: a field where farm-budget has no inputs, grain-tickets has no harvest records, and farm-registry has no organic acres. The PDF must render without crashing and must show "No records" in the relevant sections.

**Warning signs:**
- The compiled PDF is smaller than expected (in kilobytes) — a truncated PDF is smaller because it ends early.
- A PDF section shows blank rows where data should appear.
- The `/api/reports/generate` endpoint returns a 200 status but the downloaded PDF is fewer pages than expected.

**Phase to address:** Phase 4 (PDF regeneration from live sources) — add a report readiness validation layer before any PDF rendering call. Test with intentionally incomplete data before testing with real data.

---

### Pitfall 8: Replacing Manual Data Entry Breaks Existing Records That Have No Equivalent in Source Systems

**What goes wrong:**
organic-cert currently has manually entered records for scoutings, management actions, narrative sections, pest management documentation, and equipment cleanout events. None of these records have equivalents in farm-budget, farm-registry, or grain-tickets. When v3.0 replaces manual data entry with live pulls, these record types have no source to pull from.

If the compilation engine treats these sections as "replaced by aggregation," it will generate PDFs with empty pest management sections, no cleanout verification records, and no narrative descriptions — all of which are required for a complete NOP inspection packet (7 CFR Part 205.201 requires pest management documentation; cleanout records are required for C11.0 compliance).

The failure mode is an inspector arriving to find an incomplete packet and the farm having to scramble for documentation that used to exist but was deleted when the data entry screens were removed.

**Why it happens:**
The v3.0 design states "eliminate double-entry." This is correct for fields, inputs, seed, and harvest data that are duplicated from farm-budget. But the "eliminate double-entry" principle gets misapplied to record types that are organic-cert-only — records that exist nowhere else and have no external source.

**How to avoid:**
- Map every organic-cert record type to its data source before building any phase:
  - FROM farm-budget: fields, enterprises, inputs (material applications), seed usage, machinery, yield
  - FROM grain-tickets: harvest delivery records (actual loads)
  - FROM farm-registry: field identity, acres, ownership, organic status
  - ORGANIC-CERT-ONLY (keep manual entry): scoutings, management actions, cleanout events, narrative sections, buffer zone documentation, water source records, NOP application exceptions
- Build a clear "sources of truth" matrix as a planning artifact before v3.0 execution begins. Protect organic-cert-only records from elimination.
- The UI transition must be additive, not subtractive. Remove the data entry screens for things that are pulled from source systems. Keep the data entry screens for things that only exist in organic-cert.

**Warning signs:**
- A compiled PDF shows empty sections for pest management, management actions, or cleanout events.
- The ScoutingLog table in organic-cert has rows but they are not appearing in compiled PDFs.
- The build removes UI components for ManagementAction or CleanoutEvent entry.

**Phase to address:** Phase 3 (NOP compliance layer) — create the sources-of-truth matrix before this phase starts. Verify that every record type that has an organic-cert-only source retains its manual entry path.

---

### Pitfall 9: Cross-App HTTP Calls From Next.js Server Components Have No Retry or Timeout

**What goes wrong:**
When the compilation engine calls `http://localhost:3001/api/fields` (farm-budget), `http://localhost:3005/api/fields` (farm-registry), and `http://localhost:3000/api/tickets` (grain-tickets), each call is a standard `fetch()` in a Next.js API route handler. Node.js's default fetch has no timeout. If any of the three Express apps is slow to respond (large JSON file being read from disk, slow query), the compilation request hangs indefinitely. The user sees a loading spinner forever. There is no error, no timeout, no partial result.

More critically: if farm-budget is not running (common in development, possible in production if the process crashed), `fetch()` to port 3001 will throw a `ECONNREFUSED` error that crashes the compilation API route with a 500 and no useful message.

**Why it happens:**
`fetch()` in a browser has a natural connection timeout because browsers enforce one. `fetch()` in Node.js (Next.js API routes) has no default timeout. Developers test the compilation engine with all apps running and never discover the hang behavior until a production incident.

**How to avoid:**
- Wrap every cross-app HTTP call in an `AbortController` with an explicit timeout (5 seconds is reasonable for local Express apps).
- Use `Promise.allSettled()` not `Promise.all()` when calling multiple source apps in parallel. `allSettled` allows the compilation to proceed with partial data and report which sources were unavailable, instead of failing completely if one source is unreachable.
- Design a "source availability" pre-check at the start of every compilation: ping each source app's `/health` or `/api/settings` endpoint with a 2-second timeout before starting the full compilation pull. Return a structured error listing which sources are offline.
- Show the user which sources contributed to the compiled report and which were unavailable: "farm-budget: CONNECTED | farm-registry: CONNECTED | grain-tickets: UNREACHABLE (port 3000 not responding)."
- Never generate a PDF when a required source is unreachable. Show the source availability status and require user acknowledgment before generating with partial data.

**Warning signs:**
- A compilation request hangs for 30+ seconds and eventually times out at the Next.js default request timeout.
- A compilation error message says "fetch failed" with no indication of which source app was unreachable.
- The user restarts farm-budget and the compilation works, but there is no explanation of why it failed before.

**Phase to address:** Phase 1 (cross-app HTTP foundation) — the timeout, retry, and `allSettled` pattern must be in place from the first HTTP call written. Do not add it later as an enhancement.

---

### Pitfall 10: Partial Unique Index Not in schema.prisma Means Environment Rebuilds Drop a Critical Constraint

**What goes wrong:**
There is a known partial unique index in organic-cert's PostgreSQL database that is NOT captured in `schema.prisma`. When the database is rebuilt in a new environment (new developer, staging deployment, schema reset via `prisma migrate reset`), this index is not recreated. The constraint it enforces is silently absent. Data that should be rejected by the constraint is now accepted, potentially allowing duplicate records that would cause mass balance miscalculations or duplicate entries in the NOP inspection report.

This is pre-existing tech debt from v1.1. v3.0 makes it worse because the compilation engine will be inserting aggregated data programmatically — exactly the scenario where duplicate suppression constraints are most critical. If the constraint is absent and the compilation runs twice (user clicks "Compile" twice), duplicate MaterialUsage or FieldHistory rows could be created silently.

**Why it happens:**
Partial unique indexes (e.g., `CREATE UNIQUE INDEX idx_name ON table(col) WHERE condition = 'value'`) require raw SQL in Prisma migrations. They cannot be expressed in schema.prisma using the standard `@@unique` syntax. If the migration file that created the index is not present in the `prisma/migrations/` history, `prisma migrate reset` will not recreate it.

**How to avoid:**
- Before v3.0 starts: audit the PostgreSQL database for indexes not present in schema.prisma. Run `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname` and compare against what Prisma would generate. Document every custom index.
- Add a Prisma migration file that re-creates the partial unique index via raw SQL (`CREATE UNIQUE INDEX IF NOT EXISTS ...`). Once this migration exists in the history, it will run on every `migrate deploy` and `migrate reset`.
- The compilation engine must handle unique constraint violations gracefully — on duplicate, update the existing row, do not fail the entire compilation.
- Add a "health check" step to the compilation phase that verifies critical indexes exist before running the insert phase.

**Warning signs:**
- `prisma migrate reset` in a fresh environment produces a database with different behavior than the production database.
- Running the compilation engine twice produces duplicate MaterialUsage or FieldHistory rows.
- The audit log shows the same record being created twice within a short window.

**Phase to address:** Phase 1 (pre-flight tasks before building the compilation engine) — the partial unique index must be captured in a migration before any v3.0 work writes to the database.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Match farm-budget fields to organic-cert fields by name string comparison | Simple to implement, works for exact-match fields | 5-10 of 56 fields will not match; their data is silently absent from PDFs | Never for the compilation engine — build the explicit mapping step |
| Skip the rotation snapshot mechanism and pull farm-budget for prior years via API | No snapshot table needed | After farm-budget is rebuilt each year, prior seasons are gone; NOP 3-year history requirement cannot be met | Never — snapshot is a regulatory requirement, not an enhancement |
| Use `Promise.all()` for parallel cross-app HTTP calls | Simpler code | If any one source app is down, the entire compilation fails with no partial result | Never — use `Promise.allSettled()` so one unreachable app doesn't block the others |
| Reuse `GET /api/fields` with its `take: 3` pagination for compilation data pull | No new endpoints needed | Fields with 4+ enterprises in the 3-year window return truncated data silently | Never — build a dedicated compilation endpoint or use report-assembler.ts directly |
| Generate PDF from live API pulls without a snapshot step | No snapshot table needed | Two consecutive compilations can produce different PDFs if farm-budget is being edited; NOP audit records must be reproducible | Never — the PDF is an audit document; it must render from an immutable snapshot |
| Skip the `data.unmatched` crash fix and work around it | Save 15 minutes | Every field pull in the compilation engine uses the same broken code path and fails silently | Never — fix before v3.0 starts |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| farm-budget `GET /api/fields` | Calling with no parameters gets all fields including conventional-designated ones | Filter by `enterpriseId` with enterprise `systemCode` to get only organic-designated fields; confirm system code mapping before pulling |
| farm-budget `GET /api/fields` response shape | Expecting a flat array of field objects; getting enriched fields with `_computed` budget data attached | Strip `_computed` properties before using farm-budget field data in the compilation engine; they are budget projections, not NOP audit data |
| farm-registry `GET /api/fields` | Treating `reportingAcres` as the same as `organicAcres` | These are different numbers; `reportingAcres` is the canonical total; `organicAcres` is the subset that is certified; both are needed for NOP field list section |
| grain-tickets `GET /api/tickets` (once Phase 11+ is complete) | Using `ticketNo` as the harvest record link to organic-cert | grain-tickets will have a `fieldId` or farm name field; organic-cert must use the registry ID to link, not the ticket number |
| organic-cert `POST /api/fields/sync-registry` | Calling this as part of the compilation engine pull | This is a write operation — it upserts field records from registry. Do not call it during compilation. Use it only in the manual "Sync Acres" flow. The compilation engine should read from organic-cert's own field records (which have been synced), not trigger a re-sync. |
| farm-budget debounced save | Assuming a 200 response to a PUT means the data is on disk | The 200 confirms in-memory update; disk write happens 500ms later. Wait at least 1 second after any farm-budget write before pulling the data in a compilation. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential HTTP calls to farm-budget, farm-registry, grain-tickets during compilation | Compilation takes 3-5x longer than necessary | Use `Promise.allSettled()` to fan out all three source calls in parallel; they are independent | With 3 sequential 1-second calls, every compilation takes 3+ seconds; parallel makes it ~1 second |
| Fetching all 527+ grain-tickets for every compilation even when only organic enterprise tickets are needed | Compilation payload is large; JSON parse time is high | Add a `fieldId` or `crop` filter to the grain-tickets API call; only pull tickets for organic enterprise fields | Noticeable now; breaks above ~2,000 tickets when JSON parsing blocks the event loop |
| Assembling ReportData without database indexes on (farmId, cropYear) | Report assembly queries scan all enterprises for a farm | Add Prisma indexes on `FieldEnterprise.cropYear` and `FieldEnterprise.fieldId` before building the compilation engine | Already noted in CONCERNS.md; becomes critical when the compilation engine runs report assembly for 3 years × 56 fields |
| Generating the PDF in the same API route that runs the compilation | Long-running route; Next.js default 30-second timeout | Separate compilation (data pull + snapshot) from PDF generation; let the user trigger PDF generation from the snapshot | A full compilation + PDF for 56 fields will approach 10-15 seconds; PDF generation alone adds 3-5 seconds on top |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Making cross-app HTTP calls from Next.js API routes to unauthenticated Express apps | farm-budget and farm-registry have no auth; any process on the machine can call them | Acceptable for this single-machine deployment; document the assumption explicitly; if the farm network becomes multi-machine, add API key auth to Express apps |
| Including raw financial data from farm-budget (rent per acre, cost of production) in the NOP PDF | NOP inspectors do not need financial data; including it leaks sensitive farm financials | Filter the farm-budget field response to only NOP-relevant fields (crop, acres, inputs, seed, operations) before passing to the compilation engine; strip `_computed` budget data |
| Storing compilation snapshots with no access control | Snapshots contain crop plans, input records, and yield data — sensitive operational data | Snapshots stored in PostgreSQL are protected by organic-cert's existing auth/RBAC; do not expose snapshots via unauthenticated endpoints |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Compilation silently uses stale data without showing when data was last pulled | User generates an "inspection-ready" PDF that reflects farm-budget state from 2 days ago | Show a "last compiled: [timestamp]" prominently on the compilation page; require re-compile if data is older than 24 hours |
| Replacing the manual input entry form with "pull from farm-budget" without a fallback | If farm-budget is down during an inspection prep session, the user has no way to add a missing input record | Keep a manual override path for every pulled record type; compilation adds records, manual entry can supplement or correct |
| Showing NOP compliance warnings from unresolved materials as if they were real violations | User thinks they have compliance problems; spends time investigating records that are just unmapped, not actually restricted | Clearly distinguish "material not yet mapped to NOP status" from "material has RESTRICTED status"; unresolved materials are a workflow step, not a compliance finding |
| "Compile all fields" takes 10+ seconds with no progress indicator | User clicks compile, waits, wonders if it crashed | Show a progress indicator with the current step: "Pulling farm-budget fields... farm-registry acres... grain-tickets... Assembling report... Saving snapshot..." |

---

## "Looks Done But Isn't" Checklist

- [ ] **Sync-registry crash fixed:** After clicking "Sync Acres" with farm-registry running, no TypeError in browser console and field list refreshes correctly.
- [ ] **Field mapping verified:** Every organic-cert field that has a corresponding farm-budget field has a confirmed name mapping stored. Fields with no farm-budget match are explicitly flagged as "no farm-budget data" not silently omitted.
- [ ] **Rotation snapshot tested:** After running a snapshot for 2025, manually rebuilding the farm-budget data.json to simulate a new season, and running a compilation for 2026, the 2025 history still appears in the PDF field history section.
- [ ] **take:3 check:** A compiled report for a field with 3 enterprises in 2024, 3 in 2025, and 3 in 2026 (9 total) shows all 9 enterprises in the output, not just 3.
- [ ] **Source unavailability handled:** With farm-budget stopped, clicking "Compile" returns a clear error: "farm-budget (port 3001) is not reachable — cannot compile." No hang, no infinite spinner.
- [ ] **NOP-only records preserved:** After v3.0, the ScoutingLog, ManagementAction, and CleanoutEvent tables retain their existing rows and the data entry UI for these record types still works.
- [ ] **Partial unique index in migration:** Running `prisma migrate reset` in a fresh environment produces a database with the same indexes as production. Verify via `SELECT indexname FROM pg_indexes WHERE tablename = 'FieldEnterprise'`.
- [ ] **Conventional fields excluded:** Compiling a report for an organic-designated enterprise does not pull inputs from conventional-designated enterprises on the same field (split-field scenario with organic and conventional enterprises).
- [ ] **Snapshot immutable:** Running the compilation twice for the same crop year produces identical snapshots (or updates the existing snapshot without creating a duplicate).
- [ ] **PDF null-safety:** Generating a PDF for a field with no inputs, no harvest records, and no history rows produces a valid PDF with "No records" in those sections — not a crash or a truncated file.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Rotation snapshot not built before farm-budget is rebuilt — prior year history lost | HIGH | Restore prior year farm-budget data.json from backup (farm-budget keeps 5 rotating backups); run snapshot against restored backup; verify FieldHistory rows created; rebuild current season |
| Field mapping silently dropped data — PDF missing inputs for 10+ fields | MEDIUM | Run the field name resolution step again with the mapping UI; identify unmatched fields; manually assign mappings; re-compile |
| Duplicate MaterialUsage or FieldHistory rows from double-compilation | MEDIUM | Identify duplicates via SQL (group by fieldId, cropYear, materialId, applicationDate having count > 1); delete duplicates; add missing unique constraint; re-generate PDF |
| take:3 truncation discovered post-launch — prior PDFs are incomplete | HIGH | Re-run compilation for all affected crop years; regenerate and archive corrected PDFs; notify if inspection has already occurred |
| farm-budget conventional field inputs included in organic PDF | MEDIUM | Identify affected compilation snapshots; delete materialdUsage rows that came from conventional enterprises; re-run NOP compliance check; regenerate PDF |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Sync-registry crash (data.unmatched) | Phase 1, first task — fix before any other work | Click "Sync Acres" with farm-registry running; no TypeError; field list refreshes |
| farm-budget eventual consistency | Phase 1 (snapshot design decision) | Compilation uses snapshot table, not live pull; snapshot has `compiledAt` timestamp displayed in UI |
| Field identity mismatch | Phase 1 (field mapping step) | 100% of organic-designated fields have an explicit farm-budget field mapping stored; zero fields silently absent |
| Rotation snapshot mechanism | Phase 2 (standalone snapshot phase) | 2024 and 2025 history present in PDF after simulated farm-budget rebuild |
| NOP compliance on unmapped materials | Phase 3 (NOP compliance layer) | Unresolved materials shown as workflow step, not compliance warnings; APPROVED/RESTRICTED counts correct for mapped materials |
| take:3 enterprise truncation | Phase 1 (API foundation audit) | 9-enterprise field test passes; all enterprises present in compiled output |
| PDF null safety | Phase 4 (PDF regeneration) | PDF generation with empty data completes without crash; "No records" shown in empty sections |
| Organic-cert-only records eliminated | Phase 2 or 3 (sources-of-truth matrix) | ScoutingLog, ManagementAction, CleanoutEvent data entry UI present and functional post-v3.0 |
| Cross-app HTTP no timeout | Phase 1 (first HTTP call written) | Compilation with farm-budget stopped returns error in < 6 seconds; no infinite hang |
| Partial unique index missing | Phase 1 (pre-flight migration task) | `prisma migrate reset` reproduces production indexes; double-compile produces no duplicates |

---

## Sources

- Codebase direct analysis — `organic-cert/src/app/(app)/fields/page.tsx` lines 128-129 — Confirmed: `data.unmatched` crash on sync-registry button. HIGH confidence (direct code reading).
- Codebase direct analysis — `organic-cert/src/app/api/fields/sync-registry/route.ts` response shape — Confirmed: route returns `matched/created/updated/unchanged`, NOT `unmatched`. HIGH confidence (direct code reading).
- Codebase direct analysis — `organic-cert/src/app/api/fields/route.ts` line 18 — Confirmed: `take: 3` on enterprises query in the field list endpoint. HIGH confidence (direct code reading).
- Codebase direct analysis — `farm-budget/server.js` lines 78-110 — Confirmed: debounced 500ms save, no transactions, in-memory store is source of truth for API reads. HIGH confidence (direct code reading).
- Codebase direct analysis — `organic-cert/src/lib/report-assembler.ts` — Confirmed: assembler has no take/skip limits; safe to use as compilation foundation. HIGH confidence (direct code reading).
- Planning doc — `.planning/codebase/CONCERNS.md` — Confirmed: partial unique index not in schema.prisma; take:3 limit identified as tech debt; Sync Acres crash documented. HIGH confidence (project planning records).
- Planning doc — `.planning/PROJECT.md` Key Decisions — Confirmed: "Yearly rotation snapshots for NOP 3-year history" is a pending design decision; farm-budget is single-season. HIGH confidence (project planning records).
- USDA NOP — 7 CFR Part 205.103 — Required: 3-year field history for certification. HIGH confidence (federal regulation).
- USDA NOP — 7 CFR Part 205.201 — Required: pest management documentation with hierarchy escalation records. HIGH confidence (federal regulation).
- Next.js Documentation — App Router fetch() behavior — Confirmed: Node.js fetch has no default timeout; AbortController required for explicit timeouts. MEDIUM confidence (training data + consistent with Node.js behavior).

---
*Pitfalls research for: organic-cert v3.0 compilation engine — adding cross-app aggregation to an existing Next.js app*
*Researched: 2026-03-01*
