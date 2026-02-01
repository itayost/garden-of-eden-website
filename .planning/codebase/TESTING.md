# Testing Patterns

**Analysis Date:** 2026-02-01

## Test Framework

**Runner:**
- Vitest 4.0.17
- Config: `vitest.config.ts`
- Environment: jsdom (browser environment for component testing)
- Globals enabled: `globals: true` (describe, it, expect available without imports)

**Assertion Library:**
- Vitest built-in expect (Chai-compatible)
- Testing Library: `@testing-library/react` 16.3.2, `@testing-library/dom` 10.4.1
- Jest DOM matchers: `@testing-library/jest-dom` 6.9.1

**Run Commands:**
```bash
npm run test                # Run tests in watch mode
npm run test:run          # Run tests once and exit
npm run lint              # Run ESLint
```

## Test File Organization

**Location:**
- Pattern: Colocated with source code in `__tests__/` subdirectories
- Location example: `src/features/assessment-comparison/__tests__/comparison-utils.test.ts`
- Alternative: `src/features/rankings/__tests__/ranking-utils.test.ts`
- Setup file: `src/test/setup.ts`

**Naming:**
- Convention: `[module].test.ts` for unit tests
- Pattern: `comparison-utils.test.ts` for testing `comparison-utils` module
- Consistent kebab-case for test file names

**Vitest Configuration:**
```typescript
// vitest.config.ts
include: ['src/**/*.{test,spec}.{ts,tsx}']
setupFiles: ['./src/test/setup.ts']
```

## Test Structure

**Suite Organization:**
```typescript
// From comparison-utils.test.ts
describe('calculateDelta', () => {
  it('should return null when either value is null', () => {
    expect(calculateDelta(null, 5)).toBeNull();
    expect(calculateDelta(5, null)).toBeNull();
    expect(calculateDelta(null, null)).toBeNull();
  });

  it('should calculate positive delta correctly', () => {
    expect(calculateDelta(10, 15)).toBe(5);
  });
});

describe('isImprovement', () => {
  describe('for lower-is-better fields (sprint times)', () => {
    it('should return true when new value is lower (faster)', () => {
      expect(isImprovement('sprint_5m', -0.15)).toBe(true);
    });
  });
});
```

**Patterns:**
- Describe blocks: Group tests by function or behavior domain
- Nested describes: Subdivide tests by context (e.g., "for lower-is-better fields")
- Test names: Start with "should" (e.g., "should return null when either value is null")
- One assertion per test (mostly), sometimes multiple related assertions
- Setup: Inline within test (no beforeEach/afterEach observed)

## Mock Data & Factories

**Test Data:**
```typescript
// Helper factory function from ranking-utils.test.ts
function createMockAssessment(
  overrides: Partial<PlayerAssessment> & { user_id: string; assessment_date: string }
): PlayerAssessment {
  return {
    id: `assessment-${overrides.user_id}-${overrides.assessment_date}`,
    sprint_5m: null,
    sprint_10m: null,
    // ... all fields with null defaults
    created_at: new Date().toISOString(),
    ...overrides,  // Apply customizations
  };
}
```

**Location:**
- Defined inline in test file
- Named with `createMock*` pattern
- Accepts `overrides` parameter for test-specific customization

**Usage:**
```typescript
const assessment = createMockAssessment({
  user_id: "user1",
  assessment_date: "2024-02-01",
  sprint_10m: 2.3,  // Override specific field
});
```

## Fixtures and Factories

**Test Data Creation:**
- Factory functions are the pattern (not JSON fixtures)
- `createMockAssessment()` creates full PlayerAssessment objects
- Supports partial overrides with spread operator

**Example: Map-based test data (ranking-utils.test.ts):**
```typescript
const userNames = new Map([
  ["user1", "אלון כהן"],
  ["user2", "יובל לוי"],
  ["user3", "נועם דוד"],
]);

const latestAssessments = new Map([
  ["user1", createMockAssessment({ user_id: "user1", assessment_date: "2024-02-01", sprint_10m: 2.5 })],
  ["user2", createMockAssessment({ user_id: "user2", assessment_date: "2024-02-01", sprint_10m: 2.3 })],
  ["user3", createMockAssessment({ user_id: "user3", assessment_date: "2024-02-01", sprint_10m: 2.8 })],
]);
```

## Mocking

**Framework:**
- No mocking library explicitly imported (mocks not required for utility function tests)
- Vitest has built-in mocking capabilities but not used in current test suite
- Data is created with factories, not mocked

**What to Mock:**
- External API calls: Would use Vitest mocking for Supabase, HTTP requests
- DOM APIs: Not directly tested in current suite
- Date/time: Not explicitly mocked; real dates used in tests

**What NOT to Mock:**
- Pure utility functions: Tested directly with real inputs
- Type definitions: Used as-is
- Constants: Imported and used directly

## Async Testing

**Pattern:**
- Not extensively used in current test suite
- Utility functions being tested are synchronous
- When needed: Use `async/await` in test function directly

```typescript
// Example pattern (if needed):
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

## Error Testing

**Pattern:**
```typescript
// From ranking-utils.test.ts
it('should return null for empty array', () => {
  const stats = calculateGroupStatistics([]);
  expect(stats).toBeNull();
});

// From comparison-utils.test.ts
it('should return null when delta is null', () => {
  expect(isImprovement('sprint_5m', null)).toBeNull();
});
```

**Error Handling:**
- Functions return null for error/edge cases
- Tests assert null values for invalid inputs
- No exception throwing observed in utility functions
- Error messages come from separate validation logic (e.g., `validateFile` in image-upload)

## Coverage

**Requirements:**
- Not enforced (no coverage threshold specified in vitest.config.ts)
- Currently 2 test files present: `comparison-utils.test.ts`, `ranking-utils.test.ts`

**View Coverage:**
```bash
# Coverage not explicitly configured
# Would add: vitest run --coverage
```

**Current Status:**
- Test coverage is limited to specific utilities
- Main feature logic: `src/features/assessment-comparison/lib/comparison-utils.ts` - TESTED
- Main feature logic: `src/features/rankings/lib/utils/ranking-utils.ts` - TESTED
- Components: No component tests found
- Integration tests: Not found
- E2E tests: Not found

## Test Types

**Unit Tests:**
- Scope: Individual pure functions in utilities
- Approach: Test inputs and outputs, no side effects
- Examples: `calculateDelta()`, `formatDelta()`, `isImprovement()`, `compareAssessments()`
- Coverage: Math operations, conditional logic, formatting

**Integration Tests:**
- Status: Not present
- Would test: Feature workflows combining multiple utilities
- Example: Full assessment comparison flow with rankings

**E2E Tests:**
- Framework: Not used
- Current coverage: N/A

## Test Assertions

**Common Assertions:**
```typescript
// Value equality
expect(result).toBe(expected);
expect(result).toEqual(expected);  // Deep equality

// Nullability
expect(result).toBeNull();
expect(result).toBeDefined();

// Type checking
expect(result).toHaveLength(n);

// Numeric precision
expect(result).toBeCloseTo(-0.15, 2);  // 2 decimal places

// Collections
expect(map.size).toBe(2);
expect(array).toHaveLength(3);
expect(result.find(r => r.userId === "user2")).toBeUndefined();
```

## Setup Files

**Location:** `src/test/setup.ts`

**Contents:**
```typescript
import '@testing-library/jest-dom';
```

**Purpose:**
- Imports Jest DOM matchers for component testing readiness
- Minimal setup; assumes Vitest defaults are sufficient

## Test Execution Context

**Global Setup:**
- `globals: true` in vitest.config.ts
- `describe`, `it`, `expect` available without imports (convenience for tests)

**Environment:**
- jsdom: Browser-like DOM environment
- Allows DOM testing (not used in current utility tests)
- Path alias resolution: `@/*` configured in both vitest.config.ts and tsconfig.json

## Testing Conventions

**File Structure:**
```
src/features/[feature]/
├── lib/
│   ├── [module].ts
│   └── utils/
│       └── [utility].ts
└── __tests__/
    └── [module].test.ts
```

**Test Naming:**
- Describe: name of function being tested
- Nested describes: context or grouping (e.g., "for lower-is-better fields")
- Test cases: "should [expected behavior]"

**Data Setup:**
- Inline factories, not external fixtures
- Tests are self-contained and readable
- Complex scenarios: Build data incrementally in test

**Assertion Style:**
- Explicit assertions over implicit behavior
- Test one concept per test case
- Related assertions grouped logically

---

*Testing analysis: 2026-02-01*
