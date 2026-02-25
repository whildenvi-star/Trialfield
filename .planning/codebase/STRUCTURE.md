# Codebase Structure

**Analysis Date:** 2025-02-25

## Directory Layout

```
organic-cert/
├── prisma/                       # Database schema & migrations
│   └── schema.prisma             # Prisma ORM model definitions (25+ models)
├── public/                       # Static assets (favicons, images)
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (app)/                # Protected routes group (requires auth)
│   │   │   ├── admin/            # Admin features (fieldops sync, review)
│   │   │   ├── dashboard/        # Dashboard landing page
│   │   │   ├── farm/             # Farm settings & metadata
│   │   │   ├── field-enterprises/# Split-field management UI
│   │   │   ├── fields/           # Field records & history
│   │   │   ├── import-plan/      # Import workflow from farm-budget
│   │   │   ├── reference/        # Master data (materials, seeds, equipment, storage, buyers)
│   │   │   ├── reports/          # Report generation UI
│   │   │   └── layout.tsx        # Auth wrapper, sidebar + header
│   │   ├── api/                  # Next.js API routes (REST endpoints)
│   │   │   ├── admin/            # Admin-only endpoints (sync, staging review)
│   │   │   ├── audit-log/        # Audit trail queries
│   │   │   ├── auth/             # NextAuth handlers
│   │   │   ├── buyers/           # Buyer CRUD
│   │   │   ├── equipment/        # Equipment CRUD
│   │   │   ├── farm/             # Farm info CRUD
│   │   │   ├── field-enterprises/# Enterprise CRUD + sub-resources (fertility, operations, harvest, applications, seed-usage)
│   │   │   ├── fields/           # Field CRUD
│   │   │   ├── import-plan/      # Import workflow endpoints
│   │   │   ├── materials/        # Material CRUD
│   │   │   ├── reports/          # Report generation & history
│   │   │   ├── seeds/            # Seed lot CRUD
│   │   │   └── storage/          # Storage location CRUD
│   │   ├── login/                # Login page (unauthenticated)
│   │   └── layout.tsx            # Root layout (metadata, fonts, global styles)
│   ├── components/               # Reusable React components
│   │   ├── forms/                # Form components (dialogs, inputs)
│   │   ├── layout/               # Sidebar, header, providers (NextAuth, theme)
│   │   ├── tables/               # Data tables for list views
│   │   └── ui/                   # Shadcn/ui components (card, button, dialog, select, etc.)
│   ├── generated/                # AUTO-GENERATED
│   │   └── prisma/               # Prisma client generated types
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Business logic, utilities
│   │   ├── pdf/                  # PDF report generation
│   │   │   ├── sections/         # 8 NOP inspection report sections
│   │   │   ├── components/       # Reusable PDF components (header, footer, table)
│   │   │   ├── inspection-report.tsx  # Root Document component
│   │   │   └── styles.ts         # @react-pdf/renderer styling
│   │   ├── audit-logger.ts       # AuditLog insert helper
│   │   ├── auth.ts               # NextAuth configuration
│   │   ├── day-rule-calc.ts      # NOP harvest-to-application gap calculator
│   │   ├── fieldops-client.ts    # Case IH API OAuth2 client
│   │   ├── fieldops-mock.ts      # Test data for fieldops-client fallback
│   │   ├── fieldops-normalizer.ts# Zod validation + transform for Case IH responses
│   │   ├── fieldops-sync.ts      # Sync orchestration (3-year lookback, staging, state)
│   │   ├── lot-generator.ts      # CropLot number generation (YEAR-CROP-FIELDABBREV)
│   │   ├── mass-balance.ts       # Harvest → sold reconciliation
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── rbac.ts               # Role-based access control permission matrix
│   │   ├── report-assembler.ts   # Single Prisma query for all report data
│   │   └── utils.ts              # Miscellaneous utilities
│   ├── types/                    # TypeScript type definitions
│   │   └── next-auth.d.ts        # NextAuth session type augmentation
│   └── globals.css               # Tailwind base styles
├── uploads/                      # Runtime directory for generated PDFs
│   └── reports/                  # PDF files written here by report API route
├── package.json                  # Dependencies, scripts
├── tsconfig.json                 # TypeScript compiler config (@ alias for src/)
├── tailwind.config.ts            # Tailwind CSS configuration
├── next.config.js                # Next.js build config
└── .env.local                    # Environment variables (NOT committed)
```

## Directory Purposes

**`prisma/`:**
- Purpose: Database schema, migrations, and Prisma client generation
- Contains: `schema.prisma` (single file defining all models, enums, relations)
- Key files: `schema.prisma` defines 25+ models in sections (foundation, land & fields, seeds & inputs, field operations, harvest→storage→sale, supporting, Case IH integration, reports)

**`src/app/(app)/`:**
- Purpose: Authenticated user-facing pages and layouts
- Contains: Page components (.tsx files), route groups using Next.js parentheses notation
- Key directories:
  - `admin/` — FieldOps sync/review UI (requires ADMIN role)
  - `field-enterprises/` — Crop-per-field management with create/edit dialogs
  - `fields/` — Field list with activity metrics, drill-down to history
  - `reference/` — Master data editors (materials, seeds, equipment, storage, buyers)
  - `reports/` — Report generation selector (crop year, field filter, download history)

**`src/app/api/`:**
- Purpose: REST API endpoints
- Contains: Route handlers (route.ts files) for GET/POST/PATCH/DELETE operations
- Naming: Path matches resource (e.g., `/api/field-enterprises/[id]/fertility` → `field-enterprises/[id]/fertility/route.ts`)
- All routes check authentication via auth() helper and RBAC via hasPermission()

**`src/components/`:**
- Purpose: Reusable React UI building blocks
- Contains:
  - `ui/` — Shadcn/ui imported components (Card, Button, Dialog, Select, Badge, Input, etc.)
  - `layout/` — App-level components (Sidebar with navigation, Header with user menu, Providers wrapper)
  - `forms/` — Form input groups, validation dialogs
  - `tables/` — Paginated data tables with sort/filter

**`src/lib/`:**
- Purpose: Non-component business logic
- Contains:
  - Core integrations: `fieldops-client.ts` (Case IH OAuth2), `fieldops-sync.ts` (orchestration), `fieldops-normalizer.ts` (Zod validation)
  - Data assembly: `report-assembler.ts` (single Prisma query), `lot-generator.ts` (auto-generated lot numbers)
  - PDF generation: `pdf/*.tsx` (React Document components using @react-pdf/renderer)
  - Security: `auth.ts` (NextAuth), `rbac.ts` (permission matrix), `audit-logger.ts` (log writes)
  - Utilities: `day-rule-calc.ts`, `mass-balance.ts`, `utils.ts`, `prisma.ts` (client singleton)

**`src/lib/pdf/`:**
- Purpose: PDF inspection report assembly and rendering
- Contains:
  - `inspection-report.tsx` — Top-level Document component wrapping all sections
  - `sections/` — 8 components for NOP report structure (cover page, TOC, operation overview, field list, field history, application log, harvest log, mass balance)
  - `components/` — Reusable PDF building blocks (header, footer, table layouts)
  - `styles.ts` — @react-pdf/renderer StyleSheet definitions

**`src/types/`:**
- Purpose: TypeScript type extensions and definitions
- Contains: `next-auth.d.ts` augments NextAuth session type with role, farmId, farmName fields

**`uploads/reports/`:**
- Purpose: Runtime storage for generated PDF files
- Created by: `/api/reports/generate` route
- Committed: No (generated at runtime; not in git)

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx` — Root Next.js layout; loads fonts, global CSS, wraps with Providers
- `src/app/(app)/layout.tsx` — Protected app layout; checks auth, renders Sidebar + Header + children
- `src/app/(app)/dashboard/page.tsx` — Default landing page after login
- `src/app/login/page.tsx` — Login form (unauthenticated)

**Configuration:**
- `prisma/schema.prisma` — Database schema (all models and relations)
- `tsconfig.json` — TypeScript paths (@ alias for src/)
- `tailwind.config.ts` — Tailwind CSS custom config
- `next.config.js` — Next.js build settings
- `package.json` — Dependencies, scripts (dev runs on port 3004)

**Core Logic:**
- `src/lib/fieldops-sync.ts` — Case IH sync orchestration (validate → fetch → normalize → stage)
- `src/lib/fieldops-client.ts` — Case IH API OAuth2 client with token caching
- `src/lib/report-assembler.ts` — Complex Prisma query assembling report data
- `src/lib/auth.ts` — NextAuth configuration (credentials provider, JWT, callbacks)
- `src/lib/rbac.ts` — Role-based access control permission matrix

**Testing:**
- Not detected — No test files found (*.test.ts, *.spec.ts)

**Authentication:**
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth handlers (signin, signout, callback)
- `src/lib/auth.ts` — NextAuth provider config and JWT callbacks
- `src/app/login/page.tsx` — Login UI with email/password form

## Naming Conventions

**Files:**
- Page components: PascalCase, `page.tsx` in route directory (e.g., `fields/page.tsx` for /fields)
- API routes: `route.ts` in api path (e.g., `field-enterprises/[id]/fertility/route.tsx`)
- Component files: PascalCase.tsx (e.g., `FieldList.tsx`)
- Utility/lib files: kebab-case.ts (e.g., `fieldops-sync.ts`, `day-rule-calc.ts`)
- Database models: PascalCase (e.g., `FieldEnterprise`, `CropLot`)
- Database enums: PascalCase (e.g., `OrganicStatus`, `FieldOpType`)

**Directories:**
- kebab-case for route groups and API paths (e.g., `field-enterprises/`, `fieldops/`)
- kebab-case for feature groupings (e.g., `reference/`, `import-plan/`)
- Parentheses for route groups not in URL (e.g., `(app)/` for auth wrapper)

**Variables & Functions:**
- camelCase for variables, functions, hooks (e.g., `runFieldOpsSync`, `syncResult`, `useEffect`)
- UPPER_SNAKE_CASE for constants (e.g., `CURRENT_YEAR`, `CROP_YEARS`)
- PascalCase for React components (e.g., `FieldList`, `InspectionReport`)

## Where to Add New Code

**New Feature (e.g., "Soil Test Results"):**
- **Data model:** Add to `prisma/schema.prisma` (new model + relations)
- **API endpoint:** `src/app/api/soil-tests/route.ts` (GET, POST) and `[id]/route.ts` (PATCH, DELETE)
- **UI page:** `src/app/(app)/soil-tests/page.tsx` (list, create/edit dialogs)
- **Component:** `src/components/forms/SoilTestForm.tsx` or similar if reusable
- **Utilities:** `src/lib/soil-test-handler.ts` if complex business logic needed
- **Audit:** Call `logAudit()` in POST/PATCH/DELETE API routes
- **RBAC:** Add permissions to `rbac.ts` (e.g., "soiltest:read", "soiltest:write")

**New PDF Report Section:**
- **Component:** Create `src/lib/pdf/sections/MySection.tsx` (RSC returning `<Page>...</Page>`)
- **Data types:** Add interface to `src/lib/report-assembler.ts` (e.g., `MySectionData`)
- **Assembly:** Update `reportAssembler()` Prisma query to fetch new section data
- **Root component:** Import and add `<MySection data={data} />` to InspectionReport.tsx
- **PDF styling:** Use `src/lib/pdf/styles.ts` StyleSheet for consistent formatting

**New Master Data Type (like Materials, Seeds):**
- **Model:** Add to `prisma/schema.prisma` with farmId foreign key
- **API:** Create `src/app/api/my-data/route.ts` (GET, POST) and `[id]/route.ts` (PATCH, DELETE)
- **UI:** Add to `src/app/(app)/reference/my-data/page.tsx`
- **Table component:** Optional `src/components/tables/MyDataTable.tsx`

**Utilities / Helpers:**
- Shared helpers: `src/lib/utils.ts` or new file like `src/lib/my-helper.ts`
- Data transformation: `src/lib/my-transformer.ts` (following fieldops-normalizer pattern)
- Calculation logic: `src/lib/my-calculator.ts` (following day-rule-calc.ts pattern)

## Special Directories

**`src/generated/`:**
- Purpose: Auto-generated Prisma client types
- Generated: Yes (by `prisma generate` during install/migrations)
- Committed: No (in .gitignore)
- Usage: Import types from @prisma/client instead (e.g., `import { FieldEnterprise } from "@prisma/client"`)

**`uploads/`:**
- Purpose: Runtime directory for generated PDF reports
- Generated: Yes (by `/api/reports/generate` route)
- Committed: No (in .gitignore)
- Cleanup: Manual or via cron job; not auto-cleaned

**`public/`:**
- Purpose: Static assets served by Next.js
- Contains: Favicon, logo, icons
- Access: `/logo.png` references `public/logo.png`

**`.env.local`:**
- Purpose: Environment variables (secrets, database URL, API keys)
- Committed: No (in .gitignore)
- Required vars: `DATABASE_URL`, `NEXTAUTH_SECRET`, Case IH credentials (if using real API)

---

*Structure analysis: 2025-02-25*
