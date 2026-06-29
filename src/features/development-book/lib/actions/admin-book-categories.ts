"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { categorySchema } from "@/lib/validations/book-category";
import type { CategoryInput } from "@/lib/validations/book-category";

export type { CategoryInput } from "@/lib/validations/book-category";

// ---------------------------------------------------------------------------
// Action result types
// ---------------------------------------------------------------------------

type ActionResult =
  | { success: true; categoryId?: string; parameterId?: string }
  | { error: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Raw DB shapes (snake_case)
// ---------------------------------------------------------------------------

interface RawAdminCategory {
  id: string;
  name_he: string;
  slug: string;
  icon: string | null;
  order_index: number;
}

interface RawAdminParameter {
  id: string;
  category_id: string;
  number: number | null;
  slug: string;
  name_he: string;
  order_index: number;
}

// ---------------------------------------------------------------------------
// Public camelCase shapes returned to callers
// ---------------------------------------------------------------------------

export interface AdminBookParameter {
  id: string;
  categoryId: string;
  number: number | null;
  slug: string;
  nameHe: string;
  orderIndex: number;
}

export interface AdminBookCategory {
  id: string;
  nameHe: string;
  slug: string;
  icon: string | null;
  orderIndex: number;
  parameters: AdminBookParameter[];
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapCategory(
  raw: RawAdminCategory,
  parameters: AdminBookParameter[]
): AdminBookCategory {
  return {
    id: raw.id,
    nameHe: raw.name_he,
    slug: raw.slug,
    icon: raw.icon,
    orderIndex: raw.order_index,
    parameters,
  };
}

function mapParameter(raw: RawAdminParameter): AdminBookParameter {
  return {
    id: raw.id,
    categoryId: raw.category_id,
    number: raw.number,
    slug: raw.slug,
    nameHe: raw.name_he,
    orderIndex: raw.order_index,
  };
}

// ---------------------------------------------------------------------------
// listBookAdminTree — full unfiltered tree for admin CMS
// ---------------------------------------------------------------------------

export async function listBookAdminTree(): Promise<AdminBookCategory[]> {
  const adminClient = createAdminClient();

  const [catsResult, paramsResult] = await Promise.all([
    typedFrom(adminClient, "book_categories")
      .select("id, name_he, slug, icon, order_index")
      .order("order_index") as Promise<{ data: RawAdminCategory[] | null; error: unknown }>,
    typedFrom(adminClient, "book_parameters")
      .select("id, category_id, number, slug, name_he, order_index")
      .order("order_index") as Promise<{ data: RawAdminParameter[] | null; error: unknown }>,
  ]);

  const rawCategories: RawAdminCategory[] = catsResult.data ?? [];
  const rawParameters: RawAdminParameter[] = paramsResult.data ?? [];

  const paramsByCategory = rawParameters.reduce<Record<string, AdminBookParameter[]>>(
    (acc, raw) => {
      const existing = acc[raw.category_id] ?? [];
      return { ...acc, [raw.category_id]: [...existing, mapParameter(raw)] };
    },
    {}
  );

  return rawCategories.map((raw) =>
    mapCategory(raw, paramsByCategory[raw.id] ?? [])
  );
}

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------

export async function createCategory(input: CategoryInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = categorySchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    const { data: maxOrder } = (await typedFrom(adminClient, "book_categories")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { order_index: number } | null };

    const orderIndex = validated.data.order_index ?? (maxOrder?.order_index ?? 0) + 1;

    const { data: created, error: insertError } = (await typedFrom(adminClient, "book_categories")
      .insert({
        slug: validated.data.slug,
        name_he: validated.data.name_he,
        icon: validated.data.icon ?? null,
        order_index: orderIndex,
      })
      .select("id")
      .single()) as { data: { id: string } | null; error: unknown };

    if (insertError || !created) {
      console.error("createCategory insert error:", insertError);
      return { error: "שגיאה ביצירת קטגוריה" };
    }

    revalidatePath("/admin/book");
    return { success: true, categoryId: created.id };
  } catch (err) {
    console.error("createCategory error:", err);
    return { error: "שגיאה ביצירת קטגוריה" };
  }
}

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------

export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה קטגוריה לא תקין" };

  const validated = categorySchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    const { error: updateError } = await typedFrom(adminClient, "book_categories")
      .update({
        slug: validated.data.slug,
        name_he: validated.data.name_he,
        icon: validated.data.icon ?? null,
        ...(validated.data.order_index !== undefined
          ? { order_index: validated.data.order_index }
          : {}),
      })
      .eq("id", id);

    if (updateError) {
      console.error("updateCategory error:", updateError);
      return { error: "שגיאה בעדכון קטגוריה" };
    }

    revalidatePath("/admin/book");
    return { success: true, categoryId: id };
  } catch (err) {
    console.error("updateCategory error:", err);
    return { error: "שגיאה בעדכון קטגוריה" };
  }
}

// ---------------------------------------------------------------------------
// deleteCategory
// ---------------------------------------------------------------------------

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה קטגוריה לא תקין" };

  const adminClient = createAdminClient();

  try {
    const { error: deleteError } = await typedFrom(adminClient, "book_categories")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("deleteCategory error:", deleteError);
      return { error: "שגיאה במחיקת קטגוריה" };
    }

    revalidatePath("/admin/book");
    return { success: true };
  } catch (err) {
    console.error("deleteCategory error:", err);
    return { error: "שגיאה במחיקת קטגוריה" };
  }
}

// ---------------------------------------------------------------------------
// reorderCategory — swap order_index with adjacent category
// ---------------------------------------------------------------------------

export async function reorderCategory(
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה קטגוריה לא תקין" };

  const adminClient = createAdminClient();

  try {
    // Fetch current category
    const { data: current } = (await typedFrom(adminClient, "book_categories")
      .select("id, order_index")
      .eq("id", id)
      .maybeSingle()) as { data: { id: string; order_index: number } | null };

    if (!current) return { error: "קטגוריה לא נמצאה" };

    // Fetch the adjacent category by order_index
    const adjacentResult = (await typedFrom(adminClient, "book_categories")
      .select("id, order_index")
      [direction === "down" ? "gt" : "lt"]("order_index", current.order_index)
      .order("order_index", { ascending: direction === "down" })
      .limit(1)
      .maybeSingle()) as { data: { id: string; order_index: number } | null };

    const neighbor = adjacentResult.data;
    if (!neighbor) {
      // Already at boundary — no-op
      return { success: true };
    }

    // Swap order_index values
    const { error: e1 } = await typedFrom(adminClient, "book_categories")
      .update({ order_index: neighbor.order_index })
      .eq("id", current.id);

    if (e1) {
      console.error("reorderCategory swap e1:", e1);
      return { error: "שגיאה בסידור מחדש של קטגוריה" };
    }

    const { error: e2 } = await typedFrom(adminClient, "book_categories")
      .update({ order_index: current.order_index })
      .eq("id", neighbor.id);

    if (e2) {
      console.error("reorderCategory swap e2:", e2);
      return { error: "שגיאה בסידור מחדש של קטגוריה" };
    }

    revalidatePath("/admin/book");
    return { success: true };
  } catch (err) {
    console.error("reorderCategory error:", err);
    return { error: "שגיאה בסידור מחדש של קטגוריה" };
  }
}

// ---------------------------------------------------------------------------
// createParameter — create a stub parameter under a category
// ---------------------------------------------------------------------------

export async function createParameter(
  categoryId: string
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(categoryId)) return { error: "מזהה קטגוריה לא תקין" };

  const adminClient = createAdminClient();

  try {
    // Calculate next order_index within the category
    const { data: maxOrder } = (await typedFrom(adminClient, "book_parameters")
      .select("order_index")
      .eq("category_id", categoryId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { order_index: number } | null };

    const orderIndex = (maxOrder?.order_index ?? 0) + 1;

    // Generate unique slug using timestamp
    const slug = `parameter-${Date.now()}`;

    const { data: created, error: insertError } = (await typedFrom(
      adminClient,
      "book_parameters"
    )
      .insert({
        category_id: categoryId,
        name_he: "פרמטר חדש",
        slug,
        order_index: orderIndex,
        is_all_positions: true,
      })
      .select("id")
      .single()) as { data: { id: string } | null; error: unknown };

    if (insertError || !created) {
      console.error("createParameter insert error:", insertError);
      return { error: "שגיאה ביצירת פרמטר" };
    }

    revalidatePath("/admin/book");
    return { success: true, parameterId: created.id };
  } catch (err) {
    console.error("createParameter error:", err);
    return { error: "שגיאה ביצירת פרמטר" };
  }
}
