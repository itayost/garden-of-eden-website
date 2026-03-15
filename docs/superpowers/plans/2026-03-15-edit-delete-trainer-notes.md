# Edit/Delete Trainer Notes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add edit and delete capabilities for trainer notes on the admin/trainer user page.

**Architecture:** Modify `trainer_shift_reports` rows in-place. Delete removes a trainee from a category's UUID array. Edit updates per-trainee JSONB (achievements only). One RLS migration for admin UPDATE policy. UI adds action buttons to each note in `TraineeNotesCard`.

**Tech Stack:** Next.js 16 server actions, Supabase RLS, React state management, existing `DeleteConfirmDialog` component, `sonner` toasts.

**Spec:** `docs/superpowers/specs/2026-03-15-edit-delete-trainer-notes-design.md`

---

## Chunk 1: Data Layer

### Task 1: RLS Migration — Admin UPDATE Policy

**Files:**

- Create: `supabase/migrations/20260315120000_admin_update_shift_reports.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Allow admins to update any trainer shift report
-- (Trainers can already update their own reports via existing policy)
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

- [ ] **Step 2: Apply the migration**

Run: `supabase db push`
Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260315120000_admin_update_shift_reports.sql
git commit -m "feat(rls): add admin UPDATE policy for trainer_shift_reports"
```

---

### Task 2: Update Types and Export `CATEGORY_COLUMNS`

**Files:**

- Modify: `src/lib/utils/trainee-notes.ts`

- [ ] **Step 1: Add `trainer_id` to `ShiftReportForNotes` Pick type**

In `src/lib/utils/trainee-notes.ts`, add `"trainer_id"` to the Pick union (after `"id"`):

```typescript
export type ShiftReportForNotes = Pick<
  TrainerShiftReport,
  | "id"
  | "trainer_id"
  | "report_date"
  // ... rest stays the same
>;
```

- [ ] **Step 2: Add `trainerId` to `TraineeReportNotes` interface**

```typescript
export interface TraineeReportNotes {
  readonly reportId: string;
  readonly reportDate: string;
  readonly trainerName: string;
  readonly trainerId: string;
  readonly notes: readonly TraineeNote[];
}
```

- [ ] **Step 3: Export `CATEGORY_COLUMNS`**

Change line 92 from:

```typescript
const CATEGORY_COLUMNS: ReadonlyArray<{
```

to:

```typescript
export const CATEGORY_COLUMNS: ReadonlyArray<{
```

- [ ] **Step 4: Pass `trainerId` through in `extractTraineeNotes`**

In the `extractTraineeNotes` function, update the `results.push` call (around line 146) to include `trainerId`:

```typescript
if (notes.length > 0) {
  results.push({
    reportId: report.id,
    reportDate: report.report_date,
    trainerName: report.trainer_name,
    trainerId: report.trainer_id,
    notes,
  });
}
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/trainee-notes.ts
git commit -m "refactor(notes): export CATEGORY_COLUMNS, add trainerId to TraineeReportNotes"
```

---

### Task 3: Fix `social_skills` in `getTraineeNotes` Query

**Files:**

- Modify: `src/lib/actions/admin-user-notes.ts`

- [ ] **Step 1: Add `social_skills` columns to the select**

In `getTraineeNotes`, update the `.select()` string (line 31-41). After the `pro_candidates_trainee_ids, pro_candidates_details` line, add:

```typescript
.select(
  "id, trainer_id, trainer_name, report_date, " +
  "new_trainees_ids, new_trainees_details, " +
  "discipline_trainee_ids, discipline_details, " +
  "injuries_trainee_ids, injuries_details, " +
  "limitations_trainee_ids, limitations_details, " +
  "achievements_trainee_ids, achievements_details, achievements_per_trainee, " +
  "mental_state_trainee_ids, mental_state_details, " +
  "complaints_trainee_ids, complaints_details, " +
  "insufficient_attention_trainee_ids, insufficient_attention_details, " +
  "pro_candidates_trainee_ids, pro_candidates_details, " +
  "social_skills_trainee_ids, social_skills_details"
)
```

- [ ] **Step 2: Add `social_skills` to the `.or()` filter**

After `pro_candidates_trainee_ids.cs.{${traineeId}}` (line 52), add:

```typescript
.or(
  `new_trainees_ids.cs.{${traineeId}},` +
  `discipline_trainee_ids.cs.{${traineeId}},` +
  `injuries_trainee_ids.cs.{${traineeId}},` +
  `limitations_trainee_ids.cs.{${traineeId}},` +
  `achievements_trainee_ids.cs.{${traineeId}},` +
  `mental_state_trainee_ids.cs.{${traineeId}},` +
  `complaints_trainee_ids.cs.{${traineeId}},` +
  `insufficient_attention_trainee_ids.cs.{${traineeId}},` +
  `pro_candidates_trainee_ids.cs.{${traineeId}},` +
  `social_skills_trainee_ids.cs.{${traineeId}}`
)
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/admin-user-notes.ts
git commit -m "fix(notes): include social_skills in getTraineeNotes query"
```

---

### Task 4: Add `deleteTraineeNote` Server Action

**Files:**

- Modify: `src/lib/actions/admin-user-notes.ts`

- [ ] **Step 1: Add imports**

Add to the existing imports at the top of `src/lib/actions/admin-user-notes.ts`:

```typescript
import { revalidatePath } from "next/cache";
import {
  extractTraineeNotes,
  CATEGORY_COLUMNS,
  type TraineeReportNotes,
  type ShiftReportForNotes,
  type NoteCategoryType,
} from "@/lib/utils/trainee-notes";
```

(Replace the existing import line that imports from `trainee-notes`.)

- [ ] **Step 2: Define the ActionResult type**

Add after imports:

```typescript
type ActionResult =
  | { error: string; success?: never }
  | { success: true; error?: never };
```

- [ ] **Step 3: Write the `deleteTraineeNote` function**

```typescript
export async function deleteTraineeNote(
  reportId: string,
  traineeId: string,
  categoryType: NoteCategoryType,
): Promise<ActionResult> {
  if (!isValidUUID(reportId) || !isValidUUID(traineeId)) {
    return { error: "מזהה לא תקין" };
  }

  const categoryCol = CATEGORY_COLUMNS.find((c) => c.type === categoryType);
  if (!categoryCol) {
    return { error: "קטגוריה לא תקינה" };
  }

  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();

  // Fetch the report for ownership check and current data
  const { data: report, error: fetchError } = await supabase
    .from("trainer_shift_reports")
    .select("trainer_id, " + categoryCol.traineeIdsKey + ", achievements_per_trainee")
    .eq("id", reportId)
    .single();

  if (fetchError || !report) {
    return { error: "דוח לא נמצא" };
  }

  // Cast to Record for dynamic key access (Supabase returns unknown shape for dynamic selects)
  const reportData = report as Record<string, unknown>;

  // Permission check: trainers can only edit their own reports
  if (profile!.role !== "admin" && reportData.trainer_id !== user!.id) {
    return { error: "אין הרשאה לערוך דוח זה" };
  }

  // Remove trainee from the UUID array
  const currentIds = (reportData[categoryCol.traineeIdsKey] as string[]) ?? [];
  const updatedIds = currentIds.filter((id: string) => id !== traineeId);

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    [categoryCol.traineeIdsKey]: updatedIds,
  };

  // For achievements: also remove from per-trainee JSONB
  if (categoryType === "achievements" && reportData.achievements_per_trainee) {
    const { [traineeId]: _removed, ...remaining } = reportData.achievements_per_trainee as Record<
      string,
      { details?: string; categories: string[] }
    >;
    updatePayload.achievements_per_trainee = remaining;
  }

  const { error: updateError } = await supabase
    .from("trainer_shift_reports")
    .update(updatePayload)
    .eq("id", reportId);

  if (updateError) {
    console.error("Error deleting trainee note:", updateError);
    return { error: "שגיאה במחיקת ההערה" };
  }

  revalidatePath(`/admin/users/${traineeId}`);
  return { success: true };
}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/admin-user-notes.ts
git commit -m "feat(notes): add deleteTraineeNote server action"
```

---

### Task 5: Add `editTraineeNote` Server Action

**Files:**

- Modify: `src/lib/actions/admin-user-notes.ts`

- [ ] **Step 1: Write the `editTraineeNote` function**

Add after `deleteTraineeNote`:

```typescript
export async function editTraineeNote(
  reportId: string,
  traineeId: string,
  newDetails: string,
): Promise<ActionResult> {
  if (!isValidUUID(reportId) || !isValidUUID(traineeId)) {
    return { error: "מזהה לא תקין" };
  }

  const trimmedDetails = newDetails.trim();

  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();

  // Fetch the report for ownership check and current JSONB data
  const { data: report, error: fetchError } = await supabase
    .from("trainer_shift_reports")
    .select("trainer_id, achievements_trainee_ids, achievements_per_trainee")
    .eq("id", reportId)
    .single();

  if (fetchError || !report) {
    return { error: "דוח לא נמצא" };
  }

  // Permission check: trainers can only edit their own reports
  if (profile!.role !== "admin" && report.trainer_id !== user!.id) {
    return { error: "אין הרשאה לערוך דוח זה" };
  }

  // Validate trainee exists in achievements array (prevents JSONB injection)
  const achievementIds = (report.achievements_trainee_ids as string[]) ?? [];
  if (!achievementIds.includes(traineeId)) {
    return { error: "המתאמן לא נמצא בקטגוריית הישגים" };
  }

  // Update the per-trainee JSONB entry, preserving categories
  const currentPerTrainee = (report.achievements_per_trainee ?? {}) as Record<
    string,
    { details?: string; categories: string[] }
  >;
  const existingEntry = currentPerTrainee[traineeId] ?? { categories: [] };
  const updatedPerTrainee = {
    ...currentPerTrainee,
    [traineeId]: {
      ...existingEntry,
      details: trimmedDetails,
    },
  };

  const { error: updateError } = await supabase
    .from("trainer_shift_reports")
    .update({ achievements_per_trainee: updatedPerTrainee })
    .eq("id", reportId);

  if (updateError) {
    console.error("Error editing trainee note:", updateError);
    return { error: "שגיאה בעריכת ההערה" };
  }

  revalidatePath(`/admin/users/${traineeId}`);
  return { success: true };
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/admin-user-notes.ts
git commit -m "feat(notes): add editTraineeNote server action"
```

---

## Chunk 2: UI Layer

### Task 6: Pass User Context to `TraineeNotesCard`

**Files:**

- Modify: `src/app/admin/users/[userId]/page.tsx:164-165`

- [ ] **Step 1: Update the `TraineeNotesCard` usage to pass new props**

In `src/app/admin/users/[userId]/page.tsx`, replace line 165:

```tsx
<TraineeNotesCard traineeId={userId} />
```

with:

```tsx
<TraineeNotesCard
  traineeId={userId}
  currentUserId={currentUser.id}
  isAdmin={isAdmin}
/>
```

`currentUser` and `isAdmin` are already available in the page component (lines 41-58).

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: Type error in `TraineeNotesCard` (props not yet updated). This is expected — we fix it in the next task.

- [ ] **Step 3: Commit (skip until Task 7 is done)**

Will commit together with Task 7.

---

### Task 7: Add Edit/Delete UI to `TraineeNotesCard`

**Files:**

- Modify: `src/components/admin/users/TraineeNotesCard.tsx`

- [ ] **Step 1: Update imports**

Replace the imports at the top of `TraineeNotesCard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  StickyNote,
  AlertCircle,
  Calendar,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getTraineeNotes,
  deleteTraineeNote,
  editTraineeNote,
} from "@/lib/actions/admin-user-notes";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import {
  NOTE_CATEGORY_LABELS,
  type TraineeReportNotes,
  type NoteCategoryType,
} from "@/lib/utils/trainee-notes";
```

- [ ] **Step 2: Update the props interface**

```tsx
interface TraineeNotesCardProps {
  traineeId: string;
  currentUserId: string;
  isAdmin: boolean;
}
```

- [ ] **Step 3: Update the component signature and add edit state**

Replace the component function signature and initial state:

```tsx
export function TraineeNotesCard({
  traineeId,
  currentUserId,
  isAdmin,
}: TraineeNotesCardProps) {
  const [notes, setNotes] = useState<readonly TraineeReportNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editingNote, setEditingNote] = useState<{
    reportId: string;
    type: NoteCategoryType;
  } | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
```

- [ ] **Step 4: Add the `canEdit` helper function and handlers**

Add after the `formatDate` function (around line 74), before the `return`:

```tsx
  const canEditReport = (trainerId: string) =>
    isAdmin || trainerId === currentUserId;

  const handleDeleteSuccess = (reportId: string, noteType: NoteCategoryType) => {
    setNotes((prev) => {
      const updated = prev.map((report) => {
        if (report.reportId !== reportId) return report;
        return {
          ...report,
          notes: report.notes.filter((n) => n.type !== noteType),
        };
      });
      // Remove reports with no remaining notes
      return updated.filter((report) => report.notes.length > 0);
    });
  };

  const handleStartEdit = (reportId: string, noteType: NoteCategoryType, currentDetails: string | null) => {
    setEditingNote({ reportId, type: noteType });
    setEditText(currentDetails ?? "");
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditText("");
  };

  const handleSaveEdit = async () => {
    if (!editingNote) return;
    setSaving(true);
    try {
      const result = await editTraineeNote(
        editingNote.reportId,
        traineeId,
        editText,
      );
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      // Update local state
      setNotes((prev) =>
        prev.map((report) => {
          if (report.reportId !== editingNote.reportId) return report;
          return {
            ...report,
            notes: report.notes.map((n) =>
              n.type === editingNote.type
                ? { ...n, details: editText.trim() || null }
                : n,
            ),
          };
        }),
      );
      toast.success("ההערה עודכנה בהצלחה");
      setEditingNote(null);
      setEditText("");
    } catch {
      toast.error("שגיאה בעריכת ההערה");
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 5: Update the note rendering JSX**

Replace the inner note rendering block (lines 131-156 in the original file). Replace this section:

```tsx
<div className="space-y-2">
  {report.notes.map((note, idx) => (
    <div key={`${note.type}-${idx}`} className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[note.type]}`}
        >
          {NOTE_CATEGORY_LABELS[note.type]}
        </span>
        {note.achievementCategories?.map((cat) => (
          <Badge
            key={cat}
            variant="outline"
            className="text-xs"
          >
            {cat}
          </Badge>
        ))}
      </div>
      {note.details && (
        <p className="text-sm text-foreground/80 pr-1">
          {note.details}
        </p>
      )}
    </div>
  ))}
</div>
```

with:

```tsx
<div className="space-y-2">
  {report.notes.map((note, idx) => {
    const isEditing =
      editingNote?.reportId === report.reportId &&
      editingNote?.type === note.type;
    const showActions = canEditReport(report.trainerId);

    return (
      <div key={`${note.type}-${idx}`} className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[note.type]}`}
            >
              {NOTE_CATEGORY_LABELS[note.type]}
            </span>
            {note.achievementCategories?.map((cat) => (
              <Badge
                key={cat}
                variant="outline"
                className="text-xs"
              >
                {cat}
              </Badge>
            ))}
          </div>

          {showActions && !isEditing && (
            <div className="flex items-center gap-1 shrink-0">
              {note.type === "achievements" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    handleStartEdit(
                      report.reportId,
                      note.type,
                      note.details,
                    )
                  }
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              <DeleteConfirmDialog
                title="מחיקת הערה"
                description="האם למחוק הערה זו? לא ניתן לשחזר פעולה זו."
                successMessage="ההערה נמחקה בהצלחה"
                errorMessage="שגיאה במחיקת ההערה"
                onDelete={() =>
                  deleteTraineeNote(
                    report.reportId,
                    traineeId,
                    note.type,
                  )
                }
                onSuccess={() =>
                  handleDeleteSuccess(report.reportId, note.type)
                }
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                }
              />
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="text-sm min-h-[60px]"
              dir="rtl"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                <Check className="h-3.5 w-3.5 ml-1" />
                {saving ? "שומר..." : "שמור"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5 ml-1" />
                ביטול
              </Button>
            </div>
          </div>
        ) : (
          note.details && (
            <p className="text-sm text-foreground/80 pr-1">
              {note.details}
            </p>
          )
        )}
      </div>
    );
  })}
</div>
```

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Verify build passes**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/users/TraineeNotesCard.tsx src/app/admin/users/[userId]/page.tsx
git commit -m "feat(notes): add edit/delete UI for trainer notes on user page"
```

---

### Task 8: Manual Testing Checklist

- [ ] **Step 1: Test as admin**

1. Navigate to `/admin/users/[trainee-id]`
2. Verify notes display with trash icons on all note types
3. Verify pencil icon appears only on achievements notes
4. Click trash on a note -> confirm dialog appears in Hebrew
5. Confirm delete -> note disappears, success toast shown
6. Click pencil on achievement note -> textarea appears with current text
7. Edit text, click save -> text updates, success toast shown
8. Click cancel -> reverts to original text

- [ ] **Step 2: Test as trainer**

1. Log in as a trainer
2. Navigate to a trainee's page
3. Verify edit/delete buttons appear only on reports authored by this trainer
4. Verify no buttons on reports by other trainers
5. Test delete and edit work correctly

- [ ] **Step 3: Test edge cases**

1. Delete the last note in a report -> entire report card disappears
2. Edit achievement to empty text -> saves successfully, details cleared
3. Try to delete from another trainer's report (should not show button)
