import { describe, expect, it } from "vitest";
import type { QueuePlan, QueueRow } from "../plan-queue";
import { earlyEndRefusal, shrinkImpact, voidRefusal } from "../shrink";

const TODAY = "2026-10-05";

const card = (id: string, sessions: number, overrides: Partial<QueuePlan> = {}): QueuePlan => ({
  id,
  kind: "session_card",
  status: "active",
  branchId: "ka",
  sessionsTotal: sessions,
  durationDays: 60,
  notBefore: "2026-09-20",
  fixedEndsOn: null,
  createdAt: "2026-09-20T09:00:00Z",
  ...overrides,
});

let n = 0;
const booking = (date: string, overrides: Partial<QueueRow> = {}): QueueRow => {
  n += 1;
  return { id: `row-${n}`, schedule_date: date, start_time: "17:00:00", branch_id: "ka", cancelled_at: null, late_cancel: false, ...overrides };
};

const voided = (plans: QueuePlan[], id: string) => plans.map((p) => (p.id === id ? { ...p, status: "voided" as const } : p));

describe("shrinkImpact", () => {
  it("moves Bookings to the Queued plan when the Plan they were charged to is voided", () => {
    const mistake = card("mistake", 10);
    const queued = card("queued", 10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const plans = [mistake, queued];
    const rows = [booking("2026-10-07"), booking("2026-10-09")];

    const impact = shrinkImpact(plans, voided(plans, "mistake"), rows, TODAY);

    expect(impact.moved.map((m) => [m.row.schedule_date, m.fromPlanId, m.toPlanId])).toEqual([
      ["2026-10-07", "mistake", "queued"],
      ["2026-10-09", "mistake", "queued"],
    ]);
    expect(impact.cancelled).toEqual([]);
  });

  it("cancels what no Plan can take, latest first, keeping the nearest sessions", () => {
    const mistake = card("mistake", 10);
    const small = card("small", 1, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const plans = [mistake, small];
    const rows = [booking("2026-10-07"), booking("2026-10-12"), booking("2026-10-09")];

    const impact = shrinkImpact(plans, voided(plans, "mistake"), rows, TODAY);

    expect(impact.moved.map((m) => m.row.schedule_date)).toEqual(["2026-10-07"]);
    expect(impact.cancelled.map((r) => r.schedule_date)).toEqual(["2026-10-12", "2026-10-09"]);
  });

  it("counts past sessions too: a Card with one session left keeps only the nearest Booking", () => {
    const current = card("current", 10);
    const mistake = card("mistake", 10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const plans = [current, mistake];
    const past = ["09-21", "09-22", "09-23", "09-24", "09-25", "09-26", "09-27", "09-28", "09-29"].map((d) =>
      booking(`2026-${d}`),
    );
    const rows = [...past, booking("2026-10-07"), booking("2026-10-09"), booking("2026-10-12")];

    const impact = shrinkImpact(plans, voided(plans, "mistake"), rows, TODAY);

    expect(impact.moved).toEqual([]);
    expect(impact.cancelled.map((r) => r.schedule_date)).toEqual(["2026-10-12", "2026-10-09"]);
  });

  it("lists only future Bookings that a Plan was paying for", () => {
    const only = card("only", 10);
    const rows = [
      booking("2026-10-01"),
      booking("2026-10-08", { branch_id: "haifa" }),
      booking("2026-10-09", { cancelled_at: "2026-10-04T08:00:00Z" }),
      booking("2026-10-10"),
    ];

    const impact = shrinkImpact([only], voided([only], "only"), rows, TODAY);

    expect(impact.cancelled.map((r) => r.schedule_date)).toEqual(["2026-10-10"]);
  });
});

describe("voidRefusal", () => {
  it("allows a Plan nobody trained on, refuses one with a used session or already voided", () => {
    const fresh = card("fresh", 10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const usedPlan = card("used", 10);
    const already = card("already", 10, { status: "voided" });

    expect(voidRefusal([fresh], [booking("2026-10-07")], "fresh", TODAY)).toBeNull();
    expect(voidRefusal([usedPlan], [booking("2026-10-01")], "used", TODAY)).toBe(
      "כבר נוצל אימון במסלול, ולכן אי אפשר לבטל את הרישום. צריך ביטול עסקה.",
    );
    expect(voidRefusal([already], [], "already", TODAY)).toBe("הרישום של המסלול כבר בוטל");
    expect(voidRefusal([fresh], [], "missing", TODAY)).toBe("המסלול לא נמצא");
  });

  it("refuses a cancelled Plan that was trained on: its sessions count even outside the queue", () => {
    const cancelledAfterUse = card("cancelled", 10, { status: "cancelled" });

    expect(voidRefusal([cancelledAfterUse], [booking("2026-09-25")], "cancelled", TODAY)).toBe(
      "כבר נוצל אימון במסלול, ולכן אי אפשר לבטל את הרישום. צריך ביטול עסקה.",
    );
  });
});

describe("shrinkImpact for a Cancellation", () => {
  it("moves the Bookings after today to the Queued plan; what was used stays", () => {
    const current = card("current", 10);
    const queued = card("queued", 10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const plans = [current, queued];
    const rows = [booking("2026-10-01"), booking("2026-10-07"), booking("2026-10-09")];
    const after = plans.map((p) => (p.id === "current" ? { ...p, status: "cancelled" as const, endedOn: TODAY } : p));

    const impact = shrinkImpact(plans, after, rows, TODAY);

    expect(impact.moved.map((m) => [m.row.schedule_date, m.toPlanId])).toEqual([
      ["2026-10-07", "queued"],
      ["2026-10-09", "queued"],
    ]);
    expect(impact.cancelled).toEqual([]);
  });
});

describe("voidRefusal after a Cancellation", () => {
  it("refuses a Plan a Cancellation already ended", () => {
    const cancelled = card("cancelled", 10, { status: "cancelled", endedOn: TODAY, notBefore: "2026-10-01" });

    expect(voidRefusal([cancelled], [], "cancelled", TODAY)).toBe("העסקה של המסלול כבר בוטלה");
  });
});

describe("earlyEndRefusal", () => {
  it("allows the Current plan when a Plan waits behind it", () => {
    const current = card("current", 10);
    const queued = card("queued", 10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });

    expect(earlyEndRefusal([current, queued], [], "current", TODAY)).toBeNull();
  });

  it("refuses with nothing queued, a Plan that is not current, or one already ended", () => {
    const current = card("current", 10);
    const queued = card("queued", 10, { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const ended = card("ended", 10, { endedOn: TODAY });

    expect(earlyEndRefusal([current], [], "current", TODAY)).toBe("אין מסלול ממתין שיתחיל במקומו. לסיום המסלול צריך ביטול עסקה.");
    expect(earlyEndRefusal([current, queued], [], "queued", TODAY)).toBe("אפשר לסיים מוקדם רק את המסלול הנוכחי");
    expect(earlyEndRefusal([ended, queued], [], "ended", TODAY)).toBe("המסלול כבר הסתיים");
  });
});

describe("voidRefusal after an Early end", () => {
  it("refuses a Plan that was ended early", () => {
    const early = card("early", 10, { endedOn: TODAY, notBefore: "2026-10-01" });

    expect(voidRefusal([early], [], "early", TODAY)).toBe("המסלול כבר הסתיים");
  });
});

describe("earlyEndRefusal when the next Plan cannot start today", () => {
  it("refuses: the Trainee would be left with no Plan until it starts", () => {
    const current = card("current", 10);
    const later = card("later", 10, { notBefore: "2026-10-20", createdAt: "2026-10-01T09:00:00Z" });

    expect(earlyEndRefusal([current, later], [], "current", TODAY)).toBe(
      "המסלול הבא מתחיל רק ב-20/10/2026, ולכן אי אפשר לסיים את הנוכחי היום",
    );
  });
});
