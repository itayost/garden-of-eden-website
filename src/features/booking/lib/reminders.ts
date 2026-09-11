import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { addDays } from "@/lib/utils/iso-date";
import { sendBookingReminder } from "@/lib/whatsapp/plan-templates";
import { toE164 } from "@/lib/plans/local-phone";

interface ReminderRow {
  id: string;
  trainee_id: string | null;
  trainee_name: string;
  slot: {
    schedule_date: string;
    start_time: string;
    trainer_name: string | null;
    location_he: string | null;
    branch_id: string | null;
  } | null;
}

/**
 * The evening-before nudge for self-booked trainings: one message per
 * booking, to the trainee's login phone, stamped on success so the next
 * run skips it. Best-effort; failures are counted, never thrown.
 */
export async function sendBookingReminders(
  db: SupabaseClient,
  today: string,
): Promise<{ sent: number; failed: number }> {
  const tomorrow = addDays(today, 1);
  const { data } = (await typedFrom(db, "daily_schedule_slot_trainees")
    .select("id, trainee_id, trainee_name, slot:daily_schedule_slots!inner(schedule_date, start_time, trainer_name, location_he, branch_id)")
    .eq("source", "self")
    .is("cancelled_at", null)
    .is("reminded_at", null)
    .not("trainee_id", "is", null)
    .eq("slot.schedule_date", tomorrow)
    .limit(200)) as { data: ReminderRow[] | null };
  const rows = (data ?? []).filter((r) => r.slot && r.trainee_id);
  if (rows.length === 0) return { sent: 0, failed: 0 };

  // The login phone lives on auth.users; profiles.phone is editable by the
  // trainee and must not redirect reminders.
  const phoneById = new Map<string, string>();
  for (const traineeId of Array.from(new Set(rows.map((r) => r.trainee_id!)))) {
    const { data } = await db.auth.admin.getUserById(traineeId);
    if (data.user?.phone) phoneById.set(traineeId, data.user.phone);
  }

  const { data: branches } = (await typedFrom(db, "branches")
    .select("id, name_he")
    .in("id", Array.from(new Set(rows.map((r) => r.slot!.branch_id).filter((b): b is string => b !== null))))) as {
    data: { id: string; name_he: string }[] | null;
  };
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name_he]));

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const phone = phoneById.get(row.trainee_id!);
    if (!phone) continue;
    const slot = row.slot!;
    const result = await sendBookingReminder(toE164(phone), {
      traineeName: row.trainee_name,
      time: slot.start_time.slice(0, 5),
      trainerName: slot.trainer_name ?? "הצוות",
      place: slot.location_he ?? branchName.get(slot.branch_id ?? "") ?? "המגרש",
    });
    if (!result.success) {
      failed += 1;
      continue;
    }
    await typedFrom(db, "daily_schedule_slot_trainees")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", row.id);
    sent += 1;
  }
  return { sent, failed };
}
