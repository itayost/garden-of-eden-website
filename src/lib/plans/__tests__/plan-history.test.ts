import { describe, expect, it } from "vitest";
import { resolvePlanQueue, type QueuePlan } from "../plan-queue";
import { planHistory } from "../plan-history";

const TODAY = "2026-10-05";

type Row = QueuePlan & { starts_on: string; ends_on: string };

/** A subscription sold 20.9; starts_on/ends_on are the stored forecast. */
const plan = (id: string, overrides: Partial<Row> = {}): Row => ({
  id,
  starts_on: overrides.notBefore ?? "2026-09-20",
  ends_on: "2026-12-31",
  kind: "subscription",
  status: "active",
  branchId: "ka",
  sessionsTotal: null,
  durationDays: 30,
  notBefore: "2026-09-20",
  fixedEndsOn: null,
  createdAt: "2026-09-20T09:00:00Z",
  ...overrides,
});

const historyOf = (plans: Row[]) => planHistory(plans, resolvePlanQueue(plans, [], TODAY));

describe("planHistory", () => {
  it("lists the Current plan, then the queued ones in order, then the past newest first", () => {
    const old = plan("old", { notBefore: "2026-07-01", createdAt: "2026-07-01T09:00:00Z" });
    const older = plan("older", { notBefore: "2026-05-01", createdAt: "2026-05-01T09:00:00Z" });
    const current = plan("current");
    const next = plan("next", { notBefore: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" });
    const after = plan("after", { notBefore: "2026-10-02", createdAt: "2026-10-02T09:00:00Z" });

    const rows = historyOf([after, older, current, old, next]);

    expect(rows.map((r) => [r.plan.id, r.state, r.startsOn, r.endsOn])).toEqual([
      ["current", "current", "2026-09-20", "2026-10-19"],
      ["next", "queued", "2026-10-20", "2026-11-18"],
      ["after", "queued", "2026-11-19", "2026-12-18"],
      ["old", "ended", "2026-07-01", "2026-07-30"],
      ["older", "ended", "2026-05-01", "2026-05-30"],
    ]);
  });

  it("keeps cancelled Plans and Add-ons in the history with the dates stored for them", () => {
    const current = plan("current");
    // A renewal queued to start 20.10, then cancelled: its stored forecast, not its sale day.
    const cancelled = plan("cancelled", {
      status: "cancelled",
      notBefore: "2026-10-01",
      starts_on: "2026-10-20",
      ends_on: "2026-11-18",
      createdAt: "2026-10-01T09:00:00Z",
    });
    const addon = plan("addon", { kind: "addon", notBefore: "2026-09-25", ends_on: "2026-10-04", createdAt: "2026-09-25T09:00:00Z" });

    const rows = historyOf([current, cancelled, addon]);

    expect(rows.map((r) => [r.plan.id, r.state, r.startsOn, r.endsOn])).toEqual([
      ["current", "current", "2026-09-20", "2026-10-19"],
      ["cancelled", "cancelled", "2026-10-20", "2026-11-18"],
      ["addon", "addon", "2026-09-25", "2026-10-04"],
    ]);
  });

  it("puts a Plan queued past its own end right after the queue, with the window it was sold for", () => {
    const old = plan("old", { notBefore: "2026-07-01", createdAt: "2026-07-01T09:00:00Z" });
    const current = plan("current", { durationDays: 60 }); // to 18.11
    const late = plan("late", { notBefore: "2026-10-01", fixedEndsOn: "2026-11-01", createdAt: "2026-10-01T09:00:00Z" });

    const rows = historyOf([old, current, late]);

    expect(rows.map((r) => [r.plan.id, r.state, r.startsOn, r.endsOn])).toEqual([
      ["current", "current", "2026-09-20", "2026-11-18"],
      ["late", "never_runs", "2026-10-01", "2026-11-01"],
      ["old", "ended", "2026-07-01", "2026-07-30"],
    ]);
  });
});

describe("planHistory and voided Plans", () => {
  it("keeps a voided Plan on record, marked as voided", () => {
    const current = plan("current");
    const mistake = plan("mistake", { status: "voided", createdAt: "2026-09-21T09:00:00Z" });

    const rows = historyOf([current, mistake]);

    expect(rows.find((r) => r.plan.id === "mistake")?.state).toBe("voided");
  });
});
