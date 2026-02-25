# External Integrations

**Analysis Date:** 2026-02-25

## APIs & External Services

**Case IH FieldOps API:**
- Service: Case IH (CNH Industrial) FieldOps data API
- What it's used for: Pull field geometry, applications (seed/fertilizer/pesticide), harvest yield, equipment telemetry, and operation history
- SDK/Client: Custom TypeScript client in `src/lib/fieldops-client.ts` (ported from `farm-budget/fieldops/client.js`)
- Auth: OAuth2 client_credentials flow (not user-facing authorization_code flow)
- Scopes: `fields equipment yield applications telemetry`

**Anthropic Claude API:**
- Service: Claude LLM (grain-tickets module only)
- What it's used for: Grain ticket entry analysis and validation
- SDK/Client: `@anthropic-ai/sdk` v0.75.0 (grain-tickets package.json)
- Auth: API key (likely via ANTHROPIC_API_KEY env var, not verified in scope)

## Data Storage

**Databases:**

**PostgreSQL 14+**
- Connection: `DATABASE_URL` env var (format: `postgresql://user@host:port/dbname`)
- Client: Prisma 6.19.2 (ORM)
- Primary database for:
  - Users and authentication (next-auth tables: `User`, `Account`, `Session`, `VerificationToken`)
  - Farm and field data (`Farm`, `Field`, `FieldEnterprise`, `CropLot`)
  - Operations history (`FieldOperation`, `SyncedOperation`, `CaseIHFieldMapping`)
  - Audit trails (`AuditLog`, `NarrativeSection`, `ManagementAction`)
  - Certification tracking (`CertificationStatus`, `OrganicStatus` enum)
  - References (`StorageLocation`, `StorageTransfer`, `Buyer`, `Equipment`, `SeedLot`)

**File Storage:**
- Local filesystem only - PDF reports and uploads stored in project directory (no S3/cloud storage detected)
- PDFs generated in memory via `@react-pdf/renderer`, streamed to response or saved locally

**Caching:**
- None detected - In-memory token cache in `fieldops-client.ts` (60-second buffer for FieldOps OAuth2 tokens)
- No Redis, Memcached, or similar caching layer

## Authentication & Identity

**Auth Provider:**
- Custom credentials-based (email/password)
- Implementation: `next-auth` 5.0.0-beta.30 with Credentials provider
- Location: `src/lib/auth.ts`
- Session strategy: JWT (JSON Web Tokens)
- Password hashing: bcryptjs 3.0.3 (bcrypt.compare in `src/lib/auth.ts`)
- Session storage: Next.js cookies (default for next-auth JWT strategy)

**User Roles (RBAC):**
- Enum defined in `prisma/schema.prisma`: `ADMIN`, `OFFICE`, `CREW`, `AUDITOR`
- Role-based access control in API routes via `session.user.role` checks
- Example: `src/app/api/admin/fieldops/connection/route.ts` validates `user?.role === "ADMIN"`

**OAuth2 for CNH FieldOps (server-to-server):**
- Flow: client_credentials (not user-facing login)
- Token endpoint: `https://identity.cnhind.com/oauth2/aus78lla80kTGmPFf1t7/v1/token`
- Authorization header: Basic auth (base64-encoded client_id:client_secret)
- Subscription key header: `Ocp-Apim-Subscription-Key` (CNH API gateway requirement)
- Token caching: 60-second buffer before expiry to reduce token requests

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar integration

**Logs:**
- Application-level audit logging in `src/lib/audit-logger.ts`
- Database-backed: `AuditLog` Prisma model stores CREATE/UPDATE/DELETE events with JSON snapshots
- Console logging: Using standard `console.log/error/warn` (no structured logging framework like Winston or Pino detected)

**Audit Trail:**
- Tamper-evidence deferred to v2 (currently no hash chain or verification)
- Tracks userId, action, entityType, entityId, newData, timestamp per `AuditLog` schema

## CI/CD & Deployment

**Hosting:**
- Not deployed - Local development only at analysis time
- Target platform: Any Node.js-compatible server (Vercel for Next.js, traditional VPS, Docker, AWS Lambda via serverless adapter)
- No Docker or deployment configuration detected in codebase

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or Jenkins configuration files

**Build process:**
- `npm run build` compiles Next.js app to `.next/` directory
- `npm start` runs production Next.js server
- `npm run dev` runs Next.js dev server on port 3004

## Environment Configuration

**Required env vars (from .env file observed 2026-02-25):**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - JWT signing secret
- `NEXTAUTH_URL` - Auth callback URL
- `FIELDOPS_CLIENT_ID` - CNH OAuth2 client ID (blank if not configured)
- `FIELDOPS_CLIENT_SECRET` - CNH OAuth2 secret (blank if not configured)
- `FIELDOPS_SUBSCRIPTION_KEY` - CNH API subscription key (blank if not configured)
- `FIELDOPS_TOKEN_URL` - (optional, defaults to CNH production endpoint)
- `FIELDOPS_API_BASE` - (optional, defaults to CNH production API base)
- `FIELDOPS_USE_MOCK` - Set to `true` for mock data in development
- `NODE_ENV` - development, production, or test

**Secrets location:**
- `.env` file at project root (checked into repo for dev credentials only — NOT for production)
- Production secrets should be managed via:
  - Environment variables in deployment platform (Vercel, Heroku, AWS, GCP)
  - Secret management service (HashiCorp Vault, AWS Secrets Manager, etc.)
  - Do NOT commit `.env.local` or `.env.production` with real credentials

## Webhooks & Callbacks

**Incoming:**
- None detected - No webhook endpoints for CNH FieldOps push notifications
- Currently uses polling via sync job (planned pg-boss scheduled task)

**Outgoing:**
- None detected - No outbound webhooks to external services

## Data Synchronization

**FieldOps Data Sync:**
- Trigger: Scheduled task (daily, currently via polling)
- Source: CNH FieldOps API (`/v1/fields`, `/v1/applications`, `/v1/yield`, `/v1/equipment`)
- Flow: API call → Normalize data → Validate via normalizer → Upsert to Prisma models
- Implementation: `src/lib/fieldops-sync.ts` (orchestrator), `src/lib/fieldops-client.ts` (HTTP client), `src/lib/fieldops-normalizer.ts` (data transformation)
- Mock fallback: `src/lib/fieldops-mock.ts` provides test data when `FIELDOPS_USE_MOCK=true`
- Known limitation (API-05 requirement): CNH returns empty field array if equipment is registered under a dealership/linked account, not the operator's direct account

**Grain Ticket Import:**
- Source: Excel/CSV files uploaded via `grain-tickets/` module
- Implementation: `grain-tickets/import.js` uses xlsx parser
- Destination: Local data files in `grain-tickets/data/` directory
- Note: Grain-tickets is a separate Express app, not integrated into organic-cert yet

## Cross-Module Integration

**Modular ecosystem:**

| Module | Purpose | Tech | Integration Status |
|--------|---------|------|-------------------|
| farm-budget | Field-by-field budget forecasting | Node.js + Express | Case IH FieldOps client (source for TS port) |
| grain-tickets | Grain load tracking (31 crop varieties) | Node.js + Express + Anthropic Claude | Separate app, planned integration |
| fsa-acres | FSA acre reporting & crop insurance | Node.js + Express | Separate app, planned integration |
| meristem-malt | Malt cost calculator | Node.js + Express | Separate app, planned integration |
| farm-registry | Central field registry | Node.js + Express + CORS | Planned as single source of truth for field/farm data |

**Current integration pattern:**
- organic-cert pulls CNH FieldOps data directly (via `fieldops-client.ts`)
- Other modules operate independently, no API-to-API calls detected
- Future: farm-registry planned as central hub to prevent acre/field reconciliation issues

## PDF Report Generation

**PDF Library Stack:**
- Runtime: `@react-pdf/renderer` 4.3.2 (server-side React component to PDF)
- Tables: `@ag-media/react-pdf-table` 2.0.3 (table primitives for react-pdf)
- Location: Report generation in API route (planned in Phase 3)
- Format: Print-ready NOP inspection report (7 CFR Part 205 compliance)

**Report content:**
- Field summary table, 3-year land history, input records, crop rotation, harvest records, mass balance, audit log section
- Page headers/footers using react-pdf's `fixed` prop (repeats on every page)

## Development Integrations

**Package registries:**
- npm (default Node.js package manager)
- No private registries detected (all dependencies from public npm)

**Code quality tools:**
- eslint 9.x (static analysis)
- ESLint config: Next.js preset via eslint-config-next
- No Prettier, Biome, or other formatters detected in package.json

---

*Integration audit: 2026-02-25*
