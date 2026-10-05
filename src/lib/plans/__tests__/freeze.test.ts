import { describe, expect, it } from "vitest";
import { resolvePlanQueue, type QueuePlan, type QueueRow } from "../plan-queue";
import { freezeProblem } from "../freeze";

const TODAY = "2026-10-05";

const subscription = (id: string, overrides: Partial<QueuePlan> = {}): QueuePlan => ({
  id,
  kind: "subscription",
  status: "active",
  branchId: "ka",
  sessionsTotal: null,
  durationDays: 30,
  notBefore: "2026-09-20",
  fixedEndsOn: null,
  createdAt: `2026-09-01T10:00:00Z-${id}`,
  ...overrides,
});

const session = (id: string, date: string): QueueRow => ({
  id,
  schedule_date: date,
  start_time: "17:00:00",
  branch_id: "ka",
  cancelled_at: null,
  late_cancel: false,
});

describe("freezeProblem", () => {
  const rows = [session("a", "2026-09-28"), session("b", "2026-10-02")];

  it("accepts a Freeze on the Current plan from a day with no session", () => {
    const queue = resolvePlanQueue([subscription("cur")], rows, TODAY);

    expect(freezeProblem(queue, "cur", { startsOn: "2026-10-03", endsOn: "2026-10-30" })).toBeNull();
    expect(freezeProblem(queue, "cur", { startsOn: TODAY, endsOn: null })).toBeNull();
  });

  it("refuses a Plan that is not current", () => {
    const queue = resolvePlanQueue(
      [subscription("cur"), subscription("next", { createdAt: "2026-10-01T09:00:00Z" })],
      rows,
      TODAY,
    );

    expect(freezeProblem(queue, "next", { startsOn: "2026-10-25", endsOn: null })).toBe("אפשר להקפיא רק את המסלול הנוכחי");
  });

  it("refuses a start before the Plan's, an end before the start, and a day a session took place", () => {
    const queue = resolvePlanQueue([subscription("cur")], rows, TODAY);

    expect(freezeProblem(queue, "cur", { startsOn: "2026-09-19", endsOn: null })).toBe("ההקפאה מתחילה לפני תחילת המסלול");
    expect(freezeProblem(queue, "cur", { startsOn: "2026-10-10", endsOn: "2026-10-09" })).toBe("תאריך הסיום קודם לתאריך ההתחלה");
    expect(freezeProblem(queue, "cur", { startsOn: "2026-10-01", endsOn: null })).toBe("בתאריכים האלה כבר התקיים אימון");
  });

  it("refuses a Freeze that starts after the Plan's end, which would only add days", () => {
    const queue = resolvePlanQueue([subscription("cur")], rows, TODAY); // to 19.10

    expect(freezeProblem(queue, "cur", { startsOn: "2026-11-01", endsOn: "2026-11-10" })).toBe(
      "ההקפאה מתחילה אחרי סיום המסלול",
    );
    expect(freezeProblem(queue, "cur", { startsOn: "2026-10-20", endsOn: null })).toBe("ההקפאה מתחילה אחרי סיום המסלול");
    expect(freezeProblem(queue, "cur", { startsOn: "2026-10-19", endsOn: null })).toBeNull();
  });

  it("refuses an overlap with a Freeze already on the Plan", () => {
    const frozen = subscription("cur", { freezes: [{ startsOn: "2026-10-10", endsOn: "2026-10-15" }] });
    const queue = resolvePlanQueue([frozen], rows, TODAY);

    expect(freezeProblem(queue, "cur", { startsOn: "2026-10-14", endsOn: "2026-10-20" })).toBe("ההקפאה חופפת להקפאה קיימת");
    expect(freezeProblem(queue, "cur", { startsOn: "2026-10-03", endsOn: null })).toBe("ההקפאה חופפת להקפאה קיימת");
    expect(freezeProblem(queue, "cur", { startsOn: "2026-10-16", endsOn: "2026-10-20" })).toBeNull();
  });
});
