# Workouts admin: categories from data, bulk equipment linking, and safety

Branch: `feat/workouts-admin-ux` (off `main`).

## Why

Two findings from a UX review of `/admin/workouts` (snapshot in `.impeccable/critique/`):

1. An admin cannot add an exercise category. The five categories are a frozen const
   (`src/features/workouts/lib/types.ts:3`) while the column is free text with no
   constraint and `sub_category`, in the same form, is already free text. A sixth
   category is a deploy, and a category written through the server action would never
   appear in any filter, because the filters are built from the same const.
2. All 72 exercises have `equipment_id NULL`. The catalog holds 15 machines with QR
   stickers, so no scan can ever resolve to an exercise. The only way to link today is
   one dialog per exercise.

The rest of the work removes the sharp edges the same review found.

## Phases

Each phase ends green: `npx tsc --noEmit`, `npm run lint`, `npm run test:run`.
Pure helpers are written test-first.

### 1. Categories come from the data

- `deriveMainCategories`, `normalizeCategoryName`, `findSimilarCategory` in
  `src/features/workouts/lib/grid-utils.ts`, tests first in the existing
  `__tests__/grid-utils.test.ts`.
- `listMainCategories()` action beside `listSubCategories`, same shape.
- `ExerciseForm`: the select is built from the data, plus a "קטגוריה חדשה" item that
  reveals a text input. On a near-duplicate, offer the existing name instead.
- `ExerciseTable` and `ExercisePicker` filters read the same list.
- `MAIN_CATEGORIES` stays as the fallback for an empty library, documented as such.
- The action normalizes `main_category` before writing, so spacing cannot fork a
  category in two.

### 2. Link exercises to equipment in bulk

- `bulkLinkEquipment(ids, equipmentId)` action: admin or trainer, every id validated,
  batch capped.
- `ExerciseTable`: a checkbox column, select-all-on-page, and a selection bar that
  links the selected rows to one machine.
- A banner above the table while unlinked exercises exist: the count, and a button
  that filters to them. It does not change the default filter by itself.

### 3. Deleting an exercise stops asking for trouble

- Count references in `session_template_exercises` and `training_session_exercises`
  first. With any reference, refuse and say how many templates and sessions use it.
- No new column, so no migration in this PR.

### 4. The library works on a phone

- Card list under `md`, table above it, mirroring `EquipmentManager`.

### 5. Accessibility

- `h1` on the equipment page; the workouts tabs get real keyboard behavior;
  `aria-required` on the category field; the delete trigger stops clipping its label;
  logical properties in `TableToolbar`.

### 6. Filters live in the URL

- `nuqs`, as in `AssessmentsTable`: search, category, sub-category, equipment, page.
  Replaces the local state and the read-once `?equipment=`.

## Out of scope

- A categories table with rename, merge and display order. Worth doing later; it also
  fixes exercise ordering, which is set once at create.
- `is_active` on exercises, which needs a migration.
- Validating `access_override` in middleware and the per-trainee JSONB in
  `extractTraineeNotes` (carried over from the previous review).

## Verification

Type check, lint and the unit suite after every phase. The suite has 20 pre-existing
localStorage failures on `main`; that number must not grow. A production build and a
pass over the preview at the end: create an exercise with a new category, link a few
rows in bulk, try to delete a referenced exercise, and open the library on a phone.
