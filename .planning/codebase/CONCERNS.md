# Codebase Concerns

**Analysis Date:** 2026-02-25

## Tech Debt

**FieldOps Client Token Management:**
- Issue: OAuth2 access token stored in module-level `tokenCache` object in memory. No distributed session support, no token refresh persistence, expires on server restart.
- Files: `/Users/glomalinguild/Desktop/my-project-one/farm-budget/fieldops/client.js` (lines 5-54), `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-client.ts`
- Impact: Multi-server deployments share no token state; each server must re-authenticate. Long-running sync processes lose token mid-flight if server restarts. In-memory caching doesn't survive app reload.
- Fix approach: Move token cache to Redis or PostgreSQL session table with TTL. Implement token refresh logic before expiry.

**FieldOps API Schema Parsing (Defensive Zod Usage):**
- Issue: CNH Industrial FieldOps API schema is undocumented and behind a login-gated developer portal. Normalizer built against farm-budget mock data, schema assumptions unvalidated against live API responses.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-normalizer.ts`
- Impact: Live API responses may have fields not in mock data, causing silent Zod parse failures. Normalizer silently drops unmatched records instead of erroring, hiding data loss.
- Fix approach: Document actual Case IH API response schema (request from CNH support). Add telemetry logging for parse failures. Implement schema discovery tests against live API.

**Unmatched CaseIH Field Mapping (Silent Data Loss):**
- Issue: `normalizeApplications()` and `normalizeYield()` skip records where `mappedFieldId` is null (admin hasn't mapped the field). No warning or error raised; synced operations are discarded without user awareness.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-normalizer.ts` (normalizer functions)
- Impact: Operations from unmapped fields disappear from sync results. Admin has no visibility into which fields/operations were skipped. Harvest records or input applications from new Case IH fields silently vanish.
- Fix approach: Collect unmapped field list during sync, return in SyncResult.unmatchedFields. Display warning banner on sync completion if unmatchedFields.length > 0.

**Linked Account Silent Failure:**
- Issue: CNH FieldOps API returns empty field array silently when equipment is under a dealership account (not owner account). System treats this as "no operations" instead of "account misconfiguration."
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-sync.ts` (lines 73-80), `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-client.ts`
- Impact: Farm manager thinks sync succeeded ("no operations found"). Equipment/fields exist in Case IH but never pull. Audit gap for months until discovered.
- Fix approach: Check equipment count from API; if zero but auth succeeds, flag as linkedAccountWarning (already implemented). Surface this prominently in UI, not just in FieldOpsSyncState record.

**Grain Tickets Manual Excel Import (No Validation):**
- Issue: `grain-tickets/import.js` parses XLSX with hardcoded sheet names ("Farms", "Data") and row ranges (r=2 to r=1100, r=68 to r=104). No validation that sheets exist or rows are populated. Empty cells become nulls; no data integrity checks.
- Files: `/Users/glomalinguild/Desktop/my-project-one/grain-tickets/import.js` (lines 18-96)
- Impact: Corrupted XLSX (missing sheets, different structure, moved data) causes silent errors or misaligned data. No feedback to user about what went wrong. Garbage in → garbage out into data.json.
- Fix approach: Add schema validation. Check sheet existence before reading. Validate row counts and required columns. Return structured error report (not just console.log). Add CLI feedback for success/failure counts.

**Farm-Budget FieldOps Sync Incomplete (Two Codebases):**
- Issue: FieldOps integration exists in farm-budget/fieldops/ as JavaScript, and also ported to organic-cert as TypeScript. Two separate implementations, no shared library. Changes to one don't propagate.
- Files: `/Users/glomalinguild/Desktop/my-project-one/farm-budget/fieldops/sync.js`, `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-sync.ts`
- Impact: Bug fixes or feature enhancements only apply to one codebase. If organic-cert discovers a Case IH API quirk, farm-budget never learns it. Code review burden doubled.
- Fix approach: Extract FieldOps client + normalizer to shared npm package (`@ag-suite/fieldops-client`). Both farm-budget and organic-cert depend on it. Single source of truth.

**Farm API Endpoint No Tenant Isolation:**
- Issue: `GET /api/farm` and `PUT /api/farm` fetch/update the first farm in database (line 8: `findFirst()`). No farmId validation. Multi-farm deployments are not supported; any user can modify any farm.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/farm/route.ts` (lines 6-14, 26-38)
- Impact: Multi-tenant systems using this codebase for multiple farms have a security hole. Farm A admin can modify Farm B data by calling PUT /api/farm.
- Fix approach: Get farmId from session. Check user's farmId matches. Return 403 Forbidden if mismatch. Implement per-farm auth throughout API.

**Unapproved SyncedOperations Block Manual Entry (409 Conflict):**
- Issue: Manual FieldOperation/HarvestEvent approval returns 409 Conflict if a synced SyncedOperation already exists for the same date/type. Manual data wins, but conflict is treated as error, not advisory.
- Files: Design decision per STATE.md (line 54: "approve returns 409 if manual FieldOperation/HarvestEvent exists for same date/type")
- Impact: Users see 409 errors when trying to add manual records while sync is pending. Error message may be confusing (409 is "conflict," not "pending approval required"). UX assumes error, not intended behavior.
- Fix approach: Return 200 with structured response: `{ status: "manual_wins", syncedOpId: "...", message: "Manual entry superseded synced record. Review sync staging if needed." }`. Make it advisory, not an error.

---

## Known Bugs

**CNH Linked Account Returns Empty Fields (Not Auto-Detected):**
- Symptoms: Sync completes successfully but shows 0 fields, 0 operations. No operations appear in staged-ops table.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-sync.ts` (lines 73-80), `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-client.ts`
- Trigger: Farm manager uses a CNH FieldOps account where equipment is registered under a dealership, not the owner account.
- Workaround: Contact CNH Industrial support to transfer equipment to owner account, or create a separate owner account.

**SyncedOperation Approval Missing CropLot Creation for Harvests:**
- Symptoms: Synced harvest records approved, appear in FieldOperation/HarvestEvent tables, but no corresponding CropLot. Harvest Log in PDF shows "—" for lot number instead of auto-generated lot.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/admin/staged-ops/[id]/route.ts`
- Trigger: Admin approves a HARVEST operation type from Case IH sync.
- Workaround: Manually create CropLot after approving harvest (not ideal; requires additional admin step).

**PDF Report File Handles Not Cleaned Up:**
- Symptoms: Generated PDF files accumulate in `/tmp` or file storage without cleanup. Disk space grows unbounded over months.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/reports/[id]/download/route.ts`
- Trigger: System generates 100+ reports over time; each creates a file on disk.
- Workaround: Manually clean old report files. Implement cron job to delete files older than 90 days.

---

## Security Considerations

**OAuth2 Token Exposed in Logs:**
- Risk: If tokenCache token is logged or error message includes auth header, token leaks to log aggregation system. Attacker can then call Case IH API on farm's behalf.
- Files: `/Users/glomalinguild/Desktop/my-project-one/farm-budget/fieldops/client.js` (lines 43-46 error handling), `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-client.ts`
- Current mitigation: Token stored in memory only, not in DB or cookies. Error messages don't include token directly.
- Recommendations: Sanitize error messages before logging. Never log `Authorization` headers. Implement structured logging that masks secrets (use winston/pino redaction).

**No API Rate Limiting on Sync Trigger:**
- Risk: Unauthenticated attacker (if endpoint is exposed) can spam POST /api/admin/sync, overwhelming Case IH API and burning rate limit quota.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/admin/sync/route.ts`
- Current mitigation: Route is ADMIN-gated via auth middleware. Session required.
- Recommendations: Add per-farm rate limiter (max 1 sync per 5 min). Return 429 Too Soon if throttled. Log throttling attempts.

**Staged Operations Approval Runs Unvalidated User Input:**
- Risk: Admin approves SyncedOperation; normalizer output is written directly to FieldOperation/HarvestEvent without re-validation. If normalizer has bugs, bad data lands in audit tables.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/admin/staged-ops/[id]/route.ts`
- Current mitigation: Normalizer uses Zod safeParse (defensive parsing). SyncedOperation rawPayload logged for audit trail.
- Recommendations: Add approval-time re-validation. Re-parse SyncedOperation.rawPayload before committing. Prevent approval if validation fails.

**Field Mapping Admin UI No Confirmation Prompt:**
- Risk: Admin clicks "Confirm Mapping" once, locks Case IH field to wrong organic-cert field. Silent misconfiguration affects all future syncs for that field.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/(app)/admin/fieldops/matching/page.tsx`
- Current mitigation: Mapping is stored in CaseIHFieldMapping; can be updated later but no prominent "edit mapping" flow.
- Recommendations: Add confirmation dialog before finalizing mapping. Show field names and acres to verify. Implement "Change Mapping" button for correcting mistakes.

---

## Performance Bottlenecks

**Full 3-Year Sync Fetches All Operations (No Pagination):**
- Problem: `runFieldOpsSync()` fetches yield + applications for years [currentYear, currentYear-1, currentYear-2]. No pagination or date-range limiting. If farm has 5000+ records, API call is slow and network-heavy.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-sync.ts` (lines 52-59, 150-180)
- Cause: Case IH API pagination not implemented. Full response fetched in single call.
- Improvement path: Check Case IH API docs for pagination support (likely offset/limit or cursor). Implement paginated fetch loop. Cache sync state to avoid re-fetching same data.

**PDF Report Assembly Queries All Records Per Farm:**
- Problem: `assembleReportData()` loads all FieldOperation, FertilityEvent, HarvestEvent records for a farm/cropYear. Scales O(n) with record count. For large farms with 1000+ records, query + JSON assembly is slow.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/report-assembler.ts`
- Cause: No query optimization. No aggregation at database level.
- Improvement path: Add database indexes on (farmId, cropYear). Pre-aggregate counts in queries. Consider materialized view for report data.

**All Accounts Share Single FieldOps Token Cache:**
- Problem: If multiple farm instances are running (multi-deployment), each server re-authenticates to Case IH separately, wasting API quota and causing thundering herd on token endpoint.
- Files: `/Users/glomalinguild/Desktop/my-project-one/farm-budget/fieldops/client.js` (line 5)
- Cause: In-memory tokenCache not shared across processes.
- Improvement path: Move token cache to Redis with 5-min expiry. All servers hit Redis (fast) instead of Case IH token endpoint (slow).

---

## Fragile Areas

**Grain-Tickets Data Import (Hardcoded Excel Structure):**
- Files: `/Users/glomalinguild/Desktop/my-project-one/grain-tickets/import.js`
- Why fragile: Tightly coupled to exact Excel layout (sheet names, row ranges). Any structural change to the spreadsheet breaks import silently.
- Safe modification: Before changing Excel structure, update import.js to match. Add schema validation. Test against multiple file versions. Consider CSV export + standardized import instead of Excel-specific parsing.
- Test coverage: No unit tests. Manual testing only. Unknown coverage of error paths.

**SyncedOperation Staging + Approval Flow:**
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/admin/staged-ops/route.ts`, `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/admin/staged-ops/[id]/route.ts`
- Why fragile: Two-phase approval (stage + approve) introduces timing window where record can be edited between fetch and commit. If admin loads staging list, then field mapping changes before they approve, they approve stale data.
- Safe modification: Add optimistic locking. Store mapping state hash with SyncedOperation. On approval, verify hash matches current mapping. If mismatch, reject and explain.
- Test coverage: No tests for concurrency scenarios (parallel syncs, approvals while sync running).

**FieldEnterprise Unique Constraint Blocks Double-Cropping:**
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/prisma/schema.prisma` (line 304: `@@unique([fieldId, cropYear, crop])`)
- Why fragile: Prevents multiple plantings of same crop in same field in same year (double-cropping). Constraint is database-level; no error message tells user why insert failed.
- Safe modification: Replace unique constraint with business-logic validation. Allow multiple FieldEnterprise rows per (fieldId, cropYear) if `sequenceInYear` order is distinct. Plan for v1.1 split-field enterprises.
- Test coverage: No tests for double-cropping scenarios.

**Prisma Schema Enums Are Database ENUMs (Not Extensible):**
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/prisma/schema.prisma` (enums like CropCategory, ActionType, etc.)
- Why fragile: New enum values require migration. If you add a crop category (e.g., "HEMP"), must run `prisma migrate dev`, rebuild schema, redeploy app. Can't dynamically add values at runtime.
- Safe modification: For extensible enums (crops, categories), store in a reference table instead of enum. Schema enums OK for fixed USDA NOP categories (e.g., PestCategory, FertilityType).
- Test coverage: Unknown if migrations are tested.

---

## Scaling Limits

**Synced Operation Dedup via `@@unique([farmId, fieldopsExternalId])`:**
- Current capacity: Single farmId, 10k+ synced operations, dedup works fine (unique constraint O(log n) on B-tree).
- Limit: If you run 50+ sync jobs in parallel for same farm, database will experience lock contention on unique index. Dedup writes serialize.
- Scaling path: Batch inserts. Implement in-app dedup (check existing records before insert) instead of relying on unique constraint error. Use upsert strategically.

**GeneratedReport File Storage on Local Disk:**
- Current capacity: 1000 PDF reports (20 MB each) = 20 GB disk.
- Limit: Disk fills if cleanup not implemented. No archival or S3 offload.
- Scaling path: Move file storage to S3 (AWS) or Google Cloud Storage. Implement lifecycle policy to delete old reports after 90 days. Change download route to signed S3 URL.

**Audit Log JSON Serialization (No Compression):**
- Current capacity: 100k audit events, each with full oldData/newData snapshots, stored as uncompressed JSON.
- Limit: AuditLog table grows unbounded. Queries slow. No retention policy.
- Scaling path: Implement audit log archival. After 1 year, compress old logs to separate archive table or blob storage. Add index on (timestamp) for range queries.

**Prisma Client (No Connection Pooling Configuration):**
- Current capacity: Default single connection pool (5-10 connections). Fine for <50 concurrent requests.
- Limit: High-traffic deployments (100+ simultaneous users) will exhaust pool. Queries queue and timeout.
- Scaling path: Configure PgBouncer or Supabase connection pooling. Set `@prisma/client` pool size to match deployment tier.

---

## Dependencies at Risk

**Case IH FieldOps API (No Public Spec, Undocumented):**
- Risk: Schema is behind login-gated portal. Breaking changes have happened (equipment lists, field boundary format). No SLA or deprecation notice.
- Impact: Normalizer built on assumptions, not spec. Next API update may break syncing silently.
- Migration plan: Contact CNH Industrial technical support for formal schema docs. Implement schema versioning in normalizer (detect API version from response, apply conditional parsing). Add automated tests against live API (in CI, gated).

**XLSX (xlsx npm package) Single-Threaded Parsing:**
- Risk: Large Excel files (>50 MB) block the main thread. grain-tickets import.js will freeze UI if file is huge.
- Impact: Timeouts. Users think import hung.
- Migration plan: Use streaming XLSX parser (e.g., `streaming-xlsx`) or move to CSV. Implement background job for import (not synchronous route).

**React PDF (@react-pdf/renderer) Custom Styling Not Official Feature:**
- Risk: Using `col()` and `headerCol()` helper objects as custom styling (not standard React PDF). API may change or conflict with future updates.
- Impact: PDF layout breaks on major version upgrade.
- Migration plan: Pin @react-pdf/renderer version. Test major updates in staging. Document custom styling patterns in CONVENTIONS.md.

---

## Missing Critical Features

**No Undo/Rollback for Approved Operations:**
- Problem: Admin approves SyncedOperation, it becomes FieldOperation. No way to "unapprove" or revert. Must manually delete FieldOperation record via database.
- Blocks: Correcting mistakes in field mapping (e.g., mapped field A to field B by error; operations are now locked in).
- Priority: Medium (workaround exists: manual DB deletion by admin).

**No Bulk Approval for Staged Operations:**
- Problem: Admin must approve each synced operation individually. For 100 synced operations, must click approve 100 times.
- Blocks: Efficient sync workflow for large farms.
- Priority: Medium (workaround: batch SQL update, but not exposed in UI).

**No Email Notifications for Sync Status:**
- Problem: Sync completes, admin must manually check staged-ops page. No alert if sync fails or finds conflicts.
- Blocks: Async sync workflow notification.
- Priority: Low (workaround: admin periodically checks UI).

**No Fallow/Idle Enterprise Type (v1.1 blocker):**
- Problem: FieldEnterprise requires a `crop` name. Can't represent fallow/idle land that carries overhead costs but no harvest.
- Blocks: v1.1 split-field enterprises feature (multiple enterprises per field per season).
- Priority: High (blocking v1.1 roadmap).

---

## Test Coverage Gaps

**No Tests for Zod Normalizer Against Live Case IH API Schema:**
- What's not tested: Whether normalizer actually handles the live API response format. Currently tested only against farm-budget mock data.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-normalizer.ts`
- Risk: Silent parse failures when real API responds with unexpected fields or structure.
- Priority: High (direct security/data-loss impact).

**No Tests for Concurrent Sync + Approval Scenarios:**
- What's not tested: What happens if two syncs run in parallel, or if user approves staged-op while sync is running.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/fieldops-sync.ts`, staged-ops API routes
- Risk: Race conditions, duplicate records, data loss.
- Priority: High (if multi-farm deployments are used).

**No Tests for Grain-Tickets Import Error Paths:**
- What's not tested: Import with missing sheets, malformed dates, empty rows, file not found.
- Files: `/Users/glomalinguild/Desktop/my-project-one/grain-tickets/import.js`
- Risk: Garbage-in data is silently committed to data.json.
- Priority: Medium (manual-import tool, not production API).

**No Tests for PDF Report Edge Cases:**
- What's not tested: Empty field list, no harvest records, mass balance with zero input, very long field names.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/report-assembler.ts`, PDF component files
- Risk: PDF generation crashes or produces malformed output for edge cases.
- Priority: Medium (affects delivery to inspector).

**No Tests for Auth/RBAC Middleware:**
- What's not tested: Token expiry, session hijacking, role escalation, cross-farm access.
- Files: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/lib/auth.ts`, NextAuth middleware
- Risk: Security vulnerabilities in auth layer.
- Priority: Critical (foundational to all security).

---

*Concerns audit: 2026-02-25*
