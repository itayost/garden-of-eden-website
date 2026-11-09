import { describe, expect, it } from "vitest";
import {
  buildInitRequest,
  declineMessage,
  isPelecardPageUrl,
  parseInitResponse,
} from "../pelecard-page-mapping";

const SITE = "https://www.edengarden.co.il";

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
