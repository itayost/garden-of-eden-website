"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { muscleSchema } from "@/lib/validations/book-muscle";
import type { MuscleInput } from "@/lib/validations/book-muscle";

export type { MuscleInput } from "@/lib/validations/book-muscle";

// ---------------------------------------------------------------------------
// Action result type
// ---------------------------------------------------------------------------

type ActionResult =
  | { success: true }
  | { error: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Raw DB shape (snake_case)
// ---------------------------------------------------------------------------

interface RawBookMuscle {
  id: string;
  name_he: string;
  emoji: string | null;
  order_index: number;
}

// ---------------------------------------------------------------------------
// Public camelCase shape returned to callers
// ---------------------------------------------------------------------------

export interface BookMuscle {
  id: string;
  nameHe: string;
  emoji: string | null;
  orderIndex: number;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function mapMuscle(raw: RawBookMuscle): BookMuscle {
  return {
    id: raw.id,
    nameHe: raw.name_he,
    emoji: raw.emoji,
    orderIndex: raw.order_index,
  };
}

// ---------------------------------------------------------------------------
// listMuscles
// ---------------------------------------------------------------------------

export async function listMuscles(): Promise<BookMuscle[]> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return [];

  const adminClient = createAdminClient();

  const { data } = (await typedFrom(adminClient, "book_muscles")
    .select("id, name_he, emoji, order_index")
    .order("order_index")) as { data: RawBookMuscle[] | null; error: unknown };

  return (data ?? []).map(mapMuscle);
}

// ---------------------------------------------------------------------------
// createMuscle
// ---------------------------------------------------------------------------

export async function createMuscle(input: MuscleInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = muscleSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    const { data: maxOrder } = (await typedFrom(adminClient, "book_muscles")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { order_index: number } | null };

    const orderIndex = (maxOrder?.order_index ?? 0) + 1;

    const { error: insertError } = await typedFrom(adminClient, "book_muscles").insert({
      name_he: validated.data.name_he,
      emoji: validated.data.emoji ?? null,
      order_index: orderIndex,
    });

    if (insertError) {
      console.error("createMuscle insert error:", insertError);
      return { error: "שגיאה ביצירת שריר" };
    }

    revalidatePath("/admin/book/muscles");
    return { success: true };
  } catch (err) {
    console.error("createMuscle error:", err);
    return { error: "שגיאה ביצירת שריר" };
  }
}

// ---------------------------------------------------------------------------
// updateMuscle
// ---------------------------------------------------------------------------

export async function updateMuscle(
  id: string,
  input: MuscleInput
): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה שריר לא תקין" };

  const validated = muscleSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const adminClient = createAdminClient();

  try {
    const { error: updateError } = await typedFrom(adminClient, "book_muscles")
      .update({
        name_he: validated.data.name_he,
        emoji: validated.data.emoji ?? null,
      })
      .eq("id", id);

    if (updateError) {
      console.error("updateMuscle error:", updateError);
      return { error: "שגיאה בעדכון שריר" };
    }

    revalidatePath("/admin/book/muscles");
    return { success: true };
  } catch (err) {
    console.error("updateMuscle error:", err);
    return { error: "שגיאה בעדכון שריר" };
  }
}

// ---------------------------------------------------------------------------
// deleteMuscle
// ---------------------------------------------------------------------------

export async function deleteMuscle(id: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה שריר לא תקין" };

  const adminClient = createAdminClient();

  try {
    const { error: deleteError } = await typedFrom(adminClient, "book_muscles")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("deleteMuscle error:", deleteError);
      return { error: "שגיאה במחיקת שריר" };
    }

    revalidatePath("/admin/book/muscles");
    return { success: true };
  } catch (err) {
    console.error("deleteMuscle error:", err);
    return { error: "שגיאה במחיקת שריר" };
  }
}
