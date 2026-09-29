import { describe, expect, it } from "vitest";
import { lookupWindow, parseCompleteTransData, parseTrxLookUp, pelecardDateTime } from "../pelecard-lookup";

const PARAM_X = "3f2b8c1e9a4d4e21b7c";

function row(overrides: Record<string, unknown> = {}) {
  return {
    PelecardTransactionId: "80115023",
    VoucherId: "62-001-058",
    ShvaResult: "000",
    CreditCardNumber: "45******4580",
    CreditCardExpDate: "0328",
    shvaOutput: "0000000000045******4580",
    DebitTotal: "45000",
    DebitApproveNumber: "1234567",
    TotalPayments: "0",
    AdditionalDetailsParamX: PARAM_X,
    ...overrides,
  };
}

describe("pelecardDateTime", () => {
  it("formats in Israel time as dd/MM/yyyy HH:mm", () => {
    // 2026-09-29 20:05 UTC is 23:05 in Israel (summer, UTC+3).
    expect(pelecardDateTime(new Date("2026-09-29T20:05:00Z"))).toBe("29/09/2026 23:05");
    // 2026-12-01 22:30 UTC is 00:30 the next day in Israel (winter, UTC+2).
    expect(pelecardDateTime(new Date("2026-12-01T22:30:00Z"))).toBe("02/12/2026 00:30");
  });
});

describe("lookupWindow", () => {
  it("starts an hour before the order went into charging and ends a few minutes after now", () => {
    const since = new Date("2026-09-29T10:00:00Z");
    const now = new Date("2026-09-29T10:30:00Z");
    expect(lookupWindow(since, now)).toEqual({
      startDate: "29/09/2026 12:00",
      endDate: "29/09/2026 13:35",
    });
  });
});

describe("parseCompleteTransData", () => {
  it("finds the approved charge carrying this order's reference and amount", () => {
    const outcome = parseCompleteTransData(
      { StatusCode: "000", ResultData: [row({ AdditionalDetailsParamX: "other", PelecardTransactionId: "1" }), row()] },
      PARAM_X,
      45000,
    );
    expect(outcome).toMatchObject({
      kind: "found",
      transactionId: "80115023",
      approvalNumber: "1234567",
      last4: "4580",
      installments: 1,
    });
  });

  it("keeps no card number, expiry, or Shva record in what gets stored", () => {
    const outcome = parseCompleteTransData({ StatusCode: "000", ResultData: [row()] }, PARAM_X, 45000);
    if (outcome.kind !== "found") throw new Error("expected a match");
    const stored = JSON.stringify(outcome.raw);
    expect(stored).not.toContain("45******4580");
    expect(stored).not.toContain("CreditCardExpDate");
    expect(stored).not.toContain("shvaOutput");
  });

  it("matches a reference Pelecard returned with surrounding spaces", () => {
    const outcome = parseCompleteTransData(
      { StatusCode: "000", ResultData: [row({ AdditionalDetailsParamX: ` ${PARAM_X} ` })] },
      PARAM_X,
      45000,
    );
    expect(outcome.kind).toBe("found");
  });

  it("reads the installment count", () => {
    const outcome = parseCompleteTransData(
      { StatusCode: "000", ResultData: [row({ TotalPayments: "3" })] },
      PARAM_X,
      45000,
    );
    expect(outcome).toMatchObject({ kind: "found", installments: 3 });
  });

  it("ignores declined attempts and other orders", () => {
    const outcome = parseCompleteTransData(
      {
        StatusCode: "000",
        ResultData: [row({ ShvaResult: "033" }), row({ AdditionalDetailsParamX: "other" })],
      },
      PARAM_X,
      45000,
    );
    expect(outcome.kind).toBe("not_found");
  });

  it("reads an unpadded approval result as approved", () => {
    const outcome = parseCompleteTransData(
      { StatusCode: "000", ResultData: [row({ ShvaResult: 0 })] },
      PARAM_X,
      45000,
    );
    expect(outcome.kind).toBe("found");
  });

  it("stops for a human when this order's approved charge has another amount, never 'no charge'", () => {
    const outcome = parseCompleteTransData(
      { StatusCode: "000", ResultData: [row({ DebitTotal: "450.00" })] },
      PARAM_X,
      45000,
    );
    expect(outcome.kind).toBe("error");
  });

  it("stops for a human when this order's row has an unreadable result", () => {
    const outcome = parseCompleteTransData(
      { StatusCode: "000", ResultData: [row({ ShvaResult: "" })] },
      PARAM_X,
      45000,
    );
    expect(outcome.kind).toBe("error");
  });

  it("reports no charge when Pelecard has no rows", () => {
    expect(parseCompleteTransData({ StatusCode: "000", ResultData: [] }, PARAM_X, 45000).kind).toBe("not_found");
    expect(parseCompleteTransData({ StatusCode: "510" }, PARAM_X, 45000).kind).toBe("not_found");
  });

  it("refuses to pick when two approved charges carry the same order", () => {
    const outcome = parseCompleteTransData(
      { StatusCode: "000", ResultData: [row(), row({ PelecardTransactionId: "80115024" })] },
      PARAM_X,
      45000,
    );
    expect(outcome).toMatchObject({ kind: "error" });
    if (outcome.kind === "error") expect(outcome.reason).toContain("2");
  });

  it("reports a gateway error or an unreadable answer as an error, never as no charge", () => {
    expect(parseCompleteTransData({ StatusCode: "501" }, PARAM_X, 45000).kind).toBe("error");
    expect(parseCompleteTransData(null, PARAM_X, 45000).kind).toBe("error");
    expect(parseCompleteTransData({ StatusCode: "000", ResultData: "x" }, PARAM_X, 45000).kind).toBe("error");
  });
});

describe("parseTrxLookUp", () => {
  it("reports no charge only when Pelecard lists nothing for this reference", () => {
    expect(parseTrxLookUp({ StatusCode: "000", ResultData: [] }, PARAM_X)).toBe("none");
    expect(parseTrxLookUp({ StatusCode: "510" }, PARAM_X)).toBe("none");
    expect(parseTrxLookUp({ StatusCode: "000", ResultData: [{ ParamX: "other" }] }, PARAM_X)).toBe("none");
  });

  it("reports a charge when a row carries this reference, spaces and all", () => {
    expect(parseTrxLookUp({ StatusCode: "000", ResultData: [{ ParamX: ` ${PARAM_X}` }] }, PARAM_X)).toBe("charged");
  });

  it("reports an error for anything it cannot read", () => {
    expect(parseTrxLookUp({ StatusCode: "501" }, PARAM_X)).toBe("error");
    expect(parseTrxLookUp(null, PARAM_X)).toBe("error");
    expect(parseTrxLookUp({ StatusCode: "000", ResultData: {} }, PARAM_X)).toBe("error");
  });
});
