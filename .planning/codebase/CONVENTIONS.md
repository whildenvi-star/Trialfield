# Coding Conventions

**Analysis Date:** 2026-02-25

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `dashboard/page.tsx`, `FieldEnterpriseForm.tsx`)
- Utility/service files: kebab-case (e.g., `fieldops-sync.ts`, `audit-logger.ts`)
- API routes: kebab-case directories with `route.ts` (e.g., `src/app/api/field-enterprises/route.ts`)
- Types/interfaces: PascalCase in `src/types/` directory

**Functions:**
- camelCase for all functions, including React components (exported as named functions)
- Async functions use `async` keyword consistently
- Helper functions prefixed with verb (e.g., `loadData()`, `validateConnection()`, `normalizeApplications()`)
- Private/internal functions sometimes include underscore prefix for clarity (e.g., `_normalizeField()`)

**Variables:**
- camelCase for all variable declarations
- Constants in camelCase (NOT UPPER_CASE) except Prisma enums
- State hooks: `[value, setValue]` pattern (e.g., `const [loading, setLoading] = useState(true)`)
- Loop counters: `i`, `e` for `enterprises`, etc. in short contexts

**Types:**
- PascalCase for interface/type names (e.g., `FieldEnterprise`, `SyncResult`, `AuditLogInput`)
- Suffix interfaces with descriptive names (e.g., `SyncedOperationInput`, `FieldMappingLookup`)
- Prisma-generated types imported directly from `@prisma/client`

## Code Style

**Formatting:**
- No explicit Prettier config file (uses Next.js defaults)
- 2-space indentation (inferred from codebase)
- Line length not strictly limited but generally under 100 characters
- Single quotes not enforced (uses double quotes in imports/strings)

**Linting:**
- ESLint 9 with `eslint-config-next` (core-web-vitals + typescript)
- Config: `src/root/eslint.config.mjs` (flat config format)
- Run: `npm run lint` (executes `eslint`)
- Global ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`
- Generated Prisma files have `/* eslint-disable */` at top

**Rules enforced:**
- `@typescript-eslint/no-explicit-any` — any types must be intentionally disabled with comment
- React hooks rules (from eslint-config-next)
- Next.js specific warnings (images, scripts, links)
- No unused variables or imports

## Import Organization

**Order:**
1. External packages (`next/*`, `react/*`, `@prisma/client`)
2. Internal absolute imports using `@/` alias (e.g., `@/lib/prisma`, `@/components/ui/card`)
3. Relative imports (used sparingly, typically not in this codebase)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Used throughout: `@/lib/prisma`, `@/components/ui/card`, `@/app/api`

**Import patterns:**
- Named imports preferred: `import { prisma } from "@/lib/prisma"`
- Namespace imports for large modules: `import * as React from "react"`
- Type imports: `import type { FieldEnterprise } from "@/types"`

## Error Handling

**Patterns:**
- `try-catch` blocks in async functions, server routes, and Prisma operations
- Error detection: `err instanceof Error ? err.message : String(err)` (defensive pattern)
- Prisma `.findUnique()` returns `null` if not found (not an error)
- `.catch()` chaining for text parsing: `.text().catch(() => "")`
- Errors logged to console in client components: `console.error("Failed to load dashboard data", err)`
- API routes return `NextResponse.json({ error: message }, { status: 500 })`
- No custom error classes (uses built-in Error)

**Validation:**
- Zod schemas for external API responses (e.g., `FieldOpsApplicationSchema`, `FieldOpsYieldSchema`)
- Zod `safeParse()` for defensive parsing (warnings instead of crashes)
- Manual validation in API routes: check required fields then return 400 status
- Type guards: `if (!credentials?.email || !credentials?.password) return null`

## Logging

**Framework:** Native `console` object

**Patterns:**
- `console.error()` in catch blocks: `console.error("Failed to load dashboard data", err)`
- No structured logging library (logs go to stdout)
- Audit logging via `logAudit()` function in `@/lib/audit-logger.ts`
- Audit logs write to `prisma.auditLog` table with userId, action, entityType, oldData, newData

## Comments

**When to Comment:**
- JSDoc blocks for exported functions with complex signatures
- Inline comments for non-obvious logic (e.g., "Re-sync safe: PENDING rows are updated; APPROVED/REJECTED rows are skipped")
- Section headers using `// ─── Section Name ───` pattern for large files (see `fieldops-sync.ts`)
- Defensive parsing strategy explained in module docstrings

**JSDoc/TSDoc:**
```typescript
/**
 * Run a full Case IH FieldOps sync for the given farm.
 *
 * Farm-scoped: only writes SyncedOperation rows for this farmId.
 * Re-sync safe: PENDING rows are updated; APPROVED/REJECTED rows are skipped.
 */
export async function runFieldOpsSync(farmId: string): Promise<SyncResult> {
```

- Parameters, return types, and important context documented
- Inline JSDoc used for interfaces (see `fieldops-normalizer.ts`)

## Function Design

**Size:**
- Aim for functions under 50 lines (most utility functions 10-30 lines)
- Longer orchestration functions (like `runFieldOpsSync`) structured with clear step comments
- Component functions can be longer (60+ lines) if well-organized

**Parameters:**
- Use object parameter destructuring for functions with 3+ params
- Example: `function cn(...inputs: ClassValue[])` for simple functions
- Example: API routes destructure `{ searchParams } = new URL(request.url)`

**Return Values:**
- Explicit return types in function signatures
- Async functions return `Promise<T>` (e.g., `Promise<SyncResult>`)
- API handlers return `NextResponse.json()` or typed objects
- React components return JSX elements (TSX files)

## Module Design

**Exports:**
- Named exports preferred: `export function logAudit()`, `export interface SyncResult`
- Default exports only for Next.js page components and layouts
- Barrel files: `src/components/ui/` has unified exports in each component file

**Barrel Files:**
- Not used at package level (each component re-exports from `index.tsx` or combined export)
- Example in `src/components/ui/card.tsx`: 8 named exports from one file
- Clients import: `import { Card, CardContent, CardHeader } from "@/components/ui/card"`

**Module conventions:**
- Orchestration services (like `fieldops-sync.ts`) export main function + types
- Normalizers export validation schemas + transformation functions
- Library modules export pure utilities (e.g., `utils.ts` exports `cn()` helper)

## Async Patterns

**Promise handling:**
- `async/await` preferred over `.then()` chains
- `Promise.all()` for parallel requests: `const [entRes, fieldRes, ...] = await Promise.all([...])`
- Prisma transactions: `await prisma.$transaction(async (tx) => { ... })`

## Zod Validation

**Schema definition pattern:**
```typescript
const FieldOpsProductSchema = z.object({
  name: z.string(),
  rate: z.number(),
  unit: z.string(),
});
```

**Parse/safeParse:**
- Defensive parsing with `safeParse()` for external data
- Results checked for `.success` flag before accessing `.data`
- Warnings collected for partial failures (see `fieldops-normalizer.ts`)

## Type Safety

**TypeScript settings:**
- `strict: true` in `tsconfig.json`
- `noEmit: true` (type-check only, no build output)
- `moduleResolution: "bundler"` for Next.js
- `jsx: "react-jsx"` for React 19

**Type patterns:**
- Generics used sparingly (mostly in React components like `React.ComponentProps`)
- `Record<string, T>` for maps/lookups (e.g., `const fieldMappings: FieldMappingLookup = {}`)
- Optional properties with `?`: `cropYear?: number`
- Union types for status values: `status: "PENDING" | "APPROVED" | "REJECTED"`
- Type guards before unsafe casts: `const u = user as any` with preceding guard

**Any usage:**
- Intentional `any` casts documented with `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- Typically for NextAuth token/session augmentation where types can't be extended normally

---

*Convention analysis: 2026-02-25*
