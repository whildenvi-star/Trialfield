# Phase 27: FSA Data Foundation + Migration - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate fsa-acres data.json (444 CLU records, 22 pricing entries, 3 insurance policies, 149 GCS enrollments) to Supabase. Register fsa-578 module in the portal. Port calc.js pure functions to TypeScript. Build validation API and farm-budget auto-populate proxy. Legacy fsa-acres Express app (port 3002) stays running read-only.

</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- Repeatable import script with upsert (can safely re-run if Excel source changes before go-live)
- Legacy fsa-acres Express app stays running read-only on port 3002 as reference
- Verification: script outputs record counts per table + total acres, compared against source (444 CLU, 22 pricing, 3 insurance, 149 GCS, ~3,164 FSA acres)

### Data Model
- Split claim fields from insurance_policies NOW — create insurance_policies (policy fields only) + claims table from Phase 27. The 3 existing policies with claim data get rows in both tables. Clean FK chain for Phases 29-32.
- Separate gcs_enrollments table with FK to clu_records by (farmNumber, tractNumber, fieldId)
- Dedicated insurance_pricing table scoped by crop year (crop, year, spring_price, fall_price) — supports multi-year history
- Tillagecodes as enum/reference data (not a table)

### Farm-Budget Auto-Populate
- When farm-budget (port 3001) is offline: show clear error "Farm-budget is offline — auto-populate unavailable" with retry button. No stale data fallback.
- Auto-populate proposes crop assignments for ALL CLUs (including ones with existing crops), not just blanks. User reviews full diff and controls what gets applied.

### Validation Rules
- All 5 existing warning types from calc.js carry over: missing-crop, missing-date, missing-price, no-insurance (crops >10ac without policies), unreported
- Warn only — validation warnings are advisory, never block saves
- Two endpoints: full-dataset (GET /api/validation for warnings panel) + per-record validation on individual saves
- Three severity levels: error (missing-crop, missing-date), warning (unreported, no-insurance), info (missing-price)

### Claude's Discretion
- ID strategy: UUID primary keys vs keeping original string IDs (clu_1, pr_455, etc.)
- Year column normalization: flat columns (tillage_2024, tillage_2025) vs normalized clu_practice_history table
- Auto-populate preview format (side-by-side diff vs proposed-with-highlights)
- Auto-populate matching strategy (crop-only vs field+crop between farm-budget and CLU records)

</decisions>

<specifics>
## Specific Ideas

- Existing calc.js (383 lines) is a UMD module with clean pure functions — port directly to TypeScript, preserving function signatures
- Key calc functions to port: rollupByFarm, rollupByCrop, rollupByField, rollupByTract, summaryMetrics, computeInsurancePolicy, validateRecords, reportingProgress, tillageSummary, coverCropSummary, gcsSummary
- Cross-app fetch pattern already established: Promise.allSettled, {next:{revalidate:0}}, AbortSignal.timeout(5000)
- import.js (288 lines) has proven data transformation logic — reference for migration script

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-fsa-data-foundation-migration*
*Context gathered: 2026-03-05*
