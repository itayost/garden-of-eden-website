# Trainer Workout Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A trainer-only admin tool: a filterable, editable exercise library plus a periodization program builder (exercises × weeks grid) that saves shared programs.

**Architecture:** Fully-normalized `workout_*` tables (Approach A). Library (`workout_exercises`) is filtered/queried; a program is `workout_programs` → `workout_program_exercises` (grid rows) → `workout_program_cells` (per exercise×week prescription). The grid saves replace-wholesale (delete the program's rows, cascade cells, re-insert) since those tables have no external FK references. Admin + trainer only; no trainee involvement.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript strict, Supabase (Postgres + RLS), Tailwind 4, Radix UI, Vitest (pure utils only), `xlsx` (SheetJS) for the seed.

**Spec:** `docs/superpowers/specs/2026-06-30-workout-builder-design.md`

## Global Constraints

- All user-facing text in Hebrew; `dir="rtl"`. Logical CSS only (`start`/`end`); never `left`/`right`/`ml-`/`mr-`/`pl-`/`pr-`/`text-left`/`text-right`.
- No emojis in code/comments. Immutability — never mutate objects/arrays. Path alias `@/` → `src/`. Files <800 lines.
- `typedFrom(supabase, "table")` from `@/lib/supabase/helpers` for all `workout_*` tables (absent from generated types). Never `(supabase as any).from()`.
- Admin write actions: `"use server"`, gate with `verifyAdminOrTrainer()` (from `@/lib/actions/shared`, early-return its `error`), validate ids with `isValidUUID()` (from `@/lib/validations/common`), Zod-validate input, DB writes via service-role `createAdminClient()` (from `@/lib/supabase/admin`), `revalidatePath` after mutations, return `ActionResult` `{ success } | { error, fieldErrors? }`.
- Zod schemas MUST live in a NON-`"use server"` file (a `"use server"` file may only export async functions). Use `console.error` for errors.
- Canonical reference for every admin pattern above: `src/features/development-book/lib/actions/admin-book-categories.ts` (read it first). Reusable UI: `src/components/admin/TableToolbar.tsx`, `src/components/admin/TablePagination.tsx`, `src/components/admin/DeleteConfirmDialog.tsx`, `src/features/development-book/components/admin/RepeatableRows.tsx`. Migration + RLS reference: `supabase/migrations/20260630120000_development_book_schema.sql`. Seed reference: `scripts/seed-development-book.ts` + `scripts/import-utils.ts`.
- Tests: pure utility functions only (no mocks). Non-util tasks verify with `npx tsc --noEmit` + `npm run build`.
- DB is production-only: scripts do NOT run `supabase db push` or the seed against the DB during implementation; the user applies them via the established CLI flow. Verify code with tsc/build/vitest; runtime/DB verification deferred.
- Conventional commits scoped `workouts`: `feat(workouts):`, `fix(workouts):`. Branch: `feat/workout-builder` (already created; spec committed there).

---

## File Structure

```
supabase/migrations/20260630140000_workout_builder_schema.sql              (Task 1)
scripts/seed-workout-exercises.ts                                          (Task 4)
src/lib/validations/workout-exercise.ts                                    (Task 5)
src/lib/validations/workout-program.ts                                     (Task 8)
src/features/workouts/
  lib/
    types.ts                       library + grid TS types                  (Task 2)
    grid-utils.ts                  resizeRowCells, copyCellAcrossWeeks,
                                   deriveSubCategories                       (Task 3)
    __tests__/grid-utils.test.ts                                            (Task 3)
    actions/
      exercises.ts                 list/create/update/delete exercises      (Task 5)
      programs.ts                  list/create/duplicate/delete + get/save   (Task 8)
      index.ts                     barrel                                    (Tasks 5, 8)
  components/
    ExerciseTable.tsx, ExerciseForm.tsx                                     (Task 6)
    ProgramList.tsx                                                         (Task 9)
    ProgramBuilder.tsx, ProgramGrid.tsx, ExercisePicker.tsx                 (Task 10)
src/app/admin/workouts/exercises/page.tsx                                  (Task 6)
src/app/admin/workouts/programs/page.tsx                                   (Task 9)
src/app/admin/workouts/programs/[id]/page.tsx                              (Task 10)
```

Modify: the admin sidebar component (Task 7).

---

## Phase 0 — Foundation

### Task 1: Database schema migration

**Files:**
- Create: `supabase/migrations/20260630140000_workout_builder_schema.sql`

**Interfaces:**
- Produces tables: `workout_exercises`, `workout_programs`, `workout_program_exercises`, `workout_program_cells`.

- [ ] **Step 1: Write the schema SQL**

```sql
-- Trainer Workout Builder (Feature 2). Admin + trainer only (no trainee access).

CREATE TABLE workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_category TEXT NOT NULL,
  sub_category TEXT,
  name_he TEXT,
  name_en TEXT,
  equipment TEXT,
  cues_he TEXT,
  goal_he TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workout_exercises_category ON workout_exercises(main_category, sub_category);

CREATE TABLE workout_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  weeks INTEGER NOT NULL DEFAULT 1 CHECK (weeks >= 1 AND weeks <= 52),
  periodization_type TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workout_program_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  notes_he TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workout_program_exercises_program ON workout_program_exercises(program_id, order_index);

CREATE TABLE workout_program_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_exercise_id UUID NOT NULL REFERENCES workout_program_exercises(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  sets INTEGER,
  reps_he TEXT,
  load_he TEXT,
  notes_he TEXT,
  UNIQUE (program_exercise_id, week_number)
);
CREATE INDEX idx_workout_program_cells_pe ON workout_program_cells(program_exercise_id, week_number);
```

- [ ] **Step 2: Append RLS (admin + trainer, read AND write) for each table**

Apply this single FOR ALL policy to EACH of the four tables, swapping the table name. Template for `workout_exercises`; repeat verbatim for `workout_programs`, `workout_program_exercises`, `workout_program_cells`:

```sql
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_exercises_admin_trainer_all" ON workout_exercises
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer')));
```

- [ ] **Step 3: Do NOT apply.** Production-only DB — `supabase db push` is the user's deliberate step. Read the file back and confirm 4 tables, 4 ENABLE RLS, 4 policies, 3 indexes, CHECK on weeks.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260630140000_workout_builder_schema.sql
git commit -m "feat(workouts): add workout builder schema and RLS"
```

### Task 2: TypeScript types

**Files:**
- Create: `src/features/workouts/lib/types.ts`

**Interfaces:**
- Produces: `WorkoutExercise, ExerciseFilters, WorkoutProgram, ProgramCell, ProgramExerciseRow, ProgramGrid, MAIN_CATEGORIES`.

- [ ] **Step 1: Define the types**

```ts
export const MAIN_CATEGORIES = [
  "קואורדינציה וזריזות",
  "כוח מתפרץ ופליאומטריה",
  "כוח - פלג גוף תחתון",
  "כוח - פלג גוף עליון וליבה",
  "אירובי וסיבולת",
] as const;
export type MainCategory = (typeof MAIN_CATEGORIES)[number];

export interface WorkoutExercise {
  id: string;
  mainCategory: string;
  subCategory: string | null;
  nameHe: string | null;
  nameEn: string | null;
  equipment: string | null;
  cuesHe: string | null;
  goalHe: string | null;
  orderIndex: number;
}

export interface ExerciseFilters {
  mainCategory?: string;
  subCategory?: string;
  search?: string;
}

export interface WorkoutProgram {
  id: string;
  name: string;
  description: string | null;
  weeks: number;
  periodizationType: string | null;
  createdBy: string | null;
  orderIndex: number;
}

export interface ProgramCell {
  week: number;
  sets: number | null;
  repsHe: string;
  loadHe: string;
  notesHe: string;
}

export interface ProgramExerciseRow {
  key: string;            // stable client key (db id for existing rows, generated for new)
  exerciseId: string;
  exerciseName: string;   // display only (from the joined exercise)
  notesHe: string;
  cells: ProgramCell[];   // length === program.weeks, indexed by week-1
}

export interface ProgramGrid {
  program: WorkoutProgram;
  rows: ProgramExerciseRow[];
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → no errors.
- [ ] **Step 3: Commit** — `feat(workouts): add workout types`.

---

## Phase 1 — Pure utilities (TDD)

### Task 3: Grid utilities

**Files:**
- Create: `src/features/workouts/lib/grid-utils.ts`
- Test: `src/features/workouts/lib/__tests__/grid-utils.test.ts`

**Interfaces:**
- Consumes: `ProgramCell`, `WorkoutExercise` from `../types`.
- Produces:
  - `emptyCell(week: number): ProgramCell`
  - `resizeRowCells(cells: ProgramCell[], weeks: number): ProgramCell[]` — truncates to `weeks` or pads with `emptyCell`, preserving existing cells; re-stamps each cell's `week` to its 1-based index.
  - `copyCellAcrossWeeks(cells: ProgramCell[], sourceWeekIndex: number): ProgramCell[]` — returns a new array where every cell copies `sets/repsHe/loadHe/notesHe` from `cells[sourceWeekIndex]`, keeping each cell's own `week`.
  - `deriveSubCategories(exercises: Pick<WorkoutExercise,"mainCategory"|"subCategory">[], mainCategory?: string): string[]` — distinct non-null `subCategory` values (optionally filtered to a `mainCategory`), sorted.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { emptyCell, resizeRowCells, copyCellAcrossWeeks, deriveSubCategories } from "../grid-utils";

const cell = (week: number, reps: string) => ({ week, sets: 3, repsHe: reps, loadHe: "70%", notesHe: "" });

describe("resizeRowCells", () => {
  it("pads with empty cells when growing", () => {
    const out = resizeRowCells([cell(1, "8")], 3);
    expect(out).toHaveLength(3);
    expect(out[0].repsHe).toBe("8");
    expect(out[1]).toEqual(emptyCell(2));
    expect(out[2]).toEqual(emptyCell(3));
  });
  it("truncates when shrinking and re-stamps weeks", () => {
    const out = resizeRowCells([cell(1, "8"), cell(2, "6"), cell(3, "4")], 2);
    expect(out.map((c) => c.week)).toEqual([1, 2]);
    expect(out).toHaveLength(2);
  });
});

describe("copyCellAcrossWeeks", () => {
  it("copies the source week's values to every week, keeping week numbers", () => {
    const out = copyCellAcrossWeeks([cell(1, "8"), emptyCell(2), emptyCell(3)], 0);
    expect(out.map((c) => c.repsHe)).toEqual(["8", "8", "8"]);
    expect(out.map((c) => c.week)).toEqual([1, 2, 3]);
  });
});

describe("deriveSubCategories", () => {
  const ex = [
    { mainCategory: "כוח", subCategory: "שוקיים" },
    { mainCategory: "כוח", subCategory: "ארבע ראשי" },
    { mainCategory: "אירובי", subCategory: "MAS" },
    { mainCategory: "כוח", subCategory: "שוקיים" },
  ];
  it("returns distinct sorted sub-categories for a main category", () => {
    expect(deriveSubCategories(ex, "כוח")).toEqual(["ארבע ראשי", "שוקיים"]);
  });
  it("returns all distinct when no main category given", () => {
    expect(deriveSubCategories(ex)).toEqual(["MAS", "ארבע ראשי", "שוקיים"]);
  });
});
```

- [ ] **Step 2: Run, verify it fails** — `npm run test:run -- src/features/workouts/lib/__tests__/grid-utils.test.ts` → FAIL (not exported).

- [ ] **Step 3: Implement**

```ts
import type { ProgramCell, WorkoutExercise } from "./types";

export function emptyCell(week: number): ProgramCell {
  return { week, sets: null, repsHe: "", loadHe: "", notesHe: "" };
}

export function resizeRowCells(cells: ProgramCell[], weeks: number): ProgramCell[] {
  return Array.from({ length: weeks }, (_, i) => {
    const existing = cells[i];
    return existing ? { ...existing, week: i + 1 } : emptyCell(i + 1);
  });
}

export function copyCellAcrossWeeks(cells: ProgramCell[], sourceWeekIndex: number): ProgramCell[] {
  const src = cells[sourceWeekIndex];
  if (!src) return cells.map((c) => ({ ...c }));
  return cells.map((c) => ({ week: c.week, sets: src.sets, repsHe: src.repsHe, loadHe: src.loadHe, notesHe: src.notesHe }));
}

export function deriveSubCategories(
  exercises: Pick<WorkoutExercise, "mainCategory" | "subCategory">[],
  mainCategory?: string
): string[] {
  const set = new Set<string>();
  for (const e of exercises) {
    if (mainCategory && e.mainCategory !== mainCategory) continue;
    if (e.subCategory) set.add(e.subCategory);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "he"));
}
```

- [ ] **Step 4: Run, verify pass** — same command → PASS.
- [ ] **Step 5: Commit** — `feat(workouts): add grid utilities`.

---

## Phase 2 — Library

### Task 4: Seed script (Excel → workout_exercises)

**Files:**
- Create: `scripts/seed-workout-exercises.ts`

**Interfaces:**
- Consumes: `loadEnvLocal`, `getAdminClient` from `./import-utils`; the Excel at `features-to-implement/workouts-for-trainers/Elite_Football_Athletic_Database_V2.xlsx`.
- Produces: populated `workout_exercises`. Re-runnable: deletes existing rows then inserts.

- [ ] **Step 1: Add the parser dependency** — `npm i -D xlsx`.

- [ ] **Step 2: Implement** `scripts/seed-workout-exercises.ts`:

```ts
import * as path from "path";
import * as XLSX from "xlsx";
import { loadEnvLocal, getAdminClient } from "./import-utils";

const DRY_RUN = process.argv.includes("--dry-run");
const FILE = "features-to-implement/workouts-for-trainers/Elite_Football_Athletic_Database_V2.xlsx";
const SHEET = "מאגר תרגילים מורחב V2";

function s(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t.length > 0 ? t : null;
}

async function main() {
  loadEnvLocal();
  const wb = XLSX.readFile(path.join(process.cwd(), FILE));
  const ws = wb.Sheets[SHEET];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
  // rows[0] is the header; columns: 0 main, 1 sub, 2 name_he, 3 name_en, 4 equipment, 5 cues, 6 goal
  const exercises = rows.slice(1)
    .filter((r) => s(r[0]))
    .map((r, i) => ({
      main_category: s(r[0]),
      sub_category: s(r[1]),
      name_he: s(r[2]),
      name_en: s(r[3]),
      equipment: s(r[4]),
      cues_he: s(r[5]),
      goal_he: s(r[6]),
      order_index: i,
    }));

  console.log(`Parsed ${exercises.length} exercises (expect 69).`);
  if (DRY_RUN) {
    console.log(JSON.stringify(exercises.slice(0, 2), null, 2));
    console.log("Dry run — no DB writes.");
    return;
  }
  const db = getAdminClient();
  await db.from("workout_exercises").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await db.from("workout_exercises").insert(exercises);
  if (error) throw new Error(error.message);
  console.log("Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Verify the parse (no DB)** — `npx tsx scripts/seed-workout-exercises.ts --dry-run` → prints "Parsed 69 exercises" and 2 sample rows. Also `npx tsc --noEmit`.
- [ ] **Step 4: Commit** — stage the script + `package.json` + lockfile — `feat(workouts): add exercise library seed from Excel`.

### Task 5: Exercise library server actions

**Files:**
- Create: `src/lib/validations/workout-exercise.ts`, `src/features/workouts/lib/actions/exercises.ts`, `src/features/workouts/lib/actions/index.ts`

**Interfaces:**
- Produces: `listExercises(filters: ExerciseFilters, page: number): Promise<{ rows: WorkoutExercise[]; total: number }>`; `createExercise(input)`, `updateExercise(id, input)`, `deleteExercise(id)` → `ActionResult`.

- [ ] **Step 1: Zod schema** in `src/lib/validations/workout-exercise.ts` (NON-`"use server"`): `exerciseSchema` with `main_category` (required, max 120), `sub_category/name_he/name_en/equipment/cues_he/goal_he` (optional nullable, suitable max lengths). Export `ExerciseInput = z.infer<...>`.

- [ ] **Step 2: Implement** `exercises.ts` (`"use server"`) following `admin-book-categories.ts` exactly:
  - `listExercises`: gate `verifyAdminOrTrainer`; `typedFrom(createAdminClient(), "workout_exercises")` with `.ilike` search on `name_he`/`name_en`/`equipment` (OR via `.or(...)`), `.eq("main_category", ...)` / `.eq("sub_category", ...)` when provided, ordered by `order_index`, `.range(page*PAGE, page*PAGE+PAGE-1)`, `{ count: "exact" }`; map snake→camel; return `{ rows, total }`.
  - `createExercise/updateExercise/deleteExercise`: gate, validate id with `isValidUUID`, Zod-validate, `createAdminClient` write, `revalidatePath("/admin/workouts/exercises")`, `ActionResult`.
  - Barrel: `export * from "./exercises";` in `index.ts`.
- [ ] **Step 3: Verify** — `npx tsc --noEmit` (no new errors), `npm run build` (succeeds; state if any failure is pre-existing). Confirm every `typedFrom` string is exactly `workout_exercises`.
- [ ] **Step 4: Commit** — `feat(workouts): add exercise library actions`.

### Task 6: Exercise library CMS page

**Files:**
- Create: `src/app/admin/workouts/exercises/page.tsx`, `src/features/workouts/components/ExerciseTable.tsx`, `src/features/workouts/components/ExerciseForm.tsx`

**Interfaces:**
- Consumes: `listExercises`/create/update/delete (Task 5), `deriveSubCategories` (Task 3), `MAIN_CATEGORIES` (Task 2), `TableToolbar`, `TablePagination`, `DeleteConfirmDialog`.

- [ ] **Step 1:** Page (server) renders `ExerciseTable` (client). `ExerciseTable` owns filter state (mainCategory/subCategory/search) + page; calls `listExercises`; renders `TableToolbar` (two `ToolbarSelect` — main category from `MAIN_CATEGORIES`, sub-category from `deriveSubCategories` of the current rows/all exercises — plus search) and `TablePagination`. Rows show name_he/en, category, equipment, with edit + delete (`DeleteConfirmDialog`).
- [ ] **Step 2:** `ExerciseForm` (client) — the 7 fields; create/edit via the actions; mount edit with `key={exercise.id}`. Hebrew labels, logical CSS, no emojis. Match `src/app/admin/book/page.tsx` + its client island for conventions.
- [ ] **Step 3:** Verify — `npx tsc --noEmit && npm run build` → no errors; `/admin/workouts/exercises` is a dynamic route.
- [ ] **Step 4:** Commit — `feat(workouts): add exercise library cms page`.

### Task 7: Admin navigation entry

**Files:**
- Modify: `src/components/admin/AdminSidebar.tsx`

- [ ] **Step 1:** Add a "תרגילים ותוכניות" item linking to `/admin/workouts/exercises`, visible to trainers + admins (NOT `adminOnly`), with a Lucide icon (e.g. `Dumbbell`). Match the existing item shape (read the file first).
- [ ] **Step 2:** Verify — `npx tsc --noEmit && npm run build` → no errors.
- [ ] **Step 3:** Commit — `feat(workouts): add workouts to admin navigation`.

---

## Phase 3 — Programs + builder

### Task 8: Program server actions

**Files:**
- Create: `src/lib/validations/workout-program.ts`, `src/features/workouts/lib/actions/programs.ts`
- Modify: `src/features/workouts/lib/actions/index.ts`

**Interfaces:**
- Produces: `listPrograms()`, `createProgram(input): { success, programId }`, `duplicateProgram(id)`, `deleteProgram(id)`, `getProgramForEdit(id): ProgramGrid | null`, `saveProgram(id, meta, rows): ActionResult`.

- [ ] **Step 1: Zod schemas** in `src/lib/validations/workout-program.ts` (NON-`"use server"`): `programMetaSchema` (name required, description nullable, weeks int 1-52, periodization_type nullable); `programRowSchema` (exercise_id uuid, notes_he nullable, cells array of `{ week:int, sets:int|null, reps_he, load_he, notes_he }`); `programRowsSchema = z.array(programRowSchema)`.

- [ ] **Step 2: Implement** `programs.ts` (`"use server"`), all gated by `verifyAdminOrTrainer`, ids `isValidUUID`, writes via `createAdminClient`, `revalidatePath("/admin/workouts/programs")` (+ the `[id]` path for save), `ActionResult`. `typedFrom` strings EXACTLY `workout_programs`, `workout_program_exercises`, `workout_program_cells`, `workout_exercises`.
  - `listPrograms`: all programs ordered by order_index (camel-mapped).
  - `createProgram(input)`: insert a program (default weeks from input), set `created_by` to the current user id, return `{ success, programId }`.
  - `duplicateProgram(id)`: load the program + its exercises + cells, insert a copy (name + " (עותק)") and copy all rows/cells.
  - `deleteProgram(id)`: delete the program (cascade removes rows+cells).
  - `getProgramForEdit(id)`: load program meta; load `workout_program_exercises` (ordered) joined to `workout_exercises` for the display name; load `workout_program_cells`; assemble a `ProgramGrid` (each row's `cells` normalized to length `program.weeks` via `resizeRowCells`). Return null if not found.
  - `saveProgram(id, meta, rows)`: Zod-validate; `updateProgram` meta; then REPLACE the grid — `delete from workout_program_exercises where program_id = id` (cascade drops cells), then for each row insert a `workout_program_exercises` (order_index by array index) and its `workout_program_cells` (one per cell, week_number from cell). This is safe (no external FK references). Return `ActionResult`.
  - Barrel: append `export * from "./programs";`.
- [ ] **Step 3: Verify** — `npx tsc --noEmit && npm run build`; audit every `typedFrom` table string.
- [ ] **Step 4: Commit** — `feat(workouts): add program crud and grid save actions`.

### Task 9: Program list page

**Files:**
- Create: `src/app/admin/workouts/programs/page.tsx`, `src/features/workouts/components/ProgramList.tsx`

- [ ] **Step 1:** Page (server) calls `listPrograms()`, renders `ProgramList` (client): cards/rows with name + weeks, links to `/admin/workouts/programs/[id]`, plus create (name + weeks → `createProgram` → navigate to the new id), duplicate, delete (`DeleteConfirmDialog`).
- [ ] **Step 2:** Verify — `npx tsc --noEmit && npm run build`.
- [ ] **Step 3:** Commit — `feat(workouts): add program list page`.

### Task 10: Program builder (the grid)

**Files:**
- Create: `src/app/admin/workouts/programs/[id]/page.tsx`, `src/features/workouts/components/ProgramBuilder.tsx`, `src/features/workouts/components/ProgramGrid.tsx`, `src/features/workouts/components/ExercisePicker.tsx`

**Interfaces:**
- Consumes: `getProgramForEdit`/`saveProgram` (Task 8), `listExercises` (Task 5), `resizeRowCells`/`copyCellAcrossWeeks`/`deriveSubCategories` (Task 3), types (Task 2).

- [ ] **Step 1:** Page (server): `const { id } = await params`, `getProgramForEdit(id)`, `notFound()` if null, render `ProgramBuilder` with `key={id}`.
- [ ] **Step 2:** `ProgramBuilder` (client) holds `ProgramGrid` state (program meta + rows). Meta editor (name, description, weeks, periodization label). Changing `weeks` runs `resizeRowCells` on every row. "Save" calls `saveProgram(id, meta, rows)` with Hebrew success/error toast.
- [ ] **Step 3:** `ProgramGrid` (client): a table — sticky first column (exercise name + row reorder/remove + notes), one column per week, each cell editing `sets`/`reps`/`load`/`notes` (compact inline inputs). Horizontal scroll for many weeks. A per-row "copy week 1 to all" using `copyCellAcrossWeeks`. Logical CSS only; the sticky column uses `inset-inline-start`.
- [ ] **Step 4:** `ExercisePicker` (client modal): reuses the library filter (mainCategory/subCategory/search via `listExercises`) to pick exercises; on add, appends rows to the grid with `cells = resizeRowCells([], weeks)`.
- [ ] **Step 5:** Verify — `npx tsc --noEmit && npm run build` → no errors; `/admin/workouts/programs/[id]` is dynamic. Manual/DB verification deferred (production-only DB).
- [ ] **Step 6:** Commit — `feat(workouts): add periodization program builder`.

---

## Self-Review

**Spec coverage:** §4 data model → Task 1, 2. §5 library CMS + filtering → Tasks 4 (seed), 5 (actions), 6 (page), 7 (nav). §6 builder → Tasks 8 (actions incl. replace-wholesale save), 9 (list), 10 (grid). §7 RLS → Task 1. §8 testing (pure utils) → Task 3. §9 migration/seed → Tasks 1, 4. No uncovered spec sections.

**Placeholder note:** Tasks 5, 6, 8, 9, 10 specify files, interfaces (exact signatures), field lists, the exact reuse targets and the established `admin-book-categories.ts` pattern, and step sequences rather than pasting full component bodies — the heavy logic (migration, types, utils with tests, the seed, the save-replace algorithm) is given as complete code. Type/signature names are consistent across tasks (`listExercises`, `getProgramForEdit`, `saveProgram`, `ProgramGrid`, `resizeRowCells`).

**Type consistency:** types in Task 2 (`WorkoutExercise`, `ProgramGrid`, `ProgramExerciseRow`, `ProgramCell`) are referenced consistently by Tasks 3, 5, 8, 10. `typedFrom` table strings are the four schema tables only.

## Phasing note
Phase 1-2 (Tasks 1-7) deliver the working, filterable, editable exercise library on their own. Phase 3 (Tasks 8-10) adds the program builder. The two can be executed and reviewed as separate waves.
