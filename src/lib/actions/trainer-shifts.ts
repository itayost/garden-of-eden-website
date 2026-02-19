"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdmin, verifyAdminOrTrainer } from "./shared/verify-admin";
import { isSaturdayInIsrael } from "@/lib/utils/israel-time";
import { isValidUUID } from "@/lib/validations/common";
import { resolveTimestamp } from "@/lib/utils/resolve-timestamp";

const MAX_SHIFT_HOURS = 12;

type ActionResult =
  | { error: string; success?: never }
  | { success: true; error?: never };

export async function clockInAction(
  clientTimestamp?: string
): Promise<ActionResult> {
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

  const timestamp = resolveTimestamp(clientTimestamp);
  if ("error" in timestamp) return { error: timestamp.error };

  const { error: insertError } = await supabase
    .from("trainer_shifts")
    .insert({
      trainer_id: user.id,
      trainer_name: profile.full_name || "מאמן",
      start_time: timestamp.value,
    });

  if (insertError) {
    console.error("Clock in error:", insertError);
    return { error: "שגיאה בתחילת משמרת" };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function clockOutAction(
  clientTimestamp?: string
): Promise<ActionResult> {
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

  const timestamp = resolveTimestamp(clientTimestamp);
  if ("error" in timestamp) return { error: timestamp.error };

  const startTime = new Date(activeShift.start_time);
  const endTime = new Date(timestamp.value);
  const hoursDiff =
    (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  const flagForReview = hoursDiff > MAX_SHIFT_HOURS;

  const { error: updateError } = await supabase
    .from("trainer_shifts")
    .update({
      end_time: timestamp.value,
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
  if (!isValidUUID(shiftId)) return { error: "מזהה משמרת לא תקין" };

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
  if (!isValidUUID(shiftId)) return { error: "מזהה משמרת לא תקין" };

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
  if (!isValidUUID(shiftId)) return { error: "מזהה משמרת לא תקין" };

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

export async function adminCreateShiftAction(data: {
  trainerId: string;
  startTime: string;
  endTime: string;
}): Promise<ActionResult> {
  if (!isValidUUID(data.trainerId)) return { error: "מזהה מאמן לא תקין" };

  const { error } = await verifyAdmin();
  if (error) return { error };

  // Validate timestamps
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: "תאריך או שעה לא תקינים" };
  }
  if (end <= start) {
    return { error: "שעת סיום חייבת להיות אחרי שעת התחלה" };
  }
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (durationHours > MAX_SHIFT_HOURS) {
    return { error: `משמרת לא יכולה להיות ארוכה יותר מ-${MAX_SHIFT_HOURS} שעות` };
  }

  const supabase = await createClient();

  // Look up trainer name and verify role
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", data.trainerId)
    .in("role", ["trainer", "admin"])
    .single();

  if (!profile) return { error: "מאמן לא נמצא" };

  // Check for overlapping shifts
  const { data: overlapping } = await supabase
    .from("trainer_shifts")
    .select("id")
    .eq("trainer_id", data.trainerId)
    .lt("start_time", data.endTime)
    .gt("end_time", data.startTime)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    return { error: "קיימת משמרת חופפת לזמנים אלו" };
  }

  const { error: insertError } = await supabase
    .from("trainer_shifts")
    .insert({
      trainer_id: data.trainerId,
      trainer_name: profile.full_name || "מאמן",
      start_time: data.startTime,
      end_time: data.endTime,
    });

  if (insertError) {
    console.error("Admin create shift error:", insertError);
    return { error: "שגיאה ביצירת משמרת" };
  }

  revalidatePath("/admin/shifts");
  return { success: true };
}

export async function adminEditShiftAction(data: {
  shiftId: string;
  startTime: string;
  endTime: string;
}): Promise<ActionResult> {
  if (!isValidUUID(data.shiftId)) return { error: "מזהה משמרת לא תקין" };

  const { error } = await verifyAdmin();
  if (error) return { error };

  // Validate timestamps
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: "תאריך או שעה לא תקינים" };
  }
  if (end <= start) {
    return { error: "שעת סיום חייבת להיות אחרי שעת התחלה" };
  }
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (durationHours > MAX_SHIFT_HOURS) {
    return { error: `משמרת לא יכולה להיות ארוכה יותר מ-${MAX_SHIFT_HOURS} שעות` };
  }

  const supabase = await createClient();

  // Verify shift exists
  const { data: existing } = await supabase
    .from("trainer_shifts")
    .select("id")
    .eq("id", data.shiftId)
    .maybeSingle();

  if (!existing) return { error: "משמרת לא נמצאה" };

  const { error: updateError } = await supabase
    .from("trainer_shifts")
    .update({
      start_time: data.startTime,
      end_time: data.endTime,
    })
    .eq("id", data.shiftId);

  if (updateError) {
    console.error("Admin edit shift error:", updateError);
    return { error: "שגיאה בעדכון משמרת" };
  }

  revalidatePath("/admin/shifts");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Failed shift sync management (admin only)
// ---------------------------------------------------------------------------

export interface FailedShiftSync {
  id: string;
  trainer_id: string;
  trainer_name: string;
  action_type: string;
  client_timestamp: string;
  failure_reason: string;
  resolved: boolean;
  created_at: string;
}

export async function getFailedShiftSyncsAction(): Promise<{
  data: FailedShiftSync[];
  error?: string;
}> {
  const { error } = await verifyAdmin();
  if (error) return { data: [], error };

  const supabase = await createClient();

  const { data, error: fetchError } = await typedFrom(supabase, "failed_shift_syncs")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  if (fetchError) return { data: [], error: "שגיאה בטעינת נתונים" };
  return { data: (data as FailedShiftSync[]) || [] };
}

export async function resolveFailedSyncAction(
  syncId: string
): Promise<ActionResult> {
  if (!isValidUUID(syncId)) return { error: "מזהה לא תקין" };

  const { error } = await verifyAdmin();
  if (error) return { error };

  const supabase = await createClient();

  const { error: updateError } = await typedFrom(supabase, "failed_shift_syncs")
    .update({ resolved: true })
    .eq("id", syncId);

  if (updateError) return { error: "שגיאה בעדכון" };

  revalidatePath("/admin/shifts");
  return { success: true };
}
