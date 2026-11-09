import { describe, expect, it } from "vitest";
import {
  canCheckWithPelecard,
  isRefundFlag,
  KEEP_REFUND_FLAG_FILTER,
  paidOrderAction,
  planWithoutPayment,
  refundNote,
  REFUND_FLAG_PREFIX,
  returnRedirect,
  SUPERSEDED_NOTE,
  unverifiedOutcome,
} from "../page-settlement";

const ID = "3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c";

describe("paidOrderAction", () => {
  const base = { fulfillment_error: null, provider_transaction_id: null };

  it("completes open orders", () => {
    for (const status of ["pending", "expired", "charging"] as const) {
      expect(paidOrderAction({ ...base, status }, "9", false)).toBe("complete");
    }
  });

  it("treats the same transaction on a paid order as done, a different one as a refund", () => {
    expect(paidOrderAction({ ...base, status: "paid", provider_transaction_id: "9" }, "9", false)).toBe("already_done");
    expect(paidOrderAction({ ...base, status: "paid", provider_transaction_id: "8" }, "9", false)).toBe("flag_refund");
  });

  it("honors a superseded link unless a newer link was already paid", () => {
    const superseded = { ...base, status: "failed" as const, fulfillment_error: SUPERSEDED_NOTE };
    expect(paidOrderAction(superseded, "9", false)).toBe("complete_superseded");
    expect(paidOrderAction(superseded, "9", true)).toBe("flag_refund");
  });

  it("flags a payment on any other closed order", () => {
    for (const status of ["failed", "voided", "refunded"] as const) {
      expect(paidOrderAction({ ...base, status, fulfillment_error: "x" }, "9", false)).toBe("flag_refund");
    }
  });
});

describe("refundNote", () => {
  it("leads with the prefix and keeps what was there", () => {
    const note = refundNote("invoice: timeout", { pelecardId: "9", approvalNumber: "0155995", reason: "paid twice" });
    expect(note.startsWith(REFUND_FLAG_PREFIX)).toBe(true);
    expect(note).toContain("paid twice");
    expect(note).toContain("transaction 9");
    expect(note).toContain("approval 0155995");
    expect(note.endsWith("invoice: timeout")).toBe(true);
  });

  it("stands alone when nothing was there", () => {
    const note = refundNote(null, { pelecardId: "9", approvalNumber: null, reason: "paid twice" });
    expect(note).toBe(`${REFUND_FLAG_PREFIX} paid twice, transaction 9`);
  });

  it("does not repeat a refund already flagged for the same transaction (return and callback)", () => {
    const first = refundNote(null, { pelecardId: "9", approvalNumber: "1", reason: "paid twice" });
    expect(refundNote(first, { pelecardId: "9", approvalNumber: "1", reason: "paid twice" })).toBe(first);
  });
});

describe("KEEP_REFUND_FLAG_FILTER", () => {
  it("matches only notes that are not refund flags, quoted for PostgREST", () => {
    expect(KEEP_REFUND_FLAG_FILTER).toBe(`fulfillment_error.is.null,fulfillment_error.not.like."${REFUND_FLAG_PREFIX}*"`);
  });
});

describe("planWithoutPayment", () => {
  it("holds an order whose own transaction moved money but does not add up, whatever the hint", () => {
    for (const hint of ["000", "036", null]) {
      expect(planWithoutPayment("ambiguous", hint)).toEqual({ outcome: { kind: "unverified" }, hold: true, markChecking: false });
    }
  });

  it("marks the order as being checked when Pelecard cannot say yet and the hint says paid", () => {
    for (const reason of ["unreadable", "unfinished"] as const) {
      expect(planWithoutPayment(reason, "000")).toEqual({ outcome: { kind: "unverified" }, hold: false, markChecking: true });
      expect(planWithoutPayment(reason, null)).toEqual({ outcome: { kind: "unverified" }, hold: false, markChecking: true });
    }
  });

  it("believes a decline hint when Pelecard cannot say yet", () => {
    expect(planWithoutPayment("unreadable", "036")).toEqual({
      outcome: { kind: "not_paid", code: "036" },
      hold: false,
      markChecking: false,
    });
  });

  it("ignores another order's transaction entirely", () => {
    const plan = planWithoutPayment("not_ours", "000");
    expect(plan.outcome.kind).toBe("ignored");
    expect(plan.hold).toBe(false);
    expect(plan.markChecking).toBe(false);
  });
});

describe("returnRedirect", () => {
  it("sends paid, flagged and unverified to the confirmation page", () => {
    for (const kind of ["paid", "refund_flagged", "unverified"] as const) {
      expect(returnRedirect({ kind }, ID)).toBe(`/join/success?order=${ID}`);
    }
  });

  it("sends a decline back to the card page with its code", () => {
    expect(returnRedirect({ kind: "not_paid", code: "036" }, ID)).toBe(`/join/pay/${ID}?declined=036`);
  });

  it("sends anything ignored back to the card page", () => {
    expect(returnRedirect({ kind: "ignored", reason: "x" }, ID)).toBe(`/join/pay/${ID}`);
  });
});

describe("canCheckWithPelecard", () => {
  it("offers the check on held orders and on open card orders", () => {
    expect(canCheckWithPelecard({ status: "charging", payment_provider: "isracard" })).toBe(true);
    expect(canCheckWithPelecard({ status: "pending", payment_provider: "isracard" })).toBe(true);
    expect(canCheckWithPelecard({ status: "pending", payment_provider: "morning" })).toBe(true);
  });

  it("does not offer it on staff payments or settled orders", () => {
    expect(canCheckWithPelecard({ status: "pending", payment_provider: "manual" })).toBe(false);
    expect(canCheckWithPelecard({ status: "paid", payment_provider: "isracard" })).toBe(false);
    expect(canCheckWithPelecard({ status: "failed", payment_provider: "isracard" })).toBe(false);
  });
});

describe("isRefundFlag", () => {
  it("recognizes a refund note and nothing else", () => {
    expect(isRefundFlag(refundNote(null, { pelecardId: "9", approvalNumber: null, reason: "paid twice" }))).toBe(true);
    expect(isRefundFlag("invoice: timeout")).toBe(false);
    expect(isRefundFlag(null)).toBe(false);
  });
});

describe("unverifiedOutcome", () => {
  it("trusts a decline hint, because it can only hurt whoever forged it", () => {
    expect(unverifiedOutcome("036")).toEqual({ kind: "not_paid", code: "036" });
  });

  it("holds the order when the hint says paid or says nothing", () => {
    expect(unverifiedOutcome("000")).toEqual({ kind: "unverified" });
    expect(unverifiedOutcome(null)).toEqual({ kind: "unverified" });
    expect(unverifiedOutcome("abc")).toEqual({ kind: "unverified" });
  });
});
