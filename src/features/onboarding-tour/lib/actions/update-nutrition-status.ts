"use server";

import { verifyAdmin } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/validations/common";
import type { NutritionAppointmentStatus } from "@/types/database";

const VALID_STATUSES: NutritionAppointmentStatus[] = [
  "not_scheduled",
  "scheduled",
  "completed",
];

export async function updateNutritionAppointmentStatus(
  traineeId: string,
  status: NutritionAppointmentStatus
): Promise<{ error?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  if (!isValidUUID(traineeId)) return { error: "מזהה חניך לא תקין" };
  if (!VALID_STATUSES.includes(status)) return { error: "סטטוס לא תקין" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      nutrition_appointment_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", traineeId);

  if (error) return { error: "שגיאה בעדכון" };
  return {};
}
