# Technology Stack

**Analysis Date:** 2026-02-23

## Languages

**Primary:**
- JavaScript - Node.js backend servers (farm-budget, grain-tickets, fsa-acres, meristem-malt)
- TypeScript 5.x - Frontend application (organic-cert)
- SQL - PostgreSQL database schema and queries

**Secondary:**
- JSX/TSX - React components (organic-cert)

## Runtime

**Environment:**
- Node.js v22.22.0 (current development environment)
- npm v11.10.0 (package manager)

**Package Manager:**
- npm - Primary package manager for all projects
- Lockfile: Present (package-lock.json in each project)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack web framework for organic-cert
  - React 19.2.3 - UI rendering
  - React DOM 19.2.3 - DOM manipulation
- Express 4.18.x - HTTP server framework for farm-budget, grain-tickets, fsa-acres, meristem-malt
- Prisma 6.19.2 - ORM and database client (organic-cert)

**UI/Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework (organic-cert)
- shadcn - Component library built on Radix UI (organic-cert)
- Radix UI 1.4.3 - Accessible component primitives (organic-cert)
- lucide-react 0.575.0 - Icon library (organic-cert)
- clsx 2.1.1 - Utility for conditional className concatenation
- class-variance-authority 0.7.1 - CSS-in-JS pattern for components

**Authentication:**
- next-auth 5.0.0-beta.30 - Authentication middleware (organic-cert)
- bcryptjs 3.0.3 - Password hashing (organic-cert)

**Data Processing:**
- xlsx 0.18.x - Excel file parsing and generation (farm-budget, grain-tickets, fsa-acres)
- csv-parse 6.1.0 - CSV parsing (organic-cert)
- csv-stringify 6.6.0 - CSV generation (organic-cert)

**Utilities:**
- date-fns 4.1.0 - Date manipulation (organic-cert)
- @react-pdf/renderer 4.3.2 - PDF generation from React (organic-cert)
- next-themes 0.4.6 - Theme management (organic-cert)
- sonner 2.0.7 - Toast notifications (organic-cert)
- tailwind-merge 3.5.0 - Tailwind CSS conflict resolution
- cmdk 1.1.1 - Command palette/search component (organic-cert)
- node-cron 3.0.0 - Cron job scheduling (farm-budget)
- multer 2.0.2 - File upload handling (grain-tickets)
- dotenv 16.4.0 - Environment variable loading (farm-budget, organic-cert)

**Development:**
- TypeScript 5.x - Type checking (organic-cert)
- ESLint 9.x - Code linting (organic-cert)
- eslint-config-next - Next.js ESLint configuration
- Tailwind CSS PostCSS - PostCSS plugin for Tailwind (organic-cert)
- tsx 4.21.0 - TypeScript execution (organic-cert)
- PostCSS 4.x - CSS processing (organic-cert)

## External APIs & SDKs

**Anthropic Claude API:**
- @anthropic-ai/sdk 0.75.0 - Claude vision API for ticket scanning (grain-tickets)
- Model: claude-sonnet-4-5-20250929
- Used for: Grain ticket image recognition and data extraction

**Case IH FieldOps:**
- OAuth2-based integration with CNH Industrial
- Endpoints: identity.cnhind.com, ag.api.cnhind.com
- Purpose: Sync field operations, applications, and yield history
- Status: Integration code present in farm-budget (not fully active)

## Configuration Files

**Build/Runtime:**
- `next.config.ts` - Next.js configuration (organic-cert)
- `tsconfig.json` - TypeScript compiler options (organic-cert)
- `eslint.config.mjs` - ESLint rules (organic-cert)
- `postcss.config.mjs` - PostCSS configuration (organic-cert)
- `prisma.config.ts` - Prisma configuration (organic-cert)
- `prisma/schema.prisma` - Database schema definition (organic-cert)

**Environment:**
- `.env` files present but not included in repository
- `.env.example` files for reference (farm-budget)
- Environment variables control API keys, feature flags, and configuration

## Package Structure

**Monorepo Organization:**
```
my-project-one/
├── farm-budget/          # Field budget forecasting server (Express)
├── grain-tickets/        # Grain ticket entry system (Express + Claude Vision)
├── fsa-acres/           # FSA acre reporting (Express)
├── meristem-malt/       # Malt cost calculator (Express)
└── organic-cert/        # Organic certification UI (Next.js full-stack)
```

**Multi-Project Setup:**
- Each project has independent package.json
- Separate npm dependencies per project
- No workspace/monorepo root configuration
- Data persistence varies: file-based JSON (Express apps), PostgreSQL (organic-cert)

## Database

**Primary Database:**
- PostgreSQL - Used by organic-cert application
- Connection: Via DATABASE_URL environment variable
- Client: Prisma Client
- Schema: `prisma/schema.prisma` in organic-cert

**Data Storage (Express Apps):**
- JSON file-based storage in `data/data.json`
- Backup rotation (up to 5 backups)
- Atomic writes with lock-based concurrency
- Used in: farm-budget, grain-tickets

## Platform Requirements

**Development:**
- Node.js 22.x (tested with v22.22.0)
- npm 11.x
- PostgreSQL database (for organic-cert)
- Git (repository control)

**Production:**
- Node.js 22.x runtime
- PostgreSQL database instance
- Environment variables configured for API keys
- Port exposure (configurable via PORT env var)
  - farm-budget: 3001
  - grain-tickets: 3000
  - organic-cert: 3004

## Key Integrations

**External Services:**
- Claude API (Anthropic) - Vision-based document scanning
- Case IH FieldOps API - Agricultural equipment data sync
- PostgreSQL database hosting

**Data Exchange Formats:**
- JSON (REST APIs, data storage)
- CSV (import/export for organic-cert)
- Excel/XLSX (import/export for farm data)
- PDF (certification document generation)

---

*Stack analysis: 2026-02-23*
