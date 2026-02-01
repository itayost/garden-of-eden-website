# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- Component files: PascalCase (e.g., `ImageUpload.tsx`, `LoginForm`)
- Utility/lib files: camelCase (e.g., `utils.ts`, `redirect.ts`, `uuid.ts`)
- Test files: `*.test.ts` or `*.spec.ts` with descriptive name (e.g., `comparison-utils.test.ts`, `ranking-utils.test.ts`)
- Type/interface files: Named descriptively in `src/types/` (e.g., `assessment.ts`, `database.ts`, `activity-log.ts`)
- API route files: Named by route path (e.g., `src/app/auth/callback/route.ts`)

**Functions:**
- camelCase for all function names (e.g., `calculateDelta`, `formatPhoneNumber`, `handlePhoneSubmit`)
- Descriptive verb-first names: `handle*` for event handlers, `calculate*` for computations, `format*` for transformations, `validate*` for validation
- Private/internal functions: Use camelCase same as public (no leading underscore convention observed)
- Helper functions: Prefixed descriptively (e.g., `createMockAssessment`, `isSafeUrl`)

**Variables:**
- camelCase for all variable names (e.g., `phone`, `email`, `formattedPhone`, `objectUrl`)
- Boolean variables: Prefixed with verb (e.g., `isDragging`, `isSafeUrl`, `isImprovement`)
- State variables from `useState`: camelCase with corresponding setter (e.g., `loading` and `setLoading`, `preview` and `setPreview`)
- Constants: UPPER_SNAKE_CASE for true constants (e.g., `NUMERIC_FIELDS`, `CATEGORICAL_FIELDS`, `AGE_GROUPS`)

**Types:**
- Interface names: PascalCase (e.g., `ImageUploadProps`, `PlayerAssessment`, `AssessmentDelta`, `ComparisonResult`)
- Type aliases: PascalCase (e.g., `CoordinationLevel`, `LegPowerTechnique`, `BodyStructure`)
- Generic type parameters: Single uppercase letters or descriptive PascalCase
- Exported types: Always exported with `export type` or `export interface` explicitly

## Code Style

**Formatting:**
- No explicit prettier config file found; ESLint used for linting
- Code appears to follow default Next.js formatting (2-space indentation implied by ESLint config)
- Line length: Appears to be ~80-100 characters based on code samples
- String literals: Double quotes used throughout (e.g., `"use client"`, `"aria-live"`)

**Linting:**
- ESLint with Next.js core-web-vitals and TypeScript support via `eslint.config.mjs`
- Config uses: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`
- Run: `npm run lint`

**Import Organization:**
- Order observed in files:
  1. Third-party React/Next.js imports (e.g., `"use client"`)
  2. React hooks (e.g., `useState`, `useRef`)
  3. Next.js navigation imports (e.g., `useRouter`, `useSearchParams`)
  4. Internal library imports from `@/lib` (e.g., `createClient`, `getSafeRedirectUrl`)
  5. Component imports from `@/components` (e.g., `Button`, `Card`)
  6. Icon imports (e.g., `lucide-react`)
  7. Toast/notification imports (e.g., `sonner`)
  8. Type imports (separate, using `import type`)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Usage: `import { Button } from "@/components/ui/button"`, `import { cn } from "@/lib/utils"`

## TypeScript

**Strict Mode:**
- Enabled: `strict: true` in `tsconfig.json`
- Compiler target: ES2017
- Module: esnext

**Type Exports:**
- Export types separately from implementations where appropriate
- Example: `export type PlayerAssessment` in `types/assessment.ts`
- Types used in prop interfaces (e.g., `interface ImageUploadProps { value: File | string | null }`)

**Null Handling:**
- Explicit null checks: `if (value === null)` pattern used (not `if (!value)`)
- Optional chaining: `array?.[0]`, `ref?.current?.click()`
- Nullish coalescing: Used for default values where appropriate

## Error Handling

**Patterns:**
- Try-catch blocks in async functions that interact with external services (e.g., Supabase auth)
- Error type narrowing: `error instanceof Error ? error.message : "fallback message"`
- Client-side errors: Logged with `console.error()` and displayed via `toast.error()`
- Validation errors: Returned as objects with `{ valid: boolean; error?: string }` shape

**Example from `image-upload.tsx`:**
```typescript
try {
  // operation
  if (error) {
    throw error;
  }
} catch (error: unknown) {
  console.error("Login error:", error);
  const errorMessage = error instanceof Error ? error.message : "Fallback message";
  toast.error(errorMessage);
} finally {
  setLoading(false);
}
```

## Logging

**Framework:** Native `console` object (no dedicated logging library)

**Patterns:**
- `console.error()` for error logging (e.g., `console.error("Login error:", error)`)
- No info or debug logging observed in production code
- Errors are typically surfaced to users via toast notifications (`sonner` library)

## Comments

**When to Comment:**
- JSDoc-style comments for exported functions in utility/feature files
- Inline comments for complex logic (e.g., chronological order swapping in `compareAssessments`)
- Section comments with `// ===================` pattern to organize code blocks
- Comments above functions explaining purpose and return behavior

**JSDoc Pattern:**
```typescript
/**
 * Calculates the delta (difference) between two numeric values.
 * Returns null if either value is null.
 */
export function calculateDelta(
  oldValue: number | null,
  newValue: number | null
): number | null {
  // implementation
}
```

## Function Design

**Size:**
- Small, single-responsibility functions preferred (e.g., `calculateDelta`, `formatDelta`, `isImprovement`)
- Larger functions (100+ lines) broken into smaller helper functions
- Event handlers: Typically 20-50 lines, extracted from component body

**Parameters:**
- Props interfaces for component parameters (e.g., `ImageUploadProps`)
- Function parameters: Individual typed parameters preferred over object destructuring for simple cases
- Callback parameters: Wrapped in `useCallback` with dependency arrays
- Function overloading: Not observed; union types used instead

**Return Values:**
- Explicit return types in function signatures (always typed)
- Early returns for validation (guard clauses)
- Computed values returned as objects or primitives based on context
- Null/undefined returned explicitly when no value available

## Module Design

**Exports:**
- Named exports for functions (e.g., `export function calculateDelta(...)`)
- Named exports for types (e.g., `export type AssessmentDelta = {...}`)
- Single default export for page components (e.g., `export default function LoginPage() {...}`)
- Utility functions: All exported as named exports from `src/lib/utils.ts`, `src/lib/utils/*.ts`

**Barrel Files:**
- Not observed; imports are specific to module location (e.g., `import { Button } from "@/components/ui/button"`)
- Type exports alongside implementation in same file (e.g., `assessment.ts` exports types and constants together)

**File Organization:**
- Feature directories: `src/features/[feature-name]/`
  - `lib/` subdirectory for utility functions
  - `__tests__/` subdirectory for tests
  - Type definitions included inline in main files
- Shared utilities: `src/lib/utils/` with topic-based files
- Components: `src/components/ui/` for reusable UI components
- Pages: `src/app/` following Next.js App Router structure

## React/JSX Conventions

**Client Components:**
- Prefixed with `"use client"` directive in client-rendered components
- Example: `src/app/auth/login/page.tsx` starts with `"use client"`

**Props Interfaces:**
- Interface name follows pattern: `[ComponentName]Props`
- Destructured in function parameters: `function Component({ prop1, prop2 }: ComponentProps) { ... }`
- Optional props marked with `?` (e.g., `className?: string`)

**Hooks Usage:**
- `useState` for local state with explicit typing
- `useCallback` for memoized event handlers with dependency arrays
- `useRef` for DOM references (input fields, drag-and-drop zones)
- `useEffect` for side effects with proper cleanup (e.g., `URL.revokeObjectURL` in image-upload)

**Conditional Rendering:**
- Ternary operators for simple conditions
- Logical AND (`&&`) for conditional JSX
- Early returns at component function level
- className: Built with `cn()` utility from `clsx` + `tailwind-merge`

## Styling

**Framework:** Tailwind CSS

**Utilities:**
- `cn()` function from `@/lib/utils` combines clsx and tailwind-merge
- Usage: `className={cn("base-class", condition && "conditional-class", className)}`
- Tailwind classes: Standard utilities (e.g., `w-full`, `space-y-2`, `text-sm`)
- Radix UI components: Paired with Tailwind for styling (e.g., `@radix-ui/react-dialog`)

**CSS Variables:**
- Appears to use standard CSS theme variables (not explicitly defined, inherited from Next.js template)
- Example: `text-[#22C55E]` (inline hex), `bg-destructive`, `text-muted-foreground`

---

*Convention analysis: 2026-02-01*
