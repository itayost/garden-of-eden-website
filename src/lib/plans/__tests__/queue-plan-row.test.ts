import { describe, expect, it } from "vitest";
import { toQueuePlan } from "../queue-plan-row";

const row = {
  id: "p1",
  profile_id: "t1",
  branch_id: "ka",
  status: "active" as const,
  starts_on: "2026-10-20",
  ends_on: "2026-11-18",
  sessions_total: 10,
  not_before: "2026-10-03",
  duration_days: 60,
  fixed_ends_on: null,
  ended_on: null,
  created_at: "2026-10-03T09:00:00Z",
  product: { kind: "session_card" as const },
};

describe("toQueuePlan", () => {
  it("reads the sale-time terms a Plan was sold with", () => {
    expect(toQueuePlan(row)).toMatchObject({
      kind: "session_card",
      branchId: "ka",
      sessionsTotal: 10,
      durationDays: 60,
      notBefore: "2026-10-03",
      fixedEndsOn: null,
      createdAt: "2026-10-03T09:00:00Z",
    });
  });

  it("takes the stored window as the terms of a Plan written before terms were stored", () => {
    const legacy = { ...row, not_before: null, duration_days: null };

    expect(toQueuePlan(legacy)).toMatchObject({ notBefore: "2026-10-20", durationDays: 30 });
  });

  it("carries the day a Cancellation ended the Plan", () => {
    expect(toQueuePlan({ ...row, status: "cancelled" as const, ended_on: "2026-10-05" }).endedOn).toBe("2026-10-05");
  });

  it("keeps the database row's own fields for the caller", () => {
    expect(toQueuePlan(row).profile_id).toBe("t1");
  });
});
