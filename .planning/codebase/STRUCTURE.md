# Codebase Structure

**Analysis Date:** 2026-02-23

## Directory Layout

```
my-project-one/
├── farm-budget/           # Farm Enterprise Financial Management
│   ├── server.js          # Express server + in-memory store
│   ├── import.js          # Data import script
│   ├── package.json       # Dependencies: express, xlsx, node-cron, dotenv
│   ├── public/            # Frontend + calc engine
│   │   ├── index.html     # Entry point HTML
│   │   ├── style.css      # UI styles
│   │   ├── app.js         # App shell, tab navigation
│   │   ├── calc.js        # Calc engine: field budget, dashboard
│   │   ├── field-editor.js    # Field CRUD UI
│   │   ├── dashboard.js       # Summary view
│   │   ├── enterprise.js      # Enterprise UI
│   │   ├── inputs-manager.js  # Product/input CRUD
│   │   ├── sales.js           # Sales tracking
│   │   ├── hedging.js         # Price hedging
│   │   ├── pdf-report.js      # PDF export
│   │   ├── farm-map.js        # Leaflet.js map integration
│   │   ├── seed-manager.js    # Seed variety CRUD
│   │   ├── rent-manager.js    # Rent tracking
│   │   └── icons/             # SVG icons
│   ├── fieldops/          # Integration with fieldops system
│   │   ├── client.js      # HTTP client to fieldops API
│   │   ├── sync.js        # Sync logic: match fields, equipment, boundaries
│   │   └── mock-data.js   # Test fixtures
│   ├── data/              # Persistent storage
│   │   └── data.json      # JSON store (created at runtime)
│   └── node_modules/      # Dependencies (not tracked)
│
├── fsa-acres/             # FSA Acre Reporting & Crop Insurance Tracker
│   ├── server.js          # Express server + in-memory store
│   ├── import.js          # Data import script
│   ├── package.json       # Dependencies: express, xlsx
│   ├── public/            # Frontend + calc
│   │   ├── index.html     # Entry point HTML
│   │   ├── calc.js        # Calc engine: CLU, farm, pricing calcs
│   │   ├── app.js         # Tab navigation
│   │   └── [ui modules]   # CRUD managers for CLU, farms, pricing
│   ├── data/              # Persistent storage
│   │   └── data.json      # JSON store
│   └── node_modules/
│
├── grain-tickets/         # Grain Ticket Entry System
│   ├── server.js          # Express + multer for file upload
│   ├── import.js          # Data import script
│   ├── package.json       # Dependencies: express, multer, xlsx, @anthropic-ai/sdk
│   ├── public/            # Frontend + calc
│   │   ├── index.html     # Entry point HTML
│   │   ├── calc.js        # Calc engine: ticket enrichment
│   │   ├── app.js         # Upload UI, ticket list
│   │   └── [ui modules]   # Ticket search, display
│   ├── data/              # Persistent storage
│   │   └── data.json      # JSON store
│   └── node_modules/
│
├── meristem-malt/         # Meristem Malt Cost Calculator
│   ├── server.js          # Express server
│   ├── package.json       # Dependencies: express
│   ├── public/            # Frontend + calc
│   │   ├── index.html     # Entry point HTML
│   │   ├── calc.js        # Cost calculation engine
│   │   ├── app.js         # Input form UI
│   │   └── style.css      # Styles
│   ├── data/              # Persistent storage (if used)
│   │   └── data.json
│   └── node_modules/
│
├── organic-cert/          # Organic Certification Tracker (Next.js full-stack)
│   ├── package.json       # Dependencies: next, react, prisma, next-auth
│   ├── tsconfig.json      # TypeScript config
│   ├── next.config.js     # Next.js config
│   ├── tailwind.config.js # Tailwind CSS config
│   ├── prisma/
│   │   └── schema.prisma  # Database schema: 30+ models
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   │   ├── layout.tsx           # Root layout (metadata, providers)
│   │   │   ├── login/page.tsx       # NextAuth login form
│   │   │   ├── (app)/layout.tsx     # Protected app layout (navbar, sidebar)
│   │   │   ├── (app)/dashboard/page.tsx        # Dashboard summary
│   │   │   ├── (app)/farm/page.tsx             # Farm settings
│   │   │   ├── (app)/fields/page.tsx           # Field list
│   │   │   ├── (app)/field-enterprises/page.tsx   # Crop lot list
│   │   │   ├── (app)/field-enterprises/[id]/page.tsx # Crop lot detail + operations/fertility/harvest
│   │   │   ├── (app)/reference/                 # Reference data pages
│   │   │   │   ├── seeds/page.tsx               # Seed lot management
│   │   │   │   ├── materials/page.tsx           # Material/input library
│   │   │   │   ├── equipment/page.tsx           # Equipment inventory
│   │   │   │   ├── storage/page.tsx             # Storage location list
│   │   │   │   └── buyers/page.tsx              # Buyer contacts
│   │   │   ├── (app)/reports/page.tsx           # Cert report generation
│   │   │   ├── (app)/import-plan/page.tsx       # Import from farm-budget
│   │   │   ├── (app)/admin/page.tsx             # Admin user mgmt
│   │   │   └── api/                             # API routes
│   │   │       ├── auth/[...nextauth]/route.ts  # NextAuth callback
│   │   │       ├── farm/route.ts                # Farm CRUD
│   │   │       ├── field-enterprises/route.ts   # Crop lot CRUD
│   │   │       ├── field-enterprises/[id]/operations/route.ts   # Operation CRUD
│   │   │       ├── field-enterprises/[id]/fertility/route.ts    # Fertility event CRUD
│   │   │       ├── field-enterprises/[id]/harvest/route.ts      # Harvest event CRUD
│   │   │       ├── materials/route.ts           # Material library CRUD
│   │   │       ├── storage/route.ts             # Storage location CRUD
│   │   │       ├── audit-log/route.ts           # Audit trail query
│   │   │       └── [more endpoints]
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── providers.tsx        # NextAuth + theme provider setup
│   │   │   │   ├── navbar.tsx           # Top navigation
│   │   │   │   └── sidebar.tsx          # Left sidebar
│   │   │   ├── forms/
│   │   │   │   ├── field-form.tsx       # Edit field details
│   │   │   │   ├── operation-form.tsx   # Create field operation
│   │   │   │   ├── fertility-form.tsx   # Create fertility event
│   │   │   │   ├── harvest-form.tsx     # Create harvest event
│   │   │   │   └── [more forms]
│   │   │   ├── tables/
│   │   │   │   ├── operations-table.tsx    # List operations
│   │   │   │   ├── fertility-table.tsx     # List fertility events
│   │   │   │   ├── harvest-table.tsx       # List harvest events
│   │   │   │   └── [more tables]
│   │   │   └── ui/
│   │   │       ├── button.tsx           # Shadcn button component
│   │   │       ├── input.tsx            # Shadcn input component
│   │   │       ├── dialog.tsx           # Shadcn dialog (modal)
│   │   │       ├── select.tsx           # Shadcn select dropdown
│   │   │       ├── table.tsx            # Shadcn table
│   │   │       └── [more UI primitives]
│   │   ├── lib/
│   │   │   ├── prisma.ts           # Prisma client singleton
│   │   │   ├── auth.ts             # NextAuth config, getSession helper
│   │   │   ├── rbac.ts             # Role-based access control
│   │   │   ├── audit-logger.ts     # Log CREATE/UPDATE/DELETE events
│   │   │   ├── lot-generator.ts    # Auto-generate lot numbers
│   │   │   ├── mass-balance.ts     # C5.0 fertility calculations
│   │   │   ├── day-rule-calc.ts    # C6.0 application timing rules
│   │   │   ├── utils.ts            # Shared helpers (formatDate, etc)
│   │   │   └── pdf/
│   │   │       └── cert-report.ts  # PDF generation for certifications
│   │   ├── hooks/
│   │   │   └── useAuth.ts          # NextAuth useSession wrapper
│   │   ├── types/
│   │   │   ├── index.ts            # Custom TypeScript types
│   │   │   └── prisma.ts           # Prisma-generated types
│   │   ├── generated/
│   │   │   └── prisma/             # Auto-generated Prisma client types
│   │   └── globals.css             # Tailwind directives + custom styles
│   ├── public/
│   │   └── [static assets]         # Logos, favicons
│   ├── .env.example                # Template for env vars
│   ├── .env                        # DATABASE_URL, NEXTAUTH_SECRET, etc (not tracked)
│   └── node_modules/
│
├── Glomalin/                       # Supporting folder (documentation/examples)
├── .planning/                      # GSD planning docs
│   └── codebase/
│       ├── ARCHITECTURE.md         # This file
│       ├── STRUCTURE.md            # This file
│       └── [other docs]
├── .git/                           # Version control
└── [spreadsheets, data files]      # Business documents
```

## Directory Purposes

**farm-budget/:**
- Purpose: Field-by-field budget forecasting for crop enterprises
- Contains: Express server, tab-based SPA, calculation engine
- Key files: `server.js` (API), `public/calc.js` (budget math), `public/app.js` (shell)

**fsa-acres/:**
- Purpose: FSA acre reporting, crop insurance tracking
- Contains: Express server, CRUD managers for CLU records, farms, pricing
- Key files: `server.js` (API), `public/calc.js` (FSA calculations)

**grain-tickets/:**
- Purpose: Grain ticket entry from uploaded files, AI-assisted extraction
- Contains: Express + multer, Anthropic SDK integration, ticket storage
- Key files: `server.js` (multer + API), `public/app.js` (upload UI)

**meristem-malt/:**
- Purpose: Malt cost calculator, break-even pricing
- Contains: Express server, simple calculation UI
- Key files: `server.js` (API), `public/calc.js` (costing logic)

**organic-cert/:**
- Purpose: Organic certification audit trail, compliance documentation
- Contains: Next.js full-stack, Prisma PostgreSQL, NextAuth authentication, role-based access
- Key files: `prisma/schema.prisma` (data model), `src/app/api/` (API routes), `src/components/` (React components)

## Key File Locations

**Entry Points:**
- `farm-budget/public/index.html`: HTML shell with nav tabs
- `fsa-acres/public/index.html`: HTML shell for FSA tracking
- `grain-tickets/public/index.html`: Upload form + ticket list
- `organic-cert/src/app/layout.tsx`: Next.js root layout (NextAuth providers)

**Configuration:**
- `farm-budget/.env`: PORT, FIELDOPS_API_URL (if enabled)
- `organic-cert/.env`: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
- `organic-cert/prisma/schema.prisma`: Complete data model

**Core Logic:**
- `farm-budget/server.js`: 382 lines, Express API with CRUD factory pattern
- `farm-budget/public/calc.js`: Budget, dashboard, enterprise calculations
- `organic-cert/src/lib/audit-logger.ts`: Compliance audit logging
- `organic-cert/src/lib/rbac.ts`: Role-based access control middleware

**Testing:**
- None currently (no test framework detected)

## Naming Conventions

**Files:**
- Express app backends: `server.js` (main) + `import.js` (data loader)
- Calculation engines: `calc.js` always in `public/` folder
- Frontend modules: `[feature]-manager.js` (e.g., `seed-manager.js`, `inputs-manager.js`)
- Next.js pages: `[feature]/page.tsx` in App Router structure
- Next.js API: `src/app/api/[resource]/route.ts` and `src/app/api/[resource]/[id]/route.ts`

**Directories:**
- `public/`: Static assets + frontend JS modules (Express apps)
- `src/app/`: Next.js App Router pages (not src/pages/)
- `src/components/`: React components (forms, tables, UI primitives)
- `src/lib/`: Shared utilities, middleware, helpers
- `data/`: Runtime data storage (JSON files)
- `fieldops/`: Integration module (farm-budget only)

## Where to Add New Code

**New Feature in Express App:**
- Backend API: Add route in `server.js` (or extract to separate file)
- Frontend: Add `[feature].js` module in `public/`, create form in HTML or JS
- Calc logic: Add function to `public/calc.js`
- Tests: None currently (would be in `test/` folder if added)

**New Feature in Next.js (organic-cert):**
- Page/UI: Add `src/app/(app)/[feature]/page.tsx`
- API endpoint: Add `src/app/api/[resource]/route.ts`
- Database model: Update `prisma/schema.prisma`, run `npx prisma migrate dev`
- Component: Add to `src/components/[category]/[feature].tsx`
- Shared logic: Add to `src/lib/[feature].ts`

**New Component in organic-cert:**
- Shadcn UI: Copy base component from `src/components/ui/`, customize in feature component
- Form: Create in `src/components/forms/[feature]-form.tsx`, use Form components + Prisma types
- Table: Create in `src/components/tables/[feature]-table.tsx`, use shadcn Table + Tailwind

**Utilities:**
- Shared helpers (dates, formatting): `src/lib/utils.ts`
- Auth helpers: `src/lib/auth.ts`
- Type definitions: `src/types/index.ts`

## Special Directories

**node_modules/:**
- Purpose: Installed dependencies per package.json
- Generated: Yes (via npm install)
- Committed: No (ignored in .gitignore)

**data/:**
- Purpose: JSON data persistence for Express apps
- Generated: Yes (created at runtime if missing)
- Committed: Optionally (can contain large data files)

**.next/:**
- Purpose: Next.js build cache (organic-cert)
- Generated: Yes (via npm run dev or build)
- Committed: No (ignored in .gitignore)

**src/generated/:**
- Purpose: Auto-generated Prisma types (organic-cert)
- Generated: Yes (via prisma generate)
- Committed: No (should be auto-generated, but often included)

**prisma/**
- Purpose: Database schema and migrations (organic-cert)
- Generated: migrations/ folder auto-generated by `prisma migrate`
- Committed: schema.prisma YES, migrations/ YES

---

*Structure analysis: 2026-02-23*
