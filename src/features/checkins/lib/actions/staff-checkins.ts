"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays } from "@/lib/utils/iso-date";
import { israelToday } from "@/lib/utils/tasks";
import { isValidUUID } from "@/lib/validations/common";
import type { Checkin } from "../checkin";
import { loadRecentCheckins } from "../queries";

/** How far back the trainee page shows Check-ins. */
const DAYS_SHOWN = 14;

type Result = { success: true; data: Checkin[] } | { success: false; error: string };

/** A Trainee's Check-ins for the trainee page. Trainers see their branches' Trainees only. */
export async function getTraineeCheckinsAction(traineeId: string): Promise<Result> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { success: false, error };
  if (!isValidUUID(traineeId)) return { success: false, error: "מזהה מתאמן לא תקין" };

  const scopeError = await assertTraineeInScope(traineeId);
  if (scopeError) return { success: false, error: scopeError };

  try {
    const fromDate = addDays(israelToday(), -(DAYS_SHOWN - 1));
    return { success: true, data: await loadRecentCheckins(createAdminClient(), traineeId, fromDate) };
  } catch (loadError) {
    console.error("[checkins] staff read failed:", loadError instanceof Error ? loadError.message : loadError);
    return { success: false, error: "שגיאה בטעינת הצ׳ק-אין" };
  }
}
