# Architecture

**Analysis Date:** 2026-02-23

## Pattern Overview

**Overall:** Monorepo with multiple independent applications using either Express.js server + vanilla JS frontend or Next.js full-stack pattern.

**Key Characteristics:**
- Separate applications per domain (farm budgeting, FSA tracking, grain tickets, malt costing, organic certification)
- Each application manages its own data store (JSON file or PostgreSQL)
- Backend serves both API and static frontend assets
- Real-time data enrichment via computation engines
- Audit logging for compliance-critical applications

## Layers

**Backend Server (Express/Next.js):**
- Purpose: HTTP API endpoint, data persistence, business logic computation
- Location: `[app]/server.js` (Express apps) or `[app]/src/app/api/` (Next.js)
- Contains: Route handlers, CRUD operations, calculations, file I/O
- Depends on: Node.js, Express/Next.js, Prisma (organic-cert), dotenv
- Used by: Frontend clients via HTTP

**Frontend (Vanilla JS or React):**
- Purpose: User interface, form handling, data visualization, tab-based navigation
- Location: `[app]/public/` (Express) or `[app]/src/app/(app)/` (Next.js)
- Contains: HTML/CSS, component modules, API client helpers, calculation displays
- Depends on: Browser APIs, Fetch API, Leaflet.js (farm-budget for mapping)
- Used by: End users via browser

**Data Layer (File or Database):**
- Purpose: Persistent data storage and historical backups
- Location: `[app]/data/data.json` (Express apps) or PostgreSQL via Prisma (organic-cert)
- Contains: Entity records, settings, audit logs
- Depends on: Filesystem (Express) or PostgreSQL client (Prisma)
- Used by: All business logic layers

**Computation Engine:**
- Purpose: Calculate derived values (budgets, yields, costs, lot numbers, mass balance)
- Location: `[app]/public/calc.js` (Express) or `[app]/src/lib/` (Next.js)
- Contains: Pure functions for financial/agronomic calculations
- Depends on: Domain reference data (products, implements, pricing)
- Used by: Server enrichment and frontend display

**Integration Layer:**
- Purpose: Sync data between applications (fieldops ↔ farm-budget)
- Location: `[app]/fieldops/sync.js`, `[app]/fieldops/client.js`
- Contains: Field matching logic, equipment mapping, boundary updates
- Depends on: Both applications' data stores
- Used by: farm-budget server

## Data Flow

**farm-budget: Field Budget Calculation:**

1. User creates/edits field with crop, acres, inputs, machinery
2. Frontend calls `PUT /api/fields/:id`
3. Server validates and saves to store (data.json)
4. Server calls `Calc.computeFieldBudget()` with refs (products, implements, pricing, settings)
5. Computation returns cost/revenue breakdown
6. Frontend receives enriched field with `_computed` object
7. Frontend displays budget table with machinery rates, input costs, revenue estimates

**grain-tickets: Ticket Processing with AI:**

1. User uploads grain ticket file via `/api/tickets/upload`
2. Server reads spreadsheet or PDF (multer + xlsx)
3. Server calls Anthropic API to extract/validate fields
4. Server creates ticket record with extracted data
5. Client calls `Calc.computeTicket()` to enrich with crop config
6. Enriched ticket includes weight calculations, grades, pricing
7. Ticket list page displays computed values

**organic-cert: Multi-Farm Organic Data:**

1. User logs in via NextAuth (email/password with bcryptjs)
2. Prisma middleware loads user's farm context
3. User navigates to field-enterprises/[id] page
4. Page fetches field data via `/api/field-enterprises/[id]/operations`
5. Server performs RBAC check (user.role must match operation)
6. Server returns all operations linked to fieldEnterprise
7. User can create/edit operations, with audit log recorded
8. Lot numbers auto-generated via `lot-generator.ts`
9. Mass balance calculations validate fertility inputs per C5.0 rules

**Data Sync (fieldops → farm-budget):**

1. farm-budget server runs sync on startup or schedule
2. `fieldops/sync.js` queries both farm-budget store and fieldops API
3. Normalizes field names: matches "Kopp" in both systems
4. Creates/updates farm-budget fields for matched fieldops entries
5. Updates GeoJSON farm boundary with fieldops geometry
6. Syncs equipment (implements) and adds pass planning data
7. Saves enriched store back to data.json

## Key Abstractions

**Store (JSON):**
- Purpose: In-memory object persisted to file with backup rotation
- Examples: `farm-budget/data/data.json`, `grain-tickets/data/data.json`
- Pattern: Load on startup, in-memory mutations, write lock queue to prevent corruption
- Schema: Flat object with collections (fields, products, implements, etc.)

**Calculation Engine:**
- Purpose: Isolate business logic from HTTP layer
- Examples: `farm-budget/public/calc.js`, `grain-tickets/public/calc.js`
- Pattern: Pure functions accepting data + refs, returning computed object
- Exported functions: `computeFieldBudget()`, `computeDashboard()`, `computeTicket()`

**CRUD Factory:**
- Purpose: DRY route registration for simple resource endpoints
- Example: `farm-budget/server.js` lines 191-218
- Pattern: `crudRoutes(path, collectionName, prefix)` creates GET, POST, PUT, DELETE
- Used for: products, implements, seeds, rent, buyers, suppliers

**Prisma Client:**
- Purpose: Type-safe database access with migrations
- Example: `organic-cert/src/lib/prisma.ts`
- Pattern: Singleton client instance, used across API routes
- Relationships: Models linked via foreign keys (Farm → User, Field → Equipment)

**Audit Logger:**
- Purpose: Compliance tracking for organic cert changes
- Location: `organic-cert/src/lib/audit-logger.ts`
- Pattern: Middleware logs CREATE/UPDATE/DELETE with user, old/new data, timestamp
- Stored in: AuditLog model per Prisma schema

**Lot Number Generator:**
- Purpose: Auto-generate organic lot identifiers per NOP standard
- Location: `organic-cert/src/lib/lot-generator.ts`
- Pattern: Format `[cropYear]-[crop]-[fieldName]`
- Used by: CropLot and SeedUsage models

## Entry Points

**farm-budget:**
- Location: `farm-budget/public/index.html`
- Triggers: Browser open on port 3001
- Responsibilities: Tab nav shell, API client setup, dashboard + field/input managers

**fsa-acres:**
- Location: `fsa-acres/public/index.html`
- Triggers: Browser open on port 3003
- Responsibilities: FSA acre tracking, crop insurance, tillage codes, CLU records

**grain-tickets:**
- Location: `grain-tickets/public/index.html`
- Triggers: Browser open on port 3000
- Responsibilities: Ticket file upload, OCR/parsing via Anthropic, ticket search

**meristem-malt:**
- Location: `meristem-malt/public/index.html`
- Triggers: Browser open on port [PORT env]
- Responsibilities: Malt cost calculation, break-even pricing

**organic-cert:**
- Location: `organic-cert/src/app/layout.tsx`
- Triggers: `npm run dev` (Next.js dev server on port 3004) or `npm run start` (production)
- Responsibilities: Organic audit trail, field history, operations log, certifications, NextAuth login

## Error Handling

**Strategy:** HTTP status codes + JSON error responses on backend; toast messages on frontend

**Patterns:**
- 404 Not Found: Resource doesn't exist or user lacks RBAC permission
- 400 Bad Request: Validation failed (missing fields, invalid data type)
- Express apps: `res.status(404).json({ error: 'Not found' })`
- Next.js apps: NextAuth redirects unauthorized users to login; RBAC middleware checks role
- Frontend: Try/catch on api.get/post/put/del(), util.showToast(error.message, duration, 'error')

## Cross-Cutting Concerns

**Logging:**
- Express apps: console.log for startup diagnostics
- Next.js: Prisma query logging in dev mode
- Audit trail: AuditLog model in organic-cert tracks all entity changes

**Validation:**
- Express apps: Basic req.body key check in CRUD routes
- Next.js: Prisma schema constraints (unique, required fields) + API route middleware
- Frontend: HTML5 form validation, manual range checks before POST

**Authentication:**
- Express apps: None (assumed single-user internal tools)
- organic-cert: NextAuth with bcryptjs password hashing, role-based access control (RBAC)
- Session: NextAuth session cookie, user context loaded from Prisma

**Computation:**
- Lazy: farm-budget enriches field on GET request (avoids stale cached data)
- Pre-computed: organic-cert stores mass balance results in database
- Real-time: grain-tickets AI extraction on file upload (blocking await)

---

*Architecture analysis: 2026-02-23*
