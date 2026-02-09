"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifyAdmin, verifyAdminOrTrainer } from "./shared/verify-admin";
import { isSaturdayInIsrael } from "@/lib/utils/israel-time";

const MAX_SHIFT_HOURS = 12;

type ActionResult =
  | { error: string; success?: never }
  | { success: true; error?: never };

export async function clockInAction(): Promise<ActionResult> {
  const result = await verifyAdminOrTrainer();
  if (result.error) return { error: result.error };
  const user = result.user!;
  const profile = result.profile!;

  // Block clock-in on Saturday (Israel time)
  if (isSaturdayInIsrael()) {
    return { error: "לא ניתן להתחיל משמרת בשבת" };
  }

  const supabase = await createClient();

  // Check for existing active shift
  const { data: existingShift } = await supabase
    .from("trainer_shifts")
    .select("id")
    .eq("trainer_id", user.id)
    .is("end_time", null)
    .maybeSingle();

  if (existingShift) {
    return { error: "כבר יש לך משמרת פעילה" };
  }

  const { error: insertError } = await supabase
    .from("trainer_shifts")
    .insert({
      trainer_id: user.id,
      trainer_name: profile.full_name || "מאמן",
    });

  if (insertError) {
    console.error("Clock in error:", insertError);
    return { error: "שגיאה בתחילת משמרת" };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function clockOutAction(): Promise<ActionResult> {
  const result = await verifyAdminOrTrainer();
  if (result.error) return { error: result.error };
  const user = result.user!;

  const supabase = await createClient();

  const { data: activeShift, error: fetchError } = await supabase
    .from("trainer_shifts")
    .select("id, start_time")
    .eq("trainer_id", user.id)
    .is("end_time", null)
    .maybeSingle();

  if (fetchError || !activeShift) {
    return { error: "לא נמצאה משמרת פעילה" };
  }

  const startTime = new Date(activeShift.start_time);
  const now = new Date();
  const hoursDiff =
    (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  const flagForReview = hoursDiff > MAX_SHIFT_HOURS;

  const { error: updateError } = await supabase
    .from("trainer_shifts")
    .update({
      end_time: now.toISOString(),
      flagged_for_review: flagForReview,
    })
    .eq("id", activeShift.id);

  if (updateError) {
    console.error("Clock out error:", updateError);
    return { error: "שגיאה בסיום משמרת" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/shifts");
  return { success: true };
}

export async function checkAndAutoEndShiftAction(): Promise<{
  autoEnded: boolean;
  activeShift: { id: string; start_time: string } | null;
}> {
  const result = await verifyAdminOrTrainer();
  if (result.error) return { autoEnded: false, activeShift: null };
  const user = result.user!;

  const supabase = await createClient();

  const { data: activeShift } = await supabase
    .from("trainer_shifts")
    .select("id, start_time")
    .eq("trainer_id", user.id)
    .is("end_time", null)
    .maybeSingle();

  if (!activeShift) {
    return { autoEnded: false, activeShift: null };
  }

  const startTime = new Date(activeShift.start_time);
  const now = new Date();
  const hoursDiff =
    (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

  if (hoursDiff >= MAX_SHIFT_HOURS) {
    await supabase
      .from("trainer_shifts")
      .update({
        end_time: now.toISOString(),
        auto_ended: true,
        flagged_for_review: true,
      })
      .eq("id", activeShift.id);

    revalidatePath("/admin");
    return { autoEnded: true, activeShift: null };
  }

  return { autoEnded: false, activeShift };
}

export async function adminEndShiftAction(
  shiftId: string
): Promise<ActionResult> {
  const { error } = await verifyAdmin();
  if (error) return { error };

  const supabase = await createClient();

  // Verify shift exists and is active
  const { data: shift } = await supabase
    .from("trainer_shifts")
    .select("id, end_time")
    .eq("id", shiftId)
    .maybeSingle();

  if (!shift) return { error: "משמרת לא נמצאה" };
  if (shift.end_time) return { error: "המשמרת כבר הסתיימה" };

  const { error: updateError } = await supabase
    .from("trainer_shifts")
    .update({
      end_time: new Date().toISOString(),
      flagged_for_review: true,
    })
    .eq("id", shiftId);

  if (updateError) {
    console.error("Admin end shift error:", updateError);
    return { error: "שגיאה בסיום משמרת" };
  }

  revalidatePath("/admin/shifts");
  return { success: true };
}

export async function markShiftReviewedAction(
  shiftId: string
): Promise<ActionResult> {
  const { error } = await verifyAdmin();
  if (error) return { error };

  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("trainer_shifts")
    .update({ flagged_for_review: false })
    .eq("id", shiftId);

  if (updateError) return { error: "שגיאה בעדכון" };

  revalidatePath("/admin/shifts");
  return { success: true };
}

export async function deleteShiftAction(
  shiftId: string
): Promise<ActionResult> {
  const { error } = await verifyAdmin();
  if (error) return { error };

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("trainer_shifts")
    .delete()
    .eq("id", shiftId);

  if (deleteError) return { error: "שגיאה במחיקה" };

  revalidatePath("/admin/shifts");
  return { success: true };
}
