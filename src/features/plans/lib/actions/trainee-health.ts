"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { healthSchema, type HealthInput } from "@/lib/validations/plans-admin";

export interface TraineeHealth {
  medicalNotes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

type ActionResult = { success: true } | { error: string };

export async function getTraineeHealthAction(traineeId: string): Promise<TraineeHealth | null> {
  const { error } = await verifyAdminOrTrainer();
  if (error || !isValidUUID(traineeId)) return null;
  const scopeError = await assertTraineeInScope(traineeId);
  if (scopeError) return null;

  const { data } = await createAdminClient()
    .from("profiles")
    .select("medical_notes, emergency_contact_name, emergency_contact_phone, guardian_name, guardian_phone")
    .eq("id", traineeId)
    .maybeSingle();
  if (!data) return null;
  return {
    medicalNotes: data.medical_notes,
    emergencyContactName: data.emergency_contact_name,
    emergencyContactPhone: data.emergency_contact_phone,
    guardianName: data.guardian_name,
    guardianPhone: data.guardian_phone,
  };
}

/** Trainers may correct health data for trainees in their branch: a parent tells them at the field. */
export async function updateTraineeHealthAction(input: HealthInput): Promise<ActionResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = healthSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const scopeError = await assertTraineeInScope(parsed.data.traineeId);
  if (scopeError) return { error: scopeError };

  const db = createAdminClient();
  const { error } = await db
    .from("profiles")
    .update({
      medical_notes: parsed.data.medicalNotes,
      emergency_contact_name: parsed.data.emergencyContactName,
      emergency_contact_phone: parsed.data.emergencyContactPhone,
    })
    .eq("id", parsed.data.traineeId);
  if (error) return { error: "שגיאה בשמירה" };

  await db.from("activity_logs").insert({
    user_id: parsed.data.traineeId,
    action: "user_updated",
    actor_id: user!.id,
    actor_name: profile?.full_name ?? "צוות",
    changes: [{ field: "health", old_value: null, new_value: "עודכן" }],
  });

  revalidatePath(`/admin/users/${parsed.data.traineeId}`);
  revalidatePath("/admin/schedule");
  return { success: true };
}
