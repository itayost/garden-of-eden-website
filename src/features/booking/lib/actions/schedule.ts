"use server";

import { trainerNames } from "@/lib/utils/trainer-color";
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
  cancelState,
  weeklyBookingCount,
  type BookingBlock,
  type CancelState,
} from "@/lib/schedule/booking-rules";
import { bookingVerdict, queueBookingBlock, resolvePlanQueue } from "@/lib/plans/plan-queue";
import { loadStoredPlans, toPlanQueueView } from "@/features/plans/lib/queries";
import { buildRenewalUrl } from "@/features/plans/lib/renewal-link";
import { PLAN_STATUS_LABELS_HE, type PlanStatus } from "@/types/plans";
import { materializeBookableSlots } from "../materialize";
import { loadBookableBranchForUser, loadBookableSlots, loadTraineeRosterRows } from "../queries";

const END_OF_DAY = "23:59:59";

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
  const [slots, rows, storedPlans] = await Promise.all([
    loadBookableSlots(db, branchId, today, to),
    loadTraineeRosterRows(db, user.id),
    loadStoredPlans(db, [user.id]),
  ]);
  const plans = storedPlans.get(user.id) ?? [];
  const queue = resolvePlanQueue(plans, rows, today);
  const view = toPlanQueueView(queue);
  const mySlotIds = new Set(rows.filter((r) => r.cancelled_at === null).map((r) => r.slot_id));

  // The cap shown is the one of the Plan running today.
  const runningKind = queue.current?.plan.kind ?? null;
  const plan = view
    ? {
        name: view.product.name_he,
        status: view.status,
        statusLabel: PLAN_STATUS_LABELS_HE[view.status],
        sessionsLeft: view.sessionsLeft,
        weekCount: weeklyBookingCount(rows, today, branchId),
        weeklyCap: runningKind && WEEKLY_CAP_KINDS.includes(runningKind) ? WEEKLY_CAP : null,
        endsOn: view.endsOn,
        renewUrl:
          view.status === "expired" || view.status === "ending_soon"
            ? buildRenewalUrl(view.plan.id)
            : null,
      }
    : null;

  // Plan-wide reasons block the page; date-bound reasons (no Plan running
  // that day, a week at cap) block only the days they apply to. A day is
  // judged for an hour at its end, which pushes no Booking of that day aside.
  const pageBlock = queueBookingBlock(plans, queue);

  const bookings: MyBooking[] = rows
    .filter((r) => r.cancelled_at === null && r.schedule_date >= today)
    .sort((a, b) => `${a.schedule_date}${a.start_time}`.localeCompare(`${b.schedule_date}${b.start_time}`))
    .map((r) => ({
      slotId: r.slot_id,
      date: r.schedule_date,
      time: r.start_time.slice(0, 5),
      trainerName: trainerNames(r.trainers ?? []) || "הצוות",
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
      trainerName: trainerNames(slot.trainers ?? []) || "הצוות",
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
    const verdict = pageBlock
      ? null
      : bookingVerdict(plans, rows, { date, start_time: END_OF_DAY, branch_id: branchId }, today);
    return {
      date,
      slots: byDate.get(date) ?? [],
      weekCount: weeklyBookingCount(rows, date, branchId),
      dayBlock: verdict && !verdict.ok ? verdict.block : null,
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
