"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

type ActionResult =
  | { success: true }
  | { error: string };

/**
 * Hard-delete a lead and all related data (cascade)
 */
export async function deleteLeadAction(id: string): Promise<ActionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה לא תקין" };

  const supabase = await createClient();

  const { error } = await typedFrom(supabase, "leads").delete().eq("id", id);

  if (error) {
    console.error("Delete lead error:", error);
    return { error: "שגיאה במחיקת ליד" };
  }

  revalidatePath("/admin/leads");

  return { success: true };
}
