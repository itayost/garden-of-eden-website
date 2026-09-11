import { describe, it, expect } from "vitest";
import {
  countSessionsUsedFromRows,
  dueReminderMilestone,
  renewalStartDate,
  resolvePlanStatus,
} from "../plan-status";

const timePlan = { status: "active" as const, ends_on: "2026-10-10", sessions_total: null };
const cardPlan = { status: "active" as const, ends_on: "2026-12-31", sessions_total: 10 };

describe("resolvePlanStatus", () => {
  it("is active well before the end", () => {
    expect(resolvePlanStatus(timePlan, 0, "2026-09-20")).toBe("active");
  });
  it("is ending soon within three days of the end, inclusive", () => {
    expect(resolvePlanStatus(timePlan, 0, "2026-10-07")).toBe("ending_soon");
    expect(resolvePlanStatus(timePlan, 0, "2026-10-10")).toBe("ending_soon");
  });
  it("is expired the day after the end", () => {
    expect(resolvePlanStatus(timePlan, 0, "2026-10-11")).toBe("expired");
  });
  it("is ending soon with one session left and expired with none", () => {
    expect(resolvePlanStatus(cardPlan, 9, "2026-09-20")).toBe("ending_soon");
    expect(resolvePlanStatus(cardPlan, 10, "2026-09-20")).toBe("expired");
    expect(resolvePlanStatus(cardPlan, 11, "2026-09-20")).toBe("expired");
  });
  it("cancelled wins over everything", () => {
    expect(resolvePlanStatus({ ...timePlan, status: "cancelled" }, 0, "2026-09-01")).toBe("cancelled");
  });
});

describe("countSessionsUsedFromRows", () => {
  const plan = { starts_on: "2026-09-01", ends_on: "2026-09-30", branch_id: "k" };
  it("counts rows inside the window, in the branch, not after today", () => {
    const rows = [
      { schedule_date: "2026-08-31", branch_id: "k" },
      { schedule_date: "2026-09-01", branch_id: "k" },
      { schedule_date: "2026-09-10", branch_id: "k" },
      { schedule_date: "2026-09-10", branch_id: "h" },
      { schedule_date: "2026-09-15", branch_id: "k" },
      { schedule_date: "2026-10-01", branch_id: "k" },
    ];
    expect(countSessionsUsedFromRows(rows, plan, "2026-09-12")).toBe(2);
  });
  it("counts up to ends_on when today is later", () => {
    const rows = [
      { schedule_date: "2026-09-30", branch_id: "k" },
      { schedule_date: "2026-10-01", branch_id: "k" },
    ];
    expect(countSessionsUsedFromRows(rows, plan, "2026-10-05")).toBe(1);
  });
});

describe("renewalStartDate", () => {
  it("starts today when there is no previous plan or it already ended", () => {
    expect(renewalStartDate(null, "2026-09-10")).toBe("2026-09-10");
    expect(renewalStartDate("2026-09-01", "2026-09-10")).toBe("2026-09-10");
  });
  it("starts the day after a plan that is still running", () => {
    expect(renewalStartDate("2026-09-20", "2026-09-10")).toBe("2026-09-21");
  });
});

describe("dueReminderMilestone", () => {
  const base = {
    status: "active" as const,
    ends_on: "2026-09-20",
    sessions_total: null as number | null,
    reminded_3_days_at: null as string | null,
    reminded_last_session_at: null as string | null,
    reminded_expired_at: null as string | null,
  };
  it("is three_days from three days before the end until the end", () => {
    expect(dueReminderMilestone(base, 0, "2026-09-16")).toBeNull();
    expect(dueReminderMilestone(base, 0, "2026-09-17")).toBe("three_days");
    expect(dueReminderMilestone(base, 0, "2026-09-20")).toBe("three_days");
  });
  it("is expired from the day after the end", () => {
    expect(dueReminderMilestone(base, 0, "2026-09-21")).toBe("expired");
  });
  it("is last_session when one session remains on a card", () => {
    expect(dueReminderMilestone({ ...base, sessions_total: 10 }, 9, "2026-09-01")).toBe("last_session");
    expect(dueReminderMilestone({ ...base, sessions_total: 10 }, 10, "2026-09-01")).toBe("expired");
  });
  it("never repeats a milestone already sent", () => {
    expect(dueReminderMilestone({ ...base, reminded_3_days_at: "x" }, 0, "2026-09-18")).toBeNull();
    expect(dueReminderMilestone({ ...base, reminded_expired_at: "x" }, 0, "2026-09-25")).toBeNull();
  });
  it("is null for cancelled plans", () => {
    expect(dueReminderMilestone({ ...base, status: "cancelled" }, 0, "2026-09-25")).toBeNull();
  });
});

describe("countSessionsUsedFromRows with cancellations", () => {
  it("frees a cancelled booking but keeps a late cancel", () => {
    const plan = { starts_on: "2026-09-01", ends_on: "2026-09-30", branch_id: "k" };
    const rows = [
      { schedule_date: "2026-09-02", branch_id: "k", cancelled_at: null, late_cancel: false },
      { schedule_date: "2026-09-03", branch_id: "k", cancelled_at: "2026-09-02T00:00:00Z", late_cancel: false },
      { schedule_date: "2026-09-04", branch_id: "k", cancelled_at: "2026-09-04T13:00:00Z", late_cancel: true },
    ];
    expect(countSessionsUsedFromRows(rows, plan, "2026-09-10")).toBe(2);
  });
});
