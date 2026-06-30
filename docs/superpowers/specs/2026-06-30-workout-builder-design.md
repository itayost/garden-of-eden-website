# Trainer Workout Builder (מאגר תרגילים + בונה תוכניות) — Design

- **Date:** 2026-06-30
- **Status:** Approved (design); implementation not started
- **Source:** `features-to-implement/workouts-for-trainers/Elite_Football_Athletic_Database_V2.xlsx` (69 athletic/S&C exercises)
- **Scope:** Feature 2 of 2. Independent of Feature 1 (the Player Development Book) — different content, different audience, separate tables.

## 1. Overview

A trainer-only working tool in the admin area: a filterable, editable **exercise library** (the 69 strength-and-conditioning exercises) plus a **periodization program builder** where a trainer assembles exercises into a multi-week training program (a grid of exercises × weeks with a prescription per cell) and saves it. Programs are shared across all trainers. **No trainee involvement** — there is no assignment to trainees and no trainee-facing view.

## 2. Decisions (locked)

| # | Question | Decision |
|---|----------|----------|
| 1 | Audience | Trainers + admins only. No trainees, no assignment, no trainee view. |
| 2 | Scope | Exercise library **and** a program builder that saves programs. |
| 3 | Library editing | Full CMS — trainers/admins add/edit/delete exercises. |
| 4 | Program ownership | **Shared** across all trainers (all can view/use/edit). |
| 5 | Program structure | Full periodization: a multi-week grid (exercises × weeks), prescription per cell. |
| 6 | Within-week structure | One exercise list per week (no day/session layer). |
| 7 | Data model | Approach A — full normalization (separate tables per entity). |

This and Feature 1 (the book) are different exercise sets and must not share tables. Library exercises carry S&C fields (equipment, professional cues, injury-prevention goal); the book's drills carry pedagogical fields.

## 3. Scope

**In scope**
- Exercise library: CRUD + filter (category / sub-category / equipment / text search) + seed from the Excel.
- Program builder: create/duplicate/delete programs; assemble a periodization grid (exercises × weeks); per-cell prescription; save (replace-wholesale).
- Admin-area routes, trainer + admin access only.

**Out of scope (v1)**
- Any trainee-facing view or assignment of programs to trainees.
- Per-trainer private programs (programs are shared).
- Day/session structure within a week.
- A dedicated PDF export (browser print of the on-screen program is enough for v1; a print-friendly view is an optional later phase).

## 4. Data model (normalized)

Two backbones. Timestamps `created_at`/`updated_at` on every table. Use `typedFrom(supabase, "...")` (tables absent from generated types).

### Library
**`workout_exercises`** — mirrors the 7 Excel columns
`id, main_category, sub_category, name_he, name_en, equipment, cues_he, goal_he, order_index`
(`cues_he` = "דגשים מקצועיים"; `goal_he` = "מטרת על / מניעת פציעות".)

### Programs (the periodization grid)
**`workout_programs`**
`id, name, description, weeks (int), periodization_type (nullable label), created_by (uuid, display only), order_index`

**`workout_program_exercises`** — one **row** of the grid (an exercise included in a program)
`id, program_id (FK CASCADE), exercise_id (FK → workout_exercises), order_index, notes_he`

**`workout_program_cells`** — one **cell**: the prescription for a row in a given week
`id, program_exercise_id (FK CASCADE), week_number (int), sets (int|null), reps_he (text), load_he (text), notes_he (text)`; `UNIQUE (program_exercise_id, week_number)`

**Why reps/load are text:** exercises are heterogeneous (agility ladder, plyometrics, squats, intervals). `reps_he` may be "8" / "30 שניות" / "4×4 דקות"; `load_he` may be "70%" / "5 ק\"ג" / "RPE 8". `sets` is an integer.

**Save = replace-wholesale.** `workout_program_exercises` and `workout_program_cells` have no external FK references (only cells point at rows, and they cascade). So saving a program deletes all its `workout_program_exercises` (cascading cells) and re-inserts the current grid — no row-diffing needed.

## 5. Exercise library CMS

Sits on the existing `/admin/*` pattern (same as Feature 1's book CMS). New sidebar item "תרגילים ותוכניות", visible to trainers + admins.

| Route | Purpose |
|-------|---------|
| `/admin/workouts/exercises` | Filterable, paginated library list; add/edit/delete/reorder |

**Filtering** (the Excel's "filter buttons") via the existing `TableToolbar`: `ToolbarSelect` main_category (5 values) + `ToolbarSelect` sub_category (derived from data) + free-text search (name he/en, equipment) with built-in debounce; `TablePagination` footer.

**Edit:** `ExerciseForm` with the 7 fields.

**Actions:** `listExercises(filters, page)`, `createExercise`, `updateExercise`, `deleteExercise` — each `verifyAdminOrTrainer` + service-role `createAdminClient` + Zod (schema in a non-`"use server"` file) + `revalidatePath`, returning the `ActionResult` envelope; ids validated with `isValidUUID`.

**Seed:** a script parses `Elite_Football_Athletic_Database_V2.xlsx` into `workout_exercises` (69 rows), with `--dry-run`, following the Feature 1 seed pattern.

## 6. Program builder (the grid)

| Route | Purpose |
|-------|---------|
| `/admin/workouts/programs` | List of saved programs; create / duplicate / delete |
| `/admin/workouts/programs/[id]` | The builder: one program's periodization grid |

**Builder UI**
1. Meta: name, description, weeks (N), periodization label.
2. Grid: rows = exercises, columns = N weeks. The exercise column is **sticky** (start side); weeks scroll horizontally. Each cell edits sets / reps / load / notes inline.
3. `ExercisePicker`: a modal reusing the library filter to add exercises as new rows.
4. Reorder rows (up/down), remove row.
5. Periodization helpers (optional, low-effort): "copy week 1 across all weeks" and a "linear increment". Asymmetric = edit each cell freely.
6. Changing N: increasing adds empty cells; decreasing drops cells beyond N (with confirm).

**Data flow**
- `getProgramForEdit(id)`: loads meta + ordered rows (with each exercise's name/category for display) + cells; assembles a grid structure for the client.
- The builder is a client component holding 2D grid state (rows × week-cells).
- `saveProgram(id, meta, rows)`: `updateProgram(meta)` + `replaceProgramGrid(programId, rows)` (delete all `workout_program_exercises` for the program → cascade cells → insert the current grid). One save.

**Components:** `ProgramList` (client island), `ProgramBuilder` (client), `ProgramGrid` (sticky-column editable table), `ExercisePicker` (reuses library filter). Mount the builder with `key={programId}` (project dialog-staleness gotcha). Reuse `DeleteConfirmDialog`.

**Print view:** an optional later phase; v1 relies on the on-screen grid + browser print.

## 7. Security / RLS

- All `workout_*` tables: both read and write restricted to **admin + trainer** via a role-checking policy (`EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin','trainer'))`). Unlike the book's content tables (readable by all authenticated trainees), this is a trainer-only tool, so trainees get no access.
- Server actions: all writes guarded by `verifyAdminOrTrainer()`; ids validated with `isValidUUID`; inputs Zod-validated; no service-role key on the client.
- `created_by` is stored for display only; it does not gate access (programs are shared).

## 8. Testing

Per project rule (no mock-based tests; pure utilities only). Candidate pure utils: a grid (de)serialization helper (rows×cells ↔ DB rows), a "linear increment" fill helper, sub-category derivation from the exercise set. Tests cover those; DB/component behavior is verified via `tsc` + `build` + manual.

## 9. Migrations & seeding

- One migration (timestamp format, e.g. `20260630140000_workout_builder_schema.sql`) creating all `workout_*` tables + RLS + indexes (index `workout_exercises(main_category, sub_category)`, `workout_program_exercises(program_id, order_index)`, `workout_program_cells(program_exercise_id, week_number)`).
- Seed script parses the Excel into `workout_exercises`. Migration apply + seed run follow the established CLI flow (production-only DB), run deliberately when ready.

## 10. Phasing & effort (AI-assisted, dev familiar with the repo)

| Phase / part | Days |
|--------------|------|
| **Phase 1 — Library**: schema + RLS + seed | 1 |
| Phase 1: CMS list / filter / CRUD | 1.5–2 |
| **Phase 2 — Programs + builder**: schema + RLS | 0.5 |
| Phase 2: program list (CRUD / duplicate) | 0.5–1 |
| Phase 2: **grid builder** (the hard interactive part) | 3–4 |
| Phase 2: save logic (replace-wholesale) | 0.5 |
| Polish, RTL/mobile QA, buffer | 1 |
| **Total** | **~7–9 days** |

Most uncertainty is in the grid builder (rows × weeks, editable cells, sticky column, horizontal scroll). Everything else leans on Feature 1's established patterns.

## 11. Reuse from Feature 1 / the codebase
Admin action pattern (`verifyAdminOrTrainer` + `createAdminClient` + Zod-in-separate-file + `ActionResult` + `revalidatePath`); `TableToolbar`, `TablePagination`, `DeleteConfirmDialog`; `typedFrom`; the Excel/HTML seed-script pattern; `RepeatableRows` where an ordered-row editor fits. `/admin` layout + sidebar (new nav item).
