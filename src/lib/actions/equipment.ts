"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { verifyAdmin, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  equipmentCreateSchema,
  equipmentUpdateSchema,
  type EquipmentCreateInput,
  type EquipmentUpdateInput,
} from "@/lib/validations/exercise-log";
import type { Equipment } from "@/types/equipment";

type ListResult = { success: true; data: Equipment[] } | { error: string };
type MutateResult =
  | { success: true; data: Equipment }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Short, URL-safe, unambiguous code for the QR sticker. 8 chars from a
 * 30-char alphabet (no 0/O/1/I/L) is ~6.5e11 combinations — collisions are
 * handled by retrying on the UNIQUE constraint.
 */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 8;

function generateEquipmentCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** The full catalog, active first. Staff-only (the table and pickers). */
export async function listEquipmentAction(): Promise<ListResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "equipment")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name_he", { ascending: true });

  if (error) {
    console.error("List equipment error:", error);
    return { error: "שגיאה בטעינת הציוד" };
  }

  return { success: true, data: (data ?? []) as Equipment[] };
}

export async function createEquipmentAction(
  input: EquipmentCreateInput,
): Promise<MutateResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = equipmentCreateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();

  // Retry on the astronomically-unlikely code collision rather than
  // pre-checking (which would race anyway).
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: created, error } = await typedFrom(supabase, "equipment")
      .insert({
        name_he: validated.data.name,
        notes_he: validated.data.notes,
        code: generateEquipmentCode(),
      })
      .select()
      .single();

    if (!error && created) {
      revalidatePath("/admin/workouts/equipment");
      return { success: true, data: created as Equipment };
    }

    if ((error as { code?: string } | null)?.code !== "23505") {
      console.error("Create equipment error:", error);
      return { error: "שגיאה ביצירת הציוד" };
    }
  }

  return { error: "שגיאה ביצירת הציוד" };
}

/** Name/notes/active are editable; the code never is — stickers are printed. */
export async function updateEquipmentAction(
  input: EquipmentUpdateInput,
): Promise<MutateResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = equipmentUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { data: updated, error } = await typedFrom(supabase, "equipment")
    .update({
      name_he: validated.data.name,
      notes_he: validated.data.notes,
      is_active: validated.data.isActive,
    })
    .eq("id", validated.data.equipmentId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Update equipment error:", error);
    return { error: "שגיאה בעדכון הציוד" };
  }
  if (!updated) return { error: "הציוד לא נמצא" };

  revalidatePath("/admin/workouts/equipment");

  return { success: true, data: updated as Equipment };
}
