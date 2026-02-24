# External Integrations

**Analysis Date:** 2026-02-23

## APIs & External Services

**Anthropic Claude API:**
- Service: Claude Vision API for image recognition
- What it's used for: Grain ticket scanning and data extraction
- SDK/Client: `@anthropic-ai/sdk` 0.75.0
- Integration point: `/api/scan` endpoint in grain-tickets
- Model used: `claude-sonnet-4-5-20250929`
- Purpose: Extract ticket number, weight, moisture, farm name, crop type from images
- Authentication: ANTHROPIC_API_KEY environment variable
- Error handling: Returns 500 error if API key not configured

**Case IH FieldOps:**
- Service: Agricultural equipment and field operations data platform
- What it's used for: Sync field operations, equipment applications, and yield history
- Auth: OAuth2 token-based
- Environment variables required:
  - `FIELDOPS_CLIENT_ID`
  - `FIELDOPS_CLIENT_SECRET`
  - `FIELDOPS_SUBSCRIPTION_KEY`
  - `FIELDOPS_TOKEN_URL` (default: https://identity.cnhind.com/oauth2/aus78lla80kTGmPFf1t7/v1/token)
  - `FIELDOPS_API_BASE` (default: https://ag.api.cnhind.com)
- Feature flags:
  - `FIELDOPS_SYNC_ENABLED` - Enable/disable automatic syncing
  - `FIELDOPS_USE_MOCK` - Use mock data for development
  - `FIELDOPS_SYNC_INTERVAL_MINUTES` - Sync frequency (default: 60)
- Integration location: `farm-budget/fieldops/client.js`, `farm-budget/fieldops/sync.js`
- Status: Integration code present but not fully configured

## Data Storage

**Databases:**

*PostgreSQL:*
- Provider: Self-hosted or cloud-managed PostgreSQL
- Used by: organic-cert application exclusively
- Connection string: `DATABASE_URL` environment variable
- Client: Prisma Client (v6.19.2)
- Schema location: `organic-cert/prisma/schema.prisma`
- Models: 23+ tables including Farm, User, Field, Equipment, HarvestEvent, CropLot, etc.
- Features:
  - Role-based access control (ADMIN, OFFICE, CREW, AUDITOR)
  - Organic certification tracking
  - Field operation history
  - Crop lot management
  - Cleanout event documentation
  - Audit logging with JSON change tracking

*File-based JSON Storage:*
- Location: `data/data.json` in each Express application
- Used by: farm-budget, grain-tickets, fsa-acres, meristem-malt
- Backup system: Automatic rotation up to 5 backups (.bak.1 through .bak.5)
- Concurrency: Lock-based write queue prevents data corruption
- Data structure varies per app:
  - farm-budget: enterprises, fields, products, implements, seeds, etc.
  - grain-tickets: tickets, farms, cropConfig
  - fsa-acres: acre tracking data
  - meristem-malt: budget calculations

## File Storage

**Local Filesystem Only:**
- Attachments stored as files referenced in database metadata
- No external cloud storage integrated
- Attachment categories: PHOTO, RECEIPT, CERTIFICATE, LAB_RESULT, MAP, AFFIDAVIT, DOCUMENT, OTHER
- File metadata tracked in database but actual files on local filesystem
- Location: Not centrally configured (relative to application)

## Caching

**None Detected** - No explicit caching layer (Redis/Memcached)
- In-memory store used in Express apps during runtime
- No persistent caching between restarts

## Authentication & Identity

**Auth Provider:**
- Custom: next-auth v5.0.0-beta.30 with Credentials provider
- Strategy: JWT-based sessions

**Implementation Approach (organic-cert):**
- Credentials-based authentication (email + password)
- Password hashing: bcryptjs with salt
- User model:
  - Email (unique)
  - Name
  - PasswordHash
  - Role: ADMIN, OFFICE, CREW, AUDITOR
  - FarmId (associated farm)
  - Active flag
- Token payload includes: user ID, email, name, role, farmId, farmName
- Session strategy: JWT
- Login redirect: `/login` page
- Cookie-based session storage

**Authorization:**
- Role-based access control (RBAC) implementation in `organic-cert/src/lib/rbac.ts`
- Roles: ADMIN, OFFICE, CREW, AUDITOR
- Controlled per resource type

## Monitoring & Observability

**Error Tracking:**
- Not detected - No integration with Sentry, DataDog, or similar

**Logging:**
- Console-based logging in Express applications
- AuditLog model in Prisma schema tracks:
  - User actions (CREATE, UPDATE, DELETE)
  - Entity type and ID
  - Old/new data snapshots (JSON)
  - IP address
  - Timestamp
- Logs written to database for organic-cert
- Standard console output for farm-budget, grain-tickets

## CI/CD & Deployment

**Hosting:**
- Self-hosted (development environment)
- Requires manual deployment
- Port configuration via PORT environment variable

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or similar

**Deployment Method:**
- Manual: `npm start` or `node server.js` for Express apps
- Next.js: `npm run build` then `npm start`

## Environment Configuration

**Required Environment Variables:**

*organic-cert (Next.js):*
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - JWT signing secret
- `NEXTAUTH_URL` - Base URL for auth callbacks

*grain-tickets:*
- `ANTHROPIC_API_KEY` - Claude API authentication (optional, disables scanning if missing)
- `PORT` - Server port (default: 3000)

*farm-budget:*
- `FIELDOPS_CLIENT_ID` - FieldOps OAuth client
- `FIELDOPS_CLIENT_SECRET` - FieldOps OAuth secret
- `FIELDOPS_SUBSCRIPTION_KEY` - FieldOps API subscription key
- `FIELDOPS_SYNC_ENABLED` - Enable FieldOps sync (default: false)
- `FIELDOPS_USE_MOCK` - Use mock FieldOps data (default: true)
- `FIELDOPS_SYNC_INTERVAL_MINUTES` - Sync frequency (default: 60)
- `PORT` - Server port (default: 3001)

**Secrets Location:**
- `.env` file in project root (not committed to git)
- `.env.example` provides template for required variables
- Example files present in:
  - `farm-budget/.env.example` (FieldOps credentials)
  - Other projects rely on implicit defaults

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- FieldOps sync may include callbacks but not explicitly documented
- Next.js auth callbacks configured:
  - `jwt()` - Called on token creation/update
  - `session()` - Called when session is retrieved

## Data Export/Import

**Supported Formats:**
- Excel/XLSX: Read/write via xlsx library
- CSV: Read/write via csv-parse/csv-stringify (organic-cert)
- JSON: Native format for all applications

**Import Endpoints:**
- `farm-budget/import.js` - Script for bulk data import
- `grain-tickets/import.js` - Script for bulk ticket import
- `fsa-acres/import.js` - Script for FSA data import

**Export:**
- REST API endpoints for JSON export
- PDF generation for certification documents (via @react-pdf/renderer)

## Third-Party Services Integration Summary

| Service | Purpose | Status | Config Required |
|---------|---------|--------|------------------|
| PostgreSQL | Primary database | Active | DATABASE_URL |
| Claude API | Document scanning | Configured | ANTHROPIC_API_KEY |
| Case IH FieldOps | Farm data sync | Configured | Multiple FIELDOPS_* vars |
| Next.js | Web framework | Active | NEXTAUTH_* vars |
| Prisma | Database ORM | Active | DATABASE_URL |

---

*Integration audit: 2026-02-23*
