import { describe, expect, it } from "vitest";
import {
  buildDebitRequest,
  parseDebitResponse,
  pelecardParamX,
  splitInstallments,
  toAgorot,
} from "../pelecard-mapping";
import type { CardChargeRequest } from "../provider";

const CREDS = { terminalNumber: "0962210", user: "tester", password: "secret" };
const ORDER_ID = "3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c";

function request(overrides: Partial<CardChargeRequest> = {}): CardChargeRequest {
  return {
    orderId: ORDER_ID,
    amountIls: 450,
    installments: 1,
    description: "מנוי חודשי - דני",
    card: {
      number: "4580458045804580",
      expMonth: 3,
      expYear: 2028,
      cvv: "123",
      holderName: "ישראל ישראלי",
      holderId: "123456782",
    },
    payer: { name: "ישראל ישראלי", phone: "0501234567", email: null },
    ...overrides,
  };
}

function approved(resultData: Record<string, unknown> = {}) {
  return {
    StatusCode: "000",
    ErrorMessage: "operation success",
    ResultData: {
      PelecardTransactionId: 254379665,
      VoucherId: "86-001-006",
      ShvaResult: "000",
      DebitApproveNumber: "1234567",
      DebitTotal: "45000",
      TotalPayments: "1",
      CreditCardNumber: "45******4580",
      CreditCardExpDate: "0328",
      shvaOutput: "0000000000045******458022000412193300001000",
      AdditionalDetailsParamX: pelecardParamX(ORDER_ID),
      ...resultData,
    },
  };
}

describe("toAgorot", () => {
  it("converts shekels to whole agorot without float drift", () => {
    expect(toAgorot(450)).toBe(45000);
    expect(toAgorot(19.99)).toBe(1999);
    expect(toAgorot(0.1 + 0.2)).toBe(30);
  });
});

describe("pelecardParamX", () => {
  it("fits Pelecard's 19 character limit and is stable per order", () => {
    const ref = pelecardParamX(ORDER_ID);
    expect(ref).toHaveLength(19);
    expect(ref).toBe("3f2b8c1e9a4d4e21b7c");
    expect(pelecardParamX(ORDER_ID)).toBe(ref);
  });
});

describe("splitInstallments", () => {
  it("puts the remainder on the first payment so the parts add up to the total", () => {
    expect(splitInstallments(45000, 3)).toEqual({ first: 15000, fixed: 15000 });
    expect(splitInstallments(100000, 3)).toEqual({ first: 33334, fixed: 33333 });
    const { first, fixed } = splitInstallments(99999, 2);
    expect(first + fixed).toBe(99999);
  });
});

describe("buildDebitRequest", () => {
  it("builds a regular charge in agorot with an MMYY expiry", () => {
    const { path, body } = buildDebitRequest(request(), CREDS);
    expect(path).toBe("DebitRegularType");
    expect(body).toMatchObject({
      terminalNumber: "0962210",
      user: "tester",
      password: "secret",
      shopNumber: "001",
      creditCard: "4580458045804580",
      creditCardDateMmYy: "0328",
      total: "45000",
      currency: "1",
      cvv2: "123",
      id: "123456782",
      paramX: "3f2b8c1e9a4d4e21b7c",
    });
    expect(body).not.toHaveProperty("paymentsNumber");
  });

  it("accepts a two digit expiry year", () => {
    const { body } = buildDebitRequest(request({ card: { ...request().card, expMonth: 11, expYear: 29 } }), CREDS);
    expect(body.creditCardDateMmYy).toBe("1129");
  });

  it("uses the payments endpoint with an explicit first payment for installments", () => {
    const { path, body } = buildDebitRequest(request({ amountIls: 1000, installments: 3 }), CREDS);
    expect(path).toBe("DebitPaymentsType");
    expect(body).toMatchObject({ total: "100000", paymentsNumber: "3", firstPayment: "33334" });
  });
});

describe("parseDebitResponse", () => {
  it("approves on status 000 with the transaction id and approval number", () => {
    const result = parseDebitResponse(approved(), 45000);
    expect(result).toMatchObject({
      kind: "approved",
      transactionId: "254379665",
      approvalNumber: "1234567",
    });
  });

  it("keeps no card number, expiry, or raw Shva output in what gets stored", () => {
    const result = parseDebitResponse(approved(), 45000);
    if (result.kind !== "approved") throw new Error("expected approval");
    const stored = JSON.stringify(result.raw);
    expect(stored).not.toContain("4580");
    expect(stored).not.toContain("CreditCardExpDate");
    expect(stored).not.toContain("shvaOutput");
    expect(result.raw).toMatchObject({ VoucherId: "86-001-006", DebitTotal: "45000" });
  });

  it("treats an all-zero approval number as none", () => {
    const result = parseDebitResponse(approved({ DebitApproveNumber: "0000000" }), 45000);
    expect(result).toMatchObject({ kind: "approved", approvalNumber: null });
  });

  it("reports a charged amount that differs from the order as unknown, never as approved", () => {
    expect(parseDebitResponse(approved({ DebitTotal: "4500" }), 45000).kind).toBe("unknown");
  });

  it("reports an approval without a transaction id as unknown", () => {
    expect(parseDebitResponse(approved({ PelecardTransactionId: "" }), 45000).kind).toBe("unknown");
  });

  it("maps common card errors to Hebrew messages the parent can act on", () => {
    const invalid = parseDebitResponse({ StatusCode: "033", ErrorMessage: "x" }, 45000);
    expect(invalid).toMatchObject({ kind: "declined" });
    if (invalid.kind === "declined") expect(invalid.message).toContain("מספר הכרטיס");

    const expired = parseDebitResponse({ StatusCode: "036" }, 45000);
    if (expired.kind !== "declined") throw new Error("expected decline");
    expect(expired.message).toContain("תוקף");

    const cvv = parseDebitResponse({ StatusCode: "006" }, 45000);
    if (cvv.kind !== "declined") throw new Error("expected decline");
    expect(cvv.message).toContain("תעודת הזהות");
  });

  it("keeps Pelecard's own error text for the logs", () => {
    const result = parseDebitResponse({ StatusCode: "004", ErrorMessage: "Refused" }, 45000);
    expect(result).toMatchObject({ kind: "declined", statusCode: "004", providerMessage: "Refused" });
  });

  it("keeps Pelecard's error text on a gateway failure too", () => {
    const result = parseDebitResponse({ StatusCode: "306", ErrorMessage: "No connection" }, 45000);
    expect(result).toMatchObject({ kind: "failed", statusCode: "306", providerMessage: "No connection" });
  });

  it("flattens Pelecard's error text to one log line and ignores a non-string", () => {
    const multiline = parseDebitResponse({ StatusCode: "004", ErrorMessage: "Refused\n[pelecard] forged\r\n" }, 45000);
    expect(multiline).toMatchObject({ providerMessage: "Refused [pelecard] forged" });

    const missing = parseDebitResponse({ StatusCode: "004" }, 45000);
    expect(missing).toMatchObject({ providerMessage: "" });

    const nonString = parseDebitResponse({ StatusCode: "004", ErrorMessage: { text: "x" } }, 45000);
    expect(nonString).toMatchObject({ providerMessage: "" });
  });

  it("declines an unmapped issuer refusal with a generic message", () => {
    const result = parseDebitResponse({ StatusCode: "004" }, 45000);
    expect(result).toMatchObject({ kind: "declined" });
  });

  it("marks gateway and configuration errors as failed, not declined", () => {
    expect(parseDebitResponse({ StatusCode: "306" }, 45000).kind).toBe("failed");
    expect(parseDebitResponse({ StatusCode: "501" }, 45000).kind).toBe("failed");
    expect(parseDebitResponse({ StatusCode: "599" }, 45000).kind).toBe("failed");
  });

  it("treats a duplicate transaction as unknown, because the first one may have captured", () => {
    expect(parseDebitResponse({ StatusCode: "308" }, 45000).kind).toBe("unknown");
  });

  it("treats a response without a status as unknown", () => {
    expect(parseDebitResponse({}, 45000).kind).toBe("unknown");
    expect(parseDebitResponse(null, 45000).kind).toBe("unknown");
    expect(parseDebitResponse("<html>", 45000).kind).toBe("unknown");
  });

  it("accepts a numeric status code", () => {
    expect(parseDebitResponse({ ...approved(), StatusCode: 0 }, 45000).kind).toBe("approved");
  });
});
