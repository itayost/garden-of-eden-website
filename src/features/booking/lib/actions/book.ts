"use server";

import { revalidatePath } from "next/cache";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { israelMinutesOfDay } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";
import { isValidUUID } from "@/lib/validations/common";
import {
  BOOKING_BLOCK_LABELS_HE,
  WEEKLY_CAP,
  WEEKLY_CAP_KINDS,
  bookingClosed,
  bookingEligibility,
  cancelState,
  countReservedFromRows,
  countSessionsLeft,
  isWithinBookingWindow,
  weeklyBookingCount,
  type BookingBlock,
} from "@/lib/schedule/booking-rules";
import { countSessionsUsedFromRows } from "@/lib/plans/plan-status";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { loadPlansWithUsage } from "@/features/plans/lib/queries";
import type { ScheduleSlot } from "@/types/schedule";
import { loadTraineeRosterRows } from "../queries";

type BookResult = { ok: true; sessionsLeft: number | null } | { error: string; block?: BookingBlock };
type CancelResult = { ok: true; late: boolean } | { error: string };

const RPC_ERRORS: Record<string, { message: string; block: BookingBlock }> = {
  capacity_full: { message: "האימון התמלא רגע לפני", block: "full" },
  no_sessions_left: { message: BOOKING_BLOCK_LABELS_HE.no_sessions_left, block: "no_sessions_left" },
  weekly_cap: { message: BOOKING_BLOCK_LABELS_HE.weekly_cap, block: "weekly_cap" },
  already_booked: { message: BOOKING_BLOCK_LABELS_HE.already_booked, block: "already_booked" },
  slot_not_bookable: { message: BOOKING_BLOCK_LABELS_HE.staff_only, block: "staff_only" },
  slot_not_found: { message: BOOKING_BLOCK_LABELS_HE.not_found, block: "not_found" },
};

function blocked(block: BookingBlock): BookResult {
  return { error: BOOKING_BLOCK_LABELS_HE[block], block };
}

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function revalidate(): void {
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard");
  revalidatePath("/admin/schedule");
}

/**
 * A trainee takes a seat. Every rule runs here against fresh reads, then the
 * seat itself is taken inside book_slot, which locks the slot row so the
 * last seat cannot go twice.
 */
export async function bookSlotAction(slotId: string): Promise<BookResult> {
  const user = await currentUser();
  if (!user) return { error: "נדרשת התחברות" };
  if (!isValidUUID(slotId)) return { error: "האימון לא נמצא" };

  const limit = await checkRateLimit(`booking:${user.id}`, "booking");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "יותר מדי פעולות. נסו שוב בעוד כמה דקות." };

  const db = createAdminClient();
  const today = israelToday();
  const now = { date: today, minutes: israelMinutesOfDay(new Date()) };

  const { data: slot } = (await typedFrom(db, "daily_schedule_slots")
    .select("id, schedule_date, start_time, branch_id, max_trainees")
    .eq("id", slotId)
    .maybeSingle()) as {
    data: Pick<ScheduleSlot, "id" | "schedule_date" | "start_time" | "branch_id" | "max_trainees"> | null;
  };
  if (!slot) return blocked("not_found");
  if (slot.max_trainees === null || !slot.branch_id) return blocked("staff_only");
  if (!isWithinBookingWindow(slot.schedule_date, today)) return blocked("outside_window");
  if (bookingClosed(slot.schedule_date, slot.start_time, now)) return blocked("closed");

  const [memberships, profile, rows, plans] = await Promise.all([
    loadBranchIdsByProfile(db, [user.id]),
    db.from("profiles").select("full_name, role, is_active").eq("id", user.id).maybeSingle(),
    loadTraineeRosterRows(db, user.id),
    loadPlansWithUsage(db, [user.id], today),
  ]);
  if (!profile.data || profile.data.role !== "trainee" || !profile.data.is_active) {
    return { error: "ההרשמה זמינה למתאמנים פעילים בלבד" };
  }
  if (!(memberships.get(user.id) ?? []).includes(slot.branch_id)) return blocked("wrong_branch");
  if (rows.some((r) => r.slot_id === slot.id && r.cancelled_at === null)) return blocked("already_booked");

  const current = plans.get(user.id) ?? null;
  if (current && current.plan.branch_id !== slot.branch_id) return blocked("wrong_branch");
  const used = current ? countSessionsUsedFromRows(rows, current.plan, today) : 0;
  const reserved = current ? countReservedFromRows(rows, current.plan, today) : 0;
  const eligibility = bookingEligibility({
    plan: current?.plan ?? null,
    productKind: current?.product.kind ?? null,
    used,
    reserved,
    weekCount: weeklyBookingCount(rows, slot.schedule_date, slot.branch_id),
    slotDate: slot.schedule_date,
  });
  if (!eligibility.ok) return blocked(eligibility.block);

  // book_slot is not in the generated types; the same cast the roster RPC uses.
  const rpcClient = db as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  // The plan caps are counted again inside the function under a per-trainee
  // lock, so parallel requests cannot all pass the checks above.
  const { error } = await rpcClient.rpc("book_slot", {
    p_slot_id: slot.id,
    p_trainee_id: user.id,
    p_trainee_name: profile.data.full_name ?? "מתאמן",
    p_plan_starts: current!.plan.starts_on,
    p_plan_ends: current!.plan.ends_on,
    p_sessions_total: current!.plan.sessions_total,
    p_sessions_used: used,
    p_weekly_cap: WEEKLY_CAP_KINDS.includes(current!.product.kind) ? WEEKLY_CAP : null,
    p_today: today,
  });
  if (error) {
    const known = Object.keys(RPC_ERRORS).find((key) => error.message.includes(key));
    if (known) return { error: RPC_ERRORS[known].message, block: RPC_ERRORS[known].block };
    console.error(`[book] rpc failed for ${slot.id}:`, error.message);
    return { error: "ההרשמה נכשלה. נסו שוב." };
  }

  revalidate();
  return {
    ok: true,
    sessionsLeft: current ? countSessionsLeft(current.plan, used, reserved + 1) : null,
  };
}

/** A trainee gives a seat back. Inside the cutoff it still counts as used. */
export async function cancelBookingAction(slotId: string): Promise<CancelResult> {
  const user = await currentUser();
  if (!user) return { error: "נדרשת התחברות" };
  if (!isValidUUID(slotId)) return { error: "האימון לא נמצא" };

  const limit = await checkRateLimit(`booking:${user.id}`, "booking");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "יותר מדי פעולות. נסו שוב בעוד כמה דקות." };

  const db = createAdminClient();
  const rows = await loadTraineeRosterRows(db, user.id);
  const row = rows.find((r) => r.slot_id === slotId && r.cancelled_at === null);
  if (!row) return { error: "לא נמצאה הרשמה לאימון הזה" };
  if (row.source === "staff") return { error: "האימון נקבע על ידי הצוות. לביטול דברו איתם בוואטסאפ." };

  const now = { date: israelToday(), minutes: israelMinutesOfDay(new Date()) };
  const state = cancelState(row.schedule_date, row.start_time, now);
  if (state === "closed") return { error: "האימון כבר התחיל" };

  const { data, error } = await typedFrom(db, "daily_schedule_slot_trainees")
    .update({ cancelled_at: new Date().toISOString(), late_cancel: state === "late" })
    .eq("id", row.id)
    .is("cancelled_at", null)
    .select("id");
  if (error || !data?.length) return { error: "הביטול נכשל. נסו שוב." };

  revalidate();
  return { ok: true, late: state === "late" };
}
