# Architecture

**Analysis Date:** 2025-02-25

## Pattern Overview

**Overall:** Next.js 16 full-stack application with server-side rendering (App Router), server-side business logic, client-side UI with React 19, and Prisma ORM for data persistence.

**Key Characteristics:**
- Layered architecture: UI layer (React components) → API routes → Business logic (lib/) → Database layer (Prisma)
- Role-based access control (RBAC) enforced at both API and UI layers
- External service integration (Case IH FieldOps API) with staging/approval workflow
- PDF report generation as primary output using @react-pdf/renderer
- Data-driven workflow: raw data from Case IH → staging tables → approval → production tables

## Layers

**Presentation Layer (UI):**
- Purpose: Render responsive, form-driven interfaces for farm operations data management
- Location: `src/app/(app)/**/page.tsx` (client components), `src/components/`
- Contains: Page components with React hooks, form dialogs, tables, cards using shadcn/ui
- Depends on: API routes (/api/*), authentication (auth), client-side state management (useState/useEffect)
- Used by: Web browsers; authenticated users after login

**API Layer (Route Handlers):**
- Purpose: Handle HTTP requests/responses, apply RBAC, marshal requests to business logic, serialize responses
- Location: `src/app/api/*/route.ts`
- Contains:
  - CRUD endpoints for domain entities (fields, enterprises, materials, equipment, storage, seeds, buyers)
  - Sync orchestration endpoints (`/api/admin/sync`, `/api/admin/staged-ops`)
  - Field-enterprise sub-resource routes (`/api/field-enterprises/[id]/fertility`, `/operations`, `/harvest`, `/applications`, `/seed-usage`)
  - Authentication route (`/api/auth/[...nextauth]`)
  - Audit logging endpoint (`/api/audit-log`)
- Depends on: Prisma models, business logic (lib/), authentication, RBAC
- Used by: Client-side fetch calls from React components

**Business Logic Layer (lib/):**
- Purpose: Orchestrate multi-step operations, manage external integrations, compute derived data
- Location: `src/lib/*.ts`
- Contains:
  - **fieldops-sync.ts**: Orchestrates Case IH API sync pipeline (validate connection → fetch → normalize → stage)
  - **fieldops-client.ts**: Case IH OAuth2 client with token caching and mock fallback
  - **fieldops-normalizer.ts**: Validates and transforms raw Case IH responses into staging schema
  - **report-assembler.ts**: Single Prisma query assembling all data needed for inspection reports
  - **auth.ts**: NextAuth configuration with JWT strategy and credentials provider
  - **rbac.ts**: Permission matrix and role-based access checks
  - **audit-logger.ts**: Records CREATE/UPDATE/DELETE actions for compliance
  - **lot-generator.ts**: Auto-generates lot numbers (YEAR-CROP-FIELDABBREV)
  - **day-rule-calc.ts**: Computes harvest-to-application day gaps for NOP compliance
  - **mass-balance.ts**: Reconciles harvested vs. sold quantities by crop lot
  - **fieldops-mock.ts**: Test data when API credentials absent
- Depends on: Prisma, external APIs (Case IH)
- Used by: API routes, PDF generation layer

**PDF/Report Generation Layer:**
- Purpose: Render inspection reports as print-ready PDFs with 8 NOP sections
- Location: `src/lib/pdf/*.tsx`
- Contains:
  - **inspection-report.tsx**: Top-level Document component wrapping 8 sections
  - `sections/cover-page.tsx`, `toc-page.tsx`, `operation-overview.tsx`, `field-list.tsx`, `field-history.tsx`, `application-log.tsx`, `harvest-log.tsx`, `mass-balance.tsx`
  - Utility components in `pdf/components/`
  - Styling utilities in `pdf/styles.ts` (@react-pdf/renderer API)
- Depends on: report-assembler data, @react-pdf/renderer, @ag-media/react-pdf-table
- Used by: API route `/api/reports/generate` (renderToBuffer) → file download

**Data Layer (Prisma):**
- Purpose: Provide type-safe ORM interface to PostgreSQL
- Location: `prisma/schema.prisma` (schema definition), `src/lib/prisma.ts` (client singleton)
- Contains: 25+ models organized in sections: foundation (Farm/User), land & fields, seeds & inputs, field operations, harvest→storage→sale, supporting records, Case IH integration, inspection reports
- Depends on: PostgreSQL database
- Used by: All API routes and business logic

## Data Flow

**Manual Data Entry:**
1. User (ADMIN/OFFICE) navigates to page (e.g., `field-enterprises/`)
2. Client-side React form captures input, submits POST to `/api/field-enterprises`
3. API route validates input, checks RBAC permission (enterprise:write), calls Prisma create
4. Response includes auto-generated lotNumber and linked field metadata
5. Audit log written by logAudit() helper
6. UI updates with new record, shows success toast

**Case IH FieldOps Sync:**
1. User clicks "Sync with Case IH" in admin panel
2. POST `/api/admin/sync` → runFieldOpsSync(farmId)
3. Sync orchestrator flow:
   - Validate OAuth credentials, detect linked account warning
   - Load existing CaseIHFieldMapping, OperationTypeMapping
   - Fetch 3-year lookback from Case IH (applications, yield)
   - Normalize via fieldops-normalizer (Zod validation)
   - Write to SyncedOperation table (staging) with dedup on (farmId, fieldopsExternalId)
   - Update FieldOpsSyncState with sync metadata
4. Sync result returned to admin UI (status, operation count, warnings)
5. Staged operations appear in admin review panel
6. User approves/rejects staged rows via `/api/admin/staged-ops/[id]`
7. Approved rows committed to FieldOperation/HarvestEvent tables

**Report Generation:**
1. User selects crop year, optionally filters fields in `/reports` page
2. Clicks "Generate Report"
3. POST `/api/reports/generate` with cropYear, fieldIds
4. API calls reportAssembler(cropYear, fieldIds) → single complex Prisma query
5. Assembler returns typed ReportData object
6. InspectionReport React component renders as Document tree
7. renderToBuffer() in API route converts to PDF bytes
8. HTTP response streams PDF with Content-Disposition: attachment
9. GeneratedReport row inserted with filename, fieldCount, cropYear metadata

**State Management:**
- Authentication: JWT token in httpOnly cookie (NextAuth), verified server-side per request via auth() helper
- Farm context: User role/farmId embedded in JWT token, checked at API layer
- RBAC: Permission matrix evaluated in API routes before data access
- UI state: React hooks (useState) for form dialogs, filters, loading states — no global state library
- Audit trail: AuditLog table records userId, action (CREATE/UPDATE/DELETE), entityType, entityId, oldData snapshot, newData snapshot, timestamp

## Key Abstractions

**FieldEnterprise:**
- Purpose: Represents one crop-per-field-per-season; splits field into multiple enterprises when one field has multiple crops
- Examples: `2024 Corn on Simpson Field`, `2024 Soybeans on Simpson Field` (same field, different crops)
- Pattern: One Field has many FieldEnterprises; all FieldEnterprise records for a Field sum acres = Field.totalAcres
- Unique constraint: `(fieldId, cropYear, crop)` ensures no duplicate crop-per-season per field
- Aggregates: SeedUsage, MaterialUsage, FieldOperation, FertilityEvent, ScoutingLog, ManagementAction, HarvestEvent, CropLot

**CropLot:**
- Purpose: Tracks harvested commodity from field through storage/sales with chain-of-custody
- Examples: `2024-SRWW-KOPP` (2024 soft red winter wheat from Kopps field)
- Pattern: Created from HarvestEvent; linked to FieldEnterprise via harvestEventId
- Aggregates: StorageTransfer (in/out of storage), LoadoutEvent (truck sales), SaleDelivery (final sale record)
- Mass balance: Reconcile harvestedLbs → soldLbs across all lots by crop

**SyncedOperation (staging table):**
- Purpose: Holds raw Case IH API responses pending human review before commitment
- Pattern: Write-heavy during sync; read during admin review; deleted after approval/rejection
- Dedup key: `(farmId, fieldopsExternalId)` prevents duplicate rows across re-syncs
- Status lifecycle: PENDING → (APPROVED | REJECTED) → deleted or archived
- Contains raw JSON payload for traceability; mappings to field/opType maintained separately

**StorageLocation:**
- Purpose: Bin/warehouse metadata for organic/conventional separation verification
- Examples: "North Bin", "Josh Tracey off-site", "Warehouse A"
- Attributes: capacity (bu), wall type (smooth/cone-bottom), equipment type (belted conveyor)
- Cleanout requirement: CleanoutEvent records document equipment/location purge between crops per NOP C11.0

## Entry Points

**Web Application:**
- Location: `src/app/layout.tsx` (root), `src/app/(app)/layout.tsx` (authenticated wrapper)
- Triggers: HTTP requests to port 3004 (configured in package.json dev script)
- Responsibilities: Bootstrap Next.js app, apply global Providers (NextAuth, Themes), render Sidebar + Header + page content for authenticated routes

**API Routes:**
- Entry: All HTTP requests to `/api/*` paths handled by respective `src/app/api/*/route.ts` files
- Triggers: Fetch calls from client components, external webhooks (if added), CLI/scheduled tasks
- Responsibilities: Parse request, validate session/RBAC, call Prisma/business logic, return JSON

**Sync Job Entry:**
- Location: `/api/admin/sync` POST handler
- Triggers: Manual click in admin UI or future scheduled background job
- Responsibilities: Call runFieldOpsSync, coordinate connection validation, normalization, staging, update sync state

**Report Generation Entry:**
- Location: `/api/reports/generate` POST handler
- Triggers: User submits report generation form
- Responsibilities: Assemble report data, render PDF, store GeneratedReport metadata, return PDF download

## Error Handling

**Strategy:** Try-catch blocks at API route level; pass errors to client as JSON with appropriate HTTP status codes; client-side toast notifications (sonner) display user-friendly messages; critical errors logged but not exposed (e.g., "Failed to fetch field enterprises").

**Patterns:**
- API routes: `try { ... } catch (error) { return NextResponse.json({ error: message }, { status: 500 }) }`
- Client validation: Check required fields before POST; form validation via Zod schemas (implicit in API input validation)
- External API failures: Case IH connection errors caught in fieldops-sync, return error status, prevent partial writes to staging table
- Database constraints: Unique constraint violations (duplicate field names, crop-per-season) handled as 400 Bad Request

## Cross-Cutting Concerns

**Logging:** AuditLog table records all entity mutations (CREATE, UPDATE, DELETE) with userId, timestamp, oldData/newData snapshots. Implemented via logAudit() helper called in POST/PATCH/DELETE routes.

**Validation:** Prisma schema enforces types, unique constraints, required fields; API routes check required fields before create/update; normalizer uses Zod for Case IH API response validation.

**Authentication:** NextAuth handles login via credentials provider (email + bcrypt), JWT strategy for session, httpOnly cookies for security. Redirects unauthenticated requests to `/login`.

**Authorization (RBAC):** Permission matrix in `rbac.ts` defines per-role capabilities (farm:read, enterprise:write, etc.). Checked in API routes via hasPermission(user.role, action) before Prisma call. Role enum: ADMIN, OFFICE, CREW, AUDITOR.

**Data Isolation:** Farm-scoped queries filter by farmId; Prisma relations enforce Foreign Key integrity. No cross-farm data leaks by design (each endpoint checks farmId from user.farmId).

---

*Architecture analysis: 2025-02-25*
