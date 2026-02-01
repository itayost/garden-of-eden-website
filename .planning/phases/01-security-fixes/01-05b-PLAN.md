---
phase: 01-security-fixes
plan: 05b
type: execute
wave: 2
depends_on: ["01-02"]
files_modified:
  - src/app/admin/submissions/page.tsx
  - src/app/admin/users/[userId]/page.tsx
  - src/app/admin/videos/page.tsx
  - src/components/dashboard/VideoCard.tsx
  - src/features/rankings/lib/actions/get-rankings.ts
  - src/features/goals/lib/actions/set-goal.ts
  - src/features/goals/lib/actions/delete-goal.ts
  - src/features/achievements/lib/actions/get-achievements.ts
  - src/lib/validations/profile.ts
autonomous: true

must_haves:
  truths:
    - "No 'as unknown as' patterns remain in admin pages (submissions, users, videos)"
    - "No 'as unknown as' patterns remain in feature actions"
    - "No 'as unknown as' patterns remain in validations"
    - "All Supabase queries use proper typing"
  artifacts:
    - path: "src/features/rankings/lib/actions/get-rankings.ts"
      provides: "Properly typed rankings action"
      min_lines: 20
    - path: "src/lib/validations/profile.ts"
      provides: "Properly typed profile validation"
      min_lines: 20
  key_links:
    - from: "Feature actions"
      to: "src/types/database.ts"
      via: "Proper type imports"
      pattern: "from.*types/database"
---

<objective>
Replace 'as unknown as' type assertion patterns in remaining admin pages, feature actions, and validation files.

Purpose: Complete the elimination of type safety bypasses across the codebase.
Output: 9 files updated with proper typing.
</objective>

<execution_context>
@/Users/itayostraich/.claude/get-shit-done/workflows/execute-plan.md
@/Users/itayostraich/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-security-fixes/01-CONTEXT.md
@.planning/phases/01-security-fixes/01-05-SUMMARY.md
@src/types/database.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix remaining admin page type assertions</name>
  <files>src/app/admin/submissions/page.tsx, src/app/admin/users/[userId]/page.tsx, src/app/admin/videos/page.tsx</files>
  <action>
Fix all `as unknown as` patterns in remaining admin pages.

Replace each pattern:
- `as unknown as { data: ... }` -> `as { data: ... }`
- `as unknown as { count: ... }` -> `as { count: ... }`

This removes the unsafe `unknown` intermediate step while maintaining necessary type assertions.

After each file update, run `npx tsc --noEmit <file>` to verify types work with regenerated database.ts.
  </action>
  <verify>
```bash
grep "as unknown as" src/app/admin/submissions/page.tsx | wc -l  # Should be 0
grep "as unknown as" "src/app/admin/users/[userId]/page.tsx" | wc -l  # Should be 0
grep "as unknown as" src/app/admin/videos/page.tsx | wc -l  # Should be 0

npx tsc --noEmit src/app/admin/submissions/page.tsx
npx tsc --noEmit "src/app/admin/users/[userId]/page.tsx"
npx tsc --noEmit src/app/admin/videos/page.tsx
```
  </verify>
  <done>
- No `as unknown as` patterns in admin submissions, users, videos pages
- TypeScript compiles all three pages without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix feature action type assertions</name>
  <files>src/features/rankings/lib/actions/get-rankings.ts, src/features/goals/lib/actions/set-goal.ts, src/features/goals/lib/actions/delete-goal.ts, src/features/achievements/lib/actions/get-achievements.ts, src/components/dashboard/VideoCard.tsx</files>
  <action>
Fix all `as unknown as` patterns in feature action files and VideoCard component.

For action files (get-rankings, set-goal, delete-goal, get-achievements):
- Remove `as unknown as` and use proper Supabase client typing
- The typed client should infer return types correctly

For VideoCard.tsx:
- Similar approach - remove `as unknown as` intermediate step

After each file update, run `npx tsc --noEmit <file>` to verify types work with regenerated database.ts.
  </action>
  <verify>
```bash
grep "as unknown as" src/features/rankings/lib/actions/get-rankings.ts | wc -l  # Should be 0
grep "as unknown as" src/features/goals/lib/actions/set-goal.ts | wc -l  # Should be 0
grep "as unknown as" src/features/goals/lib/actions/delete-goal.ts | wc -l  # Should be 0
grep "as unknown as" src/features/achievements/lib/actions/get-achievements.ts | wc -l  # Should be 0
grep "as unknown as" src/components/dashboard/VideoCard.tsx | wc -l  # Should be 0

npx tsc --noEmit src/features/rankings/lib/actions/get-rankings.ts
npx tsc --noEmit src/features/goals/lib/actions/set-goal.ts
npx tsc --noEmit src/features/goals/lib/actions/delete-goal.ts
npx tsc --noEmit src/features/achievements/lib/actions/get-achievements.ts
npx tsc --noEmit src/components/dashboard/VideoCard.tsx
```
  </verify>
  <done>
- No `as unknown as` patterns in feature action files
- No `as unknown as` patterns in VideoCard component
- TypeScript compiles all five files without errors
  </done>
</task>

<task type="auto">
  <name>Task 3: Fix profile validation type assertion</name>
  <files>src/lib/validations/profile.ts</files>
  <action>
Fix the `as unknown as` pattern in profile.ts (line 27 area).

The issue is likely with `.enum(POSITIONS as unknown as [string, ...string[]])`.

Fix options:

Option A: If POSITIONS is a const array, use `as const`:
```typescript
const POSITIONS = ["position1", "position2", "position3"] as const;
// Then use:
.enum(POSITIONS)
```

Option B: Create properly typed tuple:
```typescript
const POSITIONS_TUPLE: [string, ...string[]] = [POSITIONS[0], ...POSITIONS.slice(1)];
.enum(POSITIONS_TUPLE)
```

Option C: If Zod 4.x supports it, use z.enum with explicit type:
```typescript
z.enum([...POSITIONS] as [string, ...string[]])
```

Choose the approach that compiles cleanly with Zod 4.x.

After update, run `npx tsc --noEmit src/lib/validations/profile.ts` to verify types work.
  </action>
  <verify>
```bash
grep "as unknown as" src/lib/validations/profile.ts | wc -l  # Should be 0
npx tsc --noEmit src/lib/validations/profile.ts
```
  </verify>
  <done>
- No `as unknown as` patterns in profile validation
- TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. No patterns in admin: `grep -r "as unknown as" src/app/admin/submissions src/app/admin/users src/app/admin/videos --include="*.tsx" | wc -l` (0)
2. No patterns in features: `grep -r "as unknown as" src/features/ --include="*.ts" | wc -l` (0)
3. No patterns in validations: `grep "as unknown as" src/lib/validations/profile.ts | wc -l` (0)
4. Full build passes: `npm run build`
</verification>

<success_criteria>
- Zero `as unknown as` patterns in admin pages (submissions, users, videos)
- Zero `as unknown as` patterns in feature action files (4 files)
- Zero `as unknown as` patterns in VideoCard component
- Zero `as unknown as` patterns in profile validation
- TypeScript build passes without errors
</success_criteria>

<output>
After completion, create `.planning/phases/01-security-fixes/01-05b-SUMMARY.md`
</output>
