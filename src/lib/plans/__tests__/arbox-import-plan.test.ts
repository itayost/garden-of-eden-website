import { describe, expect, test } from "vitest";

import type { ArboxPurchase } from "@/lib/arbox/purchase-rows";
import type { QueueRow } from "../plan-queue";
import {
  newPlanId,
  planArboxImports,
  purchaseKey,
  type ImportPlanRow,
  type ImportTrainee,
} from "../arbox-import-plan";

const TODAY = "2026-09-27";
const PRODUCTS = { card10: "p-card10", card20: "p-card20", monthly: "p-monthly", term: "p-term" };
const TRAINEE: ImportTrainee = {
  profileId: "prof-1",
  arboxUserId: 100,
  name: "יון דגן",
  birthdate: "2015-01-01",
  phone: "+972501234567",
  guardianName: null,
};

function cardPurchase(overrides: Partial<ArboxPurchase> = {}): ArboxPurchase {
  return {
    membershipUserId: 5001,
    userId: 100,
    kind: "card",
    itemName: "כרטיסייה",
    purchaseDate: "2026-09-28",
    startDate: "2026-09-28",
    endDate: "2026-12-27",
    sessionsLeft: 10,
    paid: 1250,
    status: "active",
    ...overrides,
  };
}

function membershipPurchase(overrides: Partial<ArboxPurchase> = {}): ArboxPurchase {
  return {
    ...cardPurchase(),
    membershipUserId: 7001,
    kind: "membership",
    itemName: "מנוי מתקדמים 4 חודשים",
    startDate: "2026-09-28",
    endDate: "2027-01-27",
    sessionsLeft: null,
    paid: 3200,
    ...overrides,
  };
}

/** A live Arbox Card from 1.9 to 30.11, by default. */
function plan(overrides: Partial<ImportPlanRow> = {}): ImportPlanRow {
  return {
    id: "plan-1",
    profileId: "prof-1",
    kind: "session_card",
    status: "active",
    branchId: "ka",
    sessionsTotal: 10,
    durationDays: 91,
    notBefore: "2026-09-01",
    fixedEndsOn: "2026-11-30",
    createdAt: "2026-09-01T10:00:00Z",
    createdOn: "2026-09-01",
    orderPaymentMethod: "arbox",
    orderProviderTransactionId: "arbox:4000",
    ...overrides,
  };
}

const sessions = (dates: readonly string[]): QueueRow[] =>
  dates.map((date, i) => ({
    id: `row-${i}`,
    schedule_date: date,
    start_time: "17:00:00",
    branch_id: "ka",
    cancelled_at: null,
    late_cancel: false,
  }));

function run(
  overrides: Partial<Omit<Parameters<typeof planArboxImports>[0], "rows">> & { rows?: QueueRow[] } = {},
) {
  const { rows = [], ...rest } = overrides;
  return planArboxImports({
    today: TODAY,
    branchId: "ka",
    purchases: [cardPurchase()],
    trainees: [TRAINEE],
    plans: [],
    rows: new Map([["prof-1", rows]]),
    importedKeys: new Set(),
    products: PRODUCTS,
    ...rest,
  });
}

describe("skips", () => {
  test.each([
    ["not_linked", { purchases: [cardPurchase({ userId: 999 })] }],
    ["inactive_status", { purchases: [cardPurchase({ status: "inactive" })] }],
    ["no_end_date", { purchases: [membershipPurchase({ endDate: null })] }],
    ["ended", { purchases: [cardPurchase({ endDate: "2026-09-26" })] }],
    ["ends_before_start", { purchases: [membershipPurchase({ startDate: "2026-11-01", endDate: "2026-10-20" })] }],
    ["no_sessions_left", { purchases: [cardPurchase({ sessionsLeft: 0 })] }],
    ["already_imported", { importedKeys: new Set(["arbox:5001"]) }],
    ["invalid_phone", { trainees: [{ ...TRAINEE, phone: "0501234567" }] }],
  ] as const)("%s", (reason, overrides) => {
    const { actions, skips } = run(overrides);

    expect(actions).toEqual([]);
    expect(skips.map((s) => s.reason)).toEqual([reason]);
  });

  test("a hand-entered Arbox plan created on or after the purchase covers it", () => {
    const hand = plan({ createdOn: "2026-09-28", orderProviderTransactionId: null });

    const { actions, skips } = run({ plans: [hand] });

    expect(actions).toEqual([]);
    expect(skips[0].reason).toBe("covered_by_hand");
  });

  test("a hand-entered plan paid another way does not cover it", () => {
    const cash = plan({ createdOn: "2026-09-28", orderPaymentMethod: "cash", orderProviderTransactionId: null });

    const { skips } = run({ plans: [cash] });

    expect(skips).toEqual([]);
  });

  test("a hand-entered Arbox plan from before the purchase does not cover it", () => {
    const older = plan({ createdOn: "2026-09-24", orderProviderTransactionId: null });

    const { actions } = run({ plans: [older] });

    expect(actions).toHaveLength(1);
  });
});

describe("new plan", () => {
  test("a card with nothing live starts at the later of today and Arbox's start and keeps Arbox's end", () => {
    const { actions } = run();

    expect(actions).toEqual([
      {
        type: "create",
        purchase: cardPurchase(),
        profileId: "prof-1",
        queued: false,
        neverRuns: false,
        order: {
          key: "arbox:5001",
          productId: "p-card10",
          profileId: "prof-1",
          amountIls: 1250,
          reference: "Arbox כרטיסייה 28.9",
          childName: "יון דגן",
          childBirthdate: "2015-01-01",
          parentName: "הורה",
          phone: "+972501234567",
        },
        plan: {
          id: newPlanId("arbox:5001"),
          productId: "p-card10",
          notBefore: "2026-09-28",
          startsOn: "2026-09-28",
          fixedEndsOn: "2026-12-27",
          sessionsTotal: 10,
          note: "Arbox import כרטיסייה 2026-09-28 (5001)",
        },
      },
    ]);
  });

  test("a card bought earlier may start today, never before", () => {
    const { actions } = run({ purchases: [cardPurchase({ startDate: "2026-09-20", purchaseDate: "2026-09-20" })] });

    expect(actions[0].plan).toMatchObject({ notBefore: TODAY, startsOn: TODAY });
  });

  test("more than 10 sessions uses the 20 card", () => {
    const { actions } = run({ purchases: [cardPurchase({ sessionsLeft: 14 })] });

    expect(actions[0].order.productId).toBe("p-card20");
  });

  test("a long membership is a term, a short one monthly", () => {
    const long = run({ purchases: [membershipPurchase()] }).actions[0];
    const short = run({ purchases: [membershipPurchase({ endDate: "2026-10-27" })] }).actions[0];

    expect(long.plan).toMatchObject({ productId: "p-term", sessionsTotal: null, fixedEndsOn: "2027-01-27" });
    expect(short.order.productId).toBe("p-monthly");
  });

  test("an unpaid purchase is recorded at 1", () => {
    const { actions } = run({ purchases: [cardPurchase({ paid: 0 })] });

    expect(actions[0].order.amountIls).toBe(1);
  });
});

describe("queue", () => {
  test("a new Arbox card for a Trainee with a live Arbox card is queued behind it with Arbox's sessions and end; nothing merges", () => {
    const { actions } = run({ plans: [plan()] });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "create",
      queued: true,
      plan: { notBefore: "2026-09-28", startsOn: "2026-12-01", fixedEndsOn: "2026-12-27", sessionsTotal: 10 },
    });
  });

  test("a new Arbox membership is queued behind a live Arbox membership, which is not extended", () => {
    const membershipPlan = plan({ id: "m-1", kind: "term", sessionsTotal: null, fixedEndsOn: "2026-12-31" });

    const { actions } = run({ purchases: [membershipPurchase()], plans: [membershipPlan] });

    expect(actions).toEqual([
      expect.objectContaining({
        type: "create",
        queued: true,
        plan: expect.objectContaining({ startsOn: "2027-01-01", fixedEndsOn: "2027-01-27" }),
      }),
    ]);
  });

  test("the queue places it: behind a Card whose last session is booked, it starts that day", () => {
    const ending = plan({ sessionsTotal: 2, fixedEndsOn: null });

    const { actions } = run({ plans: [ending], rows: sessions(["2026-09-10", "2026-10-04"]) });

    expect(actions[0]).toMatchObject({ queued: true, plan: { startsOn: "2026-10-04" } });
  });

  test("a card beside a used-up card starts now, not after it", () => {
    const usedUp = plan({ orderPaymentMethod: "cash", orderProviderTransactionId: null, sessionsTotal: 2 });

    const { actions } = run({ plans: [usedUp], rows: sessions(["2026-09-10", "2026-09-20"]) });

    expect(actions[0]).toMatchObject({ queued: false, plan: { startsOn: "2026-09-28" } });
  });

  test("a membership that starts after the live plan ends is not queued", () => {
    const short = plan({ fixedEndsOn: "2026-10-10" });

    const { actions } = run({ purchases: [membershipPurchase({ startDate: "2026-11-01" })], plans: [short] });

    expect(actions[0]).toMatchObject({ queued: false, plan: { startsOn: "2026-11-01" } });
  });

  test("a purchase queued past its own Arbox end is flagged as never running", () => {
    const longTerm = plan({ kind: "term", sessionsTotal: null, fixedEndsOn: "2027-01-01" });

    const { actions } = run({ plans: [longTerm] });

    expect(actions[0]).toMatchObject({ queued: true, neverRuns: true, plan: { startsOn: "2027-01-02", fixedEndsOn: "2026-12-27" } });
  });

  test("two cards in one run: the second is queued behind the one the first creates", () => {
    const first = cardPurchase({ membershipUserId: 5001, purchaseDate: "2026-09-20", startDate: "2026-09-20", sessionsLeft: 4, endDate: "2026-10-07" });
    const second = cardPurchase({ membershipUserId: 5002, sessionsLeft: 10, endDate: "2026-12-24" });

    const { actions } = run({ purchases: [second, first] });

    expect(actions.map((a) => [a.order.key, a.queued, a.plan.startsOn])).toEqual([
      [purchaseKey(first), false, TODAY],
      [purchaseKey(second), true, "2026-10-08"],
    ]);
  });
});
