"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelMinutesOfDay } from "@/lib/utils/israel-time";
import { addDays } from "@/lib/utils/iso-date";
import { israelToday } from "@/lib/utils/tasks";
import {
  BOOKING_WINDOW_DAYS,
  WEEKLY_CAP,
  WEEKLY_CAP_KINDS,
  bookingClosed,
  bookingEligibility,
  cancelState,
  countReservedFromRows,
  countSessionsLeft,
  weeklyBookingCount,
  type BookingBlock,
  type CancelState,
} from "@/lib/schedule/booking-rules";
import { countSessionsUsedFromRows } from "@/lib/plans/plan-status";
import { loadPlansWithUsage } from "@/features/plans/lib/queries";
import { buildRenewalUrl } from "@/features/plans/lib/renewal-link";
import { PLAN_STATUS_LABELS_HE, type PlanStatus } from "@/types/plans";
import { materializeBookableSlots } from "../materialize";
import { loadBookableBranchForUser, loadBookableSlots, loadTraineeRosterRows } from "../queries";

export interface BookableSlotView {
  id: string;
  date: string;
  /** HH:MM */
  time: string;
  trainerName: string;
  label: string | null;
  location: string | null;
  seatsTaken: number;
  maxTrainees: number;
  booked: boolean;
  closed: boolean;
}

export interface MyBooking {
  slotId: string;
  date: string;
  time: string;
  trainerName: string;
  location: string | null;
  cancelState: CancelState;
  /** Staff put the trainee on the roster; the trainee cannot cancel it here. */
  byStaff: boolean;
}

export interface TraineeScheduleView {
  canBook: boolean;
  branchId: string | null;
  today: string;
  plan: {
    name: string;
    status: PlanStatus;
    statusLabel: string;
    sessionsLeft: number | null;
    weekCount: number;
    weeklyCap: number | null;
    endsOn: string;
    renewUrl: string | null;
  } | null;
  /** Why booking is blocked for the plan as a whole, if it is. */
  block: BookingBlock | null;
  bookings: MyBooking[];
  days: {
    date: string;
    slots: BookableSlotView[];
    /** Trainings already counted in this day's week. */
    weekCount: number;
    /** A day-level reason: the plan does not run that day, or the week is at cap. */
    dayBlock: BookingBlock | null;
  }[];
}

/**
 * Everything the trainee's schedule page shows. The session identifies the
 * trainee; the service role does the reads, because slot tables are
 * staff-only under RLS. Projects missing slots first so the two weeks are
 * always there.
 */
export async function getMyScheduleAction(): Promise<TraineeScheduleView | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "נדרשת התחברות" };

  const db = createAdminClient();
  const today = israelToday();
  const now = { date: today, minutes: israelMinutesOfDay(new Date()) };
  const branchId = await loadBookableBranchForUser(db, user.id);
  if (!branchId) {
    return { canBook: false, branchId: null, today, plan: null, block: null, bookings: [], days: [] };
  }

  await materializeBookableSlots(db, branchId, today);
  const to = addDays(today, BOOKING_WINDOW_DAYS);
  const [slots, rows, plans] = await Promise.all([
    loadBookableSlots(db, branchId, today, to),
    loadTraineeRosterRows(db, user.id),
    loadPlansWithUsage(db, [user.id], today),
  ]);
  const current = plans.get(user.id) ?? null;
  const mySlotIds = new Set(rows.filter((r) => r.cancelled_at === null).map((r) => r.slot_id));

  const plan = current
    ? {
        name: current.product.name_he,
        status: current.status,
        statusLabel: PLAN_STATUS_LABELS_HE[current.status],
        sessionsLeft: countSessionsLeft(current.plan, current.sessionsUsed, countReservedFromRows(rows, current.plan, today)),
        weekCount: weeklyBookingCount(rows, today, branchId),
        weeklyCap: WEEKLY_CAP_KINDS.includes(current.product.kind) ? WEEKLY_CAP : null,
        endsOn: current.plan.ends_on,
        renewUrl:
          current.status === "expired" || current.status === "ending_soon"
            ? buildRenewalUrl(current.plan.id)
            : null,
      }
    : null;

  // Plan-wide reasons block the page; date-bound reasons (the plan not
  // running yet, a week at cap) block only the days they apply to.
  const used = current ? countSessionsUsedFromRows(rows, current.plan, today) : 0;
  const reserved = current ? countReservedFromRows(rows, current.plan, today) : 0;
  const PAGE_BLOCKS: BookingBlock[] = ["no_plan", "plan_cancelled", "addon", "no_sessions_left"];
  const eligibilityFor = (date: string, weekCount: number) =>
    bookingEligibility({
      plan: current?.plan ?? null,
      productKind: current?.product.kind ?? null,
      used,
      reserved,
      weekCount,
      slotDate: date,
    });
  const pageEligibility = eligibilityFor(current?.plan.starts_on ?? today, 0);
  const pageBlock =
    !pageEligibility.ok && PAGE_BLOCKS.includes(pageEligibility.block) ? pageEligibility.block : null;

  const bookings: MyBooking[] = rows
    .filter((r) => r.cancelled_at === null && r.schedule_date >= today)
    .sort((a, b) => `${a.schedule_date}${a.start_time}`.localeCompare(`${b.schedule_date}${b.start_time}`))
    .map((r) => ({
      slotId: r.slot_id,
      date: r.schedule_date,
      time: r.start_time.slice(0, 5),
      trainerName: r.trainer_name ?? "הצוות",
      location: r.location_he,
      cancelState: cancelState(r.schedule_date, r.start_time, now),
      byStaff: r.source === "staff",
    }));

  const byDate = new Map<string, BookableSlotView[]>();
  for (const slot of slots) {
    const view: BookableSlotView = {
      id: slot.id,
      date: slot.schedule_date,
      time: slot.start_time.slice(0, 5),
      trainerName: slot.trainer_name ?? "הצוות",
      label: slot.focus_he,
      location: slot.location_he,
      seatsTaken: slot.seatsTaken,
      maxTrainees: slot.max_trainees,
      booked: mySlotIds.has(slot.id),
      closed: bookingClosed(slot.schedule_date, slot.start_time, now),
    };
    byDate.set(slot.schedule_date, [...(byDate.get(slot.schedule_date) ?? []), view]);
  }
  const days = Array.from({ length: BOOKING_WINDOW_DAYS + 1 }, (_, i) => addDays(today, i)).map((date) => {
    const weekCount = weeklyBookingCount(rows, date, branchId);
    const e = eligibilityFor(date, weekCount);
    return {
      date,
      slots: byDate.get(date) ?? [],
      weekCount,
      dayBlock: e.ok || pageBlock ? null : e.block,
    };
  });

  return {
    canBook: true,
    branchId,
    today,
    plan,
    block: pageBlock,
    bookings,
    days,
  };
}
