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
  } else if (is_default === false) {
    // Refuse to leave the system without a default tab — that would break
    // every lead creation path that relies on the default fallback.
    const { data: current } = await typedFrom(supabase, "lead_tabs")
      .select("is_default")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (current?.is_default) {
      return {
        error: "לא ניתן להסיר ברירת מחדל ללא קביעת ברירת מחדל חלופית",
      };
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

  // Require the client to send the full ordered list so a partial payload
  // can't leave some tabs at stale positions.
  const ids = parsed.data.ordered_ids;
  if (new Set(ids).size !== ids.length) {
    return { error: "סדר הטאבים כולל כפילויות" };
  }
  const { count } = await typedFrom(supabase, "lead_tabs")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if ((count ?? 0) !== ids.length) {
    return { error: "סדר הטאבים אינו כולל את כל הטאבים" };
  }

  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
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

  // Confirm the destination tab still exists and is active. The FK alone
  // would catch a missing row, but the resulting Postgres error message is
  // generic — pre-checking lets us return a clear Hebrew error instead.
  const { data: tab } = await typedFrom(supabase, "lead_tabs")
    .select("id")
    .eq("id", tabId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!tab) return { error: "טאב היעד לא קיים" };

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
