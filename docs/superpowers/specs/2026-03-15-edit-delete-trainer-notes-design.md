# Edit/Delete Trainer Notes — Design Spec

**Date:** 2026-03-15
**Status:** Approved

## Overview

Add edit and delete capabilities for trainer notes displayed on the admin/trainer user page (`TraineeNotesCard`). Notes are embedded in `trainer_shift_reports` rows — this feature operates on those rows in-place without schema changes.

## Requirements

- **Delete**: Remove a specific trainee from a note category in a shift report (all category types)
- **Edit**: Update per-trainee details text (achievements category only — other categories have shared details text)
- **Permissions**: Trainers can edit/delete their own notes (no time restriction); admins can edit/delete any note
- **Confirmation**: Delete requires confirmation dialog before executing

No time restriction for trainers because they may discover errors days later and corrections benefit the trainee's record.

## Approach

Approach A — modify shift report rows in-place. No new tables. One migration for admin UPDATE RLS policy.

### Why not per-trainee editing for all categories?

Non-achievement categories store a single `details` text shared across all tagged trainees. Editing that text would affect every trainee in the category. Rather than adding a per-trainee JSONB column (Approach B) or normalizing to a separate table (Approach C), we keep it simple: edit is only available for achievements (which already have `achievements_per_trainee` JSONB). For other categories, trainers edit the full report if they need to change shared text.

## Data Layer

### Return Type

Both actions return the project's standard `ActionResult` discriminated union to match `DeleteConfirmDialog` and other existing patterns:

```typescript
type ActionResult =
  | { error: string; success?: never }
  | { success: true; error?: never };
```

### Column Mapping

The `CATEGORY_COLUMNS` array in `src/lib/utils/trainee-notes.ts` maps `NoteCategoryType` to actual DB column names (e.g., `"new_trainee"` -> `"new_trainees_ids"`). Export this array and reuse it in the server actions to avoid duplicating the mapping.

### New Server Actions (`src/lib/actions/admin-user-notes.ts`)

#### `deleteTraineeNote(reportId: string, traineeId: string, categoryType: NoteCategoryType): Promise<ActionResult>`

1. Validate `reportId` and `traineeId` with `isValidUUID()`, validate `categoryType` against `CATEGORY_COLUMNS` types
2. Call `verifyAdminOrTrainer()` — get `{ error, user, profile }`
3. Fetch the report row (need `trainer_id` for ownership check + current array/JSONB data)
4. Permission check: if `profile.role !== 'admin'`, verify `report.trainer_id === user.id`
5. Look up the UUID array column name from `CATEGORY_COLUMNS` using `categoryType`
6. Build update payload:
   - Remove `traineeId` from the category's UUID array column (filter it out, produce new array)
   - For achievements: also remove the trainee key from `achievements_per_trainee` JSONB (create new object without the key)
7. Execute `.update()` on `trainer_shift_reports` via `createClient()` from `lib/supabase/server` (not `createAdminClient`) so RLS provides defense-in-depth
8. Call `revalidatePath(\`/admin/users/${traineeId}\`)` for cache invalidation
9. Return `{ success: true }` or `{ error: "..." }`

#### `editTraineeNote(reportId: string, traineeId: string, newDetails: string): Promise<ActionResult>`

1. Validate `reportId` and `traineeId` with `isValidUUID()`. Allow empty string for `newDetails` (clears details but keeps trainee tagged). Trim whitespace.
2. Call `verifyAdminOrTrainer()` — get `{ error, user, profile }`
3. Fetch the report row (need `trainer_id` + current `achievements_trainee_ids` + `achievements_per_trainee`)
4. Permission check: if `profile.role !== 'admin'`, verify `report.trainer_id === user.id`
5. Validate that `traineeId` exists in `report.achievements_trainee_ids` — reject if not found (prevents JSONB injection)
6. Update the trainee's entry in `achievements_per_trainee` JSONB — set `details` to `newDetails.trim()`, preserve `categories` (create new JSONB object, immutable)
7. Execute `.update()` on `trainer_shift_reports` via `createClient()` from `lib/supabase/server` (not `createAdminClient`) so RLS provides defense-in-depth
8. Call `revalidatePath(\`/admin/users/${traineeId}\`)` for cache invalidation
9. Return `{ success: true }` or `{ error: "..." }`

### Prerequisite Fix: `social_skills` in `getTraineeNotes`

The current `getTraineeNotes` query does not select `social_skills_trainee_ids` or `social_skills_details`, and does not include `social_skills` in the `.or()` filter — even though `NoteCategoryType` and `CATEGORY_COLUMNS` include it. Fix this as part of the implementation:

- Add `social_skills_trainee_ids, social_skills_details` to the select
- Add `social_skills_trainee_ids.cs.{${traineeId}}` to the `.or()` filter

### Changes to Types and Extraction

**`ShiftReportForNotes` type** (`src/lib/utils/trainee-notes.ts`):
- Add `trainer_id` to the Pick list (it's already selected in the query but not in the type)

**`TraineeReportNotes` interface:**
- Add `readonly trainerId: string` field

**`extractTraineeNotes` function:**
- Pass `report.trainer_id` through as `trainerId` in the output objects

## UI Changes

### `TraineeNotesCard` Component

**New props:**
- `currentUserId: string` — the logged-in user's ID
- `isAdmin: boolean` — whether the current user is an admin

Note: `traineeId` is already a prop on the component and is used when calling delete/edit actions.

**Per-note action buttons:**
- Each note row gets an action area (inline, end-aligned):
  - **Delete button** (Trash2 icon, small) — visible on all note types
  - **Edit button** (Pencil icon, small) — visible only on `achievements` notes
- Visibility rules:
  - Admin: sees buttons on all reports
  - Trainer: sees buttons only on reports where `trainerId === currentUserId`

**Delete flow:**
1. Click trash icon -> `DeleteConfirmDialog` opens with custom trigger (icon button)
   - Title: "מחיקת הערה"
   - Description: "האם למחוק הערה זו? לא ניתן לשחזר פעולה זו."
   - Success message: "ההערה נמחקה בהצלחה"
   - Error message: "שגיאה במחיקת ההערה"
2. `onDelete` callback calls `deleteTraineeNote(reportId, traineeId, categoryType)`
3. `onSuccess` callback: remove note from local state. If last note in report, remove entire report card
4. Toast handled by `DeleteConfirmDialog` internally

**Edit flow (achievements only):**
1. Click pencil icon -> the details `<p>` becomes a `<textarea>` with save/cancel buttons
2. Save calls `editTraineeNote(reportId, traineeId, newDetails)`
3. On success: update local state, exit edit mode, show success toast via `sonner`
4. On error: show error toast, stay in edit mode
5. Cancel: revert to original text, exit edit mode

### Parent Page Changes

`src/app/admin/users/[userId]/page.tsx`:
- Already calls `verifyAdminOrTrainer()` — extract `user.id` and `profile.role === 'admin'`
- Pass `currentUserId` and `isAdmin` as props to `TraineeNotesCard`

## Migration

**File:** `supabase/migrations/YYYYMMDDHHMMSS_admin_update_shift_reports.sql`

```sql
-- Allow admins to update any trainer shift report
CREATE POLICY "Admins can update any shift report"
  ON trainer_shift_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

Existing trainer UPDATE policy already allows trainers to update their own reports — no change needed.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/actions/admin-user-notes.ts` | Add `deleteTraineeNote`, `editTraineeNote` actions; fix `social_skills` in `getTraineeNotes` select/filter |
| `src/lib/utils/trainee-notes.ts` | Export `CATEGORY_COLUMNS`; add `trainer_id` to `ShiftReportForNotes`; add `trainerId` to `TraineeReportNotes`; pass through in `extractTraineeNotes` |
| `src/components/admin/users/TraineeNotesCard.tsx` | Add edit/delete UI with action buttons, `DeleteConfirmDialog`, inline edit for achievements; new `currentUserId` and `isAdmin` props |
| `src/app/admin/users/[userId]/page.tsx` | Pass `currentUserId`, `isAdmin` props to `TraineeNotesCard` |
| `supabase/migrations/YYYYMMDDHHMMSS_admin_update_shift_reports.sql` | Admin UPDATE RLS policy |

## Edge Cases

- **Last note in report deleted:** Remove the entire report card from the UI
- **Concurrent edits:** Not a concern — notes are per-trainee and operations are atomic Supabase updates
- **Empty achievements details:** Allow saving empty/trimmed string (clears the note details but keeps the trainee tagged)
- **Report with no remaining trainees in any category:** The report still exists in DB but won't appear in future queries for any trainee (the `.cs()` filters won't match). Boolean flags like `has_achievements` are left as-is — they don't affect the trainee-notes query logic
- **Trainee not in `achievements_trainee_ids`:** `editTraineeNote` rejects the request to prevent JSONB injection
