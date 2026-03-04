# Phase 9: Database Foundation - Research

**Researched:** 2026-03-01
**Domain:** Prisma 6 + PostgreSQL integration into an existing Express/CommonJS app
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Database isolation**
- Other apps in the ecosystem may migrate to PostgreSQL in the future
- Currently running on local PostgreSQL install; Docker or managed service possible later
- Office staff and personal devices access the app over local network (PWA)

**Schema scope**
- Define ALL v2.0 tables in the initial schema: Ticket, Farm, CropConfig, Buyer, Settlement, SettlementLine, Reconciliation — even though settlement tables will be empty until later phases
- Local farms table synced from farm-registry API — grain-tickets maintains its own copy of farm data in PostgreSQL, periodically synced from the registry. Works even if registry is down.
- Crop config is per-year — each CropConfig row has a cropYear, allowing configs to change across seasons

**Data shape**
- Dedicated `hbtBinNo` column on tickets — extract from notes field during migration (507/527 tickets have HBT bin numbers in notes)
- Dedicated `truckId` column on tickets — extract from notes field during migration
- Duplicate ticket numbers (14 found) are data entry errors — use non-unique index on ticketNo, not unique constraint. Flag duplicates for review.
- Notes field is preserved after extraction — original text stays, structured fields are additive

**Deployment reality**
- App is NOT yet deployed to production — running on dev machine only
- Farm office staff is still using the 31-sheet Excel spreadsheet
- The 527 tickets in data.json are historical imports, not actively entered data
- Phase 10 migration has zero live-user risk — no write-lock cutover procedure needed

### Claude's Discretion

- Separate database vs shared database (leaning separate for clean isolation)
- ID format: auto-increment integers vs preserving string IDs (t_000001)
- .env file setup and DATABASE_URL management
- Prisma schema naming conventions
- Connection pooling and singleton implementation details

### Deferred Ideas (OUT OF SCOPE)

- Phase 14 (from roadmap): Chat agent for system information and recall — noted in roadmap, not blocking v2.0 phases
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 (partial) | Existing grain ticket data migrates from JSON to PostgreSQL with zero data loss — Phase 9 covers schema + connection only (not migration cutover) | Schema design patterns, PrismaClient singleton, migrate dev workflow |
</phase_requirements>

---

## Summary

Phase 9 adds Prisma 6 + PostgreSQL to the grain-tickets Express app without touching the existing JSON-based functionality. The work is three parts: (1) install and configure Prisma with a schema covering all v2.0 entities, (2) run `prisma migrate dev` to create tables, and (3) wire up a `db.js` singleton that future phases can import. The JSON store stays fully operational — no routes change.

The grain-tickets app is plain CommonJS Node.js with no TypeScript. Prisma 6 fully supports this via the `prisma-client-js` generator, which produces a client importable via `require('@prisma/client')`. The driver adapter (`@prisma/adapter-pg`) is optional in Prisma 6 and only required if using the Rust-free preview flag or upgrading to Prisma 7. The pattern already proven in organic-cert (same codebase, same Prisma version 6.19.2) is the reference implementation — just adapted for CommonJS `require()` instead of TypeScript `import`.

The schema must cover the full v2.0 data model upfront: Ticket, Farm, CropConfig, Buyer, Settlement, SettlementLine, Reconciliation. Settlement and reconciliation tables will be empty until Phases 12-13 but defining them now avoids re-running migrations later. Key data model decisions from the CONTEXT.md have direct schema implications: `ticketNo` gets a non-unique `@@index` (not `@@unique`) due to 14 known duplicates; `hbtBinNo` and `truckId` become first-class columns; `CropConfig` includes a `cropYear` field; the `Farm` table is a local sync copy not a foreign-key reference to the registry.

**Primary recommendation:** Use `prisma-client-js` generator (no adapter needed), CommonJS `require()` throughout, a separate PostgreSQL database named `grain_tickets`, and a `db.js` singleton in `grain-tickets/lib/db.js` modeled after organic-cert's `src/lib/prisma.ts` but converted to CommonJS.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| prisma | ^6.19.2 | CLI: migrate, generate, studio | Matches organic-cert exactly — no split ORM burden |
| @prisma/client | ^6.19.2 | Generated query client for runtime | Installed alongside prisma, auto-regenerated on migrate |
| dotenv | ^16.x | Load .env into process.env | Required before PrismaClient for non-Next.js environments; already common pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @prisma/adapter-pg | optional | Driver adapter for pg-based connection | Only needed for Rust-free preview features or Prisma 7 upgrade — skip for Prisma 6 standard setup |
| pg | optional | PostgreSQL driver | Only needed if using @prisma/adapter-pg |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| prisma-client-js generator | new prisma-client generator | New generator is TypeScript-only by design; prisma-client-js continues to work in Prisma 6 and is the right choice for a vanilla JS project |
| Separate grain_tickets database | Schema isolation within glomalin DB | Separate DB is cleaner, matches organic-cert pattern (glomalin DB is organic-cert's), avoids cross-app table collision risk |
| autoincrement Int IDs | CUID strings (like organic-cert) | Int IDs are faster to query, simpler for this internal-only app; CUID has no benefit without distributed systems |

**Installation:**
```bash
npm install prisma@^6.19.2 @prisma/client@^6.19.2 dotenv
```

---

## Architecture Patterns

### Recommended Project Structure

```
grain-tickets/
├── prisma/
│   ├── schema.prisma        # All v2.0 models
│   └── migrations/          # Auto-generated by prisma migrate dev
├── lib/
│   └── db.js                # PrismaClient singleton
├── .env                     # DATABASE_URL (gitignored)
├── server.js                # Unchanged - still uses JSON store
└── data/
    └── data.json            # Unchanged - still active
```

### Pattern 1: CommonJS PrismaClient Singleton

**What:** A module that creates one PrismaClient instance per process (or per hot-reload cycle in dev). Prevents "too many database connections" from multiple `new PrismaClient()` calls.

**When to use:** Always — this is the db.js module every other server.js module will require.

**Example:**
```javascript
// grain-tickets/lib/db.js
// Source: betterstack.com/community/guides/scaling-nodejs/prisma-orm (verified)
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;
```

Note: The `global.prisma` guard is standard for development environments with hot-reload (nodemon). In production a single process runs and the guard is not needed. This pattern matches what organic-cert does in TypeScript:
```typescript
// organic-cert/src/lib/prisma.ts (reference — TS version)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Pattern 2: Schema Generator Block for CommonJS

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

The `prisma-client-js` generator produces output into `node_modules/@prisma/client` using CommonJS format by default. No `moduleFormat` option needed. After running `npx prisma generate` (or `npx prisma migrate dev`), `require('@prisma/client')` works.

### Pattern 3: prisma.config.ts — NOT NEEDED for this app

The organic-cert app has a `prisma.config.ts` because it's a TypeScript/Next.js project that needs to specify migration seed commands. For grain-tickets (plain CommonJS), `prisma.config.ts` is optional. The schema at `prisma/schema.prisma` and `.env` at root are found automatically by Prisma CLI. **Skip prisma.config.ts for grain-tickets.**

### Anti-Patterns to Avoid

- **Creating multiple PrismaClient instances:** Each `new PrismaClient()` opens a connection pool. Only one instance should exist per process. Use the singleton in `lib/db.js`.
- **Putting `@unique` on `ticketNo`:** 14 confirmed duplicates in existing data. Migration in Phase 10 would fail. Use `@@index([ticketNo])` instead.
- **Using the `glomalin` database:** That database is organic-cert's. Create a separate `grain_tickets` database to isolate concerns and avoid accidental schema collisions.
- **Adding `prisma.$connect()` in db.js:** PrismaClient connects lazily on first query. Calling `$connect()` explicitly is not necessary and adds startup latency.
- **Changing any existing routes in Phase 9:** Phase 9 is schema-only. The JSON store stays active. No routes change until Phase 10.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database migrations | Custom SQL migration scripts | `npx prisma migrate dev` | Handles migration history, rollback tracking, generates client automatically |
| Schema visualization | Console query scripts | `npx prisma studio` | Built-in visual browser at localhost:5555, zero config |
| Connection pooling | Manual pool management | PrismaClient default pool | Prisma manages connections per its internal connection pool |
| Type-safe queries | Raw SQL strings | Prisma Client query API | Even without TypeScript, Prisma Client auto-completes model names from generated code |

**Key insight:** Prisma's migration history (in `prisma/migrations/`) is the paper trail for schema evolution. Running raw SQL directly bypasses this and makes Phase 10 migration harder to verify.

---

## Common Pitfalls

### Pitfall 1: dotenv not loaded before PrismaClient instantiation

**What goes wrong:** `Error: Environment variable not found: DATABASE_URL.` when starting the server, even though `.env` exists.

**Why it happens:** The grain-tickets `server.js` doesn't call `require('dotenv/config')` at startup. PrismaClient reads `DATABASE_URL` when instantiated. If the env var isn't loaded yet, it throws.

**How to avoid:** Add `require('dotenv/config')` at the very top of `lib/db.js` (before `require('@prisma/client')`). This ensures it loads regardless of which file requires db.js first.

**Warning signs:** Works when `DATABASE_URL` is exported in shell but fails on clean start.

### Pitfall 2: Running prisma migrate dev in wrong directory

**What goes wrong:** `Error: Could not find a schema.prisma file` or migrations applied to wrong database.

**Why it happens:** Prisma CLI looks for `prisma/schema.prisma` relative to the current working directory. If run from project root instead of `grain-tickets/`, it won't find the schema.

**How to avoid:** Always run `cd grain-tickets && npx prisma migrate dev` or set `package.json` scripts inside the `grain-tickets/` directory.

**Warning signs:** `schema.prisma` file not found error, or studio connects to wrong database.

### Pitfall 3: @unique on ticketNo causes migration data load failure

**What goes wrong:** Phase 10 migration INSERT fails for any of the 14 duplicate ticket numbers.

**Why it happens:** 14 ticket number duplicates are confirmed in data.json. If schema uses `@unique`, the migration script can't insert them.

**How to avoid:** Use `@@index([ticketNo])` in the schema, never `@unique`. Phase 10 migration script handles duplicates by flagging them (separate concern).

**Warning signs:** Any schema definition with `ticketNo String @unique`.

### Pitfall 4: Forgetting to run npx prisma generate after schema changes

**What goes wrong:** `PrismaClientKnownRequestError: Unknown field 'hbtBinNo'` or similar at runtime, even though schema defines the field.

**Why it happens:** The generated Prisma Client in `node_modules/@prisma/client` is stale — doesn't reflect latest schema.

**How to avoid:** `npx prisma migrate dev` automatically runs `generate` after migration. But if you edit schema without migrating (shouldn't happen in normal workflow), run `npx prisma generate` manually.

**Warning signs:** Runtime errors about unknown fields that are clearly in schema.prisma.

### Pitfall 5: Decimal vs Float for financial/weight fields

**What goes wrong:** Float arithmetic rounding errors accumulate in weight and price calculations (e.g., `55480.1` stored as `55480.099999...`).

**Why it happens:** Prisma `Float` maps to PostgreSQL `double precision` which has IEEE 754 floating point rounding. `Decimal` maps to PostgreSQL `numeric` which is exact.

**How to avoid:** Use `Float` for moisture/fm percentages and weights (agronomic values where 2 decimal places suffice). Use `Decimal` for prices, net payments, and any monetary value in Settlement and Reconciliation models. The existing tickets use Float for netWeight — match that for the Ticket model to preserve calc.js compatibility.

**Warning signs:** Settlement totals that are off by fractions of a cent when summing many rows.

---

## Code Examples

Verified patterns from official sources and the existing organic-cert codebase:

### Schema Skeleton for v2.0 Full Scope

```prisma
// Source: official Prisma docs + organic-cert pattern
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Ticket {
  id          Int      @id @default(autoincrement())
  legacyId    String?  // preserve "t_000001" string IDs from JSON for Phase 10 matching
  date        DateTime
  cropYear    Int      // 2025, 2026 — derived from date during migration
  farm        String   // farm name (string, matched to Farm.name)
  netWeight   Float    // lbs
  moisture    Float    // %
  fm          Float    @default(0) // foreign matter %
  crop        String   // crop name (matched to CropConfig.cropName)
  ticketNo    String?  // NOT unique — 14 duplicates exist
  hbtBinNo    String?  // extracted from notes field
  truckId     String?  // extracted from notes field
  notes       String?  // preserved original notes text
  buyerId     Int?     // FK to Buyer — null until Phase 11
  buyer       Buyer?   @relation(fields: [buyerId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  settlementLines SettlementLine[] // matched in Phase 13

  @@index([ticketNo])         // non-unique — see pitfall above
  @@index([farm, cropYear])   // farm summary queries
  @@index([crop, cropYear])   // crop summary queries
  @@index([buyerId])          // buyer filter queries (Phase 11)
}

model Farm {
  id             Int      @id @default(autoincrement())
  registryId     String?  // farm-registry field ID for future sync
  name           String   @unique  // "Airport", "Schultz", etc.
  reportingAcres Float    @default(0)
  organicAcres   Float    @default(0)
  notes          String?
  syncedAt       DateTime? // last sync from farm-registry
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model CropConfig {
  id             Int      @id @default(autoincrement())
  cropYear       Int      // 2025, 2026, etc.
  cropName       String   // "Hybrid Rye", "Organic Yellow Corn"
  testWeight     Float    @default(56) // lbs/bu
  moistureShrink Float    @default(0)  // %
  discount       Float    @default(0)  // %
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([cropYear, cropName])
  @@index([cropYear])
}

model Buyer {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  shortCode   String?  // "MRM", "ADM", "COOP" for display
  type        String?  // "elevator", "maltster", "co-op"
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tickets     Ticket[]
  settlements Settlement[]
  columnMaps  BuyerColumnMap[]
}

model BuyerColumnMap {
  id        Int      @id @default(autoincrement())
  buyerId   Int
  buyer     Buyer    @relation(fields: [buyerId], references: [id])
  fieldName String   // "ticketNo", "netWeight", "moisture", etc.
  csvColumn String   // column name or index from buyer's settlement file
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([buyerId, fieldName])
}

model Settlement {
  id          Int      @id @default(autoincrement())
  buyerId     Int
  buyer       Buyer    @relation(fields: [buyerId], references: [id])
  cropYear    Int
  importedAt  DateTime @default(now())
  sourceFile  String?  // original filename
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  lines       SettlementLine[]

  @@index([buyerId, cropYear])
}

model SettlementLine {
  id            Int        @id @default(autoincrement())
  settlementId  Int
  settlement    Settlement @relation(fields: [settlementId], references: [id])
  ticketNo      String?    // from buyer's file — may not match exactly
  date          DateTime?
  netWeight     Float?     // lbs — buyer's reported weight
  moisture      Float?
  netBushels    Float?
  price         Decimal?   @db.Decimal(10, 4)  // $/bu — use Decimal for money
  deductions    Decimal?   @db.Decimal(10, 2)
  netPayment    Decimal?   @db.Decimal(10, 2)
  ticketId      Int?       // FK to Ticket after reconciliation match
  ticket        Ticket?    @relation(fields: [ticketId], references: [id])
  matchStatus   String     @default("unmatched") // "unmatched"|"matched"|"disputed"|"manual"
  notes         String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@index([settlementId])
  @@index([ticketNo])
  @@index([ticketId])
}
```

> Note on the Reconciliation model: The CONTEXT.md says define Ticket, Farm, CropConfig, Buyer, Settlement, SettlementLine, Reconciliation. Reconciliation status is captured inline on `SettlementLine.matchStatus` rather than as a separate table. If a separate Reconciliation model is needed for Phase 13, it can be added in a new migration then. Keep Phase 9 schema lean: only models that Phase 10-11 will immediately populate.

### DATABASE_URL Format

```bash
# grain-tickets/.env
DATABASE_URL="postgresql://glomalinguild@localhost:5432/grain_tickets?schema=public"
```

The existing organic-cert `.env` uses `postgresql://glomalinguild@localhost:5432/glomalin?schema=public`. Same user (`glomalinguild`), different database name (`grain_tickets`). No password because local macOS PostgreSQL installs typically use peer/trust auth for the current user.

### Verify Connection

```javascript
// One-shot connection test (don't leave in production code)
const prisma = require('./lib/db');
prisma.$connect()
  .then(() => console.log('DB connected'))
  .catch(err => console.error('DB connection failed:', err))
  .finally(() => prisma.$disconnect());
```

### Prisma Studio Launch

```bash
cd grain-tickets && npx prisma studio
# Opens at http://localhost:5555
# Run on a different port to avoid conflict with grain-tickets (3000) or organic-cert studio
npx prisma studio --port 5556
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| prisma-client-js generator (output in node_modules) | New `prisma-client` generator (output in src/) | Prisma 6.6.0 (April 2025) | New generator is TypeScript-only. `prisma-client-js` still works in Prisma 6, deprecated path in Prisma 7 |
| Driver included in Prisma engine (Rust) | Optional driver adapters (@prisma/adapter-pg) | Prisma 6+ | In Prisma 6, old Rust engine still default; adapters optional. Prisma 7 requires adapters |
| Single monolithic schema.prisma | Multi-file schema support | Prisma 6.7.0 | GA in 6.7, allows splitting large schemas into multiple files — not needed for this scope |

**Deprecated/outdated:**
- `prisma.config.ts` is new in Prisma 6 for Next.js/TypeScript apps — not needed for plain CommonJS Express app. The organic-cert uses it; grain-tickets should not (no TypeScript, no seed script needed in Phase 9).

---

## Open Questions

1. **Database name: `grain_tickets` vs `grain-tickets` vs `hughes_grain`**
   - What we know: PostgreSQL identifiers with hyphens require quoting; underscores are convention
   - What's unclear: User preference for database naming
   - Recommendation: Use `grain_tickets` (underscore, matches convention)

2. **Int autoincrement IDs vs preserving string legacy IDs**
   - What we know: Existing tickets have sequential string IDs like `t_000001`, `t_000002`; existing farms have `f_001`, `f_002`. These IDs are referenced in the JSON store only — no external integrations depend on them.
   - What's unclear: Whether any client-side UI code hard-codes ID format assumptions
   - Recommendation: Use `Int @id @default(autoincrement())` for clean PostgreSQL design + a `legacyId String?` column on Ticket and Farm to preserve the string ID for Phase 10 migration matching. Phase 10 can populate legacyId during INSERT, then client code is updated to use Int IDs.

3. **cropYear derivation for existing tickets**
   - What we know: All 527 existing tickets have a `date` field (2025 or 2026). There is no explicit `cropYear` field in data.json. The 2026-dated ticket (`t_000480`) is a data entry artifact — date is `2026-09-26` which is likely a typo for 2025.
   - What's unclear: Whether all 2025 dates should be cropYear=2025, or if grain season spans into calendar year 2026 (e.g., rye harvest in winter wheat cycle)
   - Recommendation: For Phase 9 schema only, define `cropYear Int` on Ticket. Phase 10 migration script derives it from `YEAR(date)` and can special-case obvious outliers. Leave the derivation logic to Phase 10.

---

## Sources

### Primary (HIGH confidence)
- Official Prisma docs — quickstart for Node.js + PostgreSQL: https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/relational-databases-node-postgresql
- Official Prisma docs — schema models reference: https://www.prisma.io/docs/orm/prisma-schema/data-model/models
- Official Prisma docs — prisma.config.ts reference: https://www.prisma.io/docs/orm/reference/prisma-config-reference
- organic-cert/prisma/schema.prisma — existing schema in same repo (same Prisma version 6.19.2)
- organic-cert/src/lib/prisma.ts — existing TypeScript singleton pattern
- organic-cert/prisma/seed.js — confirms `require('@prisma/client')` CommonJS pattern works in Prisma 6.19.2
- grain-tickets/data/data.json — analyzed 527 tickets for schema design (IDs, duplicates, notes patterns)

### Secondary (MEDIUM confidence)
- BetterStack Prisma ORM guide: https://betterstack.com/community/guides/scaling-nodejs/prisma-orm/ — CommonJS singleton db.js pattern verified against official docs
- Prisma GitHub Discussion #27596 — vanilla JS support status in Prisma 6 confirmed: `prisma-client-js` generator still works, eventual deprecation path in later versions

### Tertiary (LOW confidence)
- WebSearch result: Prisma 7 requires driver adapters (not Prisma 6). Not yet independently verified against Prisma 7 release notes, but consistent across multiple sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — organic-cert running same version, CommonJS require confirmed in seed.js
- Architecture: HIGH — Prisma docs + existing codebase patterns provide direct reference
- Schema design: MEDIUM-HIGH — v2.0 data model extrapolated from requirements + data analysis; exact field names at planner's discretion
- Pitfalls: HIGH — ticketNo uniqueness trap verified against actual data (14 duplicates confirmed), dotenv issue verified against project structure

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (Prisma 6.x is stable; valid until Prisma 7 GA changes the landscape)
