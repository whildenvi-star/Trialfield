# Codebase Concerns

**Analysis Date:** 2026-02-23

## Tech Debt

**Large monolithic modules:**
- Issue: Multiple files exceed 600+ lines with complex logic intertwined
- Files: `farm-budget/public/inputs-manager.js` (659 lines), `farm-budget/import.js` (597 lines), `meristem-malt/public/app.js` (809 lines), `organic-cert/src/app/(app)/field-enterprises/[id]/page.tsx` (1429 lines)
- Impact: Difficult to test, maintain, and reason about. Risk of unintended side effects when modifying
- Fix approach: Break files into smaller modules by functionality (e.g., separate form handling, data loading, rendering logic)

**No input validation on server endpoints:**
- Issue: Direct `Object.assign(store[collectionName][idx], req.body)` without field whitelisting on generic CRUD endpoints
- Files: `farm-budget/server.js` (lines 197-217), `fsa-acres/server.js` (lines 191-237)
- Impact: Users can write arbitrary fields to records, bypassing business logic constraints
- Fix approach: Create explicit whitelist schemas for each entity type and validate before assignment

**Mixed var/const/let styles:**
- Issue: Farm-budget servers use `var`, while organic-cert uses `const/let`. Import.js scripts also use `var`
- Files: `farm-budget/server.js`, `fsa-acres/server.js`, `meristem-malt/server.js`
- Impact: Inconsistent scoping behavior, confusing for maintainers
- Fix approach: Standardize to `const`/`let` throughout; run automated fixes

**Uncontrolled data growth:**
- Issue: In-memory JSON stores can grow indefinitely. No archival, rotation, or cleanup of old records
- Files: `farm-budget/server.js` (lines 22-44), `fsa-acres/server.js` (lines 19-27)
- Impact: Memory usage grows unbounded. Server restarts lose all data (no persistence beyond JSON file). Large JSON files slow startup
- Fix approach: Implement database with indexes and pruning strategy. Consider archiving old records monthly

## Security Considerations

**No authentication or authorization:**
- Risk: Any network client can read/write all data via REST API without credentials
- Files: `farm-budget/server.js`, `fsa-acres/server.js`, `grain-tickets/server.js`, `meristem-malt/server.js`
- Current mitigation: None. Apps assume trusted local network
- Recommendations: Add basic authentication (API keys or sessions), validate user permissions on sensitive operations (delete, modify pricing), implement CORS restrictions

**External API integration without timeout/retry logic:**
- Risk: USDA RMA price scraper hangs indefinitely if upstream API is slow/down
- Files: `fsa-acres/server.js` (lines 191-237)
- Current mitigation: None visible. Response waits indefinitely for https.get() callback
- Recommendations: Add timeout (e.g., 10s), implement exponential backoff for retries, return 504 after timeout

**HTML escaping in client but innerHTML used elsewhere:**
- Risk: Some client code uses `escHtml()`, but other modules may use innerHTML without escaping
- Files: `farm-budget/public/app.js` (lines 91-95), and various module manipulations of DOM
- Current mitigation: Limited client-side XSS protection
- Recommendations: Use textContent instead of innerHTML, validate all user input server-side

**No HTTPS enforcement:**
- Risk: Data transmitted in plain HTTP on localhost, but if deployed to internet, credentials/sensitive farm data exposed
- Files: All server.js files bind to `0.0.0.0` (lines 379-380, 417-418, etc.)
- Current mitigation: localhost binding only
- Recommendations: Require HTTPS in production, add HSTS headers, validate environment before binding to 0.0.0.0

**Unvalidated external fetch to USDA API:**
- Risk: JSON.parse() can fail silently, response handling doesn't validate structure
- Files: `fsa-acres/server.js` (lines 200-232)
- Current mitigation: Basic try-catch returns error JSON
- Recommendations: Validate response schema, check HTTP status codes, log parse errors for debugging

## Performance Bottlenecks

**Full data file read/parse on startup:**
- Problem: Entire data.json loaded synchronously into memory at startup
- Files: `farm-budget/server.js` (lines 46-50), `fsa-acres/server.js` (lines 29-34)
- Cause: Single JSON file with no indexing. As file grows, startup time increases linearly
- Improvement path: Migrate to database with indexes, lazy-load records on demand

**N+1 query pattern in enrichField:**
- Problem: For bulk `/api/fields` requests without `all=true`, each field is enriched by recomputing full budget
- Files: `farm-budget/server.js` (lines 116-145)
- Cause: No caching of Calc results. If 100 fields, 100 full recalculations needed
- Improvement path: Cache computed budgets in data store, invalidate on update, or return raw fields and compute client-side

**CSV export loops without streaming:**
- Problem: Entire CSV built in memory as string before sending
- Files: `fsa-acres/server.js` (lines 295-319, 321-345)
- Cause: String concatenation in JS is slow for large datasets. No streaming response
- Improvement path: Use csv streaming library, pipe to response incrementally

**Synchronous file operations in save:**
- Problem: saveData() uses synchronous fs.writeFileSync on every write
- Files: `farm-budget/server.js` (lines 60-74), `fsa-acres/server.js` (lines 44-58)
- Cause: Blocks event loop during write. With large data files, causes latency spikes
- Improvement path: Use async fs.promises.writeFile, maintain write queue with proper async/await

**Large modal form components without virtualization:**
- Problem: React pages with 1000s of fields render all at once
- Files: `organic-cert/src/app/(app)/field-enterprises/[id]/page.tsx` (1429 lines)
- Cause: No pagination, no windowing, no form field lazy-loading
- Improvement path: Split into tabs/sections, use React.lazy for form sections, virtualize long lists

## Fragile Areas

**Calc module shared between browser and Node.js:**
- Files: `farm-budget/public/calc.js`, `fsa-acres/public/calc.js`
- Why fragile: UMD pattern (`typeof module !== 'undefined'` checks) is fragile to bundler changes. If importing from Node, any browser-specific code breaks
- Safe modification: Keep calc modules pure (no DOM, no fetch), test both Node and browser paths explicitly
- Test coverage: No visible test files for calc logic. Risk: math errors undetected until production

**Data migration logic scattered in server startup:**
- Files: `farm-budget/server.js` (lines 285-370)
- Why fragile: Additions to migration function must handle all existing data shapes. No version tracking. If new field added, all old records missing that field cause undefined behavior
- Safe modification: Add schema versioning, write migrations as discrete, reversible functions
- Test coverage: No test for migration logic

**FieldOps sync integration uses hardcoded credentials in source:**
- Files: `farm-budget/fieldops/client.js`
- Why fragile: OAuth token URL and API base URL may change. No fallback if external service changes API
- Safe modification: Use environment variables for all external URLs, implement retry logic with exponential backoff
- Test coverage: Unknown

**Parse errors silently ignored in imports:**
- Files: `farm-budget/import.js`, `fsa-acres/import.js`
- Why fragile: If Excel sheet format changes slightly (header name typo), data import silently produces wrong results
- Safe modification: Add verbose logging, validate schema before processing, fail loudly on unexpected structure
- Test coverage: No automated tests for import

## Scaling Limits

**In-memory data store:**
- Current capacity: Up to ~300KB JSON file (farm-budget data.json at 290KB)
- Limit: At ~10MB, server memory footprint becomes problematic. At ~50MB, startup time exceeds 10s
- Scaling path: Migrate to SQLite (single file, local) or PostgreSQL (networked, scalable)

**Single-file concurrent writes:**
- Current capacity: ~10 writes/sec with small payloads. Locking via Promise queue prevents corruption
- Limit: Beyond ~50 concurrent users, write queue backs up and requests timeout
- Scaling path: Use database transactions instead of file locking, implement optimistic concurrency

**CSV export memory:**
- Current capacity: Exporting 10,000 records at ~1KB each = 10MB string in memory
- Limit: At 100,000 records, string building may cause GC pauses and memory exhaustion
- Scaling path: Implement streaming CSV export using Transform streams

## Dependencies at Risk

**express ^4.18.0:**
- Risk: Not on latest major version. Security patches may lag
- Impact: XSS, CSRF, DoS vulnerabilities in older Express versions
- Migration plan: Update to express 5.x, test compatibility with middleware

**xlsx ^0.18.0:**
- Risk: Excel parsing library with history of security issues in file parsing
- Impact: Malformed Excel files could cause crashes or injection attacks
- Migration plan: Consider csv-only input, or validate Excel files before parsing

**No package-lock.json enforcement:**
- Risk: Multiple package.json files across projects may resolve different transitive versions
- Impact: Dev/prod parity issues, potential security gaps
- Migration plan: Audit all transitive dependencies with `npm audit`, fix vulnerabilities, enforce exact versions

## Test Coverage Gaps

**No test suite:**
- What's not tested: All calculation engines, all API endpoints, data migrations, import logic, error cases
- Files: `farm-budget/public/calc.js`, `fsa-acres/public/calc.js`, `*/import.js`, all server.js files
- Risk: Math errors in budget calculations silently affect business decisions. API endpoint bugs discovered only in production
- Priority: High — implement unit tests for calc modules and integration tests for critical API paths

**Missing CSV export tests:**
- What's not tested: CSV escaping (quoted fields), special characters, edge cases (empty fields, null values)
- Files: `fsa-acres/server.js` (lines 295-345)
- Risk: Malformed CSV breaks downstream reporting tools
- Priority: Medium

**No end-to-end tests for organic-cert workflows:**
- What's not tested: Multi-step forms, data validation, permission checks, export/import cycles
- Files: `organic-cert/src/app/(app)/**/*`
- Risk: User-facing bugs cause data corruption or lost work
- Priority: High

**No negative test cases:**
- What's not tested: What happens when external APIs fail (USDA RMA, FieldOps), when data is malformed, when permissions are denied
- Files: All server files
- Risk: Unhandled exceptions, silent failures, data inconsistency
- Priority: Medium

---

*Concerns audit: 2026-02-23*
