# Churned Customers Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th tab "לקוחות שעזבו" to `/admin/retention` — a global manual list with CRUD, bulk paste, and per-note color tagging (none / yellow / red / green), accessible to admin and trainers.

**Architecture:** New `churned_customers` Supabase table with RLS mirroring `retention_notes`. Server Actions in `src/lib/actions/admin-churned-customers.ts`. Client components under `src/components/admin/retention/`. Optimistic UI updates. Paste parser as a pure utility with unit tests.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Supabase (Postgres + RLS), Zod, Tailwind CSS 4, Radix UI primitives, sonner for toasts, Vitest for pure utility tests.

**Spec:** `docs/superpowers/specs/2026-04-15-churned-customers-design.md`

---

## File Map

**Create:**
- `supabase/migrations/20260415120000_churned_customers.sql`
- `src/lib/validations/churned-customers.ts`
- `src/lib/utils/parse-churned-paste.ts`
- `src/lib/utils/__tests__/parse-churned-paste.test.ts`
- `src/lib/validations/__tests__/churned-customers.test.ts`
- `src/lib/actions/admin-churned-customers.ts`
- `src/components/admin/retention/ChurnedColorPicker.tsx`
- `src/components/admin/retention/ChurnedCustomersTab.tsx`
- `src/components/admin/retention/ChurnedCustomerRow.tsx`
- `src/components/admin/retention/PasteChurnedDialog.tsx`

**Modify:**
- `src/app/admin/retention/page.tsx` — fetch initial churned list
- `src/components/admin/retention/RetentionPageClient.tsx` — add 4th tab + churned state

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260415120000_churned_customers.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Churned customers: global manual list of customers who left the academy
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

-- RLS
ALTER TABLE churned_customers ENABLE ROW LEVEL SECURITY;

-- SELECT: admin and trainer
CREATE POLICY "Admin and trainers can read churned customers"
  ON churned_customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );

-- INSERT: admin and trainer (must set author_id to self)
CREATE POLICY "Admin and trainers can create churned customers"
  ON churned_customers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND author_id = auth.uid()
  );

-- UPDATE: author can update own; admin can update any
CREATE POLICY "Authors and admins can update churned customers"
  ON churned_customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.deleted_at IS NULL
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );

-- DELETE: author can delete own; admin can delete any
CREATE POLICY "Authors and admins can delete churned customers"
  ON churned_customers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.deleted_at IS NULL
      )
    )
  );
```

- [ ] **Step 2: Push migration to Supabase**

Run: `supabase db push`
Expected: migration applied, no errors.

- [ ] **Step 3: Verify**

Confirm table exists and RLS is enabled:
```bash
supabase db lint
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260415120000_churned_customers.sql
git commit -m "feat(retention): add churned_customers table with RLS"
```

---

## Task 2: Zod Validation Schemas

**Files:**
- Create: `src/lib/validations/churned-customers.ts`
- Create: `src/lib/validations/__tests__/churned-customers.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/validations/__tests__/churned-customers.test.ts
import { describe, it, expect } from "vitest";
import {
  createChurnedCustomerSchema,
  updateChurnedCustomerSchema,
  bulkRowSchema,
  NOTE_COLORS,
} from "../churned-customers";

describe("createChurnedCustomerSchema", () => {
  it("accepts a valid minimal input", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "דני כהן",
      endDate: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts full input with note and color", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "דני כהן",
      endDate: "2026-04-01",
      note: "חזר בקשר",
      noteColor: "yellow",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "   ",
      endDate: "2026-04-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "דני",
      endDate: "01/04/2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid note color", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "דני",
      endDate: "2026-04-01",
      noteColor: "blue",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 200 chars", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "א".repeat(201),
      endDate: "2026-04-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects note over 2000 chars", () => {
    const result = createChurnedCustomerSchema.safeParse({
      name: "דני",
      endDate: "2026-04-01",
      note: "א".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateChurnedCustomerSchema", () => {
  it("accepts a partial update", () => {
    const result = updateChurnedCustomerSchema.safeParse({
      note: "new note",
      noteColor: "red",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object", () => {
    const result = updateChurnedCustomerSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("bulkRowSchema", () => {
  it("accepts a valid row", () => {
    const result = bulkRowSchema.safeParse({
      name: "דני",
      endDate: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });
});

describe("NOTE_COLORS", () => {
  it("lists the four allowed colors", () => {
    expect(NOTE_COLORS).toEqual(["none", "yellow", "red", "green"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/validations/__tests__/churned-customers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schemas**

```ts
// src/lib/validations/churned-customers.ts
import { z } from "zod";
import { isValidDateString, isValidUUID } from "./common";

export const NOTE_COLORS = ["none", "yellow", "red", "green"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

const nameSchema = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v.length > 0, { message: "חובה להזין שם" })
  .refine((v) => v.length <= 200, { message: "השם ארוך מדי" });

const dateSchema = z
  .string()
  .refine(isValidDateString, { message: "תאריך לא תקין" });

const noteSchema = z
  .string()
  .max(2000, { message: "הערה ארוכה מדי" })
  .optional()
  .default("");

const noteColorSchema = z.enum(NOTE_COLORS).optional().default("none");

export const createChurnedCustomerSchema = z.object({
  name: nameSchema,
  endDate: dateSchema,
  note: noteSchema,
  noteColor: noteColorSchema,
});

export type CreateChurnedCustomerInput = z.infer<
  typeof createChurnedCustomerSchema
>;

export const updateChurnedCustomerSchema = z.object({
  name: nameSchema.optional(),
  endDate: dateSchema.optional(),
  note: z.string().max(2000).optional(),
  noteColor: z.enum(NOTE_COLORS).optional(),
});

export type UpdateChurnedCustomerInput = z.infer<
  typeof updateChurnedCustomerSchema
>;

export const bulkRowSchema = z.object({
  name: nameSchema,
  endDate: dateSchema,
});

export type BulkChurnedRow = z.infer<typeof bulkRowSchema>;

export const churnedIdSchema = z
  .string()
  .refine(isValidUUID, { message: "מזהה לא תקין" });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/validations/__tests__/churned-customers.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/churned-customers.ts src/lib/validations/__tests__/churned-customers.test.ts
git commit -m "feat(retention): add churned customer zod schemas"
```

---

## Task 3: Paste Parser Utility

**Files:**
- Create: `src/lib/utils/parse-churned-paste.ts`
- Create: `src/lib/utils/__tests__/parse-churned-paste.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/utils/__tests__/parse-churned-paste.test.ts
import { describe, it, expect } from "vitest";
import { parseChurnedPaste } from "../parse-churned-paste";

describe("parseChurnedPaste", () => {
  it("returns an empty result for empty input", () => {
    const result = parseChurnedPaste("");
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("parses tab-separated name and date", () => {
    const result = parseChurnedPaste("דני כהן\t01/04/2026");
    expect(result.valid).toEqual([{ name: "דני כהן", endDate: "2026-04-01" }]);
    expect(result.errors).toEqual([]);
  });

  it("parses comma-separated name and date", () => {
    const result = parseChurnedPaste("נועה לוי,15/03/2026");
    expect(result.valid).toEqual([{ name: "נועה לוי", endDate: "2026-03-15" }]);
  });

  it("accepts yyyy-mm-dd format", () => {
    const result = parseChurnedPaste("דני\t2026-04-01");
    expect(result.valid).toEqual([{ name: "דני", endDate: "2026-04-01" }]);
  });

  it("accepts dd.mm.yyyy format", () => {
    const result = parseChurnedPaste("דני\t01.04.2026");
    expect(result.valid).toEqual([{ name: "דני", endDate: "2026-04-01" }]);
  });

  it("skips empty lines and trims whitespace", () => {
    const input = "\n  דני\t01/04/2026  \n\n  נועה\t15/03/2026\n";
    const result = parseChurnedPaste(input);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("reports rows missing a separator", () => {
    const result = parseChurnedPaste("דני כהן");
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([
      { line: 1, raw: "דני כהן", message: "חסר תאריך סיום" },
    ]);
  });

  it("reports rows with empty name", () => {
    const result = parseChurnedPaste("\t01/04/2026");
    expect(result.errors).toEqual([
      { line: 1, raw: "\t01/04/2026", message: "חסר שם" },
    ]);
  });

  it("reports rows with invalid date", () => {
    const result = parseChurnedPaste("דני\t32/13/2026");
    expect(result.errors[0]).toMatchObject({
      line: 1,
      message: "תאריך לא תקין",
    });
  });

  it("returns valid rows and errors from a mixed paste", () => {
    const input = ["דני\t01/04/2026", "bad line", "נועה\t15/03/2026"].join(
      "\n",
    );
    const result = parseChurnedPaste(input);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/utils/__tests__/parse-churned-paste.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

```ts
// src/lib/utils/parse-churned-paste.ts
import { isValidDateString } from "@/lib/validations/common";

export interface ParsedChurnedRow {
  readonly name: string;
  readonly endDate: string;
}

export interface ParseChurnedError {
  readonly line: number;
  readonly raw: string;
  readonly message: string;
}

export interface ParseChurnedResult {
  readonly valid: readonly ParsedChurnedRow[];
  readonly errors: readonly ParseChurnedError[];
}

/**
 * Parses a pasted block of lines, each "name<tab or comma>date".
 * Accepted date formats: dd/mm/yyyy, yyyy-mm-dd, dd.mm.yyyy.
 * Returns valid rows and per-line error info.
 */
export function parseChurnedPaste(input: string): ParseChurnedResult {
  const valid: ParsedChurnedRow[] = [];
  const errors: ParseChurnedError[] = [];

  const lines = input.split(/\r?\n/);
  let lineNumber = 0;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === "") continue;
    lineNumber++;

    const separatorMatch = trimmed.match(/[\t,]/);
    if (!separatorMatch) {
      errors.push({
        line: lineNumber,
        raw: rawLine,
        message: "חסר תאריך סיום",
      });
      continue;
    }

    const sep = separatorMatch[0];
    const idx = trimmed.indexOf(sep);
    const name = trimmed.slice(0, idx).trim();
    const dateRaw = trimmed.slice(idx + 1).trim();

    if (name === "") {
      errors.push({ line: lineNumber, raw: rawLine, message: "חסר שם" });
      continue;
    }

    const normalized = normalizeDate(dateRaw);
    if (!normalized) {
      errors.push({
        line: lineNumber,
        raw: rawLine,
        message: "תאריך לא תקין",
      });
      continue;
    }

    valid.push({ name, endDate: normalized });
  }

  return { valid, errors };
}

function normalizeDate(value: string): string | null {
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isValidDateString(value) ? value : null;
  }

  // dd/mm/yyyy or dd.mm.yyyy
  const match = value.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (!match) return null;
  const [, dayStr, monthStr, yearStr] = match;
  const day = dayStr.padStart(2, "0");
  const month = monthStr.padStart(2, "0");
  const iso = `${yearStr}-${month}-${day}`;
  return isValidDateString(iso) ? iso : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/utils/__tests__/parse-churned-paste.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/parse-churned-paste.ts src/lib/utils/__tests__/parse-churned-paste.test.ts
git commit -m "feat(retention): add paste parser for churned customers"
```

---

## Task 4: Server Actions

**Files:**
- Create: `src/lib/actions/admin-churned-customers.ts`

- [ ] **Step 1: Write the server actions file**

```ts
// src/lib/actions/admin-churned-customers.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import {
  createChurnedCustomerSchema,
  updateChurnedCustomerSchema,
  bulkRowSchema,
  churnedIdSchema,
  type CreateChurnedCustomerInput,
  type UpdateChurnedCustomerInput,
  type NoteColor,
} from "@/lib/validations/churned-customers";

export interface ChurnedCustomer {
  readonly id: string;
  readonly name: string;
  readonly end_date: string;
  readonly note: string;
  readonly note_color: NoteColor;
  readonly author_id: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ActionError {
  readonly error: string;
}

export interface ActionOk<T> {
  readonly data: T;
  readonly error: null;
}

type ActionResult<T> = ActionOk<T> | { data: null; error: string };

const REVALIDATE_PATH = "/admin/retention";

export async function listChurnedCustomers(): Promise<
  readonly ChurnedCustomer[]
> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return [];

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "churned_customers")
    .select("id, name, end_date, note, note_color, author_id, created_at, updated_at")
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as ChurnedCustomer[];
}

export async function createChurnedCustomer(
  input: CreateChurnedCustomerInput,
): Promise<ActionResult<ChurnedCustomer>> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { data: null, error: authError };

  const parsed = createChurnedCustomerSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: "קלט לא תקין" };

  const supabase = await createClient();
  const { data, error: dbError } = await typedFrom(supabase, "churned_customers")
    .insert({
      name: parsed.data.name,
      end_date: parsed.data.endDate,
      note: parsed.data.note,
      note_color: parsed.data.noteColor,
      author_id: user!.id,
    })
    .select("id, name, end_date, note, note_color, author_id, created_at, updated_at")
    .single();

  if (dbError) {
    console.error("[ChurnedCustomers] Create error:", dbError);
    return { data: null, error: "שגיאה בשמירה" };
  }

  revalidatePath(REVALIDATE_PATH);
  return { data: data as unknown as ChurnedCustomer, error: null };
}

export interface BulkResult {
  readonly inserted: readonly ChurnedCustomer[];
  readonly errors: ReadonlyArray<{ index: number; message: string }>;
}

export async function createChurnedCustomersBulk(
  rows: ReadonlyArray<{ name: string; endDate: string }>,
): Promise<BulkResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { inserted: [], errors: [{ index: -1, message: authError }] };

  const validRows: Array<{ name: string; endDate: string }> = [];
  const errors: Array<{ index: number; message: string }> = [];

  rows.forEach((row, index) => {
    const parsed = bulkRowSchema.safeParse(row);
    if (parsed.success) {
      validRows.push(parsed.data);
    } else {
      errors.push({
        index,
        message: parsed.error.issues[0]?.message ?? "קלט לא תקין",
      });
    }
  });

  if (validRows.length === 0) {
    return { inserted: [], errors };
  }

  const supabase = await createClient();
  const { data, error: dbError } = await typedFrom(supabase, "churned_customers")
    .insert(
      validRows.map((r) => ({
        name: r.name,
        end_date: r.endDate,
        note: "",
        note_color: "none",
        author_id: user!.id,
      })),
    )
    .select("id, name, end_date, note, note_color, author_id, created_at, updated_at");

  if (dbError) {
    console.error("[ChurnedCustomers] Bulk insert error:", dbError);
    return {
      inserted: [],
      errors: [...errors, { index: -1, message: "שגיאה בשמירה מרוכזת" }],
    };
  }

  revalidatePath(REVALIDATE_PATH);
  return {
    inserted: (data ?? []) as unknown as ChurnedCustomer[],
    errors,
  };
}

export async function updateChurnedCustomer(
  id: string,
  patch: UpdateChurnedCustomerInput,
): Promise<ActionResult<ChurnedCustomer>> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { data: null, error: authError };

  const parsedId = churnedIdSchema.safeParse(id);
  if (!parsedId.success) return { data: null, error: "מזהה לא תקין" };

  const parsedPatch = updateChurnedCustomerSchema.safeParse(patch);
  if (!parsedPatch.success) return { data: null, error: "קלט לא תקין" };

  const supabase = await createClient();

  const { data: existing } = await typedFrom(supabase, "churned_customers")
    .select("author_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!existing) return { data: null, error: "רשומה לא נמצאה" };

  const isAdmin = profile!.role === "admin";
  const isAuthor = existing.author_id === user!.id;
  if (!isAdmin && !isAuthor) {
    return { data: null, error: "אין הרשאה לערוך רשומה זו" };
  }

  const updateRow: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsedPatch.data.name !== undefined) updateRow.name = parsedPatch.data.name;
  if (parsedPatch.data.endDate !== undefined) updateRow.end_date = parsedPatch.data.endDate;
  if (parsedPatch.data.note !== undefined) updateRow.note = parsedPatch.data.note;
  if (parsedPatch.data.noteColor !== undefined) updateRow.note_color = parsedPatch.data.noteColor;

  const { data, error: dbError } = await typedFrom(supabase, "churned_customers")
    .update(updateRow)
    .eq("id", parsedId.data)
    .select("id, name, end_date, note, note_color, author_id, created_at, updated_at")
    .single();

  if (dbError) {
    console.error("[ChurnedCustomers] Update error:", dbError);
    return { data: null, error: "שגיאה בעדכון" };
  }

  revalidatePath(REVALIDATE_PATH);
  return { data: data as unknown as ChurnedCustomer, error: null };
}

export async function deleteChurnedCustomer(
  id: string,
): Promise<{ success: true } | { error: string }> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const parsedId = churnedIdSchema.safeParse(id);
  if (!parsedId.success) return { error: "מזהה לא תקין" };

  const supabase = await createClient();
  const { data: existing } = await typedFrom(supabase, "churned_customers")
    .select("author_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!existing) return { error: "רשומה לא נמצאה" };

  const isAdmin = profile!.role === "admin";
  const isAuthor = existing.author_id === user!.id;
  if (!isAdmin && !isAuthor) {
    return { error: "אין הרשאה למחוק רשומה זו" };
  }

  const { error: dbError } = await typedFrom(supabase, "churned_customers")
    .delete()
    .eq("id", parsedId.data);

  if (dbError) {
    console.error("[ChurnedCustomers] Delete error:", dbError);
    return { error: "שגיאה במחיקה" };
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `admin-churned-customers.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/admin-churned-customers.ts
git commit -m "feat(retention): add churned customer server actions"
```

---

## Task 5: Color Picker Component

**Files:**
- Create: `src/components/admin/retention/ChurnedColorPicker.tsx`

- [ ] **Step 1: Implement the color picker**

```tsx
// src/components/admin/retention/ChurnedColorPicker.tsx
"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { NoteColor } from "@/lib/validations/churned-customers";

interface ChurnedColorPickerProps {
  readonly value: NoteColor;
  readonly onChange: (color: NoteColor) => void;
  readonly disabled?: boolean;
}

const SWATCHES: ReadonlyArray<{ color: NoteColor; label: string; bg: string; ring: string }> = [
  { color: "none", label: "ללא", bg: "bg-white", ring: "ring-1 ring-inset ring-gray-300" },
  { color: "yellow", label: "צהוב", bg: "bg-yellow-300", ring: "" },
  { color: "red", label: "אדום", bg: "bg-red-400", ring: "" },
  { color: "green", label: "ירוק", bg: "bg-green-400", ring: "" },
];

export function ChurnedColorPicker({
  value,
  onChange,
  disabled,
}: ChurnedColorPickerProps) {
  const [open, setOpen] = useState(false);
  const current = SWATCHES.find((s) => s.color === value) ?? SWATCHES[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`צבע הערה: ${current.label}`}
          disabled={disabled}
          className={`h-6 w-6 rounded-full ${current.bg} ${current.ring} disabled:opacity-50`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex items-center gap-2">
          {SWATCHES.map((s) => (
            <Button
              key={s.color}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={s.label}
              className="h-8 w-8 p-0"
              onClick={() => {
                onChange(s.color);
                setOpen(false);
              }}
            >
              <span className={`h-6 w-6 rounded-full ${s.bg} ${s.ring}`} />
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/retention/ChurnedColorPicker.tsx
git commit -m "feat(retention): add ChurnedColorPicker component"
```

---

## Task 6: Churned Customer Row (read + inline edit)

**Files:**
- Create: `src/components/admin/retention/ChurnedCustomerRow.tsx`

- [ ] **Step 1: Implement the row component**

```tsx
// src/components/admin/retention/ChurnedCustomerRow.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { ChurnedColorPicker } from "./ChurnedColorPicker";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import type { ChurnedCustomer } from "@/lib/actions/admin-churned-customers";
import type { NoteColor } from "@/lib/validations/churned-customers";

const NOTE_BG: Record<NoteColor, string> = {
  none: "",
  yellow: "bg-yellow-100",
  red: "bg-red-100",
  green: "bg-green-100",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface ChurnedCustomerRowProps {
  readonly row: ChurnedCustomer;
  readonly onUpdate: (
    id: string,
    patch: { name?: string; endDate?: string; note?: string; noteColor?: NoteColor },
  ) => Promise<{ error: string | null }>;
  readonly onDelete: (id: string) => Promise<{ error: string | null }>;
}

export function ChurnedCustomerRow({
  row,
  onUpdate,
  onDelete,
}: ChurnedCustomerRowProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(row.name);
  const [endDate, setEndDate] = useState(row.end_date);
  const [note, setNote] = useState(row.note);
  const [noteColor, setNoteColor] = useState<NoteColor>(row.note_color);

  const reset = () => {
    setName(row.name);
    setEndDate(row.end_date);
    setNote(row.note);
    setNoteColor(row.note_color);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await onUpdate(row.id, { name, endDate, note, noteColor });
    setSaving(false);
    if (!result.error) setEditing(false);
  };

  const handleCancel = () => {
    reset();
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="border-b">
        <td className="p-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </td>
        <td className="p-2">
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </td>
        <td className="p-2">
          <div className="flex items-center gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
            <ChurnedColorPicker value={noteColor} onChange={setNoteColor} />
          </div>
        </td>
        <td className="p-2">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSave}
              disabled={saving}
              aria-label="שמור"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              disabled={saving}
              aria-label="ביטול"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b">
      <td className="p-2">{row.name}</td>
      <td className="p-2 whitespace-nowrap">{formatDate(row.end_date)}</td>
      <td className={`p-2 ${NOTE_BG[row.note_color]}`}>{row.note}</td>
      <td className="p-2">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditing(true)}
            aria-label="ערוך"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <DeleteConfirmDialog
            title="מחיקת רשומה"
            description={`למחוק את ${row.name}?`}
            successMessage="הרשומה נמחקה"
            errorMessage="שגיאה במחיקה"
            onDelete={async () => {
              const res = await onDelete(row.id);
              if (res.error) return { error: res.error };
              return { success: true };
            }}
            trigger={
              <Button size="icon" variant="ghost" aria-label="מחק">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            }
          />
        </div>
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/retention/ChurnedCustomerRow.tsx
git commit -m "feat(retention): add churned customer row with inline edit"
```

---

## Task 7: Paste Dialog

**Files:**
- Create: `src/components/admin/retention/PasteChurnedDialog.tsx`

- [ ] **Step 1: Implement the paste dialog**

```tsx
// src/components/admin/retention/PasteChurnedDialog.tsx
"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clipboard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseChurnedPaste } from "@/lib/utils/parse-churned-paste";
import {
  createChurnedCustomersBulk,
  type ChurnedCustomer,
} from "@/lib/actions/admin-churned-customers";

interface PasteChurnedDialogProps {
  readonly onInserted: (rows: readonly ChurnedCustomer[]) => void;
}

export function PasteChurnedDialog({ onInserted }: PasteChurnedDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = useMemo(() => parseChurnedPaste(text), [text]);
  const validCount = parsed.valid.length;
  const errorCount = parsed.errors.length;

  const handleSubmit = async () => {
    if (validCount === 0) return;
    setSubmitting(true);
    const result = await createChurnedCustomersBulk(parsed.valid);
    setSubmitting(false);

    if (result.inserted.length > 0) {
      onInserted(result.inserted);
      toast.success(`נוספו ${result.inserted.length} רשומות`);
    }
    if (result.errors.length > 0) {
      toast.error(`${result.errors.length} שגיאות בשמירה`);
    }
    if (result.inserted.length > 0) {
      setText("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button">
          <Clipboard className="h-4 w-4 me-2" />
          הדבק רשימה
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>הדבקת רשימת לקוחות שעזבו</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={`הדבק שורות בפורמט: שם[Tab]תאריך\nתאריכים נתמכים: dd/mm/yyyy, yyyy-mm-dd, dd.mm.yyyy`}
            dir="auto"
          />
          {text && (
            <div className="text-sm space-y-1">
              <p>
                <span className="text-green-700">{validCount} תקינות</span>
                {" · "}
                <span className="text-red-700">{errorCount} שגיאות</span>
              </p>
              {errorCount > 0 && (
                <ul className="max-h-40 overflow-y-auto text-xs space-y-0.5 border rounded p-2">
                  {parsed.errors.map((err) => (
                    <li key={`${err.line}-${err.message}`} className="text-red-700">
                      שורה {err.line}: {err.message} — <code>{err.raw}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={validCount === 0 || submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" />
                מוסיף...
              </>
            ) : (
              `הוסף ${validCount}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/retention/PasteChurnedDialog.tsx
git commit -m "feat(retention): add paste dialog for bulk churned insert"
```

---

## Task 8: Churned Customers Tab (add form + table)

**Files:**
- Create: `src/components/admin/retention/ChurnedCustomersTab.tsx`

- [ ] **Step 1: Implement the tab component**

```tsx
// src/components/admin/retention/ChurnedCustomersTab.tsx
"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ChurnedColorPicker } from "./ChurnedColorPicker";
import { ChurnedCustomerRow } from "./ChurnedCustomerRow";
import { PasteChurnedDialog } from "./PasteChurnedDialog";
import {
  createChurnedCustomer,
  updateChurnedCustomer,
  deleteChurnedCustomer,
  type ChurnedCustomer,
} from "@/lib/actions/admin-churned-customers";
import type { NoteColor } from "@/lib/validations/churned-customers";

interface ChurnedCustomersTabProps {
  readonly initialRows: readonly ChurnedCustomer[];
}

export function ChurnedCustomersTab({ initialRows }: ChurnedCustomersTabProps) {
  const [rows, setRows] = useState<readonly ChurnedCustomer[]>(initialRows);
  const [name, setName] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [noteColor, setNoteColor] = useState<NoteColor>("none");
  const [isPending, startTransition] = useTransition();

  const canAdd = name.trim().length > 0 && endDate.length > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    startTransition(async () => {
      const result = await createChurnedCustomer({
        name,
        endDate,
        note,
        noteColor,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? "שגיאה בשמירה");
        return;
      }
      setRows((prev) => [result.data!, ...prev]);
      setName("");
      setEndDate("");
      setNote("");
      setNoteColor("none");
      toast.success("נוסף");
    });
  };

  const handleUpdate = async (
    id: string,
    patch: { name?: string; endDate?: string; note?: string; noteColor?: NoteColor },
  ) => {
    const result = await updateChurnedCustomer(id, patch);
    if (result.error || !result.data) {
      toast.error(result.error ?? "שגיאה בעדכון");
      return { error: result.error ?? "שגיאה" };
    }
    setRows((prev) =>
      prev.map((r) => (r.id === id ? result.data! : r)),
    );
    toast.success("עודכן");
    return { error: null };
  };

  const handleDelete = async (id: string) => {
    const result = await deleteChurnedCustomer(id);
    if ("error" in result) {
      return { error: result.error };
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    return { error: null };
  };

  const handlePasted = (inserted: readonly ChurnedCustomer[]) => {
    setRows((prev) => [...inserted, ...prev]);
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="rounded border p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_auto] items-center">
          <Input
            placeholder="שם לקוח"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="הערה (אופציונלי)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <ChurnedColorPicker value={noteColor} onChange={setNoteColor} />
          <Button onClick={handleAdd} disabled={!canAdd || isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin me-2" />
            ) : (
              <Plus className="h-4 w-4 me-2" />
            )}
            הוסף
          </Button>
        </div>
        <div className="flex justify-end">
          <PasteChurnedDialog onInserted={handlePasted} />
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">אין רשומות</p>
      ) : (
        <div className="rounded border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-start">שם</th>
                <th className="p-2 text-start">תאריך סיום</th>
                <th className="p-2 text-start">הערות</th>
                <th className="p-2 text-start">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ChurnedCustomerRow
                  key={row.id}
                  row={row}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/retention/ChurnedCustomersTab.tsx
git commit -m "feat(retention): add churned customers tab with add form and table"
```

---

## Task 9: Wire Tab into Retention Page

**Files:**
- Modify: `src/app/admin/retention/page.tsx`
- Modify: `src/components/admin/retention/RetentionPageClient.tsx`

- [ ] **Step 1: Update the server page to fetch initial churned rows**

Replace the contents of `src/app/admin/retention/page.tsx` with:

```tsx
import type { Metadata } from "next";
import {
  getRetentionReportMonths,
  getRetentionReport,
  getRetentionNotes,
} from "@/lib/actions/admin-retention";
import { listChurnedCustomers } from "@/lib/actions/admin-churned-customers";
import { RetentionPageClient } from "@/components/admin/retention/RetentionPageClient";

export const metadata: Metadata = {
  title: "שימור לקוחות | Garden of Eden",
};

export default async function RetentionPage() {
  const [months, initialChurned] = await Promise.all([
    getRetentionReportMonths(),
    listChurnedCustomers(),
  ]);
  const latestMonth = months.length > 0 ? months[0].report_month : null;

  const [initialData, initialNotes] = latestMonth
    ? await Promise.all([
        getRetentionReport(latestMonth),
        getRetentionNotes(latestMonth),
      ])
    : [null, new Map()];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">שימור לקוחות</h1>
      <RetentionPageClient
        months={months}
        initialMonth={latestMonth}
        initialData={initialData}
        initialNotes={initialNotes}
        initialChurned={initialChurned}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update RetentionPageClient to add the 4th tab**

Apply the following changes to `src/components/admin/retention/RetentionPageClient.tsx`:

1. Add the import at the top near other imports:

```tsx
import { ChurnedCustomersTab } from "./ChurnedCustomersTab";
import type { ChurnedCustomer } from "@/lib/actions/admin-churned-customers";
```

2. Extend `RetentionPageClientProps`:

```tsx
interface RetentionPageClientProps {
  months: readonly RetentionReportMonth[];
  initialMonth: string | null;
  initialData: RetentionReportData | null;
  initialNotes: ReadonlyMap<string, RetentionNote>;
  initialChurned: readonly ChurnedCustomer[];
}
```

3. Destructure `initialChurned` in the function signature:

```tsx
export function RetentionPageClient({
  months,
  initialMonth,
  initialData,
  initialNotes,
  initialChurned,
}: RetentionPageClientProps) {
```

4. Replace the early return block so the churned tab remains visible when no monthly reports exist. Replace:

```tsx
  if (months.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        אין דוחות זמינים
      </p>
    );
  }
```

with:

```tsx
  const hasMonths = months.length > 0;
```

5. Update the JSX return. Replace the existing `return ( ... )` block (starting with `<div className="space-y-6">`) with:

```tsx
  return (
    <div className="space-y-6">
      {hasMonths && (
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="בחר חודש" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.report_month} value={m.report_month}>
                {formatReportMonth(m.report_month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Tabs defaultValue={hasMonths ? "monthly" : "churned"} dir="rtl">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="monthly" disabled={!hasMonths}>
            מנוי חודשי{data ? ` (${data.monthly.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="pro" disabled={!hasMonths}>
            מנוי PRO{data ? ` (${data.pro.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="training_card" disabled={!hasMonths}>
            כרטיסת אימונים{data ? ` (${data.training_card.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="churned">לקוחות שעזבו</TabsTrigger>
        </TabsList>

        {isPending ? (
          <p className="text-center text-muted-foreground py-8">טוען...</p>
        ) : (
          <>
            {hasMonths && data && (
              <>
                <TabsContent value="monthly" className="mt-4">
                  <RetentionTable
                    entries={data.monthly}
                    monthKeys={monthKeys}
                    notes={notes}
                    onSaveNote={handleSaveNote}
                  />
                </TabsContent>
                <TabsContent value="pro" className="mt-4">
                  <RetentionTable
                    entries={data.pro}
                    monthKeys={monthKeys}
                    notes={notes}
                    onSaveNote={handleSaveNote}
                  />
                </TabsContent>
                <TabsContent value="training_card" className="mt-4">
                  <RetentionTable
                    entries={data.training_card}
                    monthKeys={monthKeys}
                    notes={notes}
                    onSaveNote={handleSaveNote}
                  />
                </TabsContent>
              </>
            )}
            <TabsContent value="churned" className="mt-4">
              <ChurnedCustomersTab initialRows={initialChurned} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors on the modified files.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/retention/page.tsx src/components/admin/retention/RetentionPageClient.tsx
git commit -m "feat(retention): wire churned customers tab into retention page"
```

---

## Task 10: Build & Manual Verification

- [ ] **Step 1: Run all tests**

Run: `npm run test:run`
Expected: all tests pass, including the new `parse-churned-paste` and `churned-customers` schema tests.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual QA in dev server**

Run: `npm run dev` and visit `/admin/retention`.

Checklist:
- [ ] The new "לקוחות שעזבו" tab appears as the 4th tab.
- [ ] Add form accepts name + date and adds a row at the top.
- [ ] Color picker changes the notes cell background.
- [ ] Paste dialog parses `שם<Tab>תאריך` format and previews valid/invalid rows.
- [ ] Bulk insert adds all valid rows at the top.
- [ ] Edit button toggles inline edit and saves correctly.
- [ ] Delete button opens confirm dialog and removes the row.
- [ ] RTL layout displays correctly.
- [ ] When a trainer is logged in, they can only edit/delete their own rows (attempt on another user's row returns a clear error).

- [ ] **Step 6: Final commit if QA-driven fixes were needed**

If any fixes were required during manual QA:

```bash
git add -A
git commit -m "fix(retention): address churned tab QA feedback"
```

Otherwise skip.

---

## Notes for Implementer

- **Paths & aliases:** `@/` maps to `src/`.
- **Supabase client imports:**
  - `createClient()` from `@/lib/supabase/server` in server actions.
  - `createClient()` from `@/lib/supabase/client` in client components (not needed here — all DB access is in server actions).
- **`typedFrom(supabase, "table")`** is used because the generated Supabase types may not include new tables until regenerated. Don't fall back to `(supabase as any)`.
- **Hebrew strings:** all user-facing text is in Hebrew. Keep it consistent with existing tone in `admin-retention.ts`.
- **RTL + `me-2` class:** Tailwind logical margin (`me-2` = margin-end) is already used across the project — use those instead of `mr-2`/`ml-2`.
- **`DeleteConfirmDialog` return type:** the component expects `{ error } | { success: true }`. Adapt the result from `onDelete` exactly to that shape — see Task 6.
- **Optimistic UI:** every action updates local state first; on server error, toast and keep the pre-existing state (rollback). The patterns in this plan already follow that.
- **Hooks order:** don't introduce early returns before all hooks have run in `RetentionPageClient` (the current code already has hooks before the `hasMonths` check — Task 9 keeps that order).
