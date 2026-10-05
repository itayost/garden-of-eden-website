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
  bookingClosed,
  cancelState,
  isWithinBookingWindow,
  countedRowIds,
  type BookingBlock,
} from "@/lib/schedule/booking-rules";
import { bookingVerdict, resolvePlanQueue } from "@/lib/plans/plan-queue";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { loadStoredPlans, planStamps } from "@/features/plans/lib/queries";
import type { ScheduleSlot } from "@/types/schedule";
import { loadTraineeRosterRows } from "../queries";

type BookResult = { ok: true; sessionsLeft: number | null } | { error: string; block?: BookingBlock };
type CancelResult = { ok: true; late: boolean } | { error: string };

const RPC_ERRORS: Record<string, { message: string; block: BookingBlock }> = {
  capacity_full: { message: "האימון התמלא רגע לפני", block: "full" },
  already_booked: { message: BOOKING_BLOCK_LABELS_HE.already_booked, block: "already_booked" },
  slot_not_bookable: { message: BOOKING_BLOCK_LABELS_HE.staff_only, block: "staff_only" },
  slot_not_found: { message: BOOKING_BLOCK_LABELS_HE.not_found, block: "not_found" },
};
/** The trainee's roster changed between the read and the lock; the verdict is stale. */
const ROSTER_CHANGED = "roster_changed";
const PLANS_CHANGED = "plans_changed";

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
  revalidatePath("/admin/calendar");
}

/**
 * A trainee takes a seat. Every rule runs here against fresh reads, through
 * the Plan queue, then the seat itself is taken inside book_slot_checked,
 * which locks the slot row so the last seat cannot go twice.
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

  const [memberships, profile, rows, storedPlans] = await Promise.all([
    loadBranchIdsByProfile(db, [user.id]),
    db.from("profiles").select("full_name, role, is_active").eq("id", user.id).maybeSingle(),
    loadTraineeRosterRows(db, user.id),
    loadStoredPlans(db, [user.id]),
  ]);
  if (!profile.data || profile.data.role !== "trainee" || !profile.data.is_active) {
    return { error: "ההרשמה זמינה למתאמנים פעילים בלבד" };
  }
  if (!(memberships.get(user.id) ?? []).includes(slot.branch_id)) return blocked("wrong_branch");
  if (rows.some((r) => r.slot_id === slot.id && r.cancelled_at === null)) return blocked("already_booked");

  // The Plan queue decides: the Booking must land on a Plan, in date order.
  const plans = storedPlans.get(user.id) ?? [];
  const target = { date: slot.schedule_date, start_time: slot.start_time, branch_id: slot.branch_id };
  // A rebooking reactivates this slot's own row (cancelled, maybe late), so
  // judge the queue without it; the database still compares every counted row.
  const otherRows = rows.filter((r) => r.slot_id !== slot.id);
  const verdict = bookingVerdict(plans, otherRows, target, today);
  if (!verdict.ok) return blocked(verdict.block);

  // book_slot_checked is not in the generated types; the same cast the roster RPC uses.
  const rpcClient = db as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  // The verdict holds only for the rows and Plans it was made on. The function
  // compares both with the trainee's under a per-trainee lock, so parallel
  // requests, or an Adjustment or Void in between, cannot pass on a stale picture.
  const { error } = await rpcClient.rpc("book_slot_checked", {
    p_slot_id: slot.id,
    p_trainee_id: user.id,
    p_trainee_name: profile.data.full_name ?? "מתאמן",
    p_counted_row_ids: countedRowIds(rows),
    p_plan_stamps: planStamps(plans),
  });
  if (error) {
    if (error.message.includes(ROSTER_CHANGED)) return { error: "ההרשמות שלך השתנו הרגע. נסו שוב." };
    if (error.message.includes(PLANS_CHANGED)) return { error: "המסלול שלך עודכן הרגע. נסו שוב." };
    const known = Object.keys(RPC_ERRORS).find((key) => error.message.includes(key));
    if (known) return { error: RPC_ERRORS[known].message, block: RPC_ERRORS[known].block };
    console.error(`[book] rpc failed for ${slot.id}:`, error.message);
    return { error: "ההרשמה נכשלה. נסו שוב." };
  }

  revalidate();
  const booked = {
    id: "booked",
    schedule_date: slot.schedule_date,
    start_time: slot.start_time,
    branch_id: slot.branch_id,
    cancelled_at: null,
    late_cancel: false,
  };
  return { ok: true, sessionsLeft: resolvePlanQueue(plans, [...otherRows, booked], today).sessionsLeft };
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

  // The workout leaves with the seat. drop_slot_workout_session refuses to
  // touch a session a trainer edited individually or one already completed, so
  // this can only take back what the slot's group workout gave. A late cancel
  // still counts as a used session; that is the roster row's business, not
  // this one's. Logged rather than returned: the seat is already given back.
  const { error: dropError } = await (
    db as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    }
  ).rpc("drop_slot_workout_session", {
    p_slot_id: slotId,
    p_trainee_id: user.id,
  });
  if (dropError) console.error("drop_slot_workout_session failed:", dropError);

  revalidate();
  return { ok: true, late: state === "late" };
}
