import { describe, expect, it } from "vitest";
import { resolvePlanQueue, type QueuePlan, type QueueRow } from "../plan-queue";
import { earliestChargeableDay, rosterReadSlices } from "../roster-read-bounds";
import { addDays } from "@/lib/utils/iso-date";

const TODAY = "2026-10-05";

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

let rowSeq = 0;
const row = (schedule_date: string, overrides: Partial<QueueRow> = {}): QueueRow => {
  rowSeq += 1;
  return {
    id: `row-${rowSeq}`,
    schedule_date,
    start_time: "17:00",
    branch_id: "ka",
    cancelled_at: null,
    late_cancel: false,
    ...overrides,
  };
};

/** Two rows a week from a year before the first Plan to a month after today. */
const history = (): QueueRow[] =>
  Array.from({ length: 140 }, (_, i) => row(addDays("2025-08-01", Math.floor(i / 2) * 7 + (i % 2) * 2)));

describe("earliestChargeableDay", () => {
  it("is the earliest notBefore of the training Plans", () => {
    expect(
      earliestChargeableDay([plan({ notBefore: "2026-09-10" }), plan({ notBefore: "2026-08-20" })]),
    ).toBe("2026-08-20");
  });

  it("ignores voided Plans and Add-ons, which never take a row", () => {
    expect(
      earliestChargeableDay([
        plan({ notBefore: "2026-09-10" }),
        plan({ notBefore: "2025-01-01", status: "voided" }),
        plan({ notBefore: "2025-01-01", kind: "addon" }),
      ]),
    ).toBe("2026-09-10");
  });

  it("is null when no Plan can take a row", () => {
    expect(earliestChargeableDay([])).toBeNull();
    expect(earliestChargeableDay([plan({ status: "voided" })])).toBeNull();
  });
});

describe("the bound leaves every queue as it was", () => {
  const scenarios: Record<string, () => QueuePlan[]> = {
    "a Card": () => [plan({ notBefore: "2026-08-01" })],
    "a used-up Card and the one behind it": () => [
      plan({ notBefore: "2026-03-01", sessionsTotal: 4 }),
      plan({ notBefore: "2026-03-01", sessionsTotal: 10 }),
    ],
    "a subscription then a queued Card": () => [
      plan({ kind: "subscription", sessionsTotal: null, durationDays: 30, notBefore: "2026-09-20" }),
      plan({ notBefore: "2026-09-20" }),
    ],
    "an Early end": () => [
      plan({ kind: "subscription", sessionsTotal: null, durationDays: 90, notBefore: "2026-07-01", endedOn: "2026-09-01" }),
      plan({ notBefore: "2026-07-01" }),
    ],
    "a Cancellation": () => [plan({ notBefore: "2026-06-01", status: "cancelled", endedOn: "2026-07-15" })],
    "a Freeze": () => [
      plan({ notBefore: "2026-08-15", freezes: [{ startsOn: "2026-09-01", endsOn: "2026-09-10" }] }),
    ],
    "an Arbox Plan with a fixed end": () => [plan({ notBefore: "2026-05-01", fixedEndsOn: "2026-06-30" })],
    "a voided early Plan": () => [plan({ notBefore: "2025-01-01", status: "voided" }), plan({ notBefore: "2026-09-01" })],
  };

  for (const [name, plans] of Object.entries(scenarios)) {
    it(name, () => {
      const own = plans();
      const rows = history();
      const from = earliestChargeableDay(own)!;
      const bounded = rows.filter((r) => r.schedule_date >= from);
      expect(bounded.length).toBeLessThan(rows.length);
      expect(resolvePlanQueue(own, bounded, TODAY)).toEqual(resolvePlanQueue(own, rows, TODAY));
    });
  }
});

describe("rosterReadSlices", () => {
  it("sorts Trainees by their bound, so each slice starts at its earliest member", () => {
    const plans = new Map<string, QueuePlan[]>([
      ["c", [plan({ notBefore: "2026-03-01" })]],
      ["a", [plan({ notBefore: "2026-09-01" })]],
      ["b", [plan({ notBefore: "2025-01-01" })]],
      ["d", [plan({ notBefore: "2026-10-01" })]],
    ]);
    expect(rosterReadSlices(plans, 2)).toEqual([
      { ids: ["b", "c"], from: "2025-01-01" },
      { ids: ["a", "d"], from: "2026-09-01" },
    ]);
  });

  it("leaves out a Trainee whose Plans can take no row", () => {
    const plans = new Map<string, QueuePlan[]>([
      ["a", [plan({ status: "voided" })]],
      ["b", [plan({ notBefore: "2026-09-01" })]],
    ]);
    expect(rosterReadSlices(plans)).toEqual([{ ids: ["b"], from: "2026-09-01" }]);
  });

  it("reads nothing for no Trainees", () => {
    expect(rosterReadSlices(new Map())).toEqual([]);
  });
});
