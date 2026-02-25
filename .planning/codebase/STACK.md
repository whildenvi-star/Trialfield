# Technology Stack

**Analysis Date:** 2026-02-25

## Languages

**Primary:**
- TypeScript 5.x - All Next.js app code, Prisma models, API routes
- JavaScript (Node.js) - Legacy modules (farm-budget fieldops, grain-tickets, fsa-acres, meristem-malt, farm-registry)

**Secondary:**
- SQL - Prisma schema definitions (`prisma/schema.prisma`), migrations
- HTML/CSS - React JSX via Tailwind CSS

## Runtime

**Environment:**
- Node.js 22.x (inferred from ES2017 TypeScript target and native fetch support)

**Package Manager:**
- npm (lockfile: `package-lock.json` present in each module)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework (organic-cert: `src/app/` structure)
- React 19.2.3 - UI component library
- Prisma 6.19.2 - ORM for PostgreSQL database access

**Testing:**
- Not detected - No test runner (Jest, Vitest) in package.json

**Build/Dev:**
- Tailwind CSS 4.x - Utility-first CSS framework
- @tailwindcss/postcss 4.x - PostCSS plugin for Tailwind
- ESLint 9.x - Code linting via eslint.config.mjs
- TypeScript 5.x - Type checking and compilation
- tsx 4.21.0 - TypeScript execution for Node.js scripts
- shadcn 3.8.5 - React component library CLI (for Radix UI pre-built components)

## Key Dependencies

**Critical:**
- @prisma/client 6.19.2 - Database client (required for all data operations)
- next-auth 5.0.0-beta.30 - Authentication & session management (Credentials provider with bcryptjs)
- @react-pdf/renderer 4.3.2 - Server-side PDF generation for NOP audit reports
- @ag-media/react-pdf-table 2.0.3 - Table layout component for PDF reports (peer dep: react-pdf >=3.0.0)
- zod 4.3.6 - Runtime schema validation
- date-fns 4.1.0 - Date parsing and formatting utilities

**UI & Component Libraries:**
- radix-ui 1.4.3 - Accessible unstyled UI component primitives
- lucide-react 0.575.0 - Icon library
- cmdk 1.1.1 - Command menu component
- sonner 2.0.7 - Toast notification library
- class-variance-authority 0.7.1 - CSS class composition utility
- clsx 2.1.1 - Conditional className helper
- tailwind-merge 3.5.0 - Merge conflicting Tailwind classes
- next-themes 0.4.6 - Theme/dark mode support

**Infrastructure:**
- bcryptjs 3.0.3 - Password hashing for next-auth (Credentials provider)

**Data Processing:**
- csv-parse 6.1.0 - Parse CSV files (for grain ticket imports)
- csv-stringify 6.6.0 - Generate CSV files (for data exports)
- xlsx 0.18.x - Parse/generate Excel files (grain-tickets, fsa-acres modules)

**Development & Configuration:**
- dotenv 17.3.1 - Load environment variables from .env files
- eslint-config-next 16.1.6 - Next.js ESLint configuration preset

## Configuration

**Environment:**
- `.env` file present - Contains DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, and Case IH FieldOps credentials
- Configuration pattern: `process.env.VARIABLE_NAME` accessed directly in code

**Key env vars required:**
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql://user@localhost:5432/glomalin`)
- `NEXTAUTH_SECRET` - Signing secret for JWT tokens
- `NEXTAUTH_URL` - Auth callback URL (e.g., `http://localhost:3004`)
- `FIELDOPS_CLIENT_ID` - Case IH OAuth2 client ID
- `FIELDOPS_CLIENT_SECRET` - Case IH OAuth2 client secret
- `FIELDOPS_SUBSCRIPTION_KEY` - CNH API subscription key
- `FIELDOPS_TOKEN_URL` - OAuth2 token endpoint (default: `https://identity.cnhind.com/oauth2/aus78lla80kTGmPFf1t7/v1/token`)
- `FIELDOPS_API_BASE` - FieldOps API base URL (default: `https://ag.api.cnhind.com`)
- `FIELDOPS_USE_MOCK` - Fall back to mock data when credentials not configured (dev only)
- `NODE_ENV` - Set to 'production' for production builds

**Build Configuration:**
- `tsconfig.json` - TypeScript compiler options (strict mode enabled, path aliases via `@/*`)
- `next.config.ts` - Next.js server config (`serverExternalPackages: ["@react-pdf/renderer"]`)
- `prisma.config.ts` - Prisma configuration with migrations and seed script
- `eslint.config.mjs` - ESLint rules (Next.js preset)
- `postcss.config.mjs` - PostCSS configuration for Tailwind CSS

## Platform Requirements

**Development:**
- PostgreSQL 14+ (required by Prisma 6 and pg-boss compatibility)
- Node.js 22.x or compatible
- npm or yarn
- Modern web browser (Chrome, Firefox, Safari, Edge)

**Production:**
- PostgreSQL 14+ database server
- Node.js 22.x runtime
- Docker recommended (not currently in use but compatible)
- Environment variables must be set before deployment

## Modular Architecture

**Separate NPM modules in ecosystem (Node.js-based, no React):**
- `farm-budget/` - Express.js app with Case IH FieldOps OAuth2 integration (`fieldops/client.js`, `fieldops/sync.js`)
- `grain-tickets/` - Grain load tracking with Anthropic Claude SDK integration
- `fsa-acres/` - FSA acre reporting and crop insurance tracking
- `meristem-malt/` - Malt cost calculator
- `farm-registry/` - Central farm/field registry service with CORS support

**Main Next.js app:**
- `organic-cert/` - USDA NOP organic certification audit system (primary focus)

---

*Stack analysis: 2026-02-25*
