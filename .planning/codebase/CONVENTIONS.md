# Coding Conventions

**Analysis Date:** 2026-02-23

## Naming Patterns

**Files:**
- Page components: `page.tsx` in route directories (`src/app/(app)/dashboard/page.tsx`)
- API routes: `route.ts` in API directories (`src/app/api/fields/route.ts`)
- Components: PascalCase with `.tsx` extension (`src/components/layout/sidebar.tsx`, `Sidebar.tsx`)
- Utility/library files: camelCase with `.ts` extension (`src/lib/utils.ts`, `src/lib/auth.ts`)
- Hooks: placed in `src/hooks/` directory (currently empty but convention established)
- Types/Interfaces: defined inline in files or in `src/types/` directory (`src/types/next-auth.d.ts`)

**Functions:**
- Components: PascalCase (`DashboardPage`, `Sidebar`, `StatCard`)
- Utility functions: camelCase (`cn`, `hasPermission`, `canWrite`, `loadData`, `fmtDate`)
- Async functions named with clear intent (`loadData`, `authorize`, `logAudit`)
- Helper functions: camelCase, often prefixed with verb (`fmtDate`, `fmtDateFull`)

**Variables:**
- State variables: camelCase (`enterprises`, `cropYear`, `loading`, `statusColor`)
- Constants (objects): camelCase (`statusOptions`, `navItems`, `actionColor`)
- Configuration objects: camelCase with clear naming (`opTypeConfig`, `fertTypeConfig`, `statusColor`)
- Destructured imports commonly use PascalCase for components

**Types:**
- Interfaces: PascalCase, often suffixed with context (`FieldEnterprise`, `SeedUsageRecord`, `MaterialUsageRecord`)
- Type definitions: PascalCase
- Enum-like objects use SCREAMING_SNAKE_CASE for values (`ORGANIC`, `TRANSITIONAL`, `CONVENTIONAL`, `CROP_YEAR`)

## Code Style

**Formatting:**
- No explicit Prettier or linting config found in project root, relying on Next.js defaults
- 2-space indentation (inferred from code)
- Semicolons required at end of statements
- Double quotes preferred (inferred from code)
- Single-line imports grouped by source

**Linting:**
- ESLint configured via `eslint.config.mjs` in `organic-cert/`
- Config extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Global ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`
- Disables specific TypeScript rules with inline comments: `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- Pattern: Using `as any` casts for NextAuth session/token type issues (see `src/lib/auth.ts` lines 44-45)

## Import Organization

**Order (observed pattern):**
1. React and Next.js imports (`import { useEffect, useState } from "react"`, `import Link from "next/link"`)
2. Component imports (`import { Card, CardContent } from "@/components/ui/card"`)
3. Icons and third-party UI (`import { Sprout, Plus } from "lucide-react"`, `import { toast } from "sonner"`)
4. Utilities and internal helpers (`import { cn } from "@/lib/utils"`)
5. Types and interfaces (defined inline in most files)

**Path Aliases:**
- `@/*` resolves to `./src/*` (configured in `tsconfig.json`)
- Consistently used across all imports: `@/lib/auth`, `@/components/ui/card`, `@/lib/utils`

## Error Handling

**Patterns:**
- Try-catch blocks for async operations, especially in API routes (see `src/app/api/fields/route.ts` lines 6-23)
- Error messages sent as JSON responses: `NextResponse.json({ error: "message" }, { status: 500 })`
- Conditional error handling: `error instanceof Error ? error.message : "default message"`
- Client-side: `.catch(() => {})` pattern (see `src/app/(app)/admin/page.tsx` line 25) - silently catches errors
- Console error logging for debugging: `console.error("Failed to load dashboard data", err)` (see `src/app/(app)/dashboard/page.tsx` line 93)
- Toast notifications for user feedback: `toast` from "sonner" library used in client components

**Server vs Client:**
- Server components (API routes): throw errors and return proper HTTP status codes
- Client components: catch errors silently or log to console; use toast for user-facing feedback

## Logging

**Framework:** No dedicated logging library used; relies on `console.error()` for errors

**Patterns:**
- Error logging: `console.error("context message", error)`
- Audit logging: dedicated `logAudit()` function in `src/lib/audit-logger.ts`
- Audit logs capture: action type, entity type, entity ID, user info, old/new data
- Example: `src/app/api/fields/route.ts` logs CREATE operations with full entity data

## Comments

**When to Comment:**
- Section headers using ASCII box patterns: `// ─── Types ──────────────────────────────────────────────`
- Linting rule suppressions: `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
- Function purposes documented in API route comments: `// GET /api/fields — list all fields`

**JSDoc/TSDoc:**
- Not observed in codebase; types are preferred via TypeScript interfaces and inline type annotations
- Parameter types defined inline in function signatures rather than JSDoc blocks

## Function Design

**Size:** Large files observed (1429 lines in `src/app/(app)/field-enterprises/[id]/page.tsx`), but functions remain focused within components
- Page components tend to be large due to form handling and UI rendering
- Utility functions kept small and single-purpose (`cn()` is 5 lines)

**Parameters:**
- Destructured parameters preferred for objects (see `AppLayout` in `src/app/(app)/layout.tsx`)
- Inline type annotations for parameters using TypeScript
- Props typed with explicit interfaces: `{ children: React.ReactNode }`, `{ icon: React.ComponentType<...>; label: string; ... }`

**Return Values:**
- Components return JSX elements or React.ReactNode
- API handlers return NextResponse objects with proper status codes
- Utility functions return simple types (strings, booleans, objects)
- Functions explicitly typed with return types: `async function loadData(): Promise<void>`

## Module Design

**Exports:**
- Default exports for page components: `export default function DashboardPage()`
- Named exports for utilities, components, and functions: `export function cn(...)`, `export function hasPermission(...)`
- Single export per utility module (thin modules)

**Barrel Files:**
- Not used; imports reference specific component paths directly
- Example: `import { Card, CardContent } from "@/components/ui/card"` (not from a barrel index.ts)

## Type Safety

**TypeScript:**
- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- Type annotations on component props and function parameters
- Inline interfaces preferred for local data structures
- Generic types used sparingly but present (e.g., `Record<string, string>` for color maps)

**Example patterns:**
```typescript
// Interface for data structures
interface FieldEnterprise {
  id: string;
  cropYear: number;
  crop: string;
  // ...
}

// Props typing
export default function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  href: string;
}) { }

// Color/config map typing
const statusColor: Record<string, string> = { /* ... */ }
```

## Client vs Server Components

**Client Components:**
- Marked with `"use client"` directive at top of file
- Page components with state, event handlers, hooks
- Examples: `src/app/(app)/dashboard/page.tsx`, `src/components/layout/sidebar.tsx`

**Server Components:**
- API routes in `src/app/api/` directory
- Auth wrapper in `src/app/(app)/layout.tsx` (fetches session server-side)
- Direct database access via Prisma in server context

---

*Convention analysis: 2026-02-23*
