import { describe, expect, test } from "vitest";

import type { ArboxPurchase } from "@/lib/arbox/purchase-rows";
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

function plan(overrides: Partial<ImportPlanRow> = {}): ImportPlanRow {
  return {
    id: "plan-1",
    profileId: "prof-1",
    productKind: "session_card",
    startsOn: "2026-09-01",
    endsOn: "2026-11-30",
    sessionsTotal: 10,
    status: "active",
    createdOn: "2026-09-01",
    orderPaymentMethod: "arbox",
    orderProviderTransactionId: "arbox:4000",
    sessionsUsed: 0,
    ...overrides,
  };
}

function run(overrides: Partial<Parameters<typeof planArboxImports>[0]> = {}) {
  return planArboxImports({
    today: TODAY,
    purchases: [cardPurchase()],
    trainees: [TRAINEE],
    plans: [],
    importedKeys: new Set(),
    products: PRODUCTS,
    ...overrides,
  });
}

describe("skips", () => {
  test.each([
    ["not_linked", { purchases: [cardPurchase({ userId: 999 })] }],
    ["inactive_status", { purchases: [cardPurchase({ status: "inactive" })] }],
    ["no_end_date", { purchases: [membershipPurchase({ endDate: null })] }],
    ["ended", { purchases: [cardPurchase({ endDate: "2026-09-26" })] }],
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
  test("a card with nothing live starts at the later of today and Arbox's start", () => {
    const { actions } = run();

    expect(actions).toEqual([
      {
        type: "create",
        purchase: cardPurchase(),
        profileId: "prof-1",
        chained: false,
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
          startsOn: "2026-09-28",
          endsOn: "2026-12-27",
          sessionsTotal: 10,
          note: "Arbox import כרטיסייה 2026-09-28 (5001)",
        },
      },
    ]);
  });

  test("a card bought earlier starts today", () => {
    const { actions } = run({ purchases: [cardPurchase({ startDate: "2026-09-20", purchaseDate: "2026-09-20" })] });

    expect(actions[0].type === "create" && actions[0].plan.startsOn).toBe(TODAY);
  });

  test("more than 10 sessions uses the 20 card", () => {
    const { actions } = run({ purchases: [cardPurchase({ sessionsLeft: 14 })] });

    expect(actions[0].order.productId).toBe("p-card20");
  });

  test("a long membership is a term, a short one monthly", () => {
    const long = run({ purchases: [membershipPurchase()] }).actions[0];
    const short = run({ purchases: [membershipPurchase({ endDate: "2026-10-27" })] }).actions[0];

    expect(long.type === "create" && long.plan).toMatchObject({ productId: "p-term", sessionsTotal: null, endsOn: "2027-01-27" });
    expect(short.order.productId).toBe("p-monthly");
  });

  test("an unpaid purchase is recorded at 1", () => {
    const { actions } = run({ purchases: [cardPurchase({ paid: 0 })] });

    expect(actions[0].order.amountIls).toBe(1);
  });
});

describe("chain", () => {
  test("a card beside a live plan paid another way starts the day after it, keeping its length", () => {
    const online = plan({ orderPaymentMethod: "card", orderProviderTransactionId: null, endsOn: "2026-10-31" });

    const { actions } = run({ plans: [online] });

    expect(actions[0]).toMatchObject({
      type: "create",
      chained: true,
      plan: { startsOn: "2026-11-01", endsOn: "2027-01-30" },
    });
  });

  test("a card beside a used-up card paid another way starts now, not after it", () => {
    const usedUp = plan({ orderPaymentMethod: "cash", orderProviderTransactionId: null, endsOn: "2026-12-20", sessionsTotal: 10, sessionsUsed: 10 });

    const { actions } = run({ plans: [usedUp] });

    expect(actions[0]).toMatchObject({ type: "create", chained: false, plan: { startsOn: "2026-09-28" } });
  });

  test("a card beside a card with sessions left still chains", () => {
    const running = plan({ orderPaymentMethod: "cash", orderProviderTransactionId: null, endsOn: "2026-12-20", sessionsTotal: 10, sessionsUsed: 9 });

    const { actions } = run({ plans: [running] });

    expect(actions[0]).toMatchObject({ type: "create", chained: true, plan: { startsOn: "2026-12-21" } });
  });

  test("a card beside a live membership starts after the membership", () => {
    const membershipPlan = plan({ productKind: "term", sessionsTotal: null, endsOn: "2026-12-31" });

    const { actions } = run({ plans: [membershipPlan] });

    expect(actions[0]).toMatchObject({ type: "create", chained: true, plan: { startsOn: "2027-01-01" } });
  });
});

describe("merge", () => {
  test("a card adds its sessions to a live Arbox card plan and keeps the later end", () => {
    const { actions } = run({ plans: [plan()] });

    expect(actions[0]).toMatchObject({
      type: "merge",
      target: { planId: "plan-1", expectSessionsTotal: 10, expectEndsOn: "2026-11-30" },
      set: { sessionsTotal: 20, endsOn: "2026-12-27", clearThreeDays: true, clearLastSession: true, clearExpired: true },
      shifts: [],
    });
  });

  test("a null session total counts as zero", () => {
    const { actions } = run({ plans: [plan({ sessionsTotal: null })] });

    expect(actions[0].type === "merge" && actions[0].set.sessionsTotal).toBe(10);
  });

  test("a membership extends a live Arbox membership and moves a queued plan behind it", () => {
    const membershipPlan = plan({ id: "m-1", productKind: "term", sessionsTotal: null, endsOn: "2026-12-31" });
    const queued = plan({ id: "q-1", startsOn: "2027-01-01", endsOn: "2027-03-31" });

    const { actions } = run({ purchases: [membershipPurchase()], plans: [membershipPlan, queued] });

    expect(actions[0]).toMatchObject({
      type: "merge",
      target: { planId: "m-1" },
      set: { sessionsTotal: null, endsOn: "2027-01-27", clearThreeDays: true },
      shifts: [{ planId: "q-1", expectStartsOn: "2027-01-01", startsOn: "2027-01-28", endsOn: "2027-04-27" }],
    });
  });

  test("a membership ending sooner than the live one changes nothing but is recorded", () => {
    const membershipPlan = plan({ id: "m-1", productKind: "term", sessionsTotal: null, endsOn: "2027-06-30" });

    const { actions } = run({ purchases: [membershipPurchase()], plans: [membershipPlan] });

    expect(actions[0]).toMatchObject({
      type: "merge",
      set: { endsOn: "2027-06-30", clearThreeDays: false, clearLastSession: false, clearExpired: false },
      shifts: [],
    });
  });

  test("two cards in one run: the second merges into the plan the first creates", () => {
    const first = cardPurchase({ membershipUserId: 5001, purchaseDate: "2026-09-20", startDate: "2026-09-20", sessionsLeft: 4, endDate: "2026-10-07" });
    const second = cardPurchase({ membershipUserId: 5002, sessionsLeft: 10, endDate: "2026-12-24" });

    const { actions } = run({ purchases: [second, first] });

    expect(actions.map((a) => a.type)).toEqual(["create", "merge"]);
    expect(actions[1]).toMatchObject({
      target: { planId: newPlanId(purchaseKey(first)), expectSessionsTotal: 4, expectEndsOn: "2026-10-07" },
      set: { sessionsTotal: 14, endsOn: "2026-12-24" },
    });
  });
});
