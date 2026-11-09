import { describe, expect, it } from "vitest";
import {
  buildInitRequest,
  declineMessage,
  feedbackIds,
  isPelecardPageUrl,
  judgePagePayment,
  pageCardBrand,
  parseInitResponse,
  parsePageTransaction,
  parseValidateResponse,
  type PageTransaction,
} from "../pelecard-page-mapping";

const SITE = "https://www.edengarden.co.il";
const ORDER_ID = "3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c";

/**
 * Shaped like GetTransaction's documented example (Services guide page 18,
 * Iframe guide page 9), adjusted to the test order. Documented, not yet
 * observed: replace with a real answer after the first live payment.
 */
const DOCUMENTED_TX = {
  StatusCode: "000",
  ErrorMessage: "operation success",
  ResultData: {
    TransactionId: "1a111c-1d1f6g-9h8j",
    ShvaResult: "000",
    AdditionalDetailsParamX: "3f2b8c1e9a4d4e21b7c",
    token: "",
    DebitApproveNumber: "0155995",
    ConfirmationKey: "51053a8812319fb",
    VoucherId: "62-001-058",
    TransactionPelecardId: 103059585,
    CardHolderID: "123456789",
    CardHolderName: "",
    CardHolderEmail: "",
    CardHolderPhone: "",
    ShvaFileNumber: "62",
    StationNumber: "1",
    Reciept: "58",
    JParam: "4",
    CreditCardNumber: "45******4580",
    CreditCardExpDate: "1218",
    CreditCardCompanyClearer: "2",
    CreditCardCompanyIssuer: "2",
    CreditCardStarsDiscountTotal: "0",
    CreditType: "1",
    CreditCardAbroadCard: 1,
    DebitType: "1",
    DebitCode: "50",
    DebitTotal: "44950",
    DebitCurrency: "1",
    TotalPayments: "0",
    FirstPaymentTotal: "0",
    FixedPaymentTotal: "0",
    CreditCardBrand: "2",
    CardHebName: "ויזה",
    shvaOutput: "0000000000045******45802200021214000000010000000000",
    ApprovedBy: "3",
    CallReason: "2",
    TransactionInitTime: "01/01/2015 15:00:59",
    TransactionUpdateTime: "01/01/2015 15:01:08",
  },
};

describe("buildInitRequest", () => {
  const order = { id: "3f2b8c1e-9a4d-4e21-b7c6-0d5e8f9a1b2c", amountIls: 449.5, maxInstallments: 3 };
  const body = buildInitRequest(order, { terminal: "t", user: "u", password: "p" }, SITE);

  it("sends the total in agorot and binds the page to the order", () => {
    expect(body.Total).toBe("44950");
    expect(body.Currency).toBe("1");
    expect(body.ActionType).toBe("J4");
    expect(body.UserKey).toBe(order.id);
    expect(body.ParamX).toBe("3f2b8c1e9a4d4e21b7c");
  });

  it("returns to our site on the top window and calls our webhook", () => {
    expect(body.GoodURL).toBe(`${SITE}/join/pay/${order.id}/return`);
    expect(body.ErrorURL).toBe(body.GoodURL);
    expect(body.FeedbackOnTop).toBe("True");
    expect(body.FeedbackDataTransferMethod).toBe("GET");
    expect(body.ServerSideGoodFeedbackURL).toBe(`${SITE}/api/webhooks/pelecard`);
    expect(body.ServerSideErrorFeedbackURL).toBe(body.ServerSideGoodFeedbackURL);
    expect(body).not.toHaveProperty("CancelURL");
  });

  it("offers regular installments up to the order's cap, never credit", () => {
    expect(body.MaxPayments).toBe("3");
    expect(body.MinPayments).toBe("1");
    expect(body.FirstPayment).toBe("auto");
    expect(Number(body.MinPaymentsForCredit)).toBeGreaterThan(3);
  });

  it("asks for ID and CVV, hides name, email and phone, in Hebrew with our look", () => {
    expect(body).toMatchObject({
      Language: "HE",
      CustomerIdField: "must",
      Cvv2Field: "must",
      CardHolderName: "hide",
      EmailField: "hide",
      TelField: "hide",
    });
    expect(body.CssURL).toBe(`${SITE}/pelecard/payment-page.css`);
    expect(body.LogoURL).toBe(`${SITE}/logo-transparent.png`);
  });

  it("carries the terminal credentials for the server-side call only", () => {
    expect(body).toMatchObject({ terminal: "t", user: "u", password: "p", ShopNo: "001" });
  });
});

describe("parseInitResponse", () => {
  it("reads Pelecard's real refusal (JSON sent as text/html)", () => {
    const text =
      '{"URL":"","ConfirmationKey":"","Error":{"ErrCode":503,"ErrMsg":"Login for user testpelecard3 failed. Locked"}}';
    expect(parseInitResponse(text)).toEqual({
      ok: false,
      reason: "503: Login for user testpelecard3 failed. Locked",
    });
  });

  it("accepts ErrCode 0 with a Pelecard https URL", () => {
    const text = '{"URL":"https://gateway21.pelecard.biz/PaymentGW?transactionId=abc","Error":{"ErrCode":0,"ErrMsg":""}}';
    expect(parseInitResponse(text)).toEqual({
      ok: true,
      url: "https://gateway21.pelecard.biz/PaymentGW?transactionId=abc",
    });
  });

  it("refuses an empty URL, a foreign URL, and text that is not JSON", () => {
    expect(parseInitResponse('{"URL":"","Error":{"ErrCode":0}}').ok).toBe(false);
    expect(parseInitResponse('{"URL":"https://evil.example/pay","Error":{"ErrCode":0}}').ok).toBe(false);
    expect(parseInitResponse("<html>").ok).toBe(false);
  });
});

describe("isPelecardPageUrl", () => {
  it("allows only https on pelecard.biz and its subdomains", () => {
    expect(isPelecardPageUrl("https://gateway20.pelecard.biz/PaymentGW?x=1")).toBe(true);
    expect(isPelecardPageUrl("http://gateway20.pelecard.biz/PaymentGW")).toBe(false);
    expect(isPelecardPageUrl("https://pelecard.biz.evil.example/")).toBe(false);
    expect(isPelecardPageUrl("https://evilpelecard.biz/")).toBe(false);
    expect(isPelecardPageUrl("not a url")).toBe(false);
  });
});

describe("declineMessage", () => {
  it("explains known codes and falls back to a generic decline", () => {
    expect(declineMessage("036")).toContain("תוקף");
    expect(declineMessage("301")).toContain("הזמן");
    expect(declineMessage("123")).toBe(declineMessage(null));
  });
});

describe("parsePageTransaction", () => {
  it("reads the fields we need and stores nothing personal", () => {
    const parsed = parsePageTransaction(DOCUMENTED_TX);
    expect(parsed.ok && parsed.tx).toMatchObject({
      transactionId: "1a111c-1d1f6g-9h8j",
      pelecardId: "103059585",
      shvaResult: "000",
      totalAgorot: 44950,
      currency: "1",
      paramX: "3f2b8c1e9a4d4e21b7c",
      confirmationKey: "51053a8812319fb",
      approvalNumber: "0155995",
      last4: "4580",
      brand: "visa",
      installments: 1,
    });
    const raw = parsed.ok ? parsed.tx.raw : {};
    for (const key of ["CreditCardNumber", "CardHolderID", "shvaOutput", "ConfirmationKey", "CreditCardExpDate"]) {
      expect(raw).not.toHaveProperty(key);
    }
    expect(raw).toHaveProperty("TransactionPelecardId", 103059585);
  });

  it("fails on a non-000 StatusCode without ResultData, or a non-object", () => {
    expect(parsePageTransaction({ StatusCode: "501", ErrorMessage: "x" }).ok).toBe(false);
    expect(parsePageTransaction("x").ok).toBe(false);
    expect(parsePageTransaction({ StatusCode: "000", ResultData: { ShvaResult: "000" } }).ok).toBe(false);
  });

  it("counts installments only above one payment", () => {
    const split = { ...DOCUMENTED_TX, ResultData: { ...DOCUMENTED_TX.ResultData, TotalPayments: "3" } };
    const parsed = parsePageTransaction(split);
    expect(parsed.ok && parsed.tx.installments).toBe(3);
  });
});

describe("parseValidateResponse", () => {
  it("reads 1, 0, quoted or JSON numbers, and anything else as an error", () => {
    expect(parseValidateResponse("1")).toBe("valid");
    expect(parseValidateResponse('"1"\n')).toBe("valid");
    expect(parseValidateResponse("0")).toBe("invalid");
    expect(parseValidateResponse(" 0 ")).toBe("invalid");
    expect(parseValidateResponse("<html>")).toBe("error");
    expect(parseValidateResponse("")).toBe("error");
  });
});

describe("pageCardBrand", () => {
  it("maps Pelecard brand and issuer codes", () => {
    expect(pageCardBrand("2", "2")).toBe("visa");
    expect(pageCardBrand("1", "1")).toBe("mastercard");
    expect(pageCardBrand("3", "6")).toBe("mastercard");
    expect(pageCardBrand("5", "1")).toBe("isracard");
    expect(pageCardBrand("0", "1")).toBe("isracard");
    expect(pageCardBrand("0", "4")).toBe("amex");
    expect(pageCardBrand(0, 3)).toBe("diners");
    expect(pageCardBrand(null, null)).toBe("unknown");
  });
});

describe("judgePagePayment", () => {
  const order = { id: ORDER_ID, amountIls: 449.5 };
  const parsed = parsePageTransaction(DOCUMENTED_TX);
  if (!parsed.ok) throw new Error("fixture must parse");
  const tx = (overrides: Partial<PageTransaction>): PageTransaction => ({ ...parsed.tx, ...overrides });

  it("asks for validation before calling a clean approval paid", () => {
    expect(judgePagePayment(tx({}), order, "not_checked")).toEqual({ kind: "needs_validation" });
    expect(judgePagePayment(tx({}), order, "valid")).toEqual({ kind: "paid" });
  });

  it("treats a readable non-000 result as not paid", () => {
    expect(judgePagePayment(tx({ shvaResult: "036" }), order, "not_checked")).toEqual({ kind: "not_paid", code: "036" });
  });

  it("never calls a mismatch or a failed validation paid", () => {
    expect(judgePagePayment(tx({ totalAgorot: 45000 }), order, "valid").kind).toBe("unknown");
    expect(judgePagePayment(tx({ totalAgorot: null }), order, "valid").kind).toBe("unknown");
    expect(judgePagePayment(tx({ currency: "2" }), order, "valid").kind).toBe("unknown");
    expect(judgePagePayment(tx({ paramX: "0000000000000000000" }), order, "valid").kind).toBe("unknown");
    expect(judgePagePayment(tx({ shvaResult: null }), order, "valid").kind).toBe("unknown");
    expect(judgePagePayment(tx({}), order, "invalid").kind).toBe("unknown");
    expect(judgePagePayment(tx({}), order, "error").kind).toBe("unknown");
  });
});

describe("feedbackIds", () => {
  it("reads the return URL's query", () => {
    expect(
      feedbackIds(new URLSearchParams({ PelecardTransactionId: "abc", PelecardStatusCode: "036", UserKey: ORDER_ID })),
    ).toEqual({ orderId: ORDER_ID, transactionId: "abc", statusCode: "036" });
  });

  it("reads a raw JSON callback body, nested or flat, any key casing", () => {
    const nested = feedbackIds(JSON.stringify({ ResultData: { TransactionId: "abc", UserKey: ORDER_ID, ShvaResult: "000" } }));
    expect(nested).toEqual({ orderId: ORDER_ID, transactionId: "abc", statusCode: "000" });
    expect(feedbackIds(JSON.stringify({ transactionid: "abc", userkey: ORDER_ID })).orderId).toBe(ORDER_ID);
  });

  it("reads JSON wrapped in a single form field", () => {
    const body = `data=${encodeURIComponent(JSON.stringify({ TransactionId: "abc", UserKey: ORDER_ID }))}`;
    expect(feedbackIds(body).transactionId).toBe("abc");
  });

  it("drops a UserKey that is not a uuid, and survives an empty body", () => {
    expect(feedbackIds(JSON.stringify({ TransactionId: "abc", UserKey: "x" })).orderId).toBeNull();
    expect(feedbackIds("")).toEqual({ orderId: null, transactionId: null, statusCode: null });
  });
});
