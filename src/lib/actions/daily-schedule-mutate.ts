"use server";

import { revalidatePath } from "next/cache";

import { verifyAdmin } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  duplicateDaySchema,
  slotIdSchema,
  slotSchema,
  slotUpdateSchema,
  type DuplicateDayInput,
  type SlotInput,
  type SlotUpdateInput,
} from "@/lib/validations/schedule";
import { SLOT_SELECT_WITH_TRAINEES, type ScheduleSlot } from "@/types/schedule";

type SlotResult =
  | { success: true; data: ScheduleSlot }
  | { error: string; fieldErrors?: Record<string, string[]> };

type DeleteResult = { success: true } | { error: string };

type DuplicateResult =
  | { success: true; count: number }
  | { error: string; fieldErrors?: Record<string, string[]> };

function revalidateSchedule() {
  revalidatePath("/admin/schedule");
}

/**
 * Resolves the trainer's display-name snapshot. The snapshot keeps the
 * schedule readable if the trainer is later renamed or deleted.
 */
async function resolveTrainerName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainerId: string | null,
): Promise<{ name: string | null } | { error: string }> {
  if (!trainerId) return { name: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", trainerId)
    .in("role", ["trainer", "admin"])
    .is("deleted_at", null)
    .maybeSingle();

  // A query failure is not "trainer does not exist" — reporting it as such
  // would send the admin investigating a healthy trainer account.
  if (error) {
    console.error("Resolve trainer name error:", error);
    return { error: "שגיאה באימות המאמן" };
  }

  if (!data) return { error: "המאמן שנבחר אינו קיים או אינו פעיל" };
  return { name: data.full_name ?? "מאמן" };
}

/**
 * Atomic roster replace via the replace_slot_roster RPC — delete + insert in
 * one transaction, so a failure can never leave a slot with a lost or partial
 * roster. SECURITY INVOKER: the admin-only RLS write policy still applies.
 */
async function replaceRoster(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slotId: string,
  trainees: { traineeId: string | null; name: string }[],
): Promise<{ error: string | null }> {
  const rpcClient = supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  };

  const { error } = await rpcClient.rpc("replace_slot_roster", {
    p_slot_id: slotId,
    p_trainees: trainees.map((entry, index) => ({
      trainee_id: entry.traineeId,
      trainee_name: entry.name,
      order_index: index,
    })),
  });

  if (error) {
    console.error("replace_slot_roster failed:", error);
    return { error: "שגיאה בשמירת רשימת המתאמנים" };
  }
  return { error: null };
}

/** Roster rows for insert, preserving the order the admin arranged. */
function rosterRows(
  slotId: string,
  trainees: { traineeId: string | null; name: string }[],
) {
  return trainees.map((entry, index) => ({
    slot_id: slotId,
    trainee_id: entry.traineeId,
    trainee_name: entry.name,
    order_index: index,
  }));
}

export async function createSlotAction(input: SlotInput): Promise<SlotResult> {
  const { error: authError, user } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = slotSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { scheduleDate, startTime, trainerId, focus, location, trainees } =
    validated.data;
  const supabase = await createClient();

  const trainerResult = await resolveTrainerName(supabase, trainerId);
  if ("error" in trainerResult) return { error: trainerResult.error };

  const { data: created, error } = await typedFrom(supabase, "daily_schedule_slots")
    .insert({
      schedule_date: scheduleDate,
      start_time: startTime,
      trainer_id: trainerId,
      trainer_name: trainerResult.name,
      focus_he: focus,
      location_he: location,
      created_by: user!.id,
    })
    .select()
    .single();

  if (error || !created) {
    console.error("Create slot error:", error);
    return { error: "שגיאה ביצירת הסלוט" };
  }

  const { error: rosterError } = await typedFrom(
    supabase,
    "daily_schedule_slot_trainees",
  ).insert(rosterRows(created.id, trainees));

  if (rosterError) {
    console.error("Create slot roster error:", rosterError);
    // Do not leave a rosterless slot behind.
    await typedFrom(supabase, "daily_schedule_slots").delete().eq("id", created.id);
    return { error: "שגיאה בשמירת רשימת המתאמנים" };
  }

  revalidateSchedule();

  return { success: true, data: { ...created, trainees: [] } as ScheduleSlot };
}

/**
 * Updates a slot. The roster is replaced wholesale (delete + insert) — the
 * form always submits the complete list, and roster rows carry no state of
 * their own worth preserving.
 */
export async function updateSlotAction(input: SlotUpdateInput): Promise<SlotResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = slotUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { slotId, scheduleDate, startTime, trainerId, focus, location, trainees } =
    validated.data;
  const supabase = await createClient();

  const { data: existing } = await typedFrom(supabase, "daily_schedule_slots")
    .select("id")
    .eq("id", slotId)
    .maybeSingle();

  if (!existing) return { error: "הסלוט לא נמצא" };

  const trainerResult = await resolveTrainerName(supabase, trainerId);
  if ("error" in trainerResult) return { error: trainerResult.error };

  const { data: updated, error } = await typedFrom(supabase, "daily_schedule_slots")
    .update({
      schedule_date: scheduleDate,
      start_time: startTime,
      trainer_id: trainerId,
      trainer_name: trainerResult.name,
      focus_he: focus,
      location_he: location,
    })
    .eq("id", slotId)
    .select()
    .single();

  if (error || !updated) {
    console.error("Update slot error:", error);
    return { error: "שגיאה בעדכון הסלוט" };
  }

  const { error: rosterError } = await replaceRoster(supabase, slotId, trainees);
  if (rosterError) return { error: rosterError };

  revalidateSchedule();

  return { success: true, data: { ...updated, trainees: [] } as ScheduleSlot };
}

export async function deleteSlotAction(slotId: string): Promise<DeleteResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = slotIdSchema.safeParse({ slotId });
  if (!validated.success) return { error: "מזהה סלוט לא תקין" };

  const supabase = await createClient();

  // Roster rows cascade with the slot.
  const { error } = await typedFrom(supabase, "daily_schedule_slots")
    .delete()
    .eq("id", validated.data.slotId);

  if (error) {
    console.error("Delete slot error:", error);
    return { error: "שגיאה במחיקת הסלוט" };
  }

  revalidateSchedule();

  return { success: true };
}

/**
 * Copies every slot (with roster) from one day to another. Refuses when the
 * target day already has slots — duplicating on top of an existing schedule
 * would double it, and "merge" has no obvious meaning.
 */
export async function duplicateDayAction(
  input: DuplicateDayInput,
): Promise<DuplicateResult> {
  const { error: authError, user } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = duplicateDaySchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { fromDate, toDate } = validated.data;
  const supabase = await createClient();

  const { data: targetExisting } = await typedFrom(supabase, "daily_schedule_slots")
    .select("id")
    .eq("schedule_date", toDate)
    .limit(1);

  if ((targetExisting?.length ?? 0) > 0) {
    return { error: "ליום היעד כבר יש לוח. מחק אותו קודם או ערוך אותו ישירות." };
  }

  const { data: sourceSlots, error: sourceError } = await typedFrom(
    supabase,
    "daily_schedule_slots",
  )
    .select(SLOT_SELECT_WITH_TRAINEES)
    .eq("schedule_date", fromDate)
    .order("start_time", { ascending: true });

  if (sourceError) {
    console.error("Duplicate day fetch error:", sourceError);
    return { error: "שגיאה בטעינת יום המקור" };
  }

  const slots = (sourceSlots ?? []) as ScheduleSlot[];
  if (slots.length === 0) return { error: "אין לוח ביום המקור לשכפל" };

  // The target day was verified empty above, so on any mid-copy failure the
  // whole target day is wiped — otherwise the partial copy blocks a retry
  // (the empty-day guard) and forces slot-by-slot manual cleanup.
  const wipeTargetDay = async () => {
    await typedFrom(supabase, "daily_schedule_slots")
      .delete()
      .eq("schedule_date", toDate);
  };

  for (const slot of slots) {
    const { data: created, error } = await typedFrom(supabase, "daily_schedule_slots")
      .insert({
        schedule_date: toDate,
        start_time: slot.start_time,
        trainer_id: slot.trainer_id,
        trainer_name: slot.trainer_name,
        focus_he: slot.focus_he,
        location_he: slot.location_he,
        created_by: user!.id,
      })
      .select()
      .single();

    if (error || !created) {
      console.error("Duplicate day insert error:", error);
      await wipeTargetDay();
      return { error: "שגיאה בשכפול היום" };
    }

    if (slot.trainees.length > 0) {
      const { error: rosterError } = await typedFrom(
        supabase,
        "daily_schedule_slot_trainees",
      ).insert(
        slot.trainees.map((trainee) => ({
          slot_id: created.id,
          trainee_id: trainee.trainee_id,
          trainee_name: trainee.trainee_name,
          order_index: trainee.order_index,
        })),
      );

      if (rosterError) {
        console.error("Duplicate day roster error:", rosterError);
        await wipeTargetDay();
        return { error: "שגיאה בשכפול רשימת המתאמנים" };
      }
    }
  }

  revalidateSchedule();

  return { success: true, count: slots.length };
}
