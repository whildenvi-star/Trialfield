# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Runner:**
- No test runner currently configured (Jest, Vitest, or similar)
- Tests only found in node_modules (e.g., Zod's internal tests)
- **Project currently has 0 test files in `src/`**

**Assertion Library:**
- Not detected (no Jest, Vitest, Mocha, or similar)

**Run Commands:**
```bash
npm run lint              # Only linting command available (ESLint)
npm run dev              # Development server (port 3004)
npm run build            # TypeScript build
npm run start            # Production server
```

**Status:** Testing infrastructure not yet implemented. This is a gap for future enhancement.

## Test File Organization

**Current state:**
- No test files co-located with source code
- No `__tests__` directories
- No `.test.ts` or `.spec.ts` files in `src/`

**Recommended structure (when implemented):**
```
src/lib/
├── fieldops-sync.ts
└── fieldops-sync.test.ts      # Co-located test

src/components/ui/
├── card.tsx
└── card.test.tsx              # Co-located test
```

**Naming convention (recommended):**
- `[module].test.ts` for unit tests
- `[module].integration.test.ts` for integration tests
- Test names should start with test function name: `test("fieldOpsSync handles 3-year lookback")`

## Test Structure

**Recommended pattern (not yet implemented):**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runFieldOpsSync } from "@/lib/fieldops-sync";
import { prisma } from "@/lib/prisma";

describe("fieldops-sync", () => {
  let testFarmId: string;

  beforeEach(async () => {
    // Setup: create test farm, clear staging tables
    testFarmId = "test-farm-" + Date.now();
  });

  afterEach(async () => {
    // Cleanup: remove test data
    await prisma.fieldOpsSyncState.deleteMany({ where: { farmId: testFarmId } });
  });

  it("should stage applications from 3-year lookback", async () => {
    // Arrange
    await setupTestFieldMapping(testFarmId);

    // Act
    const result = await runFieldOpsSync(testFarmId);

    // Expect
    expect(result.status).toBe("success");
    expect(result.operationsStaged).toBeGreaterThan(0);
  });

  it("should skip already-approved operations on re-sync", async () => {
    // Arrange: approve an operation first
    // Act: run sync again
    // Expect: operationsSkipped should increment
  });
});
```

**Patterns to follow:**
- `describe()` wraps related tests
- `beforeEach()` / `afterEach()` for setup/teardown
- Arrange-Act-Assert (AAA) structure in test bodies
- Use descriptive test names starting with verbs: "should stage", "should skip", "should validate"

## Mocking

**Framework (recommended):**
- Vitest `vi.mock()` or Jest `jest.mock()`
- Mock patterns similar to existing patterns in codebase

**Patterns for this codebase:**

Mock external API:
```typescript
vi.mock("@/lib/fieldops-client", () => ({
  validateConnection: vi.fn().mockResolvedValue({
    linkedAccountWarning: false,
    fieldCount: 3
  }),
  getApplications: vi.fn().mockResolvedValue([
    { id: "app-1", fieldId: "field-1", type: "FERTILIZER" }
  ]),
}));
```

Mock Prisma:
```typescript
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fieldOpsSyncState: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    caseIHFieldMapping: {
      findMany: vi.fn().mockResolvedValue([
        { caseIHFieldId: "cih-1", organicCertFieldId: "oc-field-1" }
      ]),
    },
  },
}));
```

Mock Next.js API:
```typescript
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: () => data,
      status: options?.status
    })),
  },
}));
```

**What to Mock:**
- External APIs (Case IH FieldOps, CNH Industrial)
- Database calls (Prisma operations)
- Next.js framework internals (NextResponse, NextRequest)
- Auth/session functions

**What NOT to Mock:**
- Pure utility functions (`cn()`, `abbreviateCrop()`)
- Zod validation schemas (test with real schemas)
- Type definitions and constants
- Error handling logic (test error paths with real errors)

## Fixtures and Factories

**Test data pattern (recommended):**

```typescript
// fixtures/fieldOpsData.ts
export const mockFieldOpsApplication = {
  id: "app-123",
  fieldId: "field-abc",
  fieldName: "North 40",
  type: "HERBICIDE",
  date: "2025-05-15",
  products: [
    { name: "Roundup", rate: 1.5, unit: "qt/ac" }
  ],
  acres: 40,
  season: "2025",
};

export const mockFieldMapping = {
  caseIHFieldId: "cih-field-1",
  organicCertFieldId: "oc-field-1",
  farmId: "farm-1",
};

// Usage in tests:
it("should normalize applications", () => {
  const result = normalizeApplications([mockFieldOpsApplication], {}, {}, "farm-1", "sync-1");
  expect(result.staged.length).toBe(1);
});
```

**Location:**
- `src/__tests__/fixtures/` for shared test data
- Per-module fixtures in `src/lib/__fixtures__/` if module-specific

## Coverage

**Requirements:**
- Not enforced (no coverage config present)

**Recommended targets (when testing added):**
- Core business logic: 80%+ coverage
- API routes: 70%+ coverage
- Utility functions: 90%+ coverage
- UI components: 50%+ coverage

**View Coverage (when configured):**
```bash
npm run test -- --coverage    # If Vitest configured
npm run test:coverage         # If Jest configured
```

## Test Types

**Unit Tests:**
- Scope: individual functions in isolation
- Example: test `normalizeApplications()` with mocked Zod validation
- Approach: mock all external dependencies, test logic only
- Files: `src/lib/[module].test.ts`

**Integration Tests:**
- Scope: multiple modules working together
- Example: full `runFieldOpsSync()` with mocked API but real database transaction
- Approach: mock external APIs, use real Prisma client (or test database)
- Files: `src/lib/[module].integration.test.ts`

**E2E Tests:**
- Framework: Not used currently
- Would test: full workflows from UI through API to database
- Could use: Playwright, Cypress, or similar
- Example: "User navigates to field-enterprises page, creates new enterprise, verifies in database"

## Common Patterns

**Async Testing:**

```typescript
it("should load dashboard data", async () => {
  const result = await loadData();
  expect(result.stats.fields).toBeGreaterThan(0);
});

// With timeout for slow operations
it("should sync fieldops data", async () => {
  const result = await runFieldOpsSync(farmId);
  expect(result.status).toBe("success");
}, { timeout: 10000 }); // 10 second timeout
```

**Error Testing:**

```typescript
it("should handle API connection failure gracefully", async () => {
  vi.mocked(validateConnection).mockRejectedValueOnce(
    new Error("OAuth token expired")
  );

  const result = await runFieldOpsSync(farmId);

  expect(result.status).toBe("error");
  expect(result.warnings).toContain(/OAuth token expired/);
  expect(result.syncRunId).toBeDefined();
});

it("should reject invalid field enterprise data", async () => {
  const response = await POST(
    new Request("http://localhost/api/field-enterprises", {
      method: "POST",
      body: JSON.stringify({ fieldId: "f1" }), // missing required fields
    })
  );

  expect(response.status).toBe(400);
  const body = await response.json();
  expect(body.error).toContain("Missing required fields");
});
```

**Prisma Testing:**

```typescript
it("should create enterprise with auto-generated lot number", async () => {
  const field = await prisma.field.create({
    data: { name: "Field A", farmId, totalAcres: 100 }
  });

  const result = await POST(
    new Request("...", {
      body: JSON.stringify({
        fieldId: field.id,
        cropYear: 2025,
        crop: "CORN",
        plantedAcres: 50,
      }),
    })
  );

  const data = await result.json();
  expect(data.lotNumber).toMatch(/2025-CORN-FIELDA/);
});
```

## Recommended Testing Stack (When Implemented)

**Runner:** Vitest (faster than Jest, better Next.js support)
**Config:** `vitest.config.ts` at root
**Assertion Library:** Vitest built-in expect
**Mocking:** Vitest `vi.mock()` + `@testing-library/react` for components
**Test DB:** Separate PostgreSQL instance or in-memory for isolated tests
**CI/CD:** Run tests on PR before merge

---

*Testing analysis: 2026-02-25*
