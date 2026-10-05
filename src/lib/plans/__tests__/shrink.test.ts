import { describe, expect, it } from "vitest";
import type { QueuePlan, QueueRow } from "../plan-queue";
import { shrinkImpact, voidRefusal } from "../shrink";

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
