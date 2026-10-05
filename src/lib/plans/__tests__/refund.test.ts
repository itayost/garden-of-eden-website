import { describe, expect, it } from "vitest";
import { cancellationFee, proposeRefund, resolveSingleSessionPrice, type RefundInput } from "../refund";

const base: RefundInput = {
  amountPaid: 1250,
  purchasedOn: "2026-09-01",
  cancelledOn: "2026-10-05",
  sessionsTotal: 10,
  sessionsUsed: 0,
  startsOn: "2026-09-01",
  endsOn: "2026-12-07",
  durationDays: 98,
  singleSessionPrice: 125,
  defect: false,
};

describe("cancellationFee", () => {
  it("is 5% of what was paid, or 100 ILS, whichever is lower", () => {
    expect(cancellationFee(850)).toBe(42.5);
    expect(cancellationFee(2000)).toBe(100);
    expect(cancellationFee(3200)).toBe(100);
  });
});

describe("proposeRefund", () => {
  it("within 14 days and before any session: everything paid, minus the fee", () => {
    const refund = proposeRefund({ ...base, purchasedOn: "2026-09-25", startsOn: "2026-10-10", sessionsUsed: 0 });

    expect(refund.rule).toBe("fourteen_days");
    expect(refund.proposed).toBe(1187.5);
    expect(refund.steps.map((s) => s.amount)).toEqual([1250, -62.5]);
  });

  it("charges no fee when the cancellation comes from a defect", () => {
    const refund = proposeRefund({ ...base, purchasedOn: "2026-09-25", defect: true });

    expect(refund.proposed).toBe(1250);
  });

  it("a Card after 14 days: paid, minus used sessions at the Single-session price, minus the fee", () => {
    const refund = proposeRefund({ ...base, sessionsUsed: 3 });

    expect(refund.rule).toBe("sessions");
    expect(refund.proposed).toBe(1250 - 3 * 125 - 62.5);
  });

  it("a Card inside 14 days that was already used follows the Card rule", () => {
    const refund = proposeRefund({ ...base, purchasedOn: "2026-09-28", sessionsUsed: 2 });

    expect(refund.rule).toBe("sessions");
    expect(refund.proposed).toBe(1250 - 2 * 125 - 62.5);
  });

  it("works from the amount actually paid after a discount", () => {
    const refund = proposeRefund({ ...base, amountPaid: 1000, sessionsUsed: 2 });

    expect(refund.proposed).toBe(1000 - 2 * 125 - 50);
  });

  it("never proposes less than nothing", () => {
    expect(proposeRefund({ ...base, sessionsUsed: 10 }).proposed).toBe(0);
  });

  it("a Subscription refunds the days left as a share of what was paid, with no fee", () => {
    const refund = proposeRefund({
      ...base,
      amountPaid: 850,
      sessionsTotal: null,
      sessionsUsed: 3,
      purchasedOn: "2026-09-01",
      startsOn: "2026-09-24",
      endsOn: "2026-10-23",
      durationDays: 30,
    });

    expect(refund.rule).toBe("time");
    expect(refund.proposed).toBe(510);
  });

  it("a Term follows the same time rule over its whole length", () => {
    const refund = proposeRefund({
      ...base,
      amountPaid: 3200,
      sessionsTotal: null,
      sessionsUsed: 11,
      purchasedOn: "2026-08-27",
      startsOn: "2026-08-27",
      endsOn: "2026-12-24",
      durationDays: 120,
    });

    expect(refund.proposed).toBe(2133.33);
  });

  it("a Plan that has not started yet refunds in full by time", () => {
    const refund = proposeRefund({
      ...base,
      amountPaid: 850,
      sessionsTotal: null,
      purchasedOn: "2026-09-01",
      startsOn: "2026-10-20",
      endsOn: "2026-11-18",
      durationDays: 30,
    });

    expect(refund.proposed).toBe(850);
  });
});

describe("resolveSingleSessionPrice", () => {
  it("uses the branch's Single-session price, else the 10-Card per-session rate", () => {
    expect(resolveSingleSessionPrice(110, 1250)).toEqual({ price: 110, fromCardRate: false });
    expect(resolveSingleSessionPrice(null, 1250)).toEqual({ price: 125, fromCardRate: true });
    expect(resolveSingleSessionPrice(null, null)).toBeNull();
  });
});

describe("proposeRefund inside 14 days", () => {
  it("never proposes less than waiting would: a queued Subscription refunds in full with no fee", () => {
    const refund = proposeRefund({
      ...base,
      amountPaid: 850,
      sessionsTotal: null,
      purchasedOn: "2026-10-02",
      startsOn: "2026-10-20",
      endsOn: "2026-11-18",
      durationDays: 30,
    });

    expect(refund.proposed).toBe(850);
    expect(refund.rule).toBe("time");
  });
});
