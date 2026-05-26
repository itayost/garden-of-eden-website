# Leads Custom Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded paid/organic source enum on leads with a `lead_tabs` table that admins can CRUD from the leads page, so every lead is assigned to a user-managed tab.

**Architecture:** Add `lead_tabs` table; seed it with the two existing values; add `leads.tab_id` FK; backfill from `source`; expose CRUD via server actions + a Dialog UI; switch URL/webhook/CSV to the new shape with one cycle of backwards-compat for the legacy `source` field.

**Tech Stack:** Next.js 16 (App Router, server components/actions), Supabase Postgres + RLS (project id `sedqdnpdvwpivrocdlmh`), TypeScript strict, Tailwind 4, Radix/shadcn UI, Zod, react-hook-form, nuqs (URL search-param hooks), Vitest for pure utilities only (project policy — no mock tests).

**Project conventions (from CLAUDE.md):**
- All Hebrew, RTL.
- Many small files (200–400 lines typical).
- Server actions live in `src/lib/actions/` (or a feature folder); each file has `"use server"`.
- Use `typedFrom(supabase, "table")` from `src/lib/supabase/helpers.ts` for any table not in `database.types.ts`.
- Use `verifyAdmin()` (admin-only) and `verifyAdminOrTrainer()` (admin or trainer) from `@/lib/actions/shared`.
- Validate IDs with `isValidUUID()` from `@/lib/validations/common`.
- No mock-based tests. Tests are added only for pure utility functions.
- Path alias `@/` → `src/`.

**Spec:** [docs/superpowers/specs/2026-05-26-leads-custom-tabs-design.md](../specs/2026-05-26-leads-custom-tabs-design.md).

---

## File structure

**New**
| Path | Responsibility |
|------|----------------|
| `supabase/migrations/20260526120000_lead_tabs.sql` | Create `lead_tabs`, seed paid+organic rows, add `leads.tab_id`, backfill, drop CHECK on `source`. |
| `src/types/lead-tabs.ts` | `LeadTab` interface and `LEAD_TAB_COLORS` allow-list + Tailwind class map. |
| `src/lib/validations/lead-tabs.ts` | Zod schemas + pure helpers (`deriveLeadTabSlug`, color enum). |
| `src/lib/actions/admin-lead-tabs.ts` | All `lead_tabs` server actions (list/create/update/reorder/delete/assign-lead). |
| `src/components/admin/leads/LeadTabBadge.tsx` | Small colored pill. |
| `src/components/admin/leads/LeadTabFormDialog.tsx` | Create/edit a tab. |
| `src/components/admin/leads/LeadTabDeleteDialog.tsx` | Delete confirm with destination picker. |
| `src/components/admin/leads/LeadTabsManager.tsx` | Manager dialog (list, reorder, open form/delete dialogs). |
| `src/lib/validations/__tests__/lead-tabs.test.ts` | Vitest tests for `deriveLeadTabSlug` (pure helper only). |

**Modified**
| Path | What changes |
|------|--------------|
| `src/types/leads.ts` | Drop `LEAD_SOURCES`/`LeadSource`/`LEAD_SOURCE_LABELS`; `Lead` gains `tab_id` + joined `tab`; rename `LEAD_SELECT_WITH_TRAINER` → `LEAD_SELECT_WITH_RELATIONS`; include tab join string. |
| `src/lib/validations/leads.ts` | Remove `source` from `leadCreateSchema`/`leadUpdateSchema`; add optional `tab_id`. Webhook schema keeps legacy `source` but adds `tab_slug`. |
| `src/lib/actions/admin-leads-list.ts` | Filter by `tab_id` instead of `source`. Use renamed select const. |
| `src/lib/actions/admin-leads-create.ts` | Accept `tab_id`; resolve default tab if missing. |
| `src/lib/actions/admin-leads-update.ts` | Allow updating `tab_id`. |
| `src/app/api/webhooks/leads/route.ts` | Accept `tab_slug` or legacy `source`; resolve to `tab_id`. |
| `src/app/admin/leads/page.tsx` | Fetch tabs; resolve `?tab=<slug>` (`?source=` alias); filter by `tab_id`. |
| `src/components/admin/leads/LeadsTabs.tsx` | Render dynamic tabs from props; render "ניהול טאבים" button for admins. |
| `src/components/admin/leads/LeadDataTable.tsx` | Take `tabs` + `activeTab`; thread down. |
| `src/components/admin/leads/LeadTableColumns.tsx` | `showPaidIndicator` keyed on slug; new "טאב" column showing the joined tab via `LeadTabBadge`. |
| `src/components/admin/leads/LeadDetailSheet.tsx` | Replace source Select with tab Select. |
| `src/components/admin/leads/LeadCreateDialog.tsx` | Replace source Select with tab Select; pre-fill active tab. |
| `src/components/admin/exports/LeadExportButton.tsx` | Replace `מקור` column with `טאב`. |

---

## Task 1: Migration — create `lead_tabs`, seed, backfill `leads.tab_id`

**Files:**
- Create: `supabase/migrations/20260526120000_lead_tabs.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
CREATE TABLE lead_tabs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  color       TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CONSTRAINT lead_tabs_slug_format CHECK (slug ~ '^[a-z0-9_-]{1,50}$')
);

CREATE UNIQUE INDEX lead_tabs_one_default_idx
  ON lead_tabs (is_default)
  WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX lead_tabs_position_idx
  ON lead_tabs (position)
  WHERE deleted_at IS NULL;

ALTER TABLE lead_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_trainer_select" ON lead_tabs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'trainer')
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "admin_insert" ON lead_tabs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "admin_update" ON lead_tabs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
        AND role = 'admin'
        AND deleted_at IS NULL
    )
  );

CREATE TRIGGER update_lead_tabs_updated_at
  BEFORE UPDATE ON lead_tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO lead_tabs (slug, name, position, is_default) VALUES
  ('paid',    'ממומנים',  0, true),
  ('organic', 'אורגניים', 1, false);

ALTER TABLE leads
  ADD COLUMN tab_id UUID REFERENCES lead_tabs(id) ON DELETE RESTRICT;

UPDATE leads
SET tab_id = (SELECT id FROM lead_tabs WHERE slug = leads.source);

ALTER TABLE leads
  ALTER COLUMN tab_id SET NOT NULL;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_source_check;

CREATE INDEX leads_tab_id_idx ON leads (tab_id);
```

- [ ] **Step 2: Apply via Supabase MCP**

Call `mcp__plugin_supabase_supabase__apply_migration` with `project_id="sedqdnpdvwpivrocdlmh"`, `name="lead_tabs"`, and the SQL above.
Expected: `{"success": true}`.

- [ ] **Step 3: Verify via `execute_sql`**

```sql
SELECT slug, name, position, is_default FROM lead_tabs ORDER BY position;
```
Expected: two rows, `paid` (default), `organic`.

```sql
SELECT COUNT(*) AS total, COUNT(tab_id) AS with_tab FROM leads;
```
Expected: `total == with_tab`.

```sql
SELECT t.slug, COUNT(*) FROM leads l JOIN lead_tabs t ON t.id = l.tab_id GROUP BY t.slug;
```
Expected: paid/organic counts match the pre-migration `source` totals.

- [ ] **Step 4: Confirm FK constraint name** (needed by the PostgREST select)

```sql
SELECT conname FROM pg_constraint WHERE conrelid='public.leads'::regclass AND contype='f';
```
Expected: list includes `leads_tab_id_fkey`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260526120000_lead_tabs.sql
git commit -m "feat(leads): add lead_tabs table and migrate source to tab_id"
```

---

## Task 2: Types — `lead-tabs.ts` + update `leads.ts`

**Files:**
- Create: `src/types/lead-tabs.ts`
- Modify: `src/types/leads.ts`

- [ ] **Step 1: Create `src/types/lead-tabs.ts`**

```ts
export type LeadTabColor =
  | "gray"
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "pink"
  | "yellow";

export const LEAD_TAB_COLORS: readonly LeadTabColor[] = [
  "gray",
  "blue",
  "green",
  "orange",
  "purple",
  "red",
  "pink",
  "yellow",
] as const;

export const LEAD_TAB_COLOR_LABELS: Record<LeadTabColor, string> = {
  gray: "אפור",
  blue: "כחול",
  green: "ירוק",
  orange: "כתום",
  purple: "סגול",
  red: "אדום",
  pink: "ורוד",
  yellow: "צהוב",
};

export const LEAD_TAB_COLOR_CLASSES: Record<LeadTabColor, string> = {
  gray:   "bg-gray-100 text-gray-800",
  blue:   "bg-blue-100 text-blue-800",
  green:  "bg-green-100 text-green-800",
  orange: "bg-orange-100 text-orange-800",
  purple: "bg-purple-100 text-purple-800",
  red:    "bg-red-100 text-red-800",
  pink:   "bg-pink-100 text-pink-800",
  yellow: "bg-yellow-100 text-yellow-800",
};

export interface LeadTab {
  id: string;
  slug: string;
  name: string;
  color: LeadTabColor | null;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function toLeadTabColor(value: string | null): LeadTabColor | null {
  if (!value) return null;
  return (LEAD_TAB_COLORS as readonly string[]).includes(value)
    ? (value as LeadTabColor)
    : null;
}
```

- [ ] **Step 2: Update `src/types/leads.ts`**

Edit A — drop the obsolete source exports:
```ts
// REMOVE these lines:
export const LEAD_SOURCES = ["paid", "organic"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

// AND lower in the file, REMOVE:
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  paid: "ממומנים",
  organic: "אורגניים",
};
```

Edit B — replace the `LEAD_SELECT_WITH_TRAINER` constant:
```ts
// REPLACE this constant:
export const LEAD_SELECT_WITH_TRAINER =
  "*, assigned_trainer:profiles!leads_assigned_trainer_id_fkey(id, full_name)";

// WITH:
import type { LeadTab } from "./lead-tabs";
export type { LeadTab } from "./lead-tabs";

export const LEAD_SELECT_WITH_RELATIONS =
  "*, assigned_trainer:profiles!leads_assigned_trainer_id_fkey(id, full_name), tab:lead_tabs!leads_tab_id_fkey(id, slug, name, color, position, is_default, created_at, updated_at)";
```

Edit C — in the `Lead` interface body:
```ts
// REMOVE the `source: LeadSource;` line.
// ADD after `assigned_trainer?:` line:
tab_id: string;
tab?: LeadTab | null;
```

- [ ] **Step 3: Type check this file in isolation**

Run: `npx tsc --noEmit --pretty false`
Expected: many errors in consumers (LeadCreateDialog, LeadDetailSheet, page, etc.). They will be fixed in later tasks. The errors must not reference `src/types/leads.ts` or `src/types/lead-tabs.ts`. If either file shows an error, fix it before moving on.

- [ ] **Step 4: Commit**

```bash
git add src/types/lead-tabs.ts src/types/leads.ts
git commit -m "feat(leads): add LeadTab type and switch leads select to tab join"
```

---

## Task 3: Validations + pure helper (with unit test)

**Files:**
- Create: `src/lib/validations/__tests__/lead-tabs.test.ts`
- Create: `src/lib/validations/lead-tabs.ts`
- Modify: `src/lib/validations/leads.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/validations/__tests__/lead-tabs.test.ts
import { describe, expect, it } from "vitest";
import { deriveLeadTabSlug } from "../lead-tabs";

describe("deriveLeadTabSlug", () => {
  it("collapses whitespace and punctuation into single dashes", () => {
    expect(deriveLeadTabSlug("Campaign  – 2026!")).toBe("campaign-2026");
  });

  it("falls back to 'tab' when the input has no slug-safe characters", () => {
    expect(deriveLeadTabSlug("!!!")).toBe("tab");
    expect(deriveLeadTabSlug("   ")).toBe("tab");
    expect(deriveLeadTabSlug("ממומנים")).toBe("tab");
  });

  it("limits the slug to 50 characters", () => {
    const long = "a".repeat(80);
    expect(deriveLeadTabSlug(long)).toHaveLength(50);
  });

  it("never emits leading or trailing dashes/underscores", () => {
    expect(deriveLeadTabSlug("--hello--")).toBe("hello");
    expect(deriveLeadTabSlug("__hi__")).toBe("hi");
  });

  it("lowercases the output", () => {
    expect(deriveLeadTabSlug("PAID")).toBe("paid");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/lib/validations/__tests__/lead-tabs.test.ts`
Expected: FAIL — module not yet exported.

- [ ] **Step 3: Create `src/lib/validations/lead-tabs.ts`**

```ts
import { z } from "zod";
import { LEAD_TAB_COLORS } from "@/types/lead-tabs";

const SLUG_REGEX = /^[a-z0-9_-]{1,50}$/;

/**
 * Convert a human label into a slug.
 * - Lowercases.
 * - Replaces any run of characters outside [a-z0-9] with a single dash.
 * - Strips leading/trailing dashes and underscores.
 * - Truncates to 50 characters (the DB column constraint).
 * - Returns "tab" if the result is empty (e.g. Hebrew-only or punctuation-only input).
 */
export function deriveLeadTabSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 50)
    .replace(/^[-_]+|[-_]+$/g, "");
  return base.length > 0 ? base : "tab";
}

export const leadTabSlugSchema = z
  .string()
  .regex(SLUG_REGEX, "מזהה טאב לא תקין");

export const leadTabNameSchema = z
  .string()
  .trim()
  .min(1, "חובה למלא שם")
  .max(80, "שם ארוך מדי");

export const leadTabColorSchema = z
  .enum(LEAD_TAB_COLORS)
  .nullable()
  .optional();

export const leadTabCreateSchema = z.object({
  name: leadTabNameSchema,
  slug: leadTabSlugSchema.optional(),
  color: leadTabColorSchema,
  is_default: z.boolean().optional().default(false),
});
export type LeadTabCreateInput = z.infer<typeof leadTabCreateSchema>;

export const leadTabUpdateSchema = z.object({
  id: z.string().uuid("מזהה לא תקין"),
  name: leadTabNameSchema.optional(),
  color: leadTabColorSchema,
  is_default: z.boolean().optional(),
});
export type LeadTabUpdateInput = z.infer<typeof leadTabUpdateSchema>;

export const leadTabReorderSchema = z.object({
  ordered_ids: z.array(z.string().uuid()).min(1, "סדר הטאבים ריק"),
});
export type LeadTabReorderInput = z.infer<typeof leadTabReorderSchema>;

export const leadTabDeleteSchema = z.object({
  id: z.string().uuid("מזהה לא תקין"),
  move_to_tab_id: z.string().uuid("יש לבחור טאב יעד"),
});
export type LeadTabDeleteInput = z.infer<typeof leadTabDeleteSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- src/lib/validations/__tests__/lead-tabs.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Update `src/lib/validations/leads.ts`**

Edit A — imports: drop `LEAD_SOURCES`:
```ts
// REPLACE:
import {
  LEAD_CONTACT_OUTCOMES,
  LEAD_CONTACT_TYPES,
  LEAD_PHONE_REGEX,
  LEAD_SOURCES,
  LEAD_STATUSES,
} from "@/types/leads";

// WITH:
import {
  LEAD_CONTACT_OUTCOMES,
  LEAD_CONTACT_TYPES,
  LEAD_PHONE_REGEX,
  LEAD_STATUSES,
} from "@/types/leads";
```

Edit B — delete the `const leadSources = ...` line (it referenced LEAD_SOURCES).

Edit C — in `leadCreateSchema`, REMOVE the `source: z.enum(leadSources).optional().default("paid"),` line and ADD:
```ts
tab_id: z.string().uuid("מזהה טאב לא תקין").optional(),
```

Edit D — in `leadUpdateSchema`, REMOVE the `source: z.enum(leadSources).optional(),` line and ADD:
```ts
tab_id: z.string().uuid("מזהה טאב לא תקין").optional(),
```

Edit E — in `leadWebhookSchema`, REPLACE the `source: z.enum(leadSources).optional().default("paid"),` line WITH:
```ts
tab_slug: z.string().regex(/^[a-z0-9_-]{1,50}$/).optional(),
source: z.enum(["paid", "organic"]).optional(),
```

- [ ] **Step 6: Type check + lint**

Run: `npx tsc --noEmit --pretty false`
Expected: only consumer errors. The three modified files compile.

Run: `npm run lint`
Expected: existing 16 warnings only.

- [ ] **Step 7: Commit**

```bash
git add src/lib/validations/__tests__/lead-tabs.test.ts src/lib/validations/lead-tabs.ts src/lib/validations/leads.ts
git commit -m "feat(leads): add lead-tabs validations and replace source with tab_id"
```

---

## Task 4: `admin-lead-tabs` server actions

**Files:**
- Create: `src/lib/actions/admin-lead-tabs.ts`

- [ ] **Step 1: Write the actions**

```ts
"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdmin, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import {
  leadTabCreateSchema,
  leadTabUpdateSchema,
  leadTabReorderSchema,
  leadTabDeleteSchema,
  deriveLeadTabSlug,
  type LeadTabCreateInput,
  type LeadTabUpdateInput,
  type LeadTabReorderInput,
  type LeadTabDeleteInput,
} from "@/lib/validations/lead-tabs";
import { toLeadTabColor, type LeadTab } from "@/types/lead-tabs";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionResult<T> = { success: true; data: T } | { error: string };
type VoidResult = { success: true } | { error: string };

interface LeadTabRow {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToTab(row: LeadTabRow): LeadTab {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    color: toLeadTabColor(row.color),
    position: row.position,
    is_default: row.is_default,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Active lead tabs ordered by position. Cached per render. */
export const listLeadTabsAction = cache(
  async (): Promise<ActionResult<LeadTab[]>> => {
    const { error: authError } = await verifyAdminOrTrainer();
    if (authError) return { error: authError };

    const supabase = await createClient();
    const { data, error } = await typedFrom(supabase, "lead_tabs")
      .select("*")
      .is("deleted_at", null)
      .order("position", { ascending: true });

    if (error) {
      console.error("List lead tabs error:", error);
      return { error: "שגיאה בטעינת טאבים" };
    }
    return { success: true, data: (data as LeadTabRow[]).map(rowToTab) };
  },
);

async function ensureSlugUnique(
  supabase: SupabaseClient,
  base: string,
): Promise<string> {
  let candidate = base;
  let n = 2;
  for (let i = 0; i < 100; i += 1) {
    const { data } = await typedFrom(supabase, "lead_tabs")
      .select("id")
      .eq("slug", candidate)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${n}`.slice(0, 50);
    n += 1;
  }
  return `${base}-${Date.now()}`.slice(0, 50);
}

export async function createLeadTabAction(
  input: LeadTabCreateInput,
): Promise<ActionResult<LeadTab>> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const parsed = leadTabCreateSchema.safeParse(input);
  if (!parsed.success) return { error: "אימות נתונים נכשל" };

  const supabase = await createClient();
  const { name, color, is_default } = parsed.data;
  const requestedSlug = parsed.data.slug ?? deriveLeadTabSlug(name);
  const slug = await ensureSlugUnique(supabase, requestedSlug);

  const { data: maxRow } = await typedFrom(supabase, "lead_tabs")
    .select("position")
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (maxRow?.position ?? -1) + 1;

  if (is_default) {
    const { error: clearErr } = await typedFrom(supabase, "lead_tabs")
      .update({ is_default: false })
      .eq("is_default", true)
      .is("deleted_at", null);
    if (clearErr) {
      console.error("Clear default tab error:", clearErr);
      return { error: "שגיאה בקביעת ברירת מחדל" };
    }
  }

  const { data, error } = await typedFrom(supabase, "lead_tabs")
    .insert({
      slug,
      name,
      color: color ?? null,
      position,
      is_default: is_default ?? false,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Create lead tab error:", error);
    return { error: "שגיאה ביצירת טאב" };
  }

  revalidatePath("/admin/leads");
  return { success: true, data: rowToTab(data as LeadTabRow) };
}

export async function updateLeadTabAction(
  input: LeadTabUpdateInput,
): Promise<ActionResult<LeadTab>> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const parsed = leadTabUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: "אימות נתונים נכשל" };

  const supabase = await createClient();
  const { id, name, color, is_default } = parsed.data;

  if (is_default === true) {
    const { error: clearErr } = await typedFrom(supabase, "lead_tabs")
      .update({ is_default: false })
      .neq("id", id)
      .eq("is_default", true)
      .is("deleted_at", null);
    if (clearErr) {
      console.error("Clear default tab error:", clearErr);
      return { error: "שגיאה בקביעת ברירת מחדל" };
    }
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = name;
  if (color !== undefined) patch.color = color ?? null;
  if (is_default !== undefined) patch.is_default = is_default;
  if (Object.keys(patch).length === 0) return { error: "אין שינויים לשמירה" };

  const { data, error } = await typedFrom(supabase, "lead_tabs")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Update lead tab error:", error);
    return { error: "שגיאה בעדכון טאב" };
  }

  revalidatePath("/admin/leads");
  return { success: true, data: rowToTab(data as LeadTabRow) };
}

export async function reorderLeadTabsAction(
  input: LeadTabReorderInput,
): Promise<VoidResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const parsed = leadTabReorderSchema.safeParse(input);
  if (!parsed.success) return { error: "אימות נתונים נכשל" };

  const supabase = await createClient();
  for (let i = 0; i < parsed.data.ordered_ids.length; i += 1) {
    const id = parsed.data.ordered_ids[i];
    const { error } = await typedFrom(supabase, "lead_tabs")
      .update({ position: i })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) {
      console.error("Reorder lead tab error:", error);
      return { error: "שגיאה בסידור טאבים" };
    }
  }

  revalidatePath("/admin/leads");
  return { success: true };
}

export async function deleteLeadTabAction(
  input: LeadTabDeleteInput,
): Promise<VoidResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const parsed = leadTabDeleteSchema.safeParse(input);
  if (!parsed.success) return { error: "אימות נתונים נכשל" };

  const { id, move_to_tab_id } = parsed.data;
  if (id === move_to_tab_id) return { error: "טאב היעד חייב להיות שונה" };

  const supabase = await createClient();

  const { count } = await typedFrom(supabase, "lead_tabs")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if ((count ?? 0) <= 1) return { error: "אי אפשר למחוק את הטאב היחיד" };

  const { data: dest } = await typedFrom(supabase, "lead_tabs")
    .select("id, is_default")
    .eq("id", move_to_tab_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!dest) return { error: "טאב היעד לא קיים" };

  const { data: source } = await typedFrom(supabase, "lead_tabs")
    .select("id, is_default")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!source) return { error: "הטאב לא נמצא" };

  if (source.is_default && !dest.is_default) {
    const { error: defErr } = await typedFrom(supabase, "lead_tabs")
      .update({ is_default: true })
      .eq("id", move_to_tab_id);
    if (defErr) {
      console.error("Transfer default flag error:", defErr);
      return { error: "שגיאה בהעברת ברירת המחדל" };
    }
  }

  const { error: moveErr } = await typedFrom(supabase, "leads")
    .update({ tab_id: move_to_tab_id })
    .eq("tab_id", id);
  if (moveErr) {
    console.error("Move leads to destination tab error:", moveErr);
    return { error: "שגיאה בהעברת הלידים" };
  }

  const { error: delErr } = await typedFrom(supabase, "lead_tabs")
    .update({ deleted_at: new Date().toISOString(), is_default: false })
    .eq("id", id);
  if (delErr) {
    console.error("Soft-delete tab error:", delErr);
    return { error: "שגיאה במחיקת הטאב" };
  }

  revalidatePath("/admin/leads");
  return { success: true };
}

export async function assignLeadToTabAction(
  leadId: string,
  tabId: string,
): Promise<VoidResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  if (!isValidUUID(leadId) || !isValidUUID(tabId)) {
    return { error: "מזהה לא תקין" };
  }

  const supabase = await createClient();
  const { error } = await typedFrom(supabase, "leads")
    .update({ tab_id: tabId })
    .eq("id", leadId);
  if (error) {
    console.error("Assign lead to tab error:", error);
    return { error: "שגיאה בשיוך הליד לטאב" };
  }

  revalidatePath("/admin/leads");
  return { success: true };
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit --pretty false`
Expected: only consumer errors. This file itself compiles.

- [ ] **Step 3: Smoke-test the DB via Supabase MCP**

```sql
SELECT id, slug, name, position, is_default FROM lead_tabs WHERE deleted_at IS NULL ORDER BY position;
```
Expected: 2 rows, `paid` is default.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/admin-lead-tabs.ts
git commit -m "feat(leads): add admin-lead-tabs server actions"
```

---

## Task 5: Update existing leads server actions to use `tab_id`

**Files:**
- Modify: `src/lib/actions/admin-leads-list.ts`
- Modify: `src/lib/actions/admin-leads-create.ts`
- Modify: `src/lib/actions/admin-leads-update.ts`

- [ ] **Step 1: Update `admin-leads-list.ts`**

Edit A — imports (drop `LEAD_SELECT_WITH_TRAINER` and `LeadSource`):
```ts
// REPLACE the entire import block from "@/types/leads" WITH:
import {
  LEAD_SELECT_WITH_RELATIONS,
  LEAD_STATUSES,
  type Lead,
  type LeadContactLog,
  type LeadFlowResponse,
  type LeadSentMessage,
  type LeadStatus,
} from "@/types/leads";
```

Edit B — `LeadsFilters`:
```ts
interface LeadsFilters {
  search?: string;
  status?: string;
  isFromHaifa?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  tabId?: string;
  assignedTrainerId?: string | null;
}
```

Edit C — `getLeadsAction` body:
- Replace `select(LEAD_SELECT_WITH_TRAINER, { count: "exact" })` with `select(LEAD_SELECT_WITH_RELATIONS, { count: "exact" })`.
- Replace `const { ..., source, assignedTrainerId } = filters;` with `const { ..., tabId, assignedTrainerId } = filters;`.
- Replace `if (source) query = query.eq("source", source);` with:
  ```ts
  if (tabId) query = query.eq("tab_id", tabId);
  ```

Edit D — `getLeadByIdAction`:
- Replace `.select(LEAD_SELECT_WITH_TRAINER)` with `.select(LEAD_SELECT_WITH_RELATIONS)`.

Edit E — `getLeadsStatsAction`:
- Replace `filters: { source?: LeadSource } = {}` with `filters: { tabId?: string } = {}`.
- Replace `const { source } = filters;` with `const { tabId } = filters;`.
- Replace `return source ? q.eq("source", source) : q;` with `return tabId ? q.eq("tab_id", tabId) : q;`.

- [ ] **Step 2: Update `admin-leads-create.ts`**

Edit A — replace the destructuring of `validated.data`:
```ts
const {
  phone,
  name,
  is_from_haifa,
  status,
  tab_id,
  note,
  club,
  birth_year,
  additional_info,
  assigned_trainer_id,
} = validated.data;
```

Edit B — move `const supabase = await createClient();` to BEFORE the phone-uniqueness check, then add default-tab resolution:
```ts
const supabase = await createClient();

let resolvedTabId = tab_id;
if (!resolvedTabId) {
  const { data: defaultTab } = await typedFrom(supabase, "lead_tabs")
    .select("id")
    .eq("is_default", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!defaultTab) return { error: "אין טאב ברירת מחדל" };
  resolvedTabId = defaultTab.id as string;
}
```

Edit C — replace the `insertPayload` so `source` is gone and `tab_id` is set:
```ts
const insertPayload = {
  phone,
  name,
  is_from_haifa,
  status,
  tab_id: resolvedTabId,
  note: nullIfEmpty(note),
  club: nullIfEmpty(club),
  birth_year: birth_year ?? null,
  additional_info: nullIfEmpty(additional_info),
  assigned_trainer_id: assigned_trainer_id ?? null,
};
```

- [ ] **Step 3: Update `admin-leads-update.ts`**

Inspect the file. The current `NULLABLE_TEXT_KEYS` + filter loop strips `undefined` and converts empty strings — no special handling needed for `tab_id`. No code change is expected. If a `source` reference exists in this file, remove it.

- [ ] **Step 4: Type check + lint**

Run: `npx tsc --noEmit --pretty false`
Expected: only UI consumers + the page + webhook still have errors.

Run: `npm run lint`
Expected: existing 16 warnings only.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/admin-leads-list.ts src/lib/actions/admin-leads-create.ts src/lib/actions/admin-leads-update.ts
git commit -m "feat(leads): server actions filter and create by tab_id"
```

---

## Task 6: Webhook backwards compatibility

**Files:**
- Modify: `src/app/api/webhooks/leads/route.ts`

- [ ] **Step 1: Resolve incoming `tab_slug` or legacy `source` to `tab_id`**

Edit A — replace the destructuring of `parseResult.data`:
```ts
const {
  phone,
  name,
  is_from_haifa,
  note,
  source,
  tab_slug,
  club,
  birth_year,
  additional_info,
} = parseResult.data;
```

Edit B — move `const supabase = createAdminClient();` UP so it's defined before the tab resolution. Then insert tab resolution before the phone-uniqueness check:
```ts
const supabase = createAdminClient();

const requestedSlug = tab_slug ?? source ?? null;

let tab_id: string;
if (requestedSlug) {
  const { data: tab } = await typedFrom(supabase, "lead_tabs")
    .select("id")
    .eq("slug", requestedSlug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!tab) {
    return NextResponse.json(
      { error: `Unknown tab_slug: ${requestedSlug}` },
      { status: 400 },
    );
  }
  tab_id = tab.id as string;
} else {
  const { data: defaultTab } = await typedFrom(supabase, "lead_tabs")
    .select("id")
    .eq("is_default", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!defaultTab) {
    return NextResponse.json(
      { error: "No default tab configured" },
      { status: 500 },
    );
  }
  tab_id = defaultTab.id as string;
}
```

Edit C — drop the old `const supabase = createAdminClient();` line that previously appeared further down (after the destructuring). The route must only have one such declaration.

Edit D — update the insert payload:
```ts
.insert({
  phone,
  name,
  is_from_haifa,
  note: note || null,
  tab_id,
  club: club || null,
  birth_year: birth_year ?? null,
  additional_info: additional_info || null,
})
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit --pretty false`
Expected: only UI consumers still have errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/leads/route.ts
git commit -m "feat(leads): webhook accepts tab_slug with legacy source fallback"
```

---

## Task 7: `LeadTabBadge` component

**Files:**
- Create: `src/components/admin/leads/LeadTabBadge.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { LEAD_TAB_COLOR_CLASSES, type LeadTab } from "@/types/lead-tabs";

interface LeadTabBadgeProps {
  tab: Pick<LeadTab, "name" | "color"> | null | undefined;
  className?: string;
}

export function LeadTabBadge({ tab, className }: LeadTabBadgeProps) {
  if (!tab) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500",
          className,
        )}
      >
        —
      </span>
    );
  }

  const palette = tab.color
    ? LEAD_TAB_COLOR_CLASSES[tab.color]
    : "bg-gray-100 text-gray-800";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        palette,
        className,
      )}
    >
      {tab.name}
    </span>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit --pretty false`
Expected: no error in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/leads/LeadTabBadge.tsx
git commit -m "feat(leads): add LeadTabBadge pill component"
```

---

## Task 8: `LeadTabFormDialog` — create / edit

**Files:**
- Create: `src/components/admin/leads/LeadTabFormDialog.tsx`

- [ ] **Step 1: Write the dialog**

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createLeadTabAction,
  updateLeadTabAction,
} from "@/lib/actions/admin-lead-tabs";
import {
  LEAD_TAB_COLORS,
  LEAD_TAB_COLOR_CLASSES,
  LEAD_TAB_COLOR_LABELS,
  type LeadTab,
  type LeadTabColor,
} from "@/types/lead-tabs";
import { cn } from "@/lib/utils";

interface LeadTabFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab?: LeadTab;
}

export function LeadTabFormDialog({
  open,
  onOpenChange,
  tab,
}: LeadTabFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(tab?.name ?? "");
  const [color, setColor] = useState<LeadTabColor | null>(tab?.color ?? null);
  const [isDefault, setIsDefault] = useState(tab?.is_default ?? false);

  useEffect(() => {
    if (open) {
      setName(tab?.name ?? "");
      setColor(tab?.color ?? null);
      setIsDefault(tab?.is_default ?? false);
    }
  }, [open, tab]);

  const handleSubmit = () => {
    startTransition(async () => {
      const result = tab
        ? await updateLeadTabAction({
            id: tab.id,
            name,
            color,
            is_default: isDefault,
          })
        : await createLeadTabAction({
            name,
            color,
            is_default: isDefault,
          });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(tab ? "טאב עודכן" : "טאב נוצר");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tab ? "עריכת טאב" : "טאב חדש"}</DialogTitle>
          <DialogDescription>
            טאבים מארגנים את הלידים לקבוצות ניתנות להחלפה.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tab-name">שם</Label>
            <Input
              id="tab-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: קמפיין סתיו"
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label>צבע</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs border",
                  color === null
                    ? "border-foreground"
                    : "border-transparent bg-gray-50 text-gray-600",
                )}
              >
                ללא
              </button>
              {LEAD_TAB_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs border",
                    LEAD_TAB_COLOR_CLASSES[c],
                    color === c ? "border-foreground" : "border-transparent",
                  )}
                  aria-label={LEAD_TAB_COLOR_LABELS[c]}
                >
                  {LEAD_TAB_COLOR_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="tab-default"
              checked={isDefault}
              onCheckedChange={(v) => setIsDefault(v === true)}
            />
            <Label htmlFor="tab-default" className="cursor-pointer">
              קבע כברירת מחדל (לידים חדשים יגיעו לכאן)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={pending || !name.trim()}>
            {pending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            {tab ? "שמירה" : "יצירה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit --pretty false`
Expected: no error in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/leads/LeadTabFormDialog.tsx
git commit -m "feat(leads): add LeadTabFormDialog for create/edit"
```

---

## Task 9: `LeadTabDeleteDialog` — delete with destination picker

**Files:**
- Create: `src/components/admin/leads/LeadTabDeleteDialog.tsx`

- [ ] **Step 1: Write the dialog**

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { deleteLeadTabAction } from "@/lib/actions/admin-lead-tabs";
import type { LeadTab } from "@/types/lead-tabs";

interface LeadTabDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: LeadTab | null;
  otherTabs: LeadTab[];
}

export function LeadTabDeleteDialog({
  open,
  onOpenChange,
  tab,
  otherTabs,
}: LeadTabDeleteDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [destination, setDestination] = useState<string>(
    otherTabs[0]?.id ?? "",
  );

  useEffect(() => {
    if (open) setDestination(otherTabs[0]?.id ?? "");
  }, [open, otherTabs]);

  if (!tab) return null;

  const handleConfirm = () => {
    if (!destination) {
      toast.error("יש לבחור טאב יעד");
      return;
    }
    startTransition(async () => {
      const result = await deleteLeadTabAction({
        id: tab.id,
        move_to_tab_id: destination,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הטאב נמחק");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>מחיקת טאב</DialogTitle>
          <DialogDescription>
            כל הלידים בטאב &quot;{tab.name}&quot; יועברו לטאב היעד לפני המחיקה.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>טאב יעד</Label>
          <Select value={destination} onValueChange={setDestination} dir="rtl">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="בחר טאב" />
            </SelectTrigger>
            <SelectContent>
              {otherTabs.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            ביטול
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending || !destination}
          >
            {pending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            מחק והעבר
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit --pretty false`
Expected: no error in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/leads/LeadTabDeleteDialog.tsx
git commit -m "feat(leads): add LeadTabDeleteDialog with destination picker"
```

---

## Task 10: `LeadTabsManager` dialog

**Files:**
- Create: `src/components/admin/leads/LeadTabsManager.tsx`

- [ ] **Step 1: Write the manager**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LeadTabBadge } from "./LeadTabBadge";
import { LeadTabFormDialog } from "./LeadTabFormDialog";
import { LeadTabDeleteDialog } from "./LeadTabDeleteDialog";
import { reorderLeadTabsAction } from "@/lib/actions/admin-lead-tabs";
import type { LeadTab } from "@/types/lead-tabs";

interface LeadTabsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs: LeadTab[];
}

export function LeadTabsManager({
  open,
  onOpenChange,
  tabs,
}: LeadTabsManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<LeadTab | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<LeadTab | null>(null);

  const ordered = useMemo(
    () => [...tabs].sort((a, b) => a.position - b.position),
    [tabs],
  );

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    startTransition(async () => {
      const result = await reorderLeadTabsAction({
        ordered_ids: next.map((t) => t.id),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ניהול טאבים</DialogTitle>
            <DialogDescription>
              צור, ערוך, סדר וקבע ברירת מחדל לטאבים של הלידים.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {ordered.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <LeadTabBadge tab={t} className="shrink-0" />
                <span className="flex-1 text-sm truncate">{t.name}</span>
                {t.is_default && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    ברירת מחדל
                  </span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="העלה"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending || i === ordered.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="הורד"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setEditing(t)}
                  aria-label="ערוך"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending || ordered.length <= 1}
                  onClick={() => setDeleting(t)}
                  aria-label="מחק"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button onClick={() => setCreating(true)} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 ml-2" />
              )}
              טאב חדש
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LeadTabFormDialog
        open={creating}
        onOpenChange={setCreating}
      />
      <LeadTabFormDialog
        open={editing !== undefined}
        onOpenChange={(o) => !o && setEditing(undefined)}
        tab={editing}
      />
      <LeadTabDeleteDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        tab={deleting}
        otherTabs={ordered.filter((t) => t.id !== deleting?.id)}
      />
    </>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit --pretty false`
Expected: no error in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/leads/LeadTabsManager.tsx
git commit -m "feat(leads): add LeadTabsManager dialog"
```

---

## Task 11: Update `LeadsTabs` to render dynamically + admin manage button

**Files:**
- Modify: `src/components/admin/leads/LeadsTabs.tsx`

- [ ] **Step 1: Replace the component body**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LeadTabsManager } from "./LeadTabsManager";
import type { LeadTab } from "@/types/lead-tabs";

interface LeadsTabsProps {
  tabs: LeadTab[];
  activeSlug: string;
  counts?: Record<string, number>;
  canManage: boolean;
}

export function LeadsTabs({
  tabs,
  activeSlug,
  counts,
  canManage,
}: LeadsTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [managerOpen, setManagerOpen] = useState(false);

  const buildHref = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", slug);
    params.delete("source"); // drop the legacy alias when the user picks a tab
    return `${pathname}?${params.toString()}`;
  };

  return (
    <>
      <div
        className="flex items-center gap-2 flex-wrap"
        role="tablist"
        aria-label="סוג ליד"
      >
        <div className="bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-lg p-[3px]">
          {tabs.map((tab) => {
            const active = tab.slug === activeSlug;
            const count = counts?.[tab.slug];
            return (
              <Link
                key={tab.id}
                href={buildHref(tab.slug)}
                scroll={false}
                role="tab"
                aria-selected={active}
                className={cn(
                  "inline-flex h-[calc(100%-1px)] shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground/80 hover:bg-background/60",
                )}
              >
                {tab.name}
                {typeof count === "number" && (
                  <span className="text-xs text-muted-foreground">
                    ({count})
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManagerOpen(true)}
            aria-label="ניהול טאבים"
          >
            <Settings2 className="h-4 w-4 ml-1" />
            ניהול טאבים
          </Button>
        )}
      </div>

      <LeadTabsManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        tabs={tabs}
      />
    </>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit --pretty false`
Expected: no error in this file. Errors remain in data table, columns, dialogs, page, export.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/leads/LeadsTabs.tsx
git commit -m "feat(leads): LeadsTabs renders dynamic tabs and admin manage button"
```

---

## Task 12: Update `LeadDataTable` + `LeadTableColumns`

**Files:**
- Modify: `src/components/admin/leads/LeadDataTable.tsx`
- Modify: `src/components/admin/leads/LeadTableColumns.tsx`

- [ ] **Step 1: Update `LeadDataTable.tsx` props**

Replace the imports + `LeadDataTableProps`:
```ts
import type { LeadTab } from "@/types/lead-tabs";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
// (remove the import of LeadSource and LEAD_SOURCE_LABELS, if present)

interface LeadDataTableProps {
  data: Lead[];
  activeTab: LeadTab;
  tabs: LeadTab[];
  trainers: TrainerOption[];
  initialSearch?: string;
  initialStatus?: string | null;
  initialHaifa?: boolean;
  initialAssignedTrainerId?: string | null;
}
```

Inside the component body, change the columns factory call to:
```ts
const columns = useMemo(
  () => getLeadColumns({ showPaidIndicator: activeTab.slug === "paid" }),
  [activeTab.slug],
);
```

In the JSX, replace `source={source}` and `defaultSource={source}` with `tabs={tabs}` and `defaultTabId={activeTab.id}` on the child dialogs:
```tsx
<LeadDetailSheet
  lead={selectedLead}
  open={sheetOpen}
  onOpenChange={setSheetOpen}
  trainers={trainers}
  tabs={tabs}
/>

<LeadCreateDialog
  open={createOpen}
  onOpenChange={setCreateOpen}
  defaultTabId={activeTab.id}
  trainers={trainers}
  tabs={tabs}
/>
```

In the mobile card list (the `.sm:hidden` block) add the tab badge next to the name:
```tsx
import { LeadTabBadge } from "./LeadTabBadge";

// inside the mobile row, after <LeadStatusBadge ...>:
<LeadTabBadge tab={lead.tab ?? null} className="shrink-0" />
```

- [ ] **Step 2: Update `LeadTableColumns.tsx`**

Add `LeadTabBadge` import:
```tsx
import { LeadTabBadge } from "./LeadTabBadge";
```

Insert a "טאב" column right after the "name" column inside `cols.push(...)`:
```tsx
{
  id: "tab",
  header: "טאב",
  cell: ({ row }) => <LeadTabBadge tab={row.original.tab ?? null} />,
  enableSorting: false,
},
```

- [ ] **Step 3: Type check + lint**

Run: `npx tsc --noEmit --pretty false`
Expected: errors remain in `LeadDetailSheet`, `LeadCreateDialog`, `LeadExportButton`, page.

Run: `npm run lint`
Expected: existing warnings only.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/leads/LeadDataTable.tsx src/components/admin/leads/LeadTableColumns.tsx
git commit -m "feat(leads): table renders tab column and threads tabs prop"
```

---

## Task 13: Update `LeadDetailSheet` + `LeadCreateDialog`

**Files:**
- Modify: `src/components/admin/leads/LeadDetailSheet.tsx`
- Modify: `src/components/admin/leads/LeadCreateDialog.tsx`

- [ ] **Step 1: Update `LeadDetailSheet.tsx`**

Edit A — props:
```tsx
import type { LeadTab } from "@/types/lead-tabs";

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainers: TrainerOption[];
  tabs: LeadTab[];
}

export function LeadDetailSheet({ lead, open, onOpenChange, trainers, tabs }: LeadDetailSheetProps) {
```

Edit B — both `reset(...)` calls (the `loadDetails` one and the initial `useEffect` one) replace `source: l.source` / `source: lead.source` with `tab_id: l.tab_id` / `tab_id: lead.tab_id`.

Edit C — replace the "source" Select in the form with a tab Select (insert it where the source Select previously lived):
```tsx
<div className="space-y-1">
  <Label className="text-xs">טאב</Label>
  <Select
    value={watch("tab_id") ?? lead.tab_id}
    onValueChange={(v) =>
      setValue("tab_id", v, { shouldDirty: true, shouldValidate: true })
    }
    dir="rtl"
  >
    <SelectTrigger className="w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {tabs.map((t) => (
        <SelectItem key={t.id} value={t.id}>
          {t.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

- [ ] **Step 2: Update `LeadCreateDialog.tsx`**

Edit A — props + imports:
```tsx
import type { LeadTab } from "@/types/lead-tabs";

interface LeadCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTabId: string;
  trainers: TrainerOption[];
  tabs: LeadTab[];
}

export function LeadCreateDialog({
  open,
  onOpenChange,
  defaultTabId,
  trainers,
  tabs,
}: LeadCreateDialogProps) {
```

Edit B — drop the old `LEAD_SOURCE_LABELS` import.

Edit C — `buildLeadDefaults` becomes:
```ts
function buildLeadDefaults(
  defaultTabId: string,
): z.input<typeof leadCreateSchema> {
  return {
    name: "",
    phone: "",
    status: "new",
    tab_id: defaultTabId,
    is_from_haifa: false,
    note: "",
    club: "",
    birth_year: null,
    additional_info: "",
    assigned_trainer_id: null,
  };
}
```

Edit D — initial state for `autoSendFlow` derives from the active tab's slug:
```ts
const initialSlug = tabs.find((t) => t.id === defaultTabId)?.slug;
const [autoSendFlow, setAutoSendFlow] = useState(initialSlug === "paid");
```
And in the `useEffect` that keeps things in sync:
```ts
useEffect(() => {
  setValue("tab_id", defaultTabId);
  const slug = tabs.find((t) => t.id === defaultTabId)?.slug;
  setAutoSendFlow(slug === "paid");
}, [defaultTabId, tabs, setValue]);
```

Edit E — replace the "source" Select in the form with the tab Select:
```tsx
<div className="space-y-2">
  <Label>טאב</Label>
  <Select
    value={watch("tab_id") ?? defaultTabId}
    onValueChange={(v) =>
      setValue("tab_id", v, { shouldDirty: true, shouldValidate: true })
    }
    dir="rtl"
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {tabs.map((t) => (
        <SelectItem key={t.id} value={t.id}>
          {t.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Edit F — at the end of `onSubmit`, replace `reset(buildLeadDefaults(defaultSource))` with `reset(buildLeadDefaults(defaultTabId))` and `setAutoSendFlow(defaultSource === "paid")` with `setAutoSendFlow(initialSlug === "paid")` (or just call the inline `slug` computation again).

- [ ] **Step 3: Type check + lint**

Run: `npx tsc --noEmit --pretty false`
Expected: only the page (Task 14) and the export (Task 15) still have errors.

Run: `npm run lint`
Expected: existing warnings only.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/leads/LeadDetailSheet.tsx src/components/admin/leads/LeadCreateDialog.tsx
git commit -m "feat(leads): detail sheet + create dialog use tab Select"
```

---

## Task 14: Update `admin/leads/page.tsx`

**Files:**
- Modify: `src/app/admin/leads/page.tsx`

- [ ] **Step 1: Replace the page**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { LeadDataTable } from "@/components/admin/leads/LeadDataTable";
import { LeadExportButton } from "@/components/admin/exports/LeadExportButton";
import { LeadsTabs } from "@/components/admin/leads/LeadsTabs";
import { listTrainersForAssignmentAction } from "@/lib/actions/admin-trainers-list";
import { listLeadTabsAction } from "@/lib/actions/admin-lead-tabs";
import {
  LEAD_SELECT_WITH_RELATIONS,
  type Lead,
} from "@/types/leads";
import type { LeadTab } from "@/types/lead-tabs";

export const metadata: Metadata = {
  title: "ניהול לידים | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    haifa?: string;
    tab?: string;
    source?: string;
    at?: string;
  }>;
}

const LEADS_PAGE_LIMIT = 2000;

function resolveActiveTab(
  tabs: LeadTab[],
  tabParam: string | undefined,
  sourceParam: string | undefined,
): LeadTab {
  const requested =
    tabParam?.toLowerCase().trim() ?? sourceParam?.toLowerCase().trim() ?? null;
  if (requested) {
    const match = tabs.find((t) => t.slug === requested);
    if (match) return match;
  }
  return tabs.find((t) => t.is_default) ?? tabs[0];
}

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const { error: authError, profile } = await verifyAdminOrTrainer();
  if (authError || !profile) redirect("/login");

  const supabase = await createClient();
  const params = await searchParams;

  const [tabsRes, trainersRes] = await Promise.all([
    listLeadTabsAction(),
    listTrainersForAssignmentAction(),
  ]);

  if ("error" in tabsRes) redirect("/dashboard");
  const tabs = tabsRes.data;
  if (tabs.length === 0) redirect("/dashboard");

  const activeTab = resolveActiveTab(tabs, params.tab, params.source);

  const [activeRes, countRows] = await Promise.all([
    typedFrom(supabase, "leads")
      .select(LEAD_SELECT_WITH_RELATIONS)
      .eq("tab_id", activeTab.id)
      .order("created_at", { ascending: false })
      .limit(LEADS_PAGE_LIMIT),
    typedFrom(supabase, "leads")
      .select("tab_id")
      .in(
        "tab_id",
        tabs.map((t) => t.id),
      ),
  ]);

  const typedLeads: Lead[] = (activeRes.data as Lead[] | null) || [];

  const counts: Record<string, number> = {};
  for (const t of tabs) counts[t.slug] = 0;
  for (const row of (countRows.data as { tab_id: string }[] | null) ?? []) {
    const tab = tabs.find((t) => t.id === row.tab_id);
    if (tab) counts[tab.slug] = (counts[tab.slug] ?? 0) + 1;
  }

  const trainers =
    "data" in trainersRes && trainersRes.data ? trainersRes.data : [];
  const canManage = profile.role === "admin";

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">ניהול לידים</h1>
          <p className="text-muted-foreground">ניהול לידים ומעקב אחר פניות</p>
        </div>
        <LeadExportButton leads={typedLeads} />
      </div>

      <LeadsTabs
        tabs={tabs}
        activeSlug={activeTab.slug}
        counts={counts}
        canManage={canManage}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {activeTab.name} ({typedLeads.length})
          </CardTitle>
          <CardDescription>
            {activeTab.is_default
              ? "טאב ברירת המחדל — לידים חדשים מגיעים לכאן"
              : "טאב מותאם של לידים"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadDataTable
            data={typedLeads}
            activeTab={activeTab}
            tabs={tabs}
            trainers={trainers}
            initialSearch={params.q || ""}
            initialStatus={params.status || null}
            initialHaifa={params.haifa === "true"}
            initialAssignedTrainerId={params.at || null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Type check + lint**

Run: `npx tsc --noEmit --pretty false`
Expected: page compiles. Only `LeadExportButton` may still have errors.

Run: `npm run lint`
Expected: existing warnings only.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/leads/page.tsx
git commit -m "feat(leads): page resolves ?tab= with ?source= fallback and counts per tab"
```

---

## Task 15: Update CSV export

**Files:**
- Modify: `src/components/admin/exports/LeadExportButton.tsx`

- [ ] **Step 1: Replace `מקור` with `טאב`**

Edit A — replace the import:
```ts
// REPLACE:
import { LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS } from "@/types/leads";
// WITH:
import { LEAD_STATUS_LABELS } from "@/types/leads";
```

Edit B — in the `csvData` map, replace the `מקור: LEAD_SOURCE_LABELS[lead.source]` entry with:
```ts
טאב: lead.tab?.name ?? "",
```

- [ ] **Step 2: Final type check + lint**

Run: `npx tsc --noEmit --pretty false`
Expected: EXIT 0, no errors.

Run: `npm run lint`
Expected: existing 16 warnings, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/exports/LeadExportButton.tsx
git commit -m "feat(leads): CSV export uses tab name column"
```

---

## Task 16: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: DB sanity via Supabase MCP**

```sql
SELECT slug, name, is_default FROM lead_tabs WHERE deleted_at IS NULL ORDER BY position;
SELECT COUNT(*) FROM leads WHERE tab_id IS NULL;
```
Expected: ≥ 2 tabs (paid still default unless changed manually); 0 leads without tab_id.

- [ ] **Step 2: Manual browser smoke test**

Run dev server: `npm run dev`

1. Visit `/admin/leads` as an admin — verify both tabs render and "ניהול טאבים" appears.
2. Visit `/admin/leads?source=organic` — verify it lands on the organic tab.
3. Click "ניהול טאבים" — create "Test Tab" with color green; verify it appears and is selectable.
4. Open a lead, change its tab to "Test Tab" in the detail sheet, save, refresh — verify the table reflects the change.
5. Open the manager, delete "Test Tab" with destination "paid" — verify the lead moves back and "Test Tab" disappears.
6. Set "organic" as default; create a new lead from the dialog with no override — verify it lands in organic. Set default back to paid afterwards.
7. Sign in as a trainer (if available) — verify "ניהול טאבים" is hidden but tabs are visible.

- [ ] **Step 3: Webhook smoke (optional)**

If `LEADS_WEBHOOK_API_KEY` is set in `.env.local`:
```bash
curl -X POST http://localhost:3000/api/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "x-api-key: $LEADS_WEBHOOK_API_KEY" \
  -d '{"phone":"0501234901","name":"WH Test paid","tab_slug":"paid","is_from_haifa":false}'

curl -X POST http://localhost:3000/api/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "x-api-key: $LEADS_WEBHOOK_API_KEY" \
  -d '{"phone":"0501234902","name":"WH Test organic legacy","source":"organic","is_from_haifa":false}'
```
Expected: both return 201 and the new leads land in the correct tabs.

---

## Task 17: Push + deploy

**Files:** none.

- [ ] **Step 1: Push to origin**

```bash
git push origin main
```
Expected: refs updated.

- [ ] **Step 2: Deploy to Vercel production**

```bash
vercel --prod
```
Expected: deployment READY, alias `https://www.edengarden.co.il` updated.

- [ ] **Step 3: Production smoke**

Visit `https://www.edengarden.co.il/admin/leads`; verify tabs render and "ניהול טאבים" works as in step 16.2.
