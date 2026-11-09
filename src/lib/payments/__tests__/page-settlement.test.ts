import { describe, expect, it } from "vitest";
import {
  paidOrderAction,
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
