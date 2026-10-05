import { describe, expect, it } from "vitest";
import {
  alreadyRenewedUntil,
  bookingVerdict,
  dueReminder,
  placeNewPlan,
  planStart,
  queueBookingBlock,
  resolvePlanQueue,
  type NewPlanTerms,
  type QueuePlan,
  type QueueRow,
} from "../plan-queue";

const TODAY = "2026-10-05"; // a Monday

let seq = 0;
const plan = (overrides: Partial<QueuePlan> = {}): QueuePlan => {
  seq += 1;
  return {
    id: `plan-${seq}`,
    kind: "session_card",
    status: "active",
    branchId: "ka",
    sessionsTotal: 10,
    durationDays: 60,
    notBefore: "2026-09-01",
    fixedEndsOn: null,
    createdAt: `2026-09-01T10:00:${String(seq).padStart(2, "0")}Z`,
    ...overrides,
  };
};

const card = (sessions: number, overrides: Partial<QueuePlan> = {}) =>
  plan({ kind: "session_card", sessionsTotal: sessions, ...overrides });
const subscription = (overrides: Partial<QueuePlan> = {}) =>
  plan({ kind: "subscription", sessionsTotal: null, durationDays: 30, ...overrides });

let rowSeq = 0;
/** A roster row: a session that took place, or a Booking when dated after today. */
const session = (date: string, overrides: Partial<QueueRow> = {}): QueueRow => {
  rowSeq += 1;
  return {
    id: `row-${rowSeq}`,
    schedule_date: date,
    start_time: "17:00:00",
    branch_id: "ka",
    cancelled_at: null,
    late_cancel: false,
    ...overrides,
  };
};

describe("resolvePlanQueue", () => {
  it("a single Card is current, runs from its not-before date for its duration, with every session left", () => {
    const only = card(10, { notBefore: "2026-10-01", durationDays: 60 });

    const queue = resolvePlanQueue([only], [], TODAY);

    expect(queue.current?.plan.id).toBe(only.id);
    expect(queue.current?.startsOn).toBe("2026-10-01");
    expect(queue.current?.endsOn).toBe("2026-11-29");
    expect(queue.sessionsLeft).toBe(10);
    expect(queue.status).toBe("active");
  });

  it("a Card bought while the current Card has one session left is current the day that last session is used", () => {
    const old = card(10, { notBefore: "2026-09-01" });
    const renewal = card(10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const used = [
      ...["01", "03", "08", "10", "15", "17", "22", "24", "29"].map((d) => session(`2026-09-${d}`)),
      session(TODAY),
    ];

    const queue = resolvePlanQueue([old, renewal], used, TODAY);

    expect(queue.current?.plan.id).toBe(renewal.id);
    expect(queue.current?.startsOn).toBe(TODAY);
    expect(queue.plans.find((p) => p.plan.id === old.id)?.endsOn).toBe(TODAY);
    expect(queue.sessionsLeft).toBe(10);
  });

  it("a Subscription sold while a Card has sessions starts on the day the Card's last session is booked", () => {
    const current = card(3, { notBefore: "2026-09-20" });
    const sub = subscription({ notBefore: "2026-10-02", createdAt: "2026-10-02T09:00:00Z" });
    const rows = [session("2026-09-28"), session("2026-10-04"), session("2026-10-07")];

    const queue = resolvePlanQueue([current, sub], rows, TODAY);

    expect(queue.current?.plan.id).toBe(current.id);
    const queued = queue.plans.find((p) => p.plan.id === sub.id);
    expect(queued?.startsOn).toBe("2026-10-07");
    expect(queued?.endsOn).toBe("2026-11-05");
  });

  it("a Subscription behind a Card starts the day after the Card's end date when that comes first, and the leftover sessions expire", () => {
    const current = card(10, { notBefore: "2026-08-06", durationDays: 60 }); // expires 2026-10-04
    const sub = subscription({ notBefore: "2026-09-25", createdAt: "2026-09-25T09:00:00Z" });
    const rows = [session("2026-08-10"), session("2026-09-14")];

    const queue = resolvePlanQueue([current, sub], rows, TODAY);

    expect(queue.plans[0].endsOn).toBe("2026-10-04");
    expect(queue.current?.plan.id).toBe(sub.id);
    expect(queue.current?.startsOn).toBe("2026-10-05");
    expect(queue.sessionsLeft).toBeNull();
  });

  it("sessions left counts every Card in the queue, net of used sessions and future Bookings", () => {
    const current = card(5, { notBefore: "2026-09-20" });
    const queued = card(10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const rows = [session("2026-09-28"), session("2026-10-01"), session("2026-10-07")];

    const queue = resolvePlanQueue([current, queued], rows, TODAY);

    expect(queue.current?.sessionsLeft).toBe(2);
    expect(queue.sessionsLeft).toBe(12);
  });

  it("a second purchase while a Plan is queued joins behind the queued one, never on the same dates", () => {
    const current = subscription({ notBefore: "2026-09-20" }); // to 2026-10-19
    const first = subscription({ notBefore: "2026-10-03", createdAt: "2026-10-03T09:00:00Z" });
    const second = subscription({ notBefore: "2026-10-04", createdAt: "2026-10-04T09:00:00Z" });

    const queue = resolvePlanQueue([second, current, first], [], TODAY);

    expect(queue.queued.map((p) => [p.plan.id, p.startsOn, p.endsOn])).toEqual([
      [first.id, "2026-10-20", "2026-11-18"],
      [second.id, "2026-11-19", "2026-12-18"],
    ]);
  });

  it("cancelling a Booking moves the Queued plan's start later; a late cancel still counts", () => {
    const current = card(2, { notBefore: "2026-09-20" });
    const queued = card(10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const freed = session("2026-10-07", { cancelled_at: "2026-10-05T08:00:00Z" });
    const late = session("2026-10-09", { cancelled_at: "2026-10-09T15:00:00Z", late_cancel: true });

    const before = resolvePlanQueue([current, queued], [session("2026-09-28"), session("2026-10-07")], TODAY);
    const after = resolvePlanQueue([current, queued], [session("2026-09-28"), freed, late], TODAY);

    expect(before.queued[0].startsOn).toBe("2026-10-07");
    expect(after.queued[0].startsOn).toBe("2026-10-09");
  });

  it("Add-ons never become the Current plan and use no sessions", () => {
    const training = card(10, { notBefore: "2026-09-20" });
    const addon = plan({ kind: "addon", sessionsTotal: 4, notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });

    const queue = resolvePlanQueue([training, addon], [session("2026-10-01")], TODAY);
    const onlyAddon = resolvePlanQueue([addon], [session("2026-10-01")], TODAY);

    expect(queue.current?.plan.id).toBe(training.id);
    expect(queue.queued).toEqual([]);
    expect(queue.sessionsLeft).toBe(9);
    expect(onlyAddon.current).toBeNull();
    expect(onlyAddon.status).toBeNull();
  });

  it("a staff-chosen future start holds the Plan until that day", () => {
    const future = subscription({ notBefore: "2026-10-15" });

    const queue = resolvePlanQueue([future], [], TODAY);

    expect(queue.current).toBeNull();
    expect(queue.queued[0].startsOn).toBe("2026-10-15");
    expect(queue.status).toBe("active");
  });

  it("an Arbox Plan keeps Arbox's end date, so starting late leaves it less time", () => {
    const current = subscription({ notBefore: "2026-09-20" }); // to 2026-10-19
    const arbox = card(8, {
      notBefore: "2026-10-01",
      fixedEndsOn: "2026-11-30",
      createdAt: "2026-10-01T09:00:00Z",
    });

    const queue = resolvePlanQueue([current, arbox], [], TODAY);

    expect(queue.queued[0].startsOn).toBe("2026-10-20");
    expect(queue.queued[0].endsOn).toBe("2026-11-30");
  });

  it("an Arbox Plan queued past its own end never runs and never pulls the next Plan back over the one ahead", () => {
    const current = subscription({ notBefore: "2026-10-01", durationDays: 61 }); // to 2026-11-30
    const arbox = card(8, { notBefore: "2026-10-02", fixedEndsOn: "2026-11-15", createdAt: "2026-10-02T09:00:00Z" });
    const renewal = subscription({ notBefore: "2026-10-20", createdAt: "2026-10-20T09:00:00Z" });

    const queue = resolvePlanQueue([current, arbox, renewal], [], "2026-11-20");

    expect(queue.current?.plan.id).toBe(current.id);
    expect(queue.queued.map((e) => e.plan.id)).toEqual([renewal.id]);
    expect(queue.queued[0].startsOn).toBe("2026-12-01");
    expect(queue.sessionsLeft).toBeNull();
  });

  it("sessions in another branch are not charged to the Plan", () => {
    const only = card(10, { notBefore: "2026-09-20" });

    const queue = resolvePlanQueue([only], [session("2026-10-01", { branch_id: "haifa" })], TODAY);

    expect(queue.sessionsLeft).toBe(10);
  });
});

describe("bookingVerdict", () => {
  const slot = (date: string, start_time = "17:00:00") => ({ date, start_time, branch_id: "ka" });

  it("charges a Booking beyond the Current Card to the Queued plan, in date order", () => {
    const current = card(2, { notBefore: "2026-09-20" });
    const queued = card(10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const rows = [session("2026-09-28"), session("2026-10-06")];

    expect(bookingVerdict([current, queued], rows, slot("2026-10-08"), TODAY)).toEqual({
      ok: true,
      planId: queued.id,
    });
    expect(bookingVerdict([current, queued], rows, slot("2026-10-06", "09:00:00"), TODAY)).toEqual({
      ok: true,
      planId: current.id,
    });
  });

  it("lets the Trainee book an hour that only a Queued plan covers", () => {
    const current = subscription({ notBefore: "2026-09-20" }); // to 2026-10-19
    const queued = subscription({ notBefore: "2026-10-02", createdAt: "2026-10-02T09:00:00Z" });

    expect(bookingVerdict([current], [], slot("2026-10-20"), TODAY)).toEqual({ ok: false, block: "plan_not_running" });
    expect(bookingVerdict([current, queued], [], slot("2026-10-20"), TODAY)).toEqual({ ok: true, planId: queued.id });
  });

  it("refuses when every session on the queue's Cards is used or booked", () => {
    const only = card(2, { notBefore: "2026-09-20" });
    const rows = [session("2026-10-01"), session("2026-10-07")];

    expect(bookingVerdict([only], rows, slot("2026-10-09"), TODAY)).toEqual({ ok: false, block: "no_sessions_left" });
  });

  it("refuses an earlier hour that would push a Booking already made off the queue", () => {
    const only = card(2, { notBefore: "2026-09-20" });
    const rows = [session("2026-10-01"), session("2026-10-09")];

    expect(bookingVerdict([only], rows, slot("2026-10-07"), TODAY)).toEqual({ ok: false, block: "no_sessions_left" });
  });

  it("applies a Subscription's weekly cap once it starts, not to the Card ahead of it", () => {
    const current = card(2, { notBefore: "2026-09-20" });
    const sub = subscription({ notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    // Sunday 11.10 to Saturday 17.10: the Card's last session, then two on the Subscription.
    const rows = [session("2026-10-01"), session("2026-10-11"), session("2026-10-12"), session("2026-10-13")];

    expect(bookingVerdict([current, sub], rows, slot("2026-10-15"), TODAY)).toEqual({ ok: false, block: "weekly_cap" });
    expect(bookingVerdict([current, sub], rows.slice(0, 3), slot("2026-10-15"), TODAY)).toEqual({
      ok: true,
      planId: sub.id,
    });
  });

  it("keeps the weekly cap across a week where one Subscription hands over to the next", () => {
    const first = subscription({ notBefore: "2026-09-14" }); // to 2026-10-13, a Tuesday
    const next = subscription({ notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const rows = [session("2026-10-11"), session("2026-10-12")];

    expect(bookingVerdict([first, next], rows, slot("2026-10-15"), TODAY)).toEqual({ ok: false, block: "weekly_cap" });
  });

  it("says the hour is in another branch when no Plan covers that branch", () => {
    const sub = subscription({ notBefore: "2026-09-20" });

    expect(bookingVerdict([sub], [], { date: "2026-10-07", start_time: "17:00:00", branch_id: "haifa" }, TODAY)).toEqual({
      ok: false,
      block: "wrong_branch",
    });
  });

  it("names the reason when there is no training Plan to book on", () => {
    const cancelled = subscription({ notBefore: "2026-09-20", status: "cancelled" });
    const addon = plan({ kind: "addon", notBefore: "2026-09-20" });

    expect(bookingVerdict([], [], slot("2026-10-07"), TODAY)).toEqual({ ok: false, block: "no_plan" });
    expect(bookingVerdict([addon], [], slot("2026-10-07"), TODAY)).toEqual({ ok: false, block: "no_plan" });
    expect(bookingVerdict([cancelled], [], slot("2026-10-07"), TODAY)).toEqual({ ok: false, block: "plan_cancelled" });
  });
});

describe("resolvePlanQueue status", () => {
  it("is ending soon when the end of the queue is three days away", () => {
    const sub = subscription({ notBefore: "2026-09-09" }); // to 2026-10-08

    expect(resolvePlanQueue([sub], [], TODAY).status).toBe("ending_soon");
  });

  it("is ending soon when the queue holds only Cards with at most one session left", () => {
    const last = card(3, { notBefore: "2026-09-20" });

    const queue = resolvePlanQueue([last], [session("2026-09-28"), session("2026-10-01")], TODAY);

    expect(queue.sessionsLeft).toBe(1);
    expect(queue.status).toBe("ending_soon");
  });

  it("stays active while a paid Plan is queued, whatever the Current plan has left", () => {
    const last = card(3, { notBefore: "2026-09-20" });
    const renewal = card(10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });

    const queue = resolvePlanQueue([last, renewal], [session("2026-09-28"), session("2026-10-01")], TODAY);

    expect(queue.status).toBe("active");
  });

  it("is expired when every Plan has ended, including a Card whose last session was today", () => {
    const old = subscription({ notBefore: "2026-08-01" });
    const spent = card(1, { notBefore: "2026-09-20" });

    expect(resolvePlanQueue([old], [], TODAY).status).toBe("expired");
    expect(resolvePlanQueue([spent], [session(TODAY)], TODAY).status).toBe("expired");
  });

  it("is cancelled only when the Trainee has nothing but cancelled Plans", () => {
    const cancelled = subscription({ notBefore: "2026-09-20", status: "cancelled" });
    const ended = subscription({ notBefore: "2026-07-01" });

    expect(resolvePlanQueue([cancelled], [], TODAY).status).toBe("cancelled");
    expect(resolvePlanQueue([cancelled, ended], [], TODAY).status).toBe("expired");
    expect(resolvePlanQueue([], [], TODAY).status).toBeNull();
  });
});

describe("resolvePlanQueue shown plan", () => {
  it("shows the Current plan, else the first Queued one, else the last that ended, else a cancelled one", () => {
    const ended = subscription({ notBefore: "2026-07-01" });
    const running = subscription({ notBefore: "2026-09-20", createdAt: "2026-09-20T09:00:00Z" });
    const later = subscription({ notBefore: "2026-10-20", createdAt: "2026-10-01T09:00:00Z" });
    const cancelled = subscription({ notBefore: "2026-09-01", status: "cancelled" });

    expect(resolvePlanQueue([ended, running, later], [], TODAY).shown?.plan.id).toBe(running.id);
    expect(resolvePlanQueue([ended, later], [], TODAY).shown?.plan.id).toBe(later.id);
    expect(resolvePlanQueue([ended, cancelled], [], TODAY).shown?.plan.id).toBe(ended.id);
    expect(resolvePlanQueue([cancelled], [], TODAY).shown?.plan.id).toBe(cancelled.id);
  });
});

describe("dueReminder", () => {
  type Stamps = {
    reminded_3_days_at: string | null;
    reminded_last_session_at: string | null;
    reminded_expired_at: string | null;
    paidInArbox: boolean;
  };
  const unstamped: Stamps = {
    reminded_3_days_at: null,
    reminded_last_session_at: null,
    reminded_expired_at: null,
    paidInArbox: false,
  };
  const withStamps = (p: QueuePlan, stamps: Partial<Stamps> = {}) => ({ ...p, ...unstamped, ...stamps });

  it("sends nothing while a paid Plan is queued", () => {
    const last = withStamps(card(3, { notBefore: "2026-09-20" }));
    const renewal = withStamps(card(10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" }));
    const rows = [session("2026-09-28"), session("2026-10-01")];

    expect(dueReminder(resolvePlanQueue([last, renewal], rows, TODAY))).toBeNull();
  });

  it("sends three days once, for the Plan at the end of the queue", () => {
    const ending = withStamps(subscription({ notBefore: "2026-09-09" })); // to 2026-10-08
    const sent = withStamps(ending, { reminded_3_days_at: "2026-10-04T08:00:00Z" });

    expect(dueReminder(resolvePlanQueue([ending], [], TODAY))).toEqual({ milestone: "three_days", plan: ending });
    expect(dueReminder(resolvePlanQueue([sent], [], TODAY))).toBeNull();
  });

  it("sends last session when the queue's Cards have one session left", () => {
    const last = withStamps(card(3, { notBefore: "2026-09-20" }));
    const rows = [session("2026-09-28"), session("2026-10-01")];

    expect(dueReminder(resolvePlanQueue([last], rows, TODAY))?.milestone).toBe("last_session");
  });

  it("sends last session, not three days, when every session left on the Cards is already booked", () => {
    const booked = withStamps(card(3, { notBefore: "2026-09-20", durationDays: 120 }));
    const rows = [session("2026-09-28"), session("2026-10-20"), session("2026-11-02")];

    expect(dueReminder(resolvePlanQueue([booked], rows, TODAY))?.milestone).toBe("last_session");
  });

  it("sends expired once when the queue runs empty", () => {
    const ended = withStamps(subscription({ notBefore: "2026-08-01" }));
    const sent = withStamps(ended, { reminded_expired_at: "2026-09-01T08:00:00Z" });

    expect(dueReminder(resolvePlanQueue([ended], [], TODAY))).toEqual({ milestone: "expired", plan: ended });
    expect(dueReminder(resolvePlanQueue([sent], [], TODAY))).toBeNull();
  });
});

describe("queueBookingBlock", () => {
  it("blocks the whole page only for no Plan, only cancelled Plans, or Cards with nothing left to book", () => {
    const spentCard = card(1, { notBefore: "2026-09-20" });
    const sub = subscription({ notBefore: "2026-09-20" });
    const cancelled = subscription({ notBefore: "2026-09-20", status: "cancelled" });
    const booked = [session("2026-10-07")];

    const blockFor = (plans: QueuePlan[], rows: QueueRow[] = []) =>
      queueBookingBlock(plans, resolvePlanQueue(plans, rows, TODAY));

    expect(blockFor([])).toBe("no_plan");
    expect(blockFor([cancelled])).toBe("plan_cancelled");
    expect(blockFor([spentCard], booked)).toBe("no_sessions_left");
    expect(blockFor([sub], booked)).toBeNull();
    expect(blockFor([spentCard])).toBeNull();
  });
});

describe("placeNewPlan", () => {
  const terms = (overrides: Partial<NewPlanTerms> = {}): NewPlanTerms => ({
    kind: "session_card",
    branchId: "ka",
    sessionsTotal: 10,
    durationDays: 60,
    notBefore: TODAY,
    fixedEndsOn: null,
    ...overrides,
  });

  it("a sale joins the end of the queue instead of today's Plan", () => {
    const current = subscription({ notBefore: "2026-09-20" }); // to 2026-10-19
    const queued = subscription({ notBefore: "2026-10-02", createdAt: "2026-10-02T09:00:00Z" }); // to 2026-11-18

    expect(placeNewPlan([current, queued], [], terms(), TODAY)).toEqual({
      startsOn: "2026-11-19",
      endsOn: "2027-01-17",
    });
  });

  it("starts today, or on the chosen day, when nothing is running", () => {
    expect(placeNewPlan([], [], terms(), TODAY)).toEqual({ startsOn: TODAY, endsOn: "2026-12-03" });
    expect(placeNewPlan([], [], terms({ notBefore: "2026-10-20" }), TODAY).startsOn).toBe("2026-10-20");
  });

  it("an Add-on starts on its own day, whatever training Plan is running", () => {
    const current = subscription({ notBefore: "2026-09-20" });

    expect(placeNewPlan([current], [], terms({ kind: "addon", durationDays: 30 }), TODAY)).toEqual({
      startsOn: TODAY,
      endsOn: "2026-11-03",
    });
  });
});

describe("dueReminder for Arbox-paid queues", () => {
  const ours = { reminded_3_days_at: null, reminded_last_session_at: null, reminded_expired_at: null, paidInArbox: false };
  const arbox = { ...ours, paidInArbox: true };

  it("sends nothing when the Plan at the end of the queue was paid in Arbox, even one that ended yesterday", () => {
    const endedYesterday = { ...subscription({ notBefore: "2026-09-04", fixedEndsOn: "2026-10-04" }), ...arbox };
    const endingSoon = { ...subscription({ notBefore: "2026-09-10", fixedEndsOn: "2026-10-07" }), ...arbox };

    expect(dueReminder(resolvePlanQueue([endedYesterday], [], TODAY))).toBeNull();
    expect(dueReminder(resolvePlanQueue([endingSoon], [], TODAY))).toBeNull();
  });

  it("goes by how the Plan was paid, not by its end date: an Arbox order without a fixed end is still Arbox", () => {
    const legacy = { ...subscription({ notBefore: "2026-09-08" }), ...arbox }; // to 7.10, no fixed end

    expect(dueReminder(resolvePlanQueue([legacy], [], TODAY))).toBeNull();
  });

  it("still reminds at the end of our own Plan queued behind an Arbox one", () => {
    const first = { ...subscription({ notBefore: "2026-09-01", fixedEndsOn: "2026-09-30" }), ...arbox };
    // Starts 1.10 when the Arbox Plan ends, and runs 8 days to 8.10.
    const last = { ...subscription({ notBefore: "2026-09-09", durationDays: 8, createdAt: "2026-09-09T09:00:00Z" }), ...ours };

    expect(dueReminder(resolvePlanQueue([first, last], [], TODAY))?.plan.id).toBe(last.id);
  });

  it("an Arbox Plan queued past its own end never runs, so it does not silence our Plan ahead of it", () => {
    const own = { ...subscription({ notBefore: "2026-09-09", durationDays: 32 }), ...ours }; // to 10.10
    const deadArbox = {
      ...subscription({ notBefore: "2026-10-01", fixedEndsOn: "2026-10-08", createdAt: "2026-10-01T09:00:00Z" }),
      ...arbox,
    };

    expect(dueReminder(resolvePlanQueue([own, deadArbox], [], "2026-10-08"))?.plan.id).toBe(own.id);
  });
});

describe("planStart", () => {
  it("says today, a date, or after the current Card, from the Plan's place in the queue", () => {
    const sub = subscription({ notBefore: "2026-09-20" }); // to 2026-10-19
    const afterSub = card(10, { notBefore: "2026-10-05", createdAt: "2026-10-05T09:00:00Z" });
    const runningCard = card(10, { notBefore: "2026-09-20" });
    const afterCard = subscription({ notBefore: "2026-10-05", createdAt: "2026-10-05T09:00:00Z" });
    const alone = subscription({ notBefore: TODAY });

    expect(planStart(resolvePlanQueue([alone], [], TODAY), alone.id, TODAY)).toEqual({ kind: "today" });
    expect(planStart(resolvePlanQueue([sub, afterSub], [], TODAY), afterSub.id, TODAY)).toEqual({
      kind: "on",
      date: "2026-10-20",
    });
    expect(planStart(resolvePlanQueue([runningCard, afterCard], [], TODAY), afterCard.id, TODAY)).toEqual({
      kind: "after_card",
      latest: "2026-11-19",
    });
  });

  it("stays tied to the Card when its sessions are all booked, since a cancelled Booking moves it", () => {
    const fullyBooked = card(2, { notBefore: "2026-09-20" });
    const next = subscription({ notBefore: "2026-10-05", createdAt: "2026-10-05T09:00:00Z" });
    const rows = [session("2026-10-07"), session("2026-10-20")];

    expect(planStart(resolvePlanQueue([fullyBooked, next], rows, TODAY), next.id, TODAY)).toEqual({
      kind: "after_card",
      latest: "2026-10-20",
    });
  });
});

describe("alreadyRenewedUntil", () => {
  it("agrees with the queue's end when the waiting Card's sessions are all booked", () => {
    const current = subscription({ notBefore: "2026-09-20" }); // to 19.10
    const queued = card(2, { notBefore: "2026-10-02", createdAt: "2026-10-02T09:00:00Z", durationDays: 60 });
    const rows = [session("2026-10-21"), session("2026-10-28")];

    expect(alreadyRenewedUntil(resolvePlanQueue([current, queued], rows, TODAY))).toBe("2026-10-28");
  });

  it("names the end of the queue when a paid Plan is waiting, and nothing otherwise", () => {
    const current = subscription({ notBefore: "2026-09-20" });
    const queued = card(10, { notBefore: "2026-10-02", createdAt: "2026-10-02T09:00:00Z", durationDays: 60 });

    expect(alreadyRenewedUntil(resolvePlanQueue([current], [], TODAY))).toBeNull();
    expect(alreadyRenewedUntil(resolvePlanQueue([current, queued], [], TODAY))).toBe("2026-12-18");
  });
});

describe("a voided Plan", () => {
  it("leaves the queue as if never sold: the Plan behind it moves forward", () => {
    const mistake = subscription({ notBefore: "2026-09-20", status: "voided" });
    const next = subscription({ notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });

    const queue = resolvePlanQueue([mistake, next], [], TODAY);

    expect(queue.current?.plan.id).toBe(next.id);
    expect(queue.current?.startsOn).toBe("2026-10-01");
  });

  it("counts as no Plan at all for booking and for the queue's state", () => {
    const voided = subscription({ notBefore: "2026-09-20", status: "voided" });

    expect(resolvePlanQueue([voided], [], TODAY).status).toBeNull();
    expect(bookingVerdict([voided], [], { date: "2026-10-07", start_time: "17:00:00", branch_id: "ka" }, TODAY)).toEqual({
      ok: false,
      block: "no_plan",
    });
  });
});

describe("a Cancellation", () => {
  it("ends the Plan today: its used sessions stay with it and the Queued plan starts tomorrow", () => {
    const cancelled = card(10, { notBefore: "2026-09-20", status: "cancelled", endedOn: TODAY });
    const queued = subscription({ notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const rows = [session("2026-09-28"), session("2026-10-02")];

    const queue = resolvePlanQueue([cancelled, queued], rows, TODAY);

    const ended = queue.plans.find((e) => e.plan.id === cancelled.id);
    expect(ended?.endsOn).toBe(TODAY);
    expect(ended?.used).toBe(2);
    expect(queue.queued[0]?.plan.id ?? queue.current?.plan.id).toBe(queued.id);
    expect(queue.plans.find((e) => e.plan.id === queued.id)?.startsOn).toBe("2026-10-06");
  });

  it("an older cancelled Plan with no end date stays out of the queue", () => {
    const hidden = card(10, { notBefore: "2026-09-20", status: "cancelled" });

    expect(resolvePlanQueue([hidden], [], TODAY).plans).toEqual([]);
  });
});

describe("the queue's state after a Cancellation", () => {
  it("is cancelled when the queue ends on a Cancellation, today and after", () => {
    const cancelled = subscription({ notBefore: "2026-09-20", status: "cancelled", endedOn: TODAY });

    expect(resolvePlanQueue([cancelled], [], TODAY).status).toBe("cancelled");
    expect(resolvePlanQueue([cancelled], [], "2026-10-20").status).toBe("cancelled");
  });

  it("follows the next Plan when one is queued behind the cancelled one", () => {
    const cancelled = subscription({ notBefore: "2026-09-20", status: "cancelled", endedOn: TODAY });
    const next = subscription({ notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });

    expect(resolvePlanQueue([cancelled, next], [], TODAY).status).toBe("active");
  });
});

describe("an Early end", () => {
  it("ends the Current plan today and the Queued plan behind it is current today", () => {
    const ended = subscription({ notBefore: "2026-09-20", endedOn: TODAY }); // was to 19.10
    const next = card(10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });

    const queue = resolvePlanQueue([ended, next], [], TODAY);

    // The ended Plan stops covering from today: its last day is yesterday.
    expect(queue.plans[0].endsOn).toBe("2026-10-04");
    expect(queue.current?.plan.id).toBe(next.id);
    expect(queue.current?.startsOn).toBe(TODAY);
  });

  it("charges a session booked later the same day to the Plan that took over", () => {
    const ended = card(10, { notBefore: "2026-09-20", endedOn: TODAY });
    const next = card(10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });

    const queue = resolvePlanQueue([ended, next], [session(TODAY, { start_time: "19:00:00" })], TODAY);

    expect(queue.plans[1].used).toBe(1);
    expect(queue.plans[0].used).toBe(0);
  });
});

describe("Called off Slots and recorded Roster removals", () => {
  it("a session on a Slot the academy called off is not charged to the Card", () => {
    const only = card(10, { notBefore: "2026-09-20" });
    const rows = [session("2026-09-28", { called_off: true }), session("2026-10-01")];

    expect(resolvePlanQueue([only], rows, TODAY).sessionsLeft).toBe(9);
  });

  it("an entry removed from a past Slot (a recorded, not late, cancellation) is not charged", () => {
    const only = card(10, { notBefore: "2026-09-20" });
    const rows = [session("2026-09-28", { cancelled_at: "2026-10-04T10:00:00Z", late_cancel: false }), session("2026-10-01")];

    expect(resolvePlanQueue([only], rows, TODAY).sessionsLeft).toBe(9);
  });
});

describe("an Adjustment", () => {
  const rows = () => [session("2026-09-28"), session("2026-10-01"), session("2026-10-07")];

  it("raising a Card keeps the Queued plan waiting longer", () => {
    const current = card(3, { notBefore: "2026-09-20" });
    const queued = subscription({ notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });

    const before = resolvePlanQueue([current, queued], rows(), TODAY);
    const after = resolvePlanQueue([{ ...current, sessionsTotal: 6 }, queued], rows(), TODAY);

    expect(before.queued[0].startsOn).toBe("2026-10-07");
    expect(after.current?.sessionsLeft).toBe(3);
    expect(after.queued[0].startsOn).toBe("2026-11-19");
  });

  it("lowering a Card hands over to the Queued plan sooner", () => {
    const current = card(6, { notBefore: "2026-09-20" });
    const queued = subscription({ notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });

    const after = resolvePlanQueue([{ ...current, sessionsTotal: 2 }, queued], rows(), TODAY);

    expect(after.plans[0].endsOn).toBe("2026-10-01");
    expect(after.current?.plan.id).toBe(queued.id);
  });
});
