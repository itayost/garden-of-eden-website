# Churned Customers Tab — Design Spec

**Date:** 2026-04-15
**Feature:** New "לקוחות שעזבו" (churned customers) tab inside the retention page.
**Scope:** Admin + trainer manual tracking list of customers who left the academy.

## Goal

Add a fourth tab to the retention page (`/admin/retention`) that holds a global, manually-managed list of customers who have left. Admins and trainers can add entries one-at-a-time, bulk-paste from an external file (Excel/CSV-style), edit inline, delete, and color-tag notes for quick visual scanning.

## Requirements Summary

- **Global list** — not tied to the monthly report selector at the top of the page.
- **Columns:** customer name, end date, notes.
- **Note color tagging:** none / yellow / red / green (applies to the notes cell only).
- **Add rows at the top** — sort by insertion order (`created_at DESC`).
- **Bulk paste** — external format `name<Tab>date` (or comma-separated), each line = one row.
- **Full CRUD** — edit name/date/note/color and delete rows.
- **Access:** admin + trainer (both can add/edit). Trainers can only edit/delete their own rows; admin can edit/delete any.

## Data Model

New table `churned_customers`:

```sql
CREATE TABLE churned_customers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  end_date     date NOT NULL,
  note         text NOT NULL DEFAULT '',
  note_color   text NOT NULL DEFAULT 'none'
                CHECK (note_color IN ('none', 'yellow', 'red', 'green')),
  author_id    uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_churned_customers_created ON churned_customers(created_at DESC);
```

**Design notes:**

- **No UNIQUE constraint.** Duplicates are allowed — the same person may leave twice, and different people may share a name. The user manually deletes duplicates if needed.
- **`note_color` as text with CHECK.** Simpler than a Postgres ENUM type (which requires a migration per value change) and follows the codebase pattern.
- **No `profiles.id` foreign key.** Churned customers are not system users; the name is free text.
- **Index on `created_at DESC`.** Supports the primary sort order efficiently.
- **`updated_at`** updated via server action (no trigger) — consistent with `retention_notes`.

### RLS Policies

Mirror the `retention_notes` policy structure:

- **SELECT:** admin + trainer (both roles, `deleted_at IS NULL`).
- **INSERT:** admin + trainer, with `author_id = auth.uid()`.
- **UPDATE:** admin can update any; trainer can update rows where `author_id = auth.uid()`.
- **DELETE:** admin can delete any; trainer can delete rows where `author_id = auth.uid()`.

## Server Actions

New file: `src/lib/actions/admin-churned-customers.ts`.

```ts
listChurnedCustomers(): Promise<ChurnedCustomer[]>
// Sorted by created_at DESC. No pagination in v1.

createChurnedCustomer(input: {
  name: string;
  endDate: string;     // YYYY-MM-DD
  note?: string;
  noteColor?: 'none' | 'yellow' | 'red' | 'green';
}): Promise<{ data: ChurnedCustomer | null; error: string | null }>

createChurnedCustomersBulk(
  rows: Array<{ name: string; endDate: string }>
): Promise<{
  inserted: ChurnedCustomer[];
  errors: Array<{ index: number; message: string }>;
}>

updateChurnedCustomer(id: string, patch: {
  name?: string;
  endDate?: string;
  note?: string;
  noteColor?: 'none' | 'yellow' | 'red' | 'green';
}): Promise<{ data: ChurnedCustomer | null; error: string | null }>

deleteChurnedCustomer(id: string): Promise<{ error: string | null }>
```

### Validation

New Zod schemas in `src/lib/validations/churned-customers.ts`:

- `name`: trimmed non-empty, max 200 chars.
- `endDate`: ISO `YYYY-MM-DD`. No range restriction (historical or future allowed).
- `noteColor`: `'none' | 'yellow' | 'red' | 'green'`.
- `note`: optional string, max 2000 chars.
- `id`: validated via `isValidUUID()` from `src/lib/validations/common.ts`.

### Authorization Pattern

Every action:
1. Calls `verifyAdminOrTrainer()` from `src/lib/actions/shared/`.
2. For `update`/`delete`: additionally confirms that the caller is admin OR the row's `author_id` matches `auth.uid()`. Server-side explicit check alongside RLS for clear error messages.
3. On success, calls `revalidatePath('/admin/retention')`.

### Bulk Insert Flow

Bulk insert is split between client and server:

- **Client** parses the pasted textarea, validates each line, and shows a preview.
- **Server** receives a structured array `Array<{ name, endDate }>`. Each row is validated server-side; valid rows are inserted in a single `insert()` call. Invalid rows are returned with index + message so the client can render per-row errors.
- Server-side validation is still authoritative — the client preview is UX only.

## UI Structure

### Changes to `RetentionPageClient.tsx`

- `TabsList` changes from `grid-cols-3` to `grid-cols-4`.
- New `<TabsTrigger value="churned">לקוחות שעזבו</TabsTrigger>` (no count badge in v1).
- The monthly report selector above the tabs stays visible but does **not** affect the churned tab — it only drives the three existing monthly tabs.
- New `<TabsContent value="churned">` renders `<ChurnedCustomersTab />`.

### New Component: `ChurnedCustomersTab.tsx`

Location: `src/components/admin/retention/ChurnedCustomersTab.tsx`.

Layout:

```
┌─────────────────────────────────────────────────┐
│ [Add form — persistent above the table]         │
│ שם: [___] תאריך: [📅] הערה: [___] [🎨] [+ הוסף] │
│                                    [📋 הדבק רשימה] │
├─────────────────────────────────────────────────┤
│ [Table]                                          │
│ שם       │ תאריך סיום │ הערות          │ פעולות │
│ דני כהן  │ 01/04/26   │ [🟡 חזר בקשר]  │ ✏️ 🗑  │
│ נועה לוי │ 15/03/26   │                │ ✏️ 🗑  │
└─────────────────────────────────────────────────┘
```

### Add Form (single row)

- Four fields: name (text), end date (DatePicker), note (text), color picker (popover with 4 circular swatches — none/yellow/red/green).
- "הוסף" button submits; fields reset on success.
- Client-side validation before submit: name and end date required.
- Uses `useFormSubmission` hook from `src/hooks/`.

### Paste Dialog (`PasteChurnedDialog.tsx`)

- Triggered by "הדבק רשימה" button next to "הוסף".
- Dialog contains a `<Textarea>` with placeholder `הדבק שורות בפורמט: שם[Tab]תאריך (dd/mm/yyyy או yyyy-mm-dd)`.
- On every `onChange`, parse:
  - Split on `\n`.
  - For each line, split on `\t` or `,` (first delimiter found).
  - Trim fields; validate name non-empty and date parseable (accepts `dd/mm/yyyy`, `yyyy-mm-dd`, `dd.mm.yyyy`).
- **Preview table** below the textarea:
  - Each line shown with status: ✓ valid (green) or ⚠ invalid (red) + reason.
  - Summary: `X שורות תקינות, Y שגיאות`.
- Primary button `הוסף X` (only valid rows) — disabled when `X === 0`.
- On success: close dialog, prepend new rows to the table via optimistic update, toast with count.
- Pasted rows are created with `note = ''` and `note_color = 'none'`. Editing happens inline afterward.

### Table

- Plain `<table>` with project styling, following `RetentionTable` conventions.
- Columns: name, end date (formatted `dd/mm/yyyy`), note (with colored background per `note_color`), actions.
- Edit button (✏️) toggles the row to inline-edit mode:
  - Inputs replace cells; color picker appears next to the note.
  - "שמור" / "ביטול" buttons.
  - On save: optimistic update + server call + rollback on error.
- Delete button (🗑) opens `DeleteConfirmDialog` (existing component in `src/components/admin/`).
- Note cell backgrounds: `bg-yellow-100`, `bg-red-100`, `bg-green-100`. Soft tints; text color unchanged for readability. For `none`: no background.

### Color Picker UI

- Popover trigger: a small circle showing the currently selected color (or an empty ring for `none`).
- Popover content: horizontal row of 4 circular buttons — none (⚪), yellow (🟡), red (🔴), green (🟢).
- Keyboard accessible.

### Optimistic Updates

All CRUD operations update local state immediately, then call the server action. On error, revert via toast + state rollback. Consistent with existing patterns in `RetentionPageClient`.

## Edge Cases

- **Empty state:** when the list is empty, the table area shows `אין רשומות` and the add form stays visible.
- **Duplicate paste:** allowed (design decision — no dedup). Two identical rows appear; user can delete manually.
- **Invalid paste lines:** reported in the preview; only valid rows are sent to the server. The invalid lines remain in the textarea so the user can fix them.
- **Long note:** cap at 2000 chars client-side (textarea maxLength) and server-side (Zod).
- **Trainer deletes another trainer's row:** server action returns a clear error (`אין הרשאה לערוך רשומה זו`); RLS is the secondary safety net.
- **Race condition on concurrent paste:** each row is an independent insert; Postgres handles concurrency via row-level locks. Client refreshes `listChurnedCustomers()` on mount — the optimistic list may briefly differ from another user's state, which is acceptable.

## Security

- All server actions go through `verifyAdminOrTrainer()`.
- Update/delete explicitly check author or admin before calling the DB.
- RLS policies mirror the action checks — defense in depth.
- No user input rendered as HTML — all text passed through React (safe by default).
- UUID validation on every `id` parameter.

## Testing

Per project convention (no mock tests — real Supabase + pure unit tests only):

- **Pure unit tests** for the paste-parser utility: `src/lib/utils/parse-churned-paste.ts` — covers tab-separated, comma-separated, Hebrew names, `dd/mm/yyyy` vs `yyyy-mm-dd` vs `dd.mm.yyyy`, invalid dates, empty lines, whitespace.
- **Zod schema tests** for `churned-customers.ts` — valid/invalid cases for each field.
- Manual QA covers the full UI flow (add, paste, edit, delete, color, RLS).

## Files to Create

- `supabase/migrations/<timestamp>_churned_customers.sql` — table + RLS.
- `src/lib/actions/admin-churned-customers.ts` — server actions.
- `src/lib/validations/churned-customers.ts` — Zod schemas + types.
- `src/lib/utils/parse-churned-paste.ts` — paste parser + tests.
- `src/lib/utils/parse-churned-paste.test.ts` — unit tests.
- `src/components/admin/retention/ChurnedCustomersTab.tsx` — main tab component.
- `src/components/admin/retention/PasteChurnedDialog.tsx` — paste dialog.
- `src/components/admin/retention/ChurnedColorPicker.tsx` — color picker popover.

## Files to Modify

- `src/components/admin/retention/RetentionPageClient.tsx` — add 4th tab, pass initial churned list.
- `src/app/admin/retention/page.tsx` — fetch initial churned list alongside the existing fetches.

## Out of Scope (v1)

- Pagination (add later if list grows beyond a few hundred rows).
- Tab counter badge.
- Sort by columns (insertion order only).
- Export to CSV (can be added using the existing export pattern later).
- Deduplication on paste.
- Historical audit log of changes.
- Color meaning convention (colors are free-form for now).
