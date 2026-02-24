# Testing Patterns

**Analysis Date:** 2026-02-23

## Test Framework

**Status:** No testing framework configured

- No Jest, Vitest, or other test runners found in `package.json` files
- No test configuration files detected (`jest.config.js`, `vitest.config.ts`, etc.)
- No `.test.ts`, `.spec.ts`, or `*.test.tsx` files in project directories
- **Current State:** No automated tests in the codebase

**Recommendation:** Adding tests should follow Next.js conventions (Jest for Next.js apps)

## Test File Organization

**Current Status:** Not applicable - no tests present

**When Testing is Added:**
- Page components and forms should have tests in `__tests__` directories
- Location pattern: Co-located with component or in separate `__tests__` folder
- Example structure (recommended):
  ```
  src/app/(app)/dashboard/
  ├── page.tsx
  └── __tests__/
      └── page.test.tsx

  src/components/layout/
  ├── sidebar.tsx
  └── __tests__/
      └── sidebar.test.tsx

  src/lib/
  ├── utils.ts
  └── __tests__/
      └── utils.test.ts
  ```

## Testing Strategy (Current Code Structure)

Based on codebase analysis, when testing is implemented, these areas are critical:

**Unit Test Candidates:**
- Utility functions: `cn()` in `src/lib/utils.ts`
- Permission checking: `hasPermission()` and `canWrite()` in `src/lib/rbac.ts`
- Audit logging: `logAudit()` in `src/lib/audit-logger.ts`
- Date formatting helpers: `fmtDate()` and `fmtDateFull()` in field-enterprises page

**Integration Test Candidates:**
- API routes:
  - `src/app/api/fields/route.ts` - GET/POST field operations
  - `src/app/api/field-enterprises/route.ts` - Field enterprise CRUD
  - `src/app/api/import-plan/route.ts` - Data import operations
- Authentication flow: `src/lib/auth.ts` NextAuth configuration
- Database interactions: Prisma client integration with API routes

**Component Test Candidates:**
- Layout components: `src/components/layout/sidebar.tsx`, `src/components/layout/header.tsx`
- Page components: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/admin/page.tsx`
- Forms and dialogs with state management
- Data loading and error states

## Mocking Strategy (Future Implementation)

**Framework:** When implemented, likely Jest or Vitest with `@testing-library/react`

**What to Mock:**
- Prisma client calls (`src/lib/prisma.ts`)
- NextAuth session/auth functions (`src/lib/auth.ts`)
- Fetch API calls (for client-side data loading in pages)
- `next/navigation` hooks (`useRouter`, `usePathname`, `useParams`)
- Icon components from `lucide-react` (replace with mock icons)

**What NOT to Mock:**
- UI component libraries (radix-ui, shadcn components) - render them
- Utility functions (`cn`, date formatters) - test real implementations
- Custom hooks with business logic (when implemented)
- Tailwind CSS classes (test via class presence, not styles)

## Example Testing Patterns

**For API Routes (recommended pattern):**
```typescript
// Example test structure for src/app/api/fields/route.ts
describe("GET /api/fields", () => {
  it("should return all fields", async () => {
    // Mock Prisma
    const mockFields = [{ id: "1", name: "Field A", farmId: "farm-1" }];
    // Call route handler
    // Verify NextResponse with fields
  });

  it("should filter by farmId if provided", async () => {
    // Test with query param: ?farmId=farm-1
  });

  it("should return 500 on database error", async () => {
    // Mock Prisma to throw error
    // Verify error response
  });
});
```

**For Client Components (recommended pattern):**
```typescript
// Example test structure for src/app/(app)/dashboard/page.tsx
describe("DashboardPage", () => {
  it("should render dashboard with stats", async () => {
    // Mock useSession, fetch calls
    // Render component
    // Verify stats cards render
  });

  it("should update crop year when buttons clicked", async () => {
    // Render component
    // Click year navigation button
    // Verify data reloaded with new year
  });

  it("should show loading state while fetching", async () => {
    // Mock slow fetch
    // Render and check for loading text
  });

  it("should display error when data fetch fails", async () => {
    // Mock fetch to fail
    // Verify error handling
  });
});
```

**For Utilities (recommended pattern):**
```typescript
// Example test structure for src/lib/utils.ts
describe("cn()", () => {
  it("should merge tailwind classes correctly", () => {
    const result = cn("px-2", "px-4"); // px-4 should win
    expect(result).toContain("px-4");
    expect(result).not.toContain("px-2");
  });

  it("should handle conditional classes", () => {
    const result = cn("base", false && "hidden");
    expect(result).toContain("base");
    expect(result).not.toContain("hidden");
  });
});

describe("hasPermission()", () => {
  it("should grant admin all permissions", () => {
    expect(hasPermission("ADMIN", "farm:write")).toBe(true);
  });

  it("should deny crew write permissions", () => {
    expect(hasPermission("CREW", "farm:write")).toBe(false);
  });

  it("should handle unknown permissions gracefully", () => {
    expect(hasPermission("ADMIN", "nonexistent:permission")).toBe(false);
  });
});
```

## Error Handling in Tests

**Current Code Patterns to Test:**
- API routes return `NextResponse.json({ error: "message" }, { status: 500 })` on error
- Client components use `console.error()` for logging and `.catch(() => {})` for silent failures
- Form submissions use `toast()` for user feedback

**Test Coverage for Error Scenarios:**
```typescript
// API error handling
test("API route returns proper error structure", async () => {
  // Verify error response contains { error: string }
  // Verify correct status code
});

// Client error handling
test("Component shows error state when fetch fails", async () => {
  // Mock fetch to reject
  // Verify error message or fallback UI
});

// Toast notifications
test("Component calls toast on operation", async () => {
  // Mock sonner toast
  // Trigger action
  // Verify toast called with correct message
});
```

## Data Fixtures (for testing)

**Current Code Uses:**
- Mock data structures defined in tests should match interfaces from pages:
  - `FieldEnterprise` with fields: `id`, `cropYear`, `crop`, `variety`, `plantedAcres`, `organicStatus`, `locked`, `field`
  - `Field` with fields: `id`, `name`, `totalAcres`, `organicStatus`
  - `SeedUsageRecord`, `MaterialUsageRecord`, `FertilityRecord`, `OperationRecord`, `HarvestRecord`

**Fixture Location (recommended):**
- Create `src/__fixtures__/` or `src/__mocks__/` directory
- Export reusable test data factories:
  ```typescript
  // src/__fixtures__/enterprises.ts
  export const mockFieldEnterprise = (overrides = {}): FieldEnterprise => ({
    id: "ent-1",
    cropYear: 2026,
    crop: "Corn",
    variety: "Golden",
    plantedAcres: 40,
    organicStatus: "ORGANIC",
    locked: false,
    field: { id: "f-1", name: "North Field", totalAcres: 80 },
    ...overrides,
  });
  ```

## Coverage Goals

**Current Status:** No coverage metrics in place

**Recommended Targets:**
- **Utilities:** 100% coverage (small, pure functions)
- **API routes:** 80%+ coverage (test happy path and error cases)
- **Page components:** 60%+ coverage (test critical user flows and states)
- **Helpers/Config:** 90%+ coverage (permission checks, formatters)

**View Coverage (when Jest is configured):**
```bash
npm test -- --coverage
```

## Test Types in Codebase (Future Implementation)

**Unit Tests:**
- Focus: Individual functions in `src/lib/` (utils, auth, rbac, audit-logger)
- Scope: Pure functions that transform data
- Framework: Jest with simple assertions
- Example: `cn()` function, permission checks, date formatters

**Integration Tests:**
- Focus: API routes that interact with Prisma and business logic
- Scope: Request → Database → Response cycle
- Framework: Jest with mocked Prisma
- Example: POST `/api/fields` creates field and logs audit entry

**Component/E2E Tests:**
- Focus: Page components with user interactions
- Scope: Data loading, form submission, state changes
- Framework: Jest + React Testing Library or Vitest + @testing-library/react
- Example: User fills form, submits, sees success toast
- Current status: Would benefit from end-to-end testing for critical flows like:
  - Field enterprise creation and audit locking
  - Multi-tab form handling (seeds, materials, operations)
  - Data import and year filtering

## Async Testing (for implementation)

**Current patterns in code:**
- API routes use async/await with try-catch
- Client components use `useState` and `useEffect` for async operations
- No Promise.all usage detected (except in dashboard data loading)

**Testing async patterns:**
```typescript
// For API routes with async handlers
test("async API route handling", async () => {
  const response = await GET(mockRequest);
  expect(response.status).toBe(200);
});

// For client useEffect
test("component loads data on mount", async () => {
  render(<DashboardPage />);
  await waitFor(() => {
    expect(screen.getByText("Field Enterprises")).toBeInTheDocument();
  });
});

// For Promise.all in dashboard
test("dashboard loads all data concurrently", async () => {
  // Verify Promise.all was called with 5 fetches
  // Verify state updated once all resolved
});
```

---

*Testing analysis: 2026-02-23*

**Note:** Automated testing infrastructure is not currently in place. This document serves as a guide for implementing tests aligned with existing code patterns and Next.js best practices.
